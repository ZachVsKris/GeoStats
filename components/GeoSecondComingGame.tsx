"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchPlayableCategoryCatalog } from "../lib/playableCatalog";
import { fetchCountries, type CountryInfo } from "../lib/worldBank";
import { SOURCE_REGISTRY } from "../lib/sourceRegistry";
import { formatValue, poolLeaderboard, scorePlacements } from "../lib/dataEngine";
import { decodeRound, deserializeRound, type Round, type RoundCategory } from "../lib/challengeCodec";
import GameTools from "./GameTools";
import AccountControls from "./AccountControls";
import Brand from "./Brand";
import useGameSound from "./useGameSound";
import CategorySourcePanel from "./CategorySourcePanel";
import { newYorkDate } from "../lib/time";
import { DAILY_DIFFICULTIES, DEFAULT_DIFFICULTY, ROUND_CONFIGS, configForDifficultyDimensions, type DailyDifficulty, difficultyFromPath } from "../lib/gameRules";
import { trackAnalytics } from "../lib/analytics";
import { CATEGORY_SET_VERSION, DATASET_VERSION, PLAYER_COPY_VERSION, RULES_VERSION } from "../lib/version";
import { categoryMeasurementBadgeLabel, categoryMeasurementLabel } from "../lib/categoryMeasurement";
import type { DailyApiPayload, PackedApiBoard } from "../lib/dailyPublicPayload";
import type { Category } from "../lib/categories";
import { categoryThemeClass } from "../lib/categoryTheme";

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
type CompletionSource = "account" | "local" | null;
type LocalDailyResult = {
  challengeDate: string;
  difficulty: DailyDifficulty;
  assignments: Assignment;
  boardSignature: string;
  completedAt: string;
  rulesVersion: string;
};
type GeoSecondComingGameProps = {
  initialDifficulty?: DailyDifficulty;
  mode?: "daily" | "random";
  initialDailyDate?: string;
  initialDailyPayload?: DailyApiPayload;
};


const DAILY_FALLBACK_CACHE_TTL_MS = 5 * 60 * 1000;
const dailyMemoryCache = new Map<string, DailyApiPayload>();
const dailyRequestCache = new Map<string, Promise<DailyApiPayload>>();

function dailyBrowserCacheKey(date: string) {
  return `geostats:daily-trio:${DATASET_VERSION}:${PLAYER_COPY_VERSION}:${date}`;
}

function readCachedDaily(date: string): DailyApiPayload | null {
  const memory = dailyMemoryCache.get(date);
  if (memory) {
    if (!memory.fallback || Date.now() - (memory._cachedAt ?? 0) <= DAILY_FALLBACK_CACHE_TTL_MS) return memory;
    dailyMemoryCache.delete(date);
  }
  try {
    const raw = window.localStorage.getItem(dailyBrowserCacheKey(date));
    const payload = raw ? JSON.parse(raw) as DailyApiPayload : null;
    if (!payload) return null;
    if (payload.fallback && Date.now() - (payload._cachedAt ?? 0) > DAILY_FALLBACK_CACHE_TTL_MS) return null;
    dailyMemoryCache.set(date, payload);
    return payload;
  } catch {
    return null;
  }
}

function writeCachedDaily(date: string, payload: DailyApiPayload) {
  const cached = { ...payload, _cachedAt: Date.now() };
  dailyMemoryCache.set(date, cached);
  try {
    window.localStorage.setItem(dailyBrowserCacheKey(date), JSON.stringify(cached));
  } catch {
    // Browser storage is an optimization only.
  }
}

function clearCachedDaily(date: string) {
  dailyMemoryCache.delete(date);
  try {
    window.localStorage.removeItem(dailyBrowserCacheKey(date));
  } catch {
    // Ignore browsers that disable local storage.
  }
}

async function requestDailyPayload(date: string): Promise<DailyApiPayload> {
  const existing = dailyRequestCache.get(date);
  if (existing) return existing;
  const request = (async () => {
    let payload: DailyApiPayload = {};
    let response: Response | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const query = new URLSearchParams({ rules: RULES_VERSION, copy: PLAYER_COPY_VERSION });
      response = await fetch(`/api/daily-trio/${date}?${query.toString()}`, { cache: "force-cache" });
      payload = await response.json().catch(() => ({})) as DailyApiPayload;
      if (DAILY_DIFFICULTIES.some((difficulty) => Boolean(payload[difficulty]))) break;
      if (response.status !== 202) break;
      await new Promise((resolve) => window.setTimeout(resolve, Math.max(1, payload.retryAfter ?? 3) * 1000));
    }
    if (!response?.ok && !DAILY_DIFFICULTIES.some((difficulty) => Boolean(payload[difficulty]))) {
      throw new Error(typeof payload.error === "string" ? payload.error : "Today’s Daily board is temporarily unavailable.");
    }
    writeCachedDaily(date, payload);
    return payload;
  })().finally(() => dailyRequestCache.delete(date));
  dailyRequestCache.set(date, request);
  return request;
}

function dailyResultKey(date: string, difficulty: DailyDifficulty) {
  return `geostats:daily-result:${date}:${difficulty}`;
}

function boardSignature(round: Round) {
  return [
    round.categories.map((item) => item.category.id).join(","),
    round.bank.map((country) => country.id).join(","),
  ].join("|");
}

function readLocalDailyResult(date: string, difficulty: DailyDifficulty): LocalDailyResult | null {
  try {
    const raw = window.localStorage.getItem(dailyResultKey(date, difficulty));
    return raw ? JSON.parse(raw) as LocalDailyResult : null;
  } catch {
    return null;
  }
}

