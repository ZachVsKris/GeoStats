"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchPlayableCategoryCatalog } from "../lib/playableCatalog";
import { fetchCountries, type CountryInfo } from "../lib/worldBank";
import { SOURCE_REGISTRY } from "../lib/sourceRegistry";
import { formatValue, poolLeaderboard, scorePlacements } from "../lib/dataEngine";
import { decodeRound, deserializeRound, type Round, type RoundCategory, type RoundSnapshot } from "../lib/challengeCodec";
import AccountControls from "./AccountControls";
import CategorySourcePanel from "./CategorySourcePanel";
import { newYorkDate } from "../lib/time";
import { DAILY_DIFFICULTIES, DEFAULT_DIFFICULTY, ROUND_CONFIGS, type DailyDifficulty, difficultyFromPath } from "../lib/gameRules";
import { trackAnalytics } from "../lib/analytics";
import { DATASET_VERSION, RULES_VERSION } from "../lib/version";

type Assignment = Record<string, string>;
type ScoreRow = {
  category: RoundCategory;
  country: CountryInfo;
  rank: number;
  globalRank: number;
  points: number;
  value: number;
  best: CountryInfo;
  bestValue: number;
  bestGlobalRank: number;
};
type SavedDailyScore = {
  assignments: Assignment;
  completed_at?: string;
};
type GeoSecondComingGameProps = {
  initialDifficulty?: DailyDifficulty;
  mode?: "daily" | "random";
};
type DailyTrio = Record<DailyDifficulty, Round>;

type PackedApiBoard = { seed?: string; encoded_board?: string; board_payload?: RoundSnapshot };
type DailyApiPayload = Partial<Record<DailyDifficulty, PackedApiBoard>> & {
  error?: string;
  generating?: boolean;
  retryAfter?: number;
  fallback?: boolean;
  fallback_date?: string;
  warning?: string;
};

function dailyBrowserCacheKey(date: string) {
  return `geostats:daily-trio:${DATASET_VERSION}:${date}`;
}

function readCachedDaily(date: string): DailyApiPayload | null {
  try {
    const raw = window.localStorage.getItem(dailyBrowserCacheKey(date));
    return raw ? JSON.parse(raw) as DailyApiPayload : null;
  } catch {
    return null;
  }
}

function writeCachedDaily(date: string, payload: DailyApiPayload) {
  try {
    window.localStorage.setItem(dailyBrowserCacheKey(date), JSON.stringify(payload));
  } catch {
    // Browser storage is an optimization only.
  }
}

function clearCachedDaily(date: string) {
  try {
    window.localStorage.removeItem(dailyBrowserCacheKey(date));
  } catch {
    // Ignore browsers that disable local storage.
  }
}

function normalizeRandomSeed(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
}

function createRandomSeed() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function dailySeed(difficulty: DailyDifficulty, date = new Date()) {
  return `DAILY-${difficulty.toUpperCase()}-${newYorkDate(date)}`;
}

function dailyDateFromSeed(value: string) {
  const match = value.match(/(\d{4}-\d{2}-\d{2})$/);
  return match?.[1] ?? newYorkDate();
}

function roundMatchesDifficulty(round: Round, difficulty: DailyDifficulty) {
  const config = ROUND_CONFIGS[difficulty];
  return round.categories.length === config.categoryCount && round.bank.length === config.countryCount;
}

function shortCountryName(name: string) {
  const aliases: Record<string, string> = {
    "United Arab Emirates": "UAE", "United States": "USA", "United Kingdom": "UK",
    "Gambia, The": "Gambia", "Bahamas, The": "Bahamas", "Russian Federation": "Russia",
    "Venezuela, RB": "Venezuela", "Egypt, Arab Rep.": "Egypt", "Iran, Islamic Rep.": "Iran",
    "Yemen, Rep.": "Yemen", "Kyrgyz Republic": "Kyrgyzstan", "Slovak Republic": "Slovakia",
    "Korea, Rep.": "South Korea", "Korea, Dem. People's Rep.": "North Korea",
    "Congo, Dem. Rep.": "DR Congo", "Congo, Rep.": "Congo", "Lao PDR": "Laos",
    "West Bank and Gaza": "West Bank & Gaza", "Micronesia, Fed. Sts.": "Micronesia",
    "St. Vincent and the Grenadines": "St. Vincent", "Antigua and Barbuda": "Antigua",
    "Trinidad and Tobago": "Trinidad & Tobago", "Bosnia and Herzegovina": "Bosnia & Herz.",
    "Central African Republic": "Central African Rep.", "Dominican Republic": "Dominican Rep.",
    "Equatorial Guinea": "Eq. Guinea", "Papua New Guinea": "Papua N. Guinea",
    "São Tomé and Príncipe": "São Tomé",
  };
  return aliases[name] ?? name;
}