function writeLocalDailyResult(result: LocalDailyResult) {
  try {
    window.localStorage.setItem(dailyResultKey(result.challengeDate, result.difficulty), JSON.stringify(result));
  } catch {
    // Local result persistence is best effort in privacy-restricted browsers.
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
  return Boolean(configForDifficultyDimensions(difficulty, round.categories.length, round.bank.length, true));
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


function observationReference(category: RoundCategory["category"], year?: string) {
  if (category.showObservationYear === false) {
    // Historical-date categories rank the historical date itself as the value.
    // Their stored observation year is the source snapshot year, so expose that
    // compact temporal reference instead of a descriptive eligibility label.
    if (category.measurementType === "historical_date" && year) return `${year} snapshot`;
    return category.referenceLabel || category.datasetRelease || "Pinned source release";
  }
  return year || "Reference unavailable";
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



export default function GeoSecondComingGame({ initialDifficulty = DEFAULT_DIFFICULTY, mode = "daily", initialDailyDate, initialDailyPayload }: GeoSecondComingGameProps = {}) {
  const initialPacked = mode === "daily" ? initialDailyPayload?.[initialDifficulty] : undefined;
  const serverInitialRound = useMemo(() => {
    try {
      return initialPacked?.board_payload ? deserializeRound(initialPacked.board_payload) : null;
    } catch {
      return null;
    }
  }, [initialPacked]);
  const initialChallengeDate = initialDailyDate ?? newYorkDate();
  const [round, setRound] = useState<Round | null>(serverInitialRound);
  const [assignments, setAssignments] = useState<Assignment>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreRow[] | null>(null);
  const [freshResult, setFreshResult] = useState(false);
  const sound = useGameSound();
  const categoryDialog = useRef<HTMLDialogElement>(null);
  const [categoryHelp, setCategoryHelp] = useState<Category | null>(null);
  const [status, setStatus] = useState(serverInitialRound ? "" : "Loading official country data…");
  const [error, setError] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const supportMenu = useRef<HTMLDetailsElement>(null);
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const [seed, setSeed] = useState(serverInitialRound ? `DAILY-${initialDifficulty.toUpperCase()}-${initialChallengeDate}` : "");
  const [seedInput, setSeedInput] = useState("");
  const [difficulty, setDifficulty] = useState<DailyDifficulty>(initialDifficulty);
  const [copied, setCopied] = useState(false);
  const [manualScoreCopy, setManualScoreCopy] = useState("");
  const [scoreImage, setScoreImage] = useState<{ url: string; file: File } | null>(null);
  const [scoreImageStatus, setScoreImageStatus] = useState("");
  const [completionSource, setCompletionSource] = useState<CompletionSource>(null);
  const [fallbackPractice, setFallbackPractice] = useState(Boolean(serverInitialRound && initialDailyPayload?.fallback));
  const [boardNotice, setBoardNotice] = useState(serverInitialRound ? (initialDailyPayload?.warning ?? "") : "");
  const [openLeaderboard, setOpenLeaderboard] = useState<string | null>(null);
  const [showMobileOptimal, setShowMobileOptimal] = useState(false);
  const [sourceDataset, setSourceDataset] = useState<RoundCategory | null>(null);
  const [touchDrag, setTouchDrag] = useState<{ countryId: string; x: number; y: number; targetCategoryId: string | null } | null>(null);
  const touchStart = useRef<{ countryId: string; x: number; y: number } | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackedRounds = useRef(new Set<string>());
  const boardLoadRevision = useRef(0);

  const used = useMemo(() => new Set(Object.values(assignments)), [assignments]);
  const activeConfig = ROUND_CONFIGS[difficulty];
  const categoryTarget = round?.categories.length ?? activeConfig.categoryCount;
  const poolSize = round?.bank.length ?? activeConfig.countryCount;
  const scoringConfig = round ? configForDifficultyDimensions(difficulty, round.categories.length, round.bank.length, true) ?? activeConfig : activeConfig;
  const legacyDimensions = Boolean(round && (round.categories.length !== activeConfig.categoryCount || round.bank.length !== activeConfig.countryCount));
  const roundMaxScore = scoringConfig.maxScore;
  const unusedCount = Math.max(0, poolSize - categoryTarget);
  const isRandom = mode === "random";
  const isUnranked = isRandom || fallbackPractice;

  useEffect(() => {
    if (!round || scores) return;
    try {
      if (window.localStorage.getItem("geostats:first-play-intro:v1")) return;
      const timer = window.setTimeout(() => setShowWelcome(true), 750);
      return () => window.clearTimeout(timer);
    } catch {
      // Private browsing can disable storage; the visible How to play link still works.
    }
  }, [round, scores]);

  function dismissWelcome(openRules = false) {
    setShowWelcome(false);
    try { window.localStorage.setItem("geostats:first-play-intro:v1", "seen"); } catch { /* Optional preference. */ }
    if (openRules) setShowRules(true);
  }

  function openRules() {
    supportMenu.current?.removeAttribute("open");
    mobileMenu.current?.removeAttribute("open");
    setShowWelcome(false);
    setShowRules(true);
  }

  function trackFirstPlacement() {
    if (!round || isUnranked) return;
    const signature = `${isRandom ? "random" : "daily"}:${difficulty}:${seed}:${round.categories.map((item) => item.category.id).join(",")}`;
    if (trackedRounds.current.has(signature)) return;
    trackedRounds.current.add(signature);
    trackAnalytics("game_started", {
      difficulty,
      challengeDate: isRandom ? undefined : dailyDateFromSeed(seed),
      metadata: {
        mode: isRandom ? "random" : "daily",
        countryCount: round.bank.length,
        categoryCount: round.categories.length,
        countryIds: round.bank.map((country) => country.id),
        categoryIds: round.categories.map((category) => category.category.id),
      },
    });
  }

  useEffect(() => {
    if (!sourceDataset) return;
    trackAnalytics("source_opened", {
      difficulty,
      challengeDate: isRandom ? undefined : dailyDateFromSeed(seed),
      metadata: { categoryId: sourceDataset.category.id, source: sourceDataset.category.source },
    });
  }, [sourceDataset, difficulty, seed, isRandom]);

  function challengePath(nextDifficulty = difficulty, nextSeed = seed) {
    const path = isRandom ? ROUND_CONFIGS[nextDifficulty].randomPath : ROUND_CONFIGS[nextDifficulty].path;
    if (!isRandom || !nextSeed) return path;
    const params = new URLSearchParams({ seed: nextSeed, v: CATEGORY_SET_VERSION });
    return `${path}?${params.toString()}`;
  }

  function challengeUrl(nextDifficulty = difficulty, nextSeed = seed) {
    return new URL(challengePath(nextDifficulty, nextSeed), window.location.origin).toString();
  }

  function syncUrl(nextDifficulty: DailyDifficulty, nextSeed = seed) {
    window.history.replaceState({}, "", challengeUrl(nextDifficulty, nextSeed));
  }

  function resetRoundState(nextSeed: string, nextDifficulty: DailyDifficulty) {
    boardLoadRevision.current++;
    setError("");
    setRound(null);
    setScores(null);
    setFreshResult(false);
    setAssignments({});
    setSelected(null);
    setSelectedCategory(null);
    setCopied(false);
    setCompletionSource(null);
    setFallbackPractice(false);
    setBoardNotice("");
    setSeed(nextSeed);
    setDifficulty(nextDifficulty);
  }

  function restoreAssignments(activeRound: Round, savedAssignments: Assignment, source: Exclude<CompletionSource, null>) {
    if (Object.keys(savedAssignments).length !== activeRound.categories.length) return false;
    const categoryIds = new Set(activeRound.categories.map((dataset) => dataset.category.id));
    const countryIds = new Set(activeRound.bank.map((country) => country.id));
    if (Object.entries(savedAssignments).some(([categoryId, countryId]) => !categoryIds.has(categoryId) || !countryIds.has(countryId))) return false;
    try {
      setAssignments(savedAssignments);
      setScores(buildScoreRows(activeRound, savedAssignments));
      setCompletionSource(source);
      return true;
    } catch {
      return false;
    }
  }

  async function restoreSavedCompletion(activeRound: Round, nextDifficulty: DailyDifficulty, challengeDate: string) {
    const revision = boardLoadRevision.current;
    try {
      const params = new URLSearchParams({ challengeDate, difficulty: nextDifficulty });
      const response = await fetch(`/api/scores?${params.toString()}`, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json().catch(() => null) as {
          completed?: boolean;
          result?: SavedDailyScore | null;
        } | null;
        if (revision !== boardLoadRevision.current) return false;
        const accountAssignments = data?.completed ? data.result?.assignments : null;
        if (accountAssignments && restoreAssignments(activeRound, accountAssignments, "account")) return true;
      }
    } catch {
      // Account lookup failure falls through to same-browser local persistence.
    }

    if (revision !== boardLoadRevision.current) return false;
    const local = readLocalDailyResult(challengeDate, nextDifficulty);
    if (!local || local.boardSignature !== boardSignature(activeRound)) return false;
    return restoreAssignments(activeRound, local.assignments, "local");
  }

  async function restorePackedBoard(packed: PackedApiBoard, existingCountries: CountryInfo[] = []) {
    if (packed.board_payload) return deserializeRound(packed.board_payload);
    if (packed.encoded_board) {
      const [categoryCatalog, countryCatalog] = await Promise.all([
        fetchPlayableCategoryCatalog(),
        existingCountries.length ? Promise.resolve(existingCountries) : fetchCountries(),
      ]);
      return decodeRound(packed.encoded_board, countryCatalog, categoryCatalog);
    }
    throw new Error("The server did not return a complete board.");
  }

  async function loadDailyRound(nextDifficulty: DailyDifficulty, existingCountries: CountryInfo[] = []) {
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

      setStatus("Loading today’s saved Daily board…");
      const saved = await requestDailyPayload(date);
      const packed = saved[nextDifficulty];
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

  async function loadRandomRound(nextDifficulty: DailyDifficulty, requestedSeed: string, existingCountries: CountryInfo[] = []) {
    const nextSeed = normalizeRandomSeed(requestedSeed) || createRandomSeed();
    resetRoundState(nextSeed, nextDifficulty);
    setSeedInput(nextSeed);
    syncUrl(nextDifficulty, nextSeed);
    setStatus(`Building ${ROUND_CONFIGS[nextDifficulty].label} random board…`);
    try {
      const randomParams = new URLSearchParams({ seed: nextSeed, catalog: CATEGORY_SET_VERSION });
      const response = await fetch(`/api/seeded/${nextDifficulty}?${randomParams.toString()}`, { cache: "force-cache" });
      const payload = await response.json().catch(() => ({})) as PackedApiBoard & { error?: string };
      if (!response.ok) throw new Error(payload.error || "The random board could not be generated.");
      const generated = await restorePackedBoard(payload, existingCountries);
      if (!roundMatchesDifficulty(generated, nextDifficulty)) {
        throw new Error("The random board has the wrong dimensions.");
      }
      setRound(generated);
      setStatus("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The random board could not be generated.");
      setStatus("");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const nextDifficulty = difficultyFromPath(window.location.pathname);
        if (isRandom) {
          const requestedSeed = new URLSearchParams(window.location.search).get("seed") ?? createRandomSeed();
          await loadRandomRound(nextDifficulty, requestedSeed);
        } else {
          const today = newYorkDate();
          const initialPackedForPath = initialDailyDate === today ? initialDailyPayload?.[nextDifficulty] : undefined;
          if (initialPackedForPath && initialDailyPayload) {
            const restored = await restorePackedBoard(initialPackedForPath);
            if (!roundMatchesDifficulty(restored, nextDifficulty)) throw new Error("The server-rendered Daily has the wrong board dimensions.");
            writeCachedDaily(today, initialDailyPayload);
            setDifficulty(nextDifficulty);
            setSeed(dailySeed(nextDifficulty));
            setFallbackPractice(Boolean(initialDailyPayload.fallback));
            setBoardNotice(initialDailyPayload.warning ?? "");
            setRound(restored);
            setStatus("");
            if (!initialDailyPayload.fallback) void restoreSavedCompletion(restored, nextDifficulty, today);
          } else {
            await loadDailyRound(nextDifficulty);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Official data could not be loaded.");
        setStatus("");
      }
    })();
  }, []);

  function switchCachedDaily(event: React.MouseEvent<HTMLAnchorElement>, nextDifficulty: DailyDifficulty) {
    if (isRandom || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const packed = readCachedDaily(newYorkDate())?.[nextDifficulty];
    if (!packed?.board_payload) return;
    event.preventDefault();
    if (nextDifficulty !== difficulty) void loadDailyRound(nextDifficulty);
  }

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

  async function shareScore(useDeviceShare = false) {
    if (!scores) return;
    const medalCounts = [1, 2, 3].map((rank) => scores.filter((row) => row.rank === rank).length);
    const gameLabel = isRandom ? `${ROUND_CONFIGS[difficulty].label} Random · ${seed}` : `${ROUND_CONFIGS[difficulty].label} Daily · ${dailyDateFromSeed(seed)}`;
    const text = `🌐 GeoStats · ${gameLabel}
${total} / ${roundMaxScore}

1st: ${medalCounts[0]} · 2nd: ${medalCounts[1]} · 3rd: ${medalCounts[2]}`;
    const url = challengeUrl(difficulty, seed);

    const scoreText = `${text}\n\n${url}`;
    setManualScoreCopy("");
    setCopied(false);
    try {
      if (useDeviceShare && typeof navigator.share === "function") {
        await navigator.share({ title: "GeoStats", text, url });
      } else {
      await navigator.clipboard.writeText(scoreText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Keep the full score available when clipboard access is denied.
      // Do not use the game-level error state, which can obscure the results.
      setManualScoreCopy(scoreText);
      return;
    }
    trackAnalytics("share_clicked", {
      difficulty,
      challengeDate: isRandom ? undefined : dailyDateFromSeed(seed),
      value: total,
      metadata: { mode: isRandom ? "random" : "daily", method: useDeviceShare && typeof navigator.share === "function" ? "device" : "clipboard" },
    });
  }


  async function createScoreImage() {
    if (!scores) return;
    setScoreImageStatus("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1000; canvas.height = 640;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.fillStyle = "#e8f3f8"; ctx.fillRect(0, 0, 1000, 640);
      // Use the same globe geometry as Brand.tsx.
      ctx.save(); ctx.translate(54, 45); ctx.scale(1.7, 1.7);
      ctx.fillStyle = "#f1f8fb"; ctx.strokeStyle = "#668d9e"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(24, 24, 23, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#175e82"; ctx.lineWidth = 1.35;
      ctx.beginPath(); ctx.arc(24, 24, 13.5, 0, Math.PI * 2); ctx.stroke();
      ctx.stroke(new Path2D("M10.5 24h27M24 10.5c5 4.2 7.5 8.7 7.5 13.5S29 33.3 24 37.5c-5-4.2-7.5-8.7-7.5-13.5S19 14.7 24 10.5ZM13.7 16.5h20.6M13.7 31.5h20.6"));
      ctx.restore();
      const font = getComputedStyle(document.body).fontFamily;
      const write = (text: string, x: number, y: number, size: number, color: string, bold = false) => {
        ctx.font = `${bold ? "700" : "400"} ${size}px ${font}`;
        ctx.fillStyle = color; ctx.fillText(text, x, y);
      };
      write("GeoStats", 152, 97, 49, "#163449", true);
      ctx.strokeStyle = "#b6cdd8"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(56, 195); ctx.lineTo(944, 195); ctx.stroke();
      write(`${ROUND_CONFIGS[difficulty].label} ${isRandom ? "Random" : "Daily"}`, 56, 251, 28, "#326d50", true);
      if (!isRandom) { ctx.textAlign = "right"; write(dailyDateFromSeed(seed), 944, 251, 24, "#405d70"); ctx.textAlign = "left"; }
      write(String(total), 56, 391, 112, "#163449", true);
      ctx.font = `700 112px ${font}`;
      const scoreWidth = ctx.measureText(String(total)).width;
      write(`/ ${roundMaxScore}`, 76 + scoreWidth, 391, 46, "#405d70");
      // Compact medal counts keep the score legible at message-preview size.
      [1, 2, 3].forEach((rank, index) => {
        const x = 78 + index * 238;
        const count = scores.filter((row) => row.rank === rank).length;
        ctx.fillStyle = ["#b58a42", "#829aa4", "#a9795b"][index];
        ctx.beginPath(); ctx.arc(x, 453, 26, 0, Math.PI * 2); ctx.fill();
        ctx.textAlign = "center";
        write(String(rank), x, 463, 27, "#ffffff", true);
        ctx.textAlign = "left";
        write(String(count), x + 41, 465, 33, "#163449", true);
      });
      ctx.beginPath(); ctx.moveTo(56, 506); ctx.lineTo(944, 506); ctx.stroke();
      write("geostats.xyz", 56, 567, 30, "#163449", true);
      ctx.textAlign = "right"; write("geostats.xyz", 944, 567, 26, "#175e82", true);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image unavailable")), "image/png"));
      setScoreImage({ url: canvas.toDataURL("image/png"), file: new File([blob], "geostats-score.png", { type: "image/png" }) });
    } catch {
      setScoreImageStatus("The image could not be created. You can still copy your score.");
    }
  }

  async function shareScoreImage() {
    if (!scoreImage) return;
    try {
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [scoreImage.file] })) {
        await navigator.share({ files: [scoreImage.file], title: "GeoStats score", text: challengeUrl(difficulty, seed) });
      } else {
        setScoreImageStatus("Use Download image, then attach it to your message.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setScoreImageStatus("Sharing is unavailable here. Download the image to attach it instead.");
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
    if (!round || !round.categories.some((item) => item.category.id === categoryId)
      || !round.bank.some((country) => country.id === countryId)) return;
    trackFirstPlacement();
    sound.play("place");
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
      setFreshResult(true);
      sound.play("result");
      if (!isRandom && !fallbackPractice) {
        const challengeDate = dailyDateFromSeed(seed);
        writeLocalDailyResult({
          challengeDate,
          difficulty,
          assignments,
          boardSignature: boardSignature(round),
          completedAt: new Date().toISOString(),
          rulesVersion: RULES_VERSION,
        });
        setCompletionSource("local");
      }
      const finalScore = scoredRows.reduce((sum, row) => sum + row.points, 0);
      trackAnalytics("game_completed", {
        difficulty,
        challengeDate: isRandom ? undefined : dailyDateFromSeed(seed),
        value: finalScore,
        metadata: {
          mode: isRandom ? "random" : "daily",
          averagePlacement: scoredRows.reduce((sum, row) => sum + row.rank, 0) / scoredRows.length,
          categoryCount: scoredRows.length,
          countryIds: round.bank.map((country) => country.id),
          categoryIds: round.categories.map((category) => category.category.id),
        },
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The round could not be scored consistently.");
    }
  }

  const total = scores?.reduce((sum, row) => sum + row.points, 0) ?? 0;

  const gameTools = <><button type="button" aria-pressed={sound.enabled} title="Sounds play when you assign or remove a country and submit answers" onClick={sound.toggle}>Game sounds: {sound.enabled ? "on" : "off"}</button><GameTools categories={round?.categories.map(item=>({id:item.category.id,name:item.category.name}))??[]} difficulty={difficulty} challengeDate={isRandom?undefined:dailyDateFromSeed(seed)}/></>;

  return <div className={`shell ${!scores ? "activePlay" : ""} ${status ? "loadingPlay" : ""} ${error ? "errorPlay" : ""} ${scores ? "resultsView" : ""} ${difficulty}Round ${difficulty === "expert" ? "expertRound" : ""} ${difficulty === "easy" ? "compactRound" : ""} ${legacyDimensions ? "legacyRound" : ""}`}>
    {!scores && <header>
      <Brand />
      <div className="headerButtons desktopHeaderButtons" aria-label="GeoStats navigation">
        <nav className="desktopNavGroup desktopGameNav" aria-label="Play GeoStats">
          <span className="desktopNavLabel">Play</span>
          {isRandom && <a href="/random" className="dailyModeButton active">Random QA</a>}
          <a href={challengePath("easy", seed)} onClick={(event) => switchCachedDaily(event, "easy")} className={`dailyModeButton ${difficulty === "easy" ? "active" : ""}`}>Scout</a>
          <a href={challengePath("normal", seed)} onClick={(event) => switchCachedDaily(event, "normal")} className={`dailyModeButton ${difficulty === "normal" ? "active" : ""}`}>Adventurer</a>
          <a href={challengePath("expert", seed)} onClick={(event) => switchCachedDaily(event, "expert")} className={`dailyModeButton ${difficulty === "expert" ? "active" : ""}`}>Expert</a>
          {!isRandom && <a href="/account" className="headerLink">My results</a>}
        </nav>
      </div>
      <details className="desktopSupportMenu" ref={supportMenu}>
        <summary>Help &amp; tools</summary>
        <div>
          <button onClick={openRules}>How to play</button>
          {gameTools}
          <a href="/audit">Data audit</a>
        </div>
      </details>
      <button type="button" className="mobileHowToPlay" onClick={openRules}>Rules</button>
      {!isRandom && <div className="gameAccount"><AccountControls difficulty={difficulty} compact /></div>}
      <details className="mobileMenu" ref={mobileMenu}><summary aria-label="Open game menu">Menu</summary><div>
        {gameTools}
        <p className="mobileDailyDate">{dailyDateFromSeed(seed)}</p>
        {boardNotice && fallbackPractice && <details><summary>Board data note</summary><p>{boardNotice}</p></details>}
        <a href="/audit">Data audit</a><button onClick={openRules}>How to play</button>
        {isRandom && <a href="/daily">Daily modes</a>}
        {!isRandom && <a href="/account">My results</a>}
      </div></details>
    </header>}

    <section className={`challengeBar ${isRandom ? "randomChallengeBar" : ""}`}>
      <div className="challengeIdentity"><span className="kicker">{isRandom ? `${ROUND_CONFIGS[difficulty].label} Random · Unranked` : `${ROUND_CONFIGS[difficulty].label} Daily`}</span>{!isRandom && <strong>{dailyDateFromSeed(seed)}</strong>}</div>
      <div className="challengeActions">
        {isRandom && <div className="seedControls">
          <label className="seedField"><span>Seed</span><input value={seedInput} onChange={(event) => setSeedInput(normalizeRandomSeed(event.target.value))} onKeyDown={(event) => event.key === "Enter" && loadEnteredSeed()} aria-label="Random seed" /></label>
          <button onClick={loadEnteredSeed}>Load seed</button>
          <button onClick={generateNewRandomRound}>New seed</button>
          <button onClick={copyRandomLink}>{copied ? "Link copied ✓" : "Copy link"}</button>
        </div>}
        <span className="mobileProgress">{Object.keys(assignments).length}/{categoryTarget} assigned</span>
        {scores && <button className="resultsRulesLink" onClick={openRules}>How scoring works</button>}
      </div>
    </section>
    {!scores && <><nav className="mobileModeTabs" aria-label="Game difficulty">
      <a href={challengePath("easy", seed)} onClick={(event) => switchCachedDaily(event, "easy")} className={difficulty === "easy" ? "active" : ""}>Scout</a>
      <a href={challengePath("normal", seed)} onClick={(event) => switchCachedDaily(event, "normal")} className={difficulty === "normal" ? "active" : ""}>Adventurer</a>
      <a href={challengePath("expert", seed)} onClick={(event) => switchCachedDaily(event, "expert")} className={difficulty === "expert" ? "active" : ""}>Expert</a>
    </nav><div className="mobileGameSummary"><strong>{ROUND_CONFIGS[difficulty].label}</strong><span>{poolSize} countries · {categoryTarget} matches · {unusedCount ? `leave ${unusedCount}` : "use all"}</span></div></>}
    {boardNotice && fallbackPractice && <details className="boardNotice"><summary>Board data note</summary><p>{boardNotice}</p></details>}
    {!scores && <div className="gamePrimer"><span>Match countries to statistics. Use each country once to score the most points across the board.</span><button type="button" onClick={openRules}>How to play</button></div>}
    {!scores && <section className="hero desktopHero">
      <div><span className="kicker">A strategy atlas</span><h2>{poolSize} countries. {categoryTarget} measures. One perfect allocation.</h2><p>{unusedCount ? <>Place {categoryTarget} countries, leave {unusedCount === 1 ? "one" : unusedCount} behind, and make every specialist count.</> : <>Place all {categoryTarget} countries and make every specialist count.</>}</p></div>
      <aside><strong>{Object.keys(assignments).length}/{categoryTarget}</strong><span>categories assigned</span></aside>
    </section>}

    {status && <div className="loading"><div className="spinner"/><strong>{status}</strong><span>Official datasets can take a few seconds to load the first time.</span></div>}
    {error && <div className="error"><strong>Couldn’t load this board.</strong><span>{error}</span><button onClick={retryCurrentRound}>Check again</button></div>}

    {round && !scores && <main className={`grid playGrid ${selected ? "holdingCountry" : ""} ${selectedCategory ? "choosingCountry" : ""}`}>
      <section className="panel bankPanel"><div className="panelTitle"><div><h3>Your countries</h3></div><small>{unusedCount ? `Use ${categoryTarget} of ${poolSize}` : `${poolSize} countries · use each once`}</small></div>
        <div className="countries" aria-label="Country bank">{round.bank.map((country) => <button key={country.id} draggable={!used.has(country.id)} onDragStart={(event)=>event.dataTransfer.setData("text/plain", country.id)} onTouchStart={(event)=>beginTouch(event,country.id)} onTouchMove={moveTouch} onTouchEnd={endTouch} onTouchCancel={endTouch} className={`country ${selected===country.id?"selected":""} ${selectedCategory&&!used.has(country.id)?"categoryTarget":""} ${used.has(country.id)?"used":""}`} aria-pressed={selected===country.id} disabled={used.has(country.id)} onClick={() => selectCountry(country.id)}><span>{country.flag}</span><div><strong title={country.name}><span className="desktopCountryName">{country.name}</span><span className="mobileCountryName">{shortCountryName(country.name)}</span></strong></div>{used.has(country.id)&&<b>USED</b>}</button>)}</div>
      </section>
      <div className="boardSpine" aria-hidden="true"/>
      <section className="panel boardPanel"><div className="panelTitle"><div><h3>Make your matches</h3></div></div>
        <div className="slots" aria-label="Measures to match">{round.categories.map((dataset, index) => {
          const c = round.bank.find((country)=>country.id===assignments[dataset.category.id]);
          return <div
            key={dataset.category.id}
            data-category-id={dataset.category.id}
            className={`slot ${categoryThemeClass(dataset.category)} ${c?"assigned":""} ${selected&&!c?"target":""} ${selectedCategory===dataset.category.id?"selectedCategory":""} ${touchDrag?.targetCategoryId===dataset.category.id?"touchTarget":""}`}
            role="button"
            tabIndex={0}
            aria-pressed={selectedCategory===dataset.category.id}
            onDragOver={(event)=>event.preventDefault()}
            onDrop={(event)=>{event.preventDefault();const dropped=event.dataTransfer.getData("text/plain");if(dropped)assignCountry(dataset.category.id,dropped)}}
            onClick={()=>selectCategory(dataset.category.id)}
            onKeyDown={(event)=>{if(event.target !== event.currentTarget) return;if(event.key==="Enter"||event.key===" "){event.preventDefault();selectCategory(dataset.category.id)}}}
          >
            <span className="cornerNotch" aria-hidden="true"/>
            <div className="category" title={categoryMeasurementLabel(dataset.category)}><span className="desktopCategoryIcon">{dataset.category.icon}</span><button type="button" className="mobileCategoryInfo" aria-label={`About ${dataset.category.name}`} onClick={(event)=>{event.stopPropagation();setCategoryHelp(dataset.category);categoryDialog.current?.showModal();}}>{dataset.category.icon}</button><div className="categoryCopy"><strong>{dataset.category.name}</strong><small>{dataset.category.boardDescription ?? dataset.category.description}</small><span className="measurementBadge" title={categoryMeasurementLabel(dataset.category)}>{categoryMeasurementBadgeLabel(dataset.category)}</span></div><b className="slotNumber">{String(index + 1).padStart(2, "0")}</b></div>
            <div key={c?.id ?? "empty"} className={`choice ${c?"filled":""}`}>{c?<><span className="pieceFlag">{c.flag}</span><strong className="pieceName">{c.name}</strong><button type="button" className="removePiece" aria-label={`Remove ${c.name} from ${dataset.category.name}`} title="Remove country" onClick={(event)=>{event.stopPropagation();sound.play("remove");setAssignments((current)=>{const next={...current};delete next[dataset.category.id];return next;});setSelectedCategory(null);}}><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></>:<em>{selected?"Place here":selectedCategory===dataset.category.id?"Choose a country":"Assign country"}</em>}</div>
          </div>
        })}</div>
        <div className="lock" aria-live="polite"><span>{categoryTarget-Object.keys(assignments).length>0?`${categoryTarget-Object.keys(assignments).length} matches remaining`:"Ready to submit"}</span><button type="button" disabled={Object.keys(assignments).length!==categoryTarget} onTouchEnd={(event)=>{event.preventDefault();score();}} onClick={score}>Submit answers</button></div>
      </section>
    </main>}

    {round && scores && <section className={`panel results ${freshResult ? "freshResult" : ""}`}><nav className="resultsModeTabs" aria-label="Results difficulty">
        <a href={challengePath("easy", seed)} onClick={(event) => switchCachedDaily(event, "easy")} className={difficulty === "easy" ? "active" : ""}>Scout</a>
        <a href={challengePath("normal", seed)} onClick={(event) => switchCachedDaily(event, "normal")} className={difficulty === "normal" ? "active" : ""}>Adventurer</a>
        <a href={challengePath("expert", seed)} onClick={(event) => switchCachedDaily(event, "expert")} className={difficulty === "expert" ? "active" : ""}>Expert</a>
      </nav><div className="score"><span>Final score</span>{completionSource === "account" && <p className="savedDailyNotice">Saved to your account</p>}{completionSource === "local" && <p className="savedDailyNotice">Saved on this browser</p>}<div className="scoreValue"><strong>{total}</strong><b>/ {roundMaxScore}</b></div><div className="scoreBreakdown" aria-label="Matches by placement">{[1,2,3].map((rank)=><span key={rank}>{ordinal(rank)} place: <strong>{scores.filter((row)=>row.rank===rank).length}</strong></span>)}</div><details className="scoringDetails"><summary>Scoring rules</summary><p>Each match earns up to 100 points based on its rank among today’s {poolSize} countries. A country ranked first in a category earns 100 points. Lower ranks earn fewer; the score adds up all {categoryTarget} matches.</p><p>On this board: {scoringConfig.pointsByRank.map((points, index)=>`${ordinal(index+1)} = ${points}`).join(" · ")} points.</p></details><div className="scoreActions"><details className="scoreShareOptions"><summary className="shareScore">Share score</summary><div className="scoreShareMenu"><button type="button" onClick={() => void shareScore()}>{copied ? "Score copied ✓" : "Copy score"}</button><button type="button" onClick={() => void shareScore(true)}>More sharing options</button></div></details>{scoreImage && <div className="scoreImagePreview"><img src={scoreImage.url} alt={`GeoStats ${ROUND_CONFIGS[difficulty].label} score: ${total} out of ${roundMaxScore}`} /><div><button type="button" onClick={() => void shareScoreImage()}>Share image</button><a href={scoreImage.url} download="geostats-score.png">Download image</a><button type="button" onClick={() => { setScoreImage(null); setScoreImageStatus(""); }}>Close preview</button></div></div>}{scoreImageStatus && <p role="status">{scoreImageStatus}</p>}<span className="sr-only" role="status">{copied ? "Score copied to clipboard" : ""}</span>{isUnranked ? (isRandom ? <button className="secondaryScoreAction" onClick={generateNewRandomRound}>Generate another board</button> : <span className="unrankedNotice">Practice board · score not saved</span>) : <AccountControls results difficulty={difficulty} pendingScore={completionSource === "account" ? undefined : { challengeDate: dailyDateFromSeed(seed), difficulty, assignments }} onScoreSaved={(saved) => {
        if (saved.challengeDate === dailyDateFromSeed(seed) && saved.difficulty === difficulty) setCompletionSource("account");
      }} />}</div>{manualScoreCopy && <div className="modal copyFallback" role="dialog" aria-modal="true" aria-label="Copy your score" onClick={(event)=>{if(event.target===event.currentTarget)setManualScoreCopy("");}}><div><h2>Copy your score</h2><p>Your browser blocked automatic copying. Select the text below and copy it.</p><textarea aria-label="Score to copy" readOnly value={manualScoreCopy} onFocus={(event) => event.currentTarget.select()} rows={7} autoFocus /><button type="button" onClick={()=>setManualScoreCopy("")}>Close</button></div></div>}</div>
      <div className="resultsHeading"><div><span className="kicker">Your placements</span><h3>Placement and points earned</h3></div><small>Open a ranking to compare the {poolSize} countries on this board</small></div>
      {scores.map((row)=>{ const leaderboard=poolLeaderboard(row.category,round.bank); return <div className="resultWrap" key={row.category.category.id}><div className="result"><div className="resultMain"><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small className="statTip" tabIndex={0}>{row.country.flag} {row.country.name} · {formatValue(row.value,row.category.category)}<span className="resultReference"> · {observationReference(row.category.category,row.category.byCountry.get(row.country.id)?.year)}</span><span className="tooltip"><strong>Why this rank?</strong><br/>Its official value ranks #{row.globalRank} globally.<br/>Actual value: {formatValue(row.value,row.category.category)}<br/>Reference: {observationReference(row.category.category,row.category.byCountry.get(row.country.id)?.year)}<br/>Source: {SOURCE_REGISTRY[row.category.category.source].name}<br/><button className="inlineSourceButton" onClick={(e)=>{e.stopPropagation();setSourceDataset(row.category)}}>Data & Source</button></span></small></div></div><div className="placementSummary"><b>{ordinal(row.rank)} of {poolSize}</b><strong>{row.points} pts</strong>{row.rank===1&&<span>Best possible</span>}</div>{row.rank!==1&&<div className="mobileBestMatch">Best match: {row.best.flag} {row.best.name} · 100 pts</div>}<button className="leaderboardButton" onClick={()=>setOpenLeaderboard(openLeaderboard===row.category.category.id?null:row.category.category.id)} aria-expanded={openLeaderboard===row.category.category.id}>{openLeaderboard===row.category.category.id?"Hide rankings":"View rankings"}</button></div>{openLeaderboard===row.category.category.id&&<div className="leaderboard"><div className="leaderboardHeader"><div className="leaderboardTitle"><h4>{row.category.category.name}</h4><span>Among these {poolSize} countries</span></div><div className="leaderboardSource"><span className="sourceBadge">{row.category.category.source === "worldbank" ? "World Bank" : SOURCE_REGISTRY[row.category.category.source].name}</span><button className="sourceDetailsButton" onClick={(e)=>{e.stopPropagation();setSourceDataset(row.category)}}>Data & Source</button></div></div><div className="leaderboardColumns" aria-hidden="true"><b>Board</b><b>Country</b><b>World Rank</b><b>Value</b><b>Reference</b><b>Points</b></div>{leaderboard.map(item=><div key={item.country.id} className={item.country.id===row.country.id?"current":""}><b className="boardRank">#{item.poolRank}</b><span className="leaderboardCountry">{item.country.flag} {item.country.name}</span><span className="worldRank">#{item.observation.globalRank}</span><span className="leaderboardValue"><span className="mobileColumnLabel">Value</span>{formatValue(item.observation.value,row.category.category)}</span><small className="leaderboardReference"><span className="mobileColumnLabel">Reference</span>{observationReference(row.category.category,item.observation.year)}</small><strong className="leaderboardPoints">{item.points} pts</strong></div>)}</div>}</div>})}
      <div id="best-solution" className={`perfect ${showMobileOptimal ? "mobileExpanded" : ""}`}><div className="resultsHeading"><div><span className="kicker">🏆 Best Possible</span><h3>The optimal allocation</h3></div><small>Each category’s best country among these {poolSize}</small></div>
      <button type="button" className="mobileOptimalToggle" aria-expanded={showMobileOptimal} onClick={() => setShowMobileOptimal(!showMobileOptimal)}>{showMobileOptimal ? "Hide optimal matches" : "Show optimal matches"}</button><div className="perfectGrid">{scores.map((row)=><div className="perfectRow" title={categoryMeasurementLabel(row.category.category)} key={`perfect-${row.category.category.id}`}><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small className="statTip" tabIndex={0}>{row.best.flag} {row.best.name} · {formatValue(row.bestValue,row.category.category)}<span className="resultReference"> · {observationReference(row.category.category,row.category.byCountry.get(row.best.id)?.year)}</span><span className="tooltip"><strong>Why this rank?</strong><br/>Its official value ranks #{row.bestGlobalRank} globally.<br/>Actual value: {formatValue(row.bestValue,row.category.category)}<br/>Reference: {observationReference(row.category.category,row.category.byCountry.get(row.best.id)?.year)}<br/>Source: {SOURCE_REGISTRY[row.category.category.source].name}<br/><button className="inlineSourceButton" onClick={(e)=>{e.stopPropagation();setSourceDataset(row.category)}}>Data & Source</button></span></small></div><b>100 pts</b></div>)}</div></div>
      <div className="lock resultsFooter" aria-live="polite"><span>Maximum score: {roundMaxScore}{isUnranked ? " · Unranked" : ""}</span></div></section>}

    {touchDrag && round && <div className="touchGhost" style={{ left: touchDrag.x, top: touchDrag.y }}><span>{round.bank.find((country)=>country.id===touchDrag.countryId)?.flag}</span><strong>{round.bank.find((country)=>country.id===touchDrag.countryId)?.name}</strong></div>}

    {!scores && <section className="dataNote"><strong>Atlas index · trusted category library</strong><p><a href="/data">Data & methodology</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p><p>Population, economy, land, agriculture, food, religion, energy, health, labor, trade, displacement, travel, technology, and environment. New official-source categories stay out of play until they pass integrity, clarity, coverage, and duplicate review.</p></section>}

    {scores && <div className="resultsGameTools">{gameTools}</div>}
    <dialog ref={categoryDialog} className="mobileCategoryDialog" aria-labelledby="categoryHelpTitle" onClick={(event)=>{if(event.target===event.currentTarget)categoryDialog.current?.close();}}>
      <h2 id="categoryHelpTitle">{categoryHelp?.icon} {categoryHelp?.name}</h2>
      <p>{categoryHelp?.boardDescription ?? categoryHelp?.description}</p>
      {categoryHelp && <p>{categoryMeasurementLabel(categoryHelp)}</p>}
      <button type="button" autoFocus onClick={()=>categoryDialog.current?.close()}>Back to board</button>
    </dialog>
    {sourceDataset && <CategorySourcePanel dataset={sourceDataset} boardCountryIds={round?.bank.map((country) => country.id) ?? []} onClose={()=>setSourceDataset(null)} />}

    {showWelcome && !scores && <div className="modal welcomeModal" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle"><div className="rulesModalCard"><h2 id="welcomeTitle">Match the whole board</h2><p>Match countries to statistics. You can use each country once, so a great choice for one category might cost you points elsewhere.</p><p>There is one best arrangement for the whole board. Find it by scoring the most points across all categories.</p><div className="welcomeModes"><span><strong>Scout</strong>4 countries · 4 matches</span><span><strong>Adventurer</strong>6 countries · 4 matches</span><span><strong>Expert</strong>8 countries · 6 matches</span></div><div className="welcomeActions"><button type="button" onClick={()=>dismissWelcome()}>Play {ROUND_CONFIGS[difficulty].label}</button><button type="button" className="secondaryAction" onClick={()=>dismissWelcome(true)}>How to play</button></div></div></div>}
    {showRules&&<div className="modal rulesModal" role="dialog" aria-modal="true" aria-labelledby="rulesTitle" onClick={(e)=>e.currentTarget===e.target&&setShowRules(false)}><div className="rulesModalCard"><h2 id="rulesTitle">How to play</h2><p>Match each country to a statistic. Use each country only once; there is one best arrangement for the whole board.</p><ol><li><strong>Assign one country to each category.</strong> Scout uses all four. Adventurer and Expert include extra countries you can leave unused.</li><li><strong>Compare their ranks.</strong> For each category, your country ranks among the countries on this board. First place earns 100 points; lower ranks earn fewer.</li><li><strong>Submit your answers.</strong> Your final score adds the points from every match. The best arrangement earns the highest total across the board.</li></ol><p><strong>Choose a level:</strong> Scout: 4 countries and 4 matches · Adventurer: 6 countries and 4 matches · Expert: 8 countries and 6 matches.</p><p>{isRandom ? "Random boards are unranked and repeatable." : "There is a new board for each level every day. No account is needed to play."}</p><button type="button" onClick={()=>setShowRules(false)}>Back to game</button></div></div>}
  </div>;
}