function ordinal(rank: number) {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  const suffix = rank % 10 === 1 ? "st" : rank % 10 === 2 ? "nd" : rank % 10 === 3 ? "rd" : "th";
  return `${rank}${suffix}`;
}

function buildScoreRows(round: Round, assignments: Assignment): ScoreRow[] {
  return scorePlacements(round.categories, round.bank, assignments).map(({ dataset, selected, best }) => ({
    category: dataset,
    country: selected.country,
    rank: selected.poolRank,
    globalRank: selected.observation.globalRank,
    points: selected.points,
    value: selected.observation.value,
    best: best.country,
    bestValue: best.observation.value,
    bestGlobalRank: best.observation.globalRank,
  })).sort((left, right) => right.points - left.points);
}



export default function GeoSecondComingGame({ initialDifficulty = DEFAULT_DIFFICULTY, mode = "daily" }: GeoSecondComingGameProps = {}) {
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [assignments, setAssignments] = useState<Assignment>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreRow[] | null>(null);
  const [status, setStatus] = useState("Loading official country data…");
  const [error, setError] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [seed, setSeed] = useState("");
  const [seedInput, setSeedInput] = useState("");
  const [difficulty, setDifficulty] = useState<DailyDifficulty>(initialDifficulty);
  const [copied, setCopied] = useState(false);
  const [savedCompletion, setSavedCompletion] = useState(false);
  const [fallbackPractice, setFallbackPractice] = useState(false);
  const [boardNotice, setBoardNotice] = useState("");
  const [openLeaderboard, setOpenLeaderboard] = useState<string | null>(null);
  const [sourceDataset, setSourceDataset] = useState<RoundCategory | null>(null);
  const [touchDrag, setTouchDrag] = useState<{ countryId: string; x: number; y: number; targetCategoryId: string | null } | null>(null);
  const touchStart = useRef<{ countryId: string; x: number; y: number } | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackedRounds = useRef(new Set<string>());

  const used = useMemo(() => new Set(Object.values(assignments)), [assignments]);
  const activeConfig = ROUND_CONFIGS[difficulty];
  const categoryTarget = round?.categories.length ?? activeConfig.categoryCount;
  const poolSize = round?.bank.length ?? activeConfig.countryCount;
  const roundMaxScore = activeConfig.maxScore;
  const topFinishRank = activeConfig.topFinishRank;
  const unusedCount = Math.max(0, poolSize - categoryTarget);
  const isRandom = mode === "random";
  const isUnranked = isRandom || fallbackPractice;

  useEffect(() => {
    if (!round) return;
    const signature = `${isRandom ? "random" : "daily"}:${difficulty}:${seed}:${round.categories.map((item) => item.category.id).join(",")}`;
    if (trackedRounds.current.has(signature)) return;
    trackedRounds.current.add(signature);
    trackAnalytics("game_started", {
      difficulty,
      challengeDate: isRandom ? undefined : dailyDateFromSeed(seed),
      metadata: { mode: isRandom ? "random" : "daily", countryCount: round.bank.length, categoryCount: round.categories.length },
    });
  }, [round, difficulty, seed, isRandom]);

  useEffect(() => {
    if (!sourceDataset) return;
    trackAnalytics("source_opened", {
      difficulty,
      challengeDate: isRandom ? undefined : dailyDateFromSeed(seed),
      metadata: { categoryId: sourceDataset.category.id, source: sourceDataset.category.source },
    });
  }, [sourceDataset, difficulty, seed, isRandom]);

  function challengeUrl(nextDifficulty = difficulty, nextSeed = seed) {
    const path = isRandom ? ROUND_CONFIGS[nextDifficulty].randomPath : ROUND_CONFIGS[nextDifficulty].path;
    const url = new URL(path, window.location.origin);
    if (isRandom && nextSeed) url.searchParams.set("seed", nextSeed);
    return url.toString();
  }

  function syncUrl(nextDifficulty: DailyDifficulty, nextSeed = seed) {
    window.history.replaceState({}, "", challengeUrl(nextDifficulty, nextSeed));
  }

  function resetRoundState(nextSeed: string, nextDifficulty: DailyDifficulty) {
    setError("");
    setRound(null);
    setScores(null);
    setAssignments({});
    setSelected(null);
    setSelectedCategory(null);
    setCopied(false);
    setSavedCompletion(false);
    setFallbackPractice(false);
    setBoardNotice("");
    setSeed(nextSeed);
    setDifficulty(nextDifficulty);
  }

  async function restoreSavedCompletion(activeRound: Round, nextDifficulty: DailyDifficulty, challengeDate: string) {
    try {
      const params = new URLSearchParams({ challengeDate, difficulty: nextDifficulty });
      const response = await fetch(`/api/scores?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) return false;
      const data = await response.json().catch(() => null) as {
        completed?: boolean;
        result?: SavedDailyScore | null;
      } | null;
      const savedAssignments = data?.completed ? data.result?.assignments : null;
      if (!savedAssignments || Object.keys(savedAssignments).length !== activeRound.categories.length) return false;
      const categoryIds = new Set(activeRound.categories.map((dataset) => dataset.category.id));
      const countryIds = new Set(activeRound.bank.map((country) => country.id));
      if (Object.entries(savedAssignments).some(([categoryId, countryId]) => !categoryIds.has(categoryId) || !countryIds.has(countryId))) return false;
      const restoredRows = buildScoreRows(activeRound, savedAssignments);
      setAssignments(savedAssignments);
      setScores(restoredRows);
      setSavedCompletion(true);
      return true;
    } catch {
      // A score-status lookup should never prevent the Daily board from loading.
      return false;
    }
  }

  async function restorePackedBoard(packed: PackedApiBoard, existingCountries: CountryInfo[]) {
    if (packed.board_payload) return deserializeRound(packed.board_payload);
    if (packed.encoded_board) {
      const categoryCatalog = await fetchPlayableCategoryCatalog();
      return decodeRound(packed.encoded_board, existingCountries, categoryCatalog);
    }
    throw new Error("The server did not return a complete board.");
  }

  async function loadDailyRound(nextDifficulty: DailyDifficulty, existingCountries = countries) {
    const date = newYorkDate();
    const nextSeed = dailySeed(nextDifficulty);
    resetRoundState(nextSeed, nextDifficulty);
    syncUrl(nextDifficulty);
    setStatus(`Loading today’s ${ROUND_CONFIGS[nextDifficulty].label} Daily…`);

    try {
      const cached = readCachedDaily(date);
      const cachedPacked = cached?.[nextDifficulty];
      if (cachedPacked) {
        try {
          const restored = await restorePackedBoard(cachedPacked, existingCountries);
          if (!roundMatchesDifficulty(restored, nextDifficulty)) throw new Error("Cached board dimensions do not match.");
          setFallbackPractice(Boolean(cached?.fallback));
          setBoardNotice(cached?.warning ?? "");
          setRound(restored);
          setStatus("");
          if (!cached?.fallback) void restoreSavedCompletion(restored, nextDifficulty, date);
          return;
        } catch {
          clearCachedDaily(date);
        }
      }

      let saved: DailyApiPayload = {};
      let response: Response | null = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        response = await fetch(`/api/daily-trio/${date}?rules=${encodeURIComponent(RULES_VERSION)}`, { cache: "no-store" });
        saved = await response.json().catch(() => ({})) as DailyApiPayload;
        if (saved[nextDifficulty]) break;
        if (response.status !== 202) break;
        setStatus("Today’s boards are being prepared…");
        await new Promise((resolve) => window.setTimeout(resolve, Math.max(1, saved.retryAfter ?? 3) * 1000));
      }

      const packed = saved[nextDifficulty];
      if (!packed && !response?.ok) {
        throw new Error(typeof saved.error === "string" ? saved.error : "Today’s Daily board is temporarily unavailable.");
      }
      if (!packed) throw new Error(`Today’s ${ROUND_CONFIGS[nextDifficulty].label} board was not returned.`);
      const restored = await restorePackedBoard(packed, existingCountries);
      if (!roundMatchesDifficulty(restored, nextDifficulty)) {
        throw new Error(`The ${ROUND_CONFIGS[nextDifficulty].label} Daily has the wrong board dimensions.`);
      }

      writeCachedDaily(date, saved);
      setFallbackPractice(Boolean(saved.fallback));
      setBoardNotice(saved.warning ?? "");
      setRound(restored);
      setStatus("");
      if (!saved.fallback) void restoreSavedCompletion(restored, nextDifficulty, date);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Daily board could not be loaded.");
      setStatus("");
    }
  }

  async function loadRandomRound(nextDifficulty: DailyDifficulty, requestedSeed: string, existingCountries = countries) {
    const nextSeed = normalizeRandomSeed(requestedSeed) || createRandomSeed();
    resetRoundState(nextSeed, nextDifficulty);
    setSeedInput(nextSeed);
    syncUrl(nextDifficulty, nextSeed);
    setStatus(`Building ${ROUND_CONFIGS[nextDifficulty].label} seeded board…`);
    try {
      const response = await fetch(`/api/seeded/${nextDifficulty}?seed=${encodeURIComponent(nextSeed)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as PackedApiBoard & { error?: string };
      if (!response.ok) throw new Error(payload.error || "The seeded board could not be generated.");
      const generated = await restorePackedBoard(payload, existingCountries);
      if (!roundMatchesDifficulty(generated, nextDifficulty)) {
        throw new Error("The seeded board has the wrong dimensions.");
      }
      setRound(generated);
      setStatus("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The seeded board could not be generated.");
      setStatus("");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchCountries();
        setCountries(list);
        const nextDifficulty = difficultyFromPath(window.location.pathname);
        if (isRandom) {
          const requestedSeed = new URLSearchParams(window.location.search).get("seed") ?? createRandomSeed();
          await loadRandomRound(nextDifficulty, requestedSeed, list);
        } else {
          await loadDailyRound(nextDifficulty, list);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Official data could not be loaded.");
        setStatus("");
      }
    })();
  }, []);

  function retryCurrentRound() {
    if (isRandom) loadRandomRound(difficulty, seed || createRandomSeed());
    else loadDailyRound(difficulty);
  }

  function generateNewRandomRound() {
    loadRandomRound(difficulty, createRandomSeed());
  }

  function loadEnteredSeed() {
    const requested = normalizeRandomSeed(seedInput);
    if (!requested) {
      setError("Enter a seed using letters, numbers, or hyphens.");
      return;
    }
    loadRandomRound(difficulty, requested);
  }

  async function copyRandomLink() {
    try {
      await navigator.clipboard.writeText(challengeUrl(difficulty, seed));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("The link could not be copied automatically.");
    }
  }

  async function shareScore() {
    if (!scores) return;
    const firsts = scores.filter((row) => row.rank === 1).length;
    const seconds = scores.filter((row) => row.rank === 2).length;
    const thirds = scores.filter((row) => row.rank === 3).length;
    const topFinish = scores.filter((row) => row.rank <= topFinishRank).length;
    const gameLabel = isRandom ? `${ROUND_CONFIGS[difficulty].label} Test · ${seed}` : `${ROUND_CONFIGS[difficulty].label} Daily`;
    const text = `🌍 GeoStats ${gameLabel}
${total} / ${roundMaxScore}

🥇 ${firsts}   🥈 ${seconds}   🥉 ${thirds}
⭐ Top ${topFinishRank}: ${topFinish}/${categoryTarget}

Can you beat my score?`;
    const url = challengeUrl(difficulty, seed);

    try {
      if (navigator.share) {
        await navigator.share({ title: "GeoStats", text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n\n${url}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
      trackAnalytics("share_clicked", {
        difficulty,
        challengeDate: isRandom ? undefined : dailyDateFromSeed(seed),
        value: total,
        metadata: { mode: isRandom ? "random" : "daily" },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setError(`The score could not be shared automatically. Copy the ${isRandom ? "seed" : "Daily"} link from your browser instead.`);
    }
  }

  function clearTouchTimer() {
    if (touchTimer.current) clearTimeout(touchTimer.current);
    touchTimer.current = null;
  }

  function categoryAtPoint(x: number, y: number) {
    const element = document.elementFromPoint(x, y) as HTMLElement | null;
    return element?.closest<HTMLElement>("[data-category-id]")?.dataset.categoryId ?? null;
  }

  function beginTouch(event: React.TouchEvent, countryId: string) {
    if (used.has(countryId)) return;
    const touch = event.touches[0];
    touchStart.current = { countryId, x: touch.clientX, y: touch.clientY };
    clearTouchTimer();
    touchTimer.current = setTimeout(() => {
      setTouchDrag({ countryId, x: touch.clientX, y: touch.clientY, targetCategoryId: categoryAtPoint(touch.clientX, touch.clientY) });
      if (navigator.vibrate) navigator.vibrate(18);
    }, 120);
  }

  function moveTouch(event: React.TouchEvent) {
    const touch = event.touches[0];
    if (!touchDrag) {
      const start = touchStart.current;
      if (start && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) clearTouchTimer();
      return;
    }
    event.preventDefault();
    setTouchDrag((current) => current ? { ...current, x: touch.clientX, y: touch.clientY, targetCategoryId: categoryAtPoint(touch.clientX, touch.clientY) } : null);
  }

  function endTouch() {
    clearTouchTimer();
    if (touchDrag?.targetCategoryId) assignCountry(touchDrag.targetCategoryId, touchDrag.countryId);
    setTouchDrag(null);
    touchStart.current = null;
  }

  function assignCountry(categoryId: string, countryId: string) {
    setAssignments((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) if (next[key] === countryId) delete next[key];
      next[categoryId] = countryId;
      return next;
    });
    setSelected(null);
    setSelectedCategory(null);
  }

  function selectCountry(countryId: string) {
    if (selectedCategory) {
      assignCountry(selectedCategory, countryId);
      return;
    }
    setSelected((current) => current === countryId ? null : countryId);
  }

  function selectCategory(categoryId: string) {
    if (selected) {
      assignCountry(categoryId, selected);
      return;
    }
    setSelectedCategory((current) => current === categoryId ? null : categoryId);
  }

  function score() {
    if (!round || Object.keys(assignments).length !== categoryTarget) return;
    try {
      const scoredRows = buildScoreRows(round, assignments);
      setScores(scoredRows);
      const finalScore = scoredRows.reduce((sum, row) => sum + row.points, 0);
      trackAnalytics("game_completed", {
        difficulty,
        challengeDate: isRandom ? undefined : dailyDateFromSeed(seed),
        value: finalScore,
        metadata: {
          mode: isRandom ? "random" : "daily",
          averagePlacement: scoredRows.reduce((sum, row) => sum + row.rank, 0) / scoredRows.length,
          categoryCount: scoredRows.length,
        },
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The round could not be scored consistently.");
    }
  }

  const total = scores?.reduce((sum, row) => sum + row.points, 0) ?? 0;
  const averagePlacement = scores?.length
    ? (scores.reduce((sum, row) => sum + row.rank, 0) / scores.length).toFixed(1)
    : "0.0";
  const bestPossibleCount = scores?.filter((row) => row.rank === 1).length ?? 0;
  const topFinishCount = scores?.filter((row) => row.rank <= topFinishRank).length ?? 0;

  return <div className={`shell ${!scores ? "activePlay" : ""} ${status ? "loadingPlay" : ""} ${error ? "errorPlay" : ""} ${scores ? "resultsView" : ""} ${difficulty}Round ${difficulty === "expert" ? "expertRound" : ""} ${difficulty === "easy" ? "compactRound" : ""}`}>
    {!scores && <header>
      <div className="brand"><span className="logo">🌍</span><div><h1>GeoStats</h1><p>Geography, with strategy.</p></div></div>
      <div className="headerButtons desktopHeaderButtons">
        <a href="/audit" className="headerLink">Data audit</a>
        <button onClick={() => setShowRules(true)}>How it works</button>
        <a href="/daily" className={`dailyModeButton ${!isRandom ? "active" : ""}`}>Daily</a>
        <a href="/random" className={`dailyModeButton ${isRandom ? "active" : ""}`}>Seeded</a>
        <a href={isRandom ? ROUND_CONFIGS.easy.randomPath : ROUND_CONFIGS.easy.path} className={`dailyModeButton ${difficulty === "easy" ? "active" : ""}`}>Scout</a>
        <a href={isRandom ? ROUND_CONFIGS.normal.randomPath : ROUND_CONFIGS.normal.path} className={`dailyModeButton ${difficulty === "normal" ? "active" : ""}`}>Adventurer</a>
        <a href={isRandom ? ROUND_CONFIGS.expert.randomPath : ROUND_CONFIGS.expert.path} className={`dailyModeButton ${difficulty === "expert" ? "active" : ""}`}>Expert</a>
        {!isRandom && <AccountControls difficulty={difficulty} />}
      </div>
      <details className="mobileMenu"><summary>Menu</summary><div>
        <a href="/audit">Data audit</a><button onClick={() => setShowRules(true)}>How it works</button>
        <a href={isRandom ? "/daily" : "/random"}>{isRandom ? "Daily" : "Seeded"}</a>
        {!isRandom && <AccountControls difficulty={difficulty} />}
      </div></details>
    </header>}

    <section className={`challengeBar ${isRandom ? "randomChallengeBar" : ""}`}>
      <div><span className="kicker">{isRandom ? `${ROUND_CONFIGS[difficulty].label} Random Test · Unranked` : `${ROUND_CONFIGS[difficulty].label} Daily`}</span><strong>{isRandom ? seed : dailyDateFromSeed(seed)}</strong></div>
      <div className="challengeActions">
        {isRandom && <div className="seedControls">
          <label><span>Seed</span><input value={seedInput} onChange={(event) => setSeedInput(normalizeRandomSeed(event.target.value))} onKeyDown={(event) => event.key === "Enter" && loadEnteredSeed()} aria-label="Random seed" /></label>
          <button onClick={loadEnteredSeed}>Load seed</button>
          <button onClick={generateNewRandomRound}>New seed</button>
          <button onClick={copyRandomLink}>{copied ? "Link copied ✓" : "Copy link"}</button>
        </div>}
        <span className="mobileProgress">{Object.keys(assignments).length}/{categoryTarget} assigned</span>
        {scores && <button className="resultsRulesLink" onClick={() => setShowRules(true)}>Rules</button>}
      </div>
    </section>
    {!scores && <><nav className="mobileModeTabs" aria-label="Game difficulty">
      <a href={isRandom ? ROUND_CONFIGS.easy.randomPath : ROUND_CONFIGS.easy.path} className={difficulty === "easy" ? "active" : ""}>Scout</a>
      <a href={isRandom ? ROUND_CONFIGS.normal.randomPath : ROUND_CONFIGS.normal.path} className={difficulty === "normal" ? "active" : ""}>Adventurer</a>
      <a href={isRandom ? ROUND_CONFIGS.expert.randomPath : ROUND_CONFIGS.expert.path} className={difficulty === "expert" ? "active" : ""}>Expert</a>
    </nav><div className="mobileGameSummary"><strong>{ROUND_CONFIGS[difficulty].label}</strong><span>{poolSize} countries · {categoryTarget} measures · leave {unusedCount}</span></div></>}
    {boardNotice && <div className="boardNotice">{boardNotice}</div>}

    {!scores && <section className="hero desktopHero">
      <div><span className="kicker">A strategy atlas</span><h2>{poolSize} countries. {categoryTarget} measures. One perfect allocation.</h2><p>Place {categoryTarget} countries, leave {unusedCount === 1 ? "one" : unusedCount} behind, and make every specialist count.</p></div>
      <aside><strong>{Object.keys(assignments).length}/{categoryTarget}</strong><span>categories assigned</span></aside>
    </section>}

    {status && <div className="loading"><div className="spinner"/><strong>{status}</strong><span>Official datasets can take a few seconds to load the first time.</span></div>}
    {error && <div className="error"><strong>Couldn’t load this board.</strong><span>{error}</span><button onClick={retryCurrentRound}>Check again</button></div>}

    {round && !scores && <main className={`grid playGrid ${selected ? "holdingCountry" : ""} ${selectedCategory ? "choosingCountry" : ""}`}>
      <section className="panel bankPanel"><div className="panelTitle"><div><span className="kicker">Country bank</span><h3>Choose your {categoryTarget}</h3></div><small>{unusedCount === 1 ? "One will remain unused" : `${unusedCount} will remain unused`}</small></div>
        <div className="countries">{round.bank.map((country) => <button key={country.id} draggable={!used.has(country.id)} onDragStart={(event)=>event.dataTransfer.setData("text/plain", country.id)} onTouchStart={(event)=>beginTouch(event,country.id)} onTouchMove={moveTouch} onTouchEnd={endTouch} onTouchCancel={endTouch} className={`country ${selected===country.id?"selected":""} ${selectedCategory&&!used.has(country.id)?"categoryTarget":""} ${used.has(country.id)?"used":""}`} aria-pressed={selected===country.id} disabled={used.has(country.id)} onClick={() => selectCountry(country.id)}><span>{country.flag}</span><div><strong title={country.name}><span className="desktopCountryName">{country.name}</span><span className="mobileCountryName">{shortCountryName(country.name)}</span></strong></div>{used.has(country.id)&&<b>USED</b>}</button>)}</div>
      </section>
      <div className="boardSpine" aria-hidden="true"/>
      <section className="panel boardPanel"><div className="panelTitle"><div><span className="kicker">The atlas</span><h3>Match countries to measures</h3></div><small>One use per country</small></div>
        <div className="slots">{round.categories.map((dataset, index) => { const c = round.bank.find((x)=>x.id===assignments[dataset.category.id]); return <button key={dataset.category.id} data-category-id={dataset.category.id} className={`slot theme-${dataset.category.family.toLowerCase().replace(/[^a-z0-9]+/g,"-")} ${c?"assigned":""} ${selected&&!c?"target":""} ${selectedCategory===dataset.category.id?"selectedCategory":""} ${touchDrag?.targetCategoryId===dataset.category.id?"touchTarget":""}`} aria-pressed={selectedCategory===dataset.category.id} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();const dropped=event.dataTransfer.getData("text/plain");if(dropped)assignCountry(dataset.category.id,dropped)}} onClick={()=>selectCategory(dataset.category.id)}><span className="cornerNotch" aria-hidden="true"/><div className="category"><span>{dataset.category.icon}</span><div><strong>{dataset.category.name}</strong><small>{dataset.category.boardDescription ?? dataset.category.description}</small></div><b className="slotNumber">{String(index + 1).padStart(2, "0")}</b></div><div className={`choice ${c?"filled":""}`}>{c?<><span className="pieceFlag">{c.flag}</span><strong className="pieceName">{c.name}</strong><i className="removePiece" aria-label={`Remove ${c.name} from ${dataset.category.name}`} title="Remove country" onClick={(e)=>{e.stopPropagation();setAssignments((a)=>{const n={...a};delete n[dataset.category.id];return n;});setSelectedCategory(null);}}>×</i></>:<em>{selected?"Place selected country":selectedCategory===dataset.category.id?"Now choose a country":"Select a country"}</em>}</div></button>})}</div>
        <div className="lock"><span>{categoryTarget-Object.keys(assignments).length>0?`${categoryTarget-Object.keys(assignments).length} selections remaining`:"Draft complete"}</span><button disabled={Object.keys(assignments).length!==categoryTarget} onClick={score}>Lock in draft</button></div>
      </section>
    </main>}

    {round && scores && <section className="panel results"><div className="score"><span>Final score</span>{savedCompletion && <p className="savedDailyNotice">Completed earlier today. This is the score saved to your account.</p>}<div className="scoreValue"><strong>{total}</strong><b>/ {roundMaxScore}</b></div><div className="scoreInsights"><div><strong>{averagePlacement}</strong><span>Average placement</span></div><div><strong>{bestPossibleCount}</strong><span>Best possible</span></div><div><strong>{topFinishCount}/{categoryTarget}</strong><span>Top {topFinishRank}</span></div></div><div className="scoreBreakdown">{[1,2,3].map((rank)=><span key={rank}>{rank===1?"🥇":rank===2?"🥈":"🥉"} {scores.filter((row)=>row.rank===rank).length}</span>)}</div><p>{total>=roundMaxScore*.8125?"Elite allocation.":total>=roundMaxScore*.65?"Strong draft with room to optimize.":"A few specialists were spent in the wrong places."}</p><div className="scoreActions"><button className="shareScore" onClick={shareScore}>{copied ? "Score copied ✓" : "Share score"}</button>{isUnranked ? (isRandom ? <button onClick={generateNewRandomRound}>Generate another board</button> : <span className="unrankedNotice">Practice board · score not saved</span>) : <AccountControls results difficulty={difficulty} pendingScore={savedCompletion ? undefined : { challengeDate: dailyDateFromSeed(seed), difficulty, assignments }} />}</div></div>
      <div className="resultsHeading"><div><span className="kicker">Your placements</span><h3>Placement and points earned</h3></div><small>Open a ranking to compare all {poolSize} countries</small></div>
      {scores.map((row)=>{ const leaderboard=poolLeaderboard(row.category,round.bank); return <div className={`resultWrap theme-${row.category.category.family.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`} key={row.category.category.id}><div className="result"><div className="resultMain"><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small className="statTip" tabIndex={0}>{row.country.flag} {row.country.name} · {formatValue(row.value,row.category.category)} · {row.category.byCountry.get(row.country.id)?.year}<span className="tooltip">#{row.globalRank} globally<br/>Actual value: {formatValue(row.value,row.category.category)}<br/>Source: {SOURCE_REGISTRY[row.category.category.source].name}<br/><button className="inlineSourceButton" onClick={(e)=>{e.stopPropagation();setSourceDataset(row.category)}}>Data & Source</button></span></small></div></div><div className="placementSummary"><b>{ordinal(row.rank)} of {poolSize}</b><strong>{row.points} pts earned</strong>{row.rank===1&&<span>Best possible</span>}</div><button className="leaderboardButton" onClick={()=>setOpenLeaderboard(openLeaderboard===row.category.category.id?null:row.category.category.id)} aria-expanded={openLeaderboard===row.category.category.id}>{openLeaderboard===row.category.category.id?"Hide rankings":"View rankings"}</button></div>{openLeaderboard===row.category.category.id&&<div className="leaderboard"><div className="leaderboardHeader"><div className="leaderboardTitle"><h4>{row.category.category.name}</h4><span>All {poolSize} countries</span></div><div className="leaderboardSource"><span className="sourceBadge">{row.category.category.source === "worldbank" ? "World Bank" : SOURCE_REGISTRY[row.category.category.source].name}</span><button className="sourceDetailsButton" onClick={(e)=>{e.stopPropagation();setSourceDataset(row.category)}}>Data & Source</button></div></div>{leaderboard.map(item=><div key={item.country.id} className={item.country.id===row.country.id?"current":""}><b>#{item.poolRank}</b><span>{item.country.flag} {item.country.name}</span><span>{formatValue(item.observation.value,row.category.category)}</span><small>{item.observation.year}</small><strong>{item.points} pts</strong></div>)}</div>}</div>})}
      <div className="perfect"><div className="resultsHeading"><div><span className="kicker">🏆 Perfect Round</span><h3>The optimal allocation</h3></div><small>Each category’s best country among these {poolSize}</small></div>
      <div className="perfectGrid">{scores.map((row)=><div className="perfectRow" key={`perfect-${row.category.category.id}`}><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small className="statTip" tabIndex={0}>{row.best.flag} {row.best.name} · {formatValue(row.bestValue,row.category.category)}<span className="tooltip">#{row.bestGlobalRank} globally<br/>Actual value: {formatValue(row.bestValue,row.category.category)}<br/>Source: {SOURCE_REGISTRY[row.category.category.source].name}<br/><button className="inlineSourceButton" onClick={(e)=>{e.stopPropagation();setSourceDataset(row.category)}}>Data & Source</button></span></small></div><b>100 pts</b></div>)}</div></div>
      <div className="lock"><span>Maximum score: {roundMaxScore}{isUnranked ? " · Unranked" : ""}</span><div className="resultActions"><a className="resultModeLink" href={isRandom ? ROUND_CONFIGS.easy.randomPath : ROUND_CONFIGS.easy.path}>Scout {isRandom ? "Random" : "Daily"}</a><a className="resultModeLink" href={isRandom ? ROUND_CONFIGS.normal.randomPath : ROUND_CONFIGS.normal.path}>Adventurer {isRandom ? "Random" : "Daily"}</a><a className="resultModeLink" href={isRandom ? ROUND_CONFIGS.expert.randomPath : ROUND_CONFIGS.expert.path}>Expert {isRandom ? "Random" : "Daily"}</a></div></div></section>}

    {touchDrag && round && <div className="touchGhost" style={{ left: touchDrag.x, top: touchDrag.y }}><span>{round.bank.find((country)=>country.id===touchDrag.countryId)?.flag}</span><strong>{round.bank.find((country)=>country.id===touchDrag.countryId)?.name}</strong></div>}

    {!scores && <section className="dataNote"><strong>Atlas index · trusted category library</strong><p><a href="/data">Data & methodology</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p><p>Population, economy, land, agriculture, energy, health, education, labor, trade, displacement, transport, technology, and environment. Approved categories draw from the World Bank, FAOSTAT, WHO, UNESCO UIS, ILOSTAT, Natural Earth, UN Comtrade, UNHCR, and the U.S. EIA. New source data stays out of play until it passes automated quality, provenance, credibility, and duplicate checks.</p></section>}

    {sourceDataset && <CategorySourcePanel dataset={sourceDataset} boardCountryIds={round?.bank.map((country) => country.id) ?? []} onClose={()=>setSourceDataset(null)} />}

    {showRules&&<div className="modal" onClick={(e)=>e.currentTarget===e.target&&setShowRules(false)}><div><h2>How GeoStats works</h2><p><strong>{isRandom ? "Choose a test difficulty:" : "Progress through the Dailies:"}</strong> Scout has 5 countries and 4 categories, Adventurer has 8 and 6, and Expert has 10 and 8.</p><ol><li><strong>Each category has a different winner.</strong> Among today’s countries, every category’s #1 country is unique.</li><li><strong>No tied values on the board.</strong> Countries in the same round always show distinct values for every category.</li><li><strong>Match countries to categories.</strong> Assign one country to each category, and use each country only once.</li><li><strong>Score as many points as possible.</strong> Higher-ranked countries earn more points. A perfect game matches every category with its #1 country.</li></ol><p>{isRandom ? "Random tests are unranked, repeatable, and reproducible from the seed in the URL." : "New Scout, Adventurer, and Expert challenges unlock every day."}</p><button onClick={()=>setShowRules(false)}>Start drafting</button></div></div>}
  </div>;
}
