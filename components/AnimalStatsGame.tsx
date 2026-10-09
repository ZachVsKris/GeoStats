"use client";

import AnimalPortrait from "./AnimalPortrait";
import AnimalPhotoCredits from "./AnimalPhotoCredits";
import { animalTraitIcon } from "../lib/animalstatsIcons";
import AnimalCategoryLabel from "./AnimalCategoryLabel";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type CSSProperties } from "react";
import { animalRegionLabel } from "../lib/animalstatsRegions";
import { randomAnimalBoardIndex } from "../lib/animalstatsVariety";
import { CATLogo } from "./CATBrand";
import { ROUND_CONFIGS, type DailyDifficulty } from "../lib/gameRules";
import type { AnimalDataset, BoardCandidate, ReviewLabel } from "../lib/animalstats";
import { ANIMAL_HISTORY_KEY, animalStats, readAnimalHistory, type AnimalGameResult } from "../lib/animalstatsHistory";
import { formatAnimalValue } from "../lib/animalstatsFormatting";
import useGameDialog from "./useGameDialog";
import AccountControls from "./AccountControls";
import GameTools from "./GameTools";
import useGameSound from "./useGameSound";
import AnimalCatalogView from "./AnimalCatalogView";
import AnimalResults from "./AnimalResults";
import AnimalScoreImage from "./AnimalScoreImage";
import { AnimalSprite } from "./AnimalSprite";
import "../app/animals/animalstats.css";
import "../app/animals/animal-sanctuary.css";
import "../app/animals/animal-fair-refresh.css";

type Props = { initialBoardId?: string; initialMode?: DailyDifficulty; unavailableBoard?: boolean; data: AnimalDataset; boards: BoardCandidate[]; approvedBoardIds: string[]; date: string };
type Assignment = Record<string, string>;

function challengeUrl(boardId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("board", boardId);
  const access = new URLSearchParams(url.hash.slice(1)).get("fair_share");
  if (access && /^[A-Za-z0-9_-]{1,256}$/.test(access)) url.searchParams.set("_vercel_share", access);
  return url.toString();
}

function observationLinks(notes: string) {
  return [...new Set(notes.match(/https?:\/\/[^\s;]+/g) ?? [])].map(url => url.replace(/[.,]$/, ""));
}

const formatValue = formatAnimalValue;

export default function AnimalStatsGame({ data, boards, approvedBoardIds, date, initialBoardId, initialMode = "easy", unavailableBoard = false }: Props) {
  const sound = useGameSound();
  const [presentation, setPresentation] = useState<"cute" | "real">("cute");
  useEffect(() => { try { if (localStorage.getItem("animalstats-presentation-v1") === "real") setPresentation("real"); } catch {} }, []);
  function changePresentation() { const next = presentation === "cute" ? "real" : "cute"; setPresentation(next); try { localStorage.setItem("animalstats-presentation-v1", next); } catch {} }
  const [view, setView] = useState<"play" | "stats" | "guide" | "prizes">("play");
  const [prizeSearch, setPrizeSearch] = useState("");
  const [prizeKind, setPrizeKind] = useState("all");
  const [focusTrait, setFocusTrait] = useState<string | null>(null);
  const [photoCreditsOpen, setPhotoCreditsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTopic, setHelpTopic] = useState<"play" | "scoring">("play");
  const menuRef = useRef<HTMLDetailsElement>(null);
  function showHelp(topic: "play" | "scoring" = "play") { setHelpTopic(topic); setHelpOpen(true); }
  useEffect(() => {
    function closeMenu(event: globalThis.PointerEvent) { if (!menuRef.current?.contains(event.target as Node) && menuRef.current) menuRef.current.open = false; }
    function escape(event: KeyboardEvent) { if (event.key === "Escape" && menuRef.current) menuRef.current.open = false; }
    document.addEventListener("pointerdown", closeMenu); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", closeMenu); document.removeEventListener("keydown", escape); };
  }, []);
  const helpRef = useRef<HTMLElement>(null);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  useGameDialog(helpOpen, helpRef, closeHelp);
  const [boardCopied, setBoardCopied] = useState(false);
  async function shareResult(native = false) {
    if (!board) return;
    const message = `Countries, Animals & Things\nAnimalStats ${config.label} · ${playKind} · ${date}\n${total}/${config.maxScore} · ${optimalChoices} Optimal Choices\n${results.map(row => row.rank === 1 ? "🎯" : row.points >= 50 ? "🟩" : "🟨").join("")}\n${challengeUrl(board.id!)}`;
    if (native && navigator.share) { try { await navigator.share({text:message}); return; } catch (error) { if ((error as DOMException).name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(message); setCopied(true); } catch { setCopied(false); setManualCopyKind("score"); setManualScoreCopy(message); }
  }
  const initialBoard = boards.find(candidate => candidate.id === initialBoardId);
  const [guideSearch, setGuideSearch] = useState("");
  const [guideGroup, setGuideGroup] = useState("all");
  const [guideRegion, setGuideRegion] = useState("all");
  const [playKind, setPlayKind] = useState<"daily" | "random">("random");
  const [signedIn, setSignedIn] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [history, setHistory] = useState<AnimalGameResult[]>([]);
  useEffect(() => {
    try { setHistory(readAnimalHistory(localStorage.getItem(ANIMAL_HISTORY_KEY))); } catch { /* Play remains available without browser storage. */ }
    const controller = new AbortController();
    fetch("/api/animals/results", { signal: controller.signal }).then((response) => response.json()).then((payload) => {
      setSignedIn(payload.signedIn === true);
      if (payload.signedIn && Array.isArray(payload.results)) setHistory(readAnimalHistory(JSON.stringify(payload.results)));
    }).catch(() => { /* Device history remains usable when account loading is unavailable. */ });
    return () => controller.abort();
  }, []);
  const [mode, setMode] = useState<DailyDifficulty>(initialBoard?.mode ?? initialMode);
  const [statsMode, setStatsMode] = useState<DailyDifficulty>(initialBoard?.mode ?? initialMode);
  const [boardIndex, setBoardIndex] = useState(initialBoard ? boards.filter(candidate => candidate.mode === initialBoard.mode).indexOf(initialBoard) : 0);
  const [assignments, setAssignments] = useState<Assignment>({});
  const [selectedTrait, setSelectedTrait] = useState<string | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null);
  const [draggingTrait, setDraggingTrait] = useState<{ id: string; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const pointer = useRef<{ id: string; kind?: "trait"; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [heldAnimal, setHeldAnimal] = useState<string | null>(null);
  const [motionPaused, setMotionPaused] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [manualScoreCopy, setManualScoreCopy] = useState("");
  const [manualCopyKind, setManualCopyKind] = useState<"score" | "board">("score");
  const copyPanelRef = useRef<HTMLDivElement>(null);
  const closeScoreCopy = useCallback(() => setManualScoreCopy(""), []);
  useGameDialog(Boolean(manualScoreCopy), copyPanelRef, closeScoreCopy);
  const [reviewLabel, setReviewLabel] = useState<ReviewLabel | "">("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewSaved, setReviewSaved] = useState(false);
  const modeBoards = useMemo(() => boards.filter((board) => board.mode === mode), [boards, mode]);
  const recentBoards = useRef<BoardCandidate[]>([]);
  const focusedBoards = useMemo(() => focusTrait ? modeBoards.filter(candidate => candidate.traitIds.includes(focusTrait)) : modeBoards, [modeBoards, focusTrait]);
  const pool = playKind === "daily" ? modeBoards.filter((board) => approvedBoardIds.includes(board.id ?? "")).slice(0, 1) : focusedBoards;
  const board = pool[boardIndex % pool.length];
  useEffect(() => {
    if (!board) return;
    try {
      const saved: string[] = JSON.parse(localStorage.getItem("animalstats-rotation-v1") ?? "[]");
      const ids = [...(Array.isArray(saved) ? saved.filter(id => typeof id === "string") : []), board.id!].slice(-12);
      recentBoards.current = ids.map(id => boards.find(b => b.id === id)).filter((b): b is BoardCandidate => Boolean(b));
      localStorage.setItem("animalstats-rotation-v1", JSON.stringify(ids));
    } catch { recentBoards.current = [...recentBoards.current, board].slice(-12); }
  }, [board, boards]);
  const animalMap = useMemo(() => new Map(data.animals.map((animal) => [animal.id, animal])), [data.animals]);
  const photoMap = useMemo(() => new Map(data.photos.map((photo) => [photo.animalId, photo])), [data.photos]);
  const traitMap = useMemo(() => new Map(data.traits.map((trait) => [trait.id, trait])), [data.traits]);
  const valueMap = useMemo(() => new Map(data.values.map((row) => [`${row.animalId}:${row.traitId}`, row])), [data.values]);
  const sourceMap = useMemo(() => new Map(data.sources.map((source) => [source.id, source])), [data.sources]);
  const config = ROUND_CONFIGS[mode];
  const stats = animalStats(history, statsMode);
  const playableTraitIds = useMemo(() => new Set(boards.flatMap((candidate) => candidate.traitIds)), [boards]);
  const pairedMetrics = useMemo(() => data.traits.filter((trait) => playableTraitIds.has(trait.id) && trait.direction === "higher_wins"), [data.traits, playableTraitIds]);


  function switchBoard(nextMode: DailyDifficulty, index = 0) {
    setBoardCopied(false);
    pointer.current = null;
    setDragging(null);
    setDraggingTrait(null);
    setDropTarget(null);
    setHeldAnimal(null);
    setMode(nextMode);
    setBoardIndex(index);
    setAssignments({});
    setSelectedTrait(null);
    setSelectedAnimal(null);
    setSubmitted(false);
    setMessage("");
    setCopied(false);
    setReviewLabel("");
    setReviewNotes("");
    setReviewSaved(false);
    setAccountMessage("");
  }

  function playPrize(traitId: string) {
    const available = boards.filter(candidate => candidate.traitIds.includes(traitId));
    const preferred = available.find(candidate => candidate.mode === mode) ?? available[0];
    if (!preferred) return;
    setFocusTrait(traitId); setPlayKind("random"); setView("play");
    switchBoard(preferred.mode);
  }

  async function copyBoard() {
    if (!board) return;
    try { await navigator.clipboard.writeText(challengeUrl(board.id!)); setBoardCopied(true); }
    catch { setManualCopyKind("board"); setManualScoreCopy(challengeUrl(board.id!)); }
  }

  function nextBoard() {
    if (playKind === "daily") { setPlayKind("random"); switchBoard(mode, randomAnimalBoardIndex(data, modeBoards, board, Math.random, recentBoards.current)); return; }
    switchBoard(mode, randomAnimalBoardIndex(data, pool, board, Math.random, recentBoards.current));
  }

  function saveResult() {
    if (!board) return;
    const boardId = board.id ?? `${mode}:${board.animalIds.join(",")}:${board.traitIds.join(",")}`;
    const id = `${playKind}:${date}:${boardId}`;
    const entry: AnimalGameResult = { id, boardId, date, mode, kind: playKind, score: total, optimalChoices,
      averagePlacement: results.reduce((sum, row) => sum + row.rank, 0) / results.length,
      ranks: results.map((row) => row.rank), completedAt: new Date().toISOString() };
    try {
      const current = readAnimalHistory(localStorage.getItem(ANIMAL_HISTORY_KEY));
      // First completion per board/day counts; replaying cannot inflate the rating.
      const next = current.some((row) => row.id === id) ? current : [entry, ...current];
      localStorage.setItem(ANIMAL_HISTORY_KEY, JSON.stringify(next));
      if (signedIn) setHistory((previous) => previous.some((row) => row.id === id) ? previous : [entry, ...previous]);
      else setHistory(next);
      setAccountMessage("Saved on this device");
    } catch { setMessage("Your results could not be saved in this browser."); }
    if (signedIn) {
      fetch("/api/animals/results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ boardId, kind: playKind, assignments }) }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw Error(payload.error ?? "Account saving is unavailable.");
        const saved = readAnimalHistory(JSON.stringify([payload.result]))[0];
        if (!saved) throw Error("Saved result could not be verified.");
        setHistory((previous) => [saved, ...previous.filter((row) => row.id !== saved.id)]);
        setAccountMessage("Saved to your account");
      }).catch(() => setAccountMessage("Account saving is unavailable; your device result is retained."));
    }
  }

  useEffect(() => {
    if (submitted) document.querySelector(".animalShell .results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [submitted]);

  function assign(traitId: string, animalId: string) {
    if (submitted || !board?.traitIds.includes(traitId) || !board.animalIds.includes(animalId)) return;
    sound.play("place");
    setAssignments((previous) => {
      const next = { ...previous };
      const previousTrait = Object.keys(next).find((id) => next[id] === animalId);
      const displaced = next[traitId];
      if (previousTrait === traitId) delete next[traitId];
      else {
        if (previousTrait) {
          if (displaced) next[previousTrait] = displaced;
          else delete next[previousTrait];
        }
        next[traitId] = animalId;
      }
      return next;
    });
    setSelectedTrait(null);
    setSelectedAnimal(null);
    setMessage("");
  }

  function animalPointerHandlers(id: string) {
    return {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (submitted || event.button !== 0) return;
        pointer.current = { id, x: event.clientX, y: event.clientY, moved: false };
        suppressClick.current = false;
        setHeldAnimal(id);
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const start = pointer.current;
        if (!start || start.kind || start.id !== id) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8 && !start.moved) return;
        start.moved = true;
        setDragging({ id, x: event.clientX, y: event.clientY });
        setDropTarget(document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-trait-id]")?.dataset.traitId ?? null);
      },
      onPointerUp(event: PointerEvent<HTMLElement>) {
        const start = pointer.current;
        if (start?.moved) {
          suppressClick.current = true;
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-trait-id]")?.dataset.traitId;
          if (target) assign(target, id);
          else if (document.elementFromPoint(event.clientX, event.clientY)?.closest(".animalPen, .bankPanel")) {
            setAssignments(previous => Object.fromEntries(Object.entries(previous).filter(([, animalId]) => animalId !== id)));
            setSelectedAnimal(null); setSelectedTrait(null);
          }
        }
        pointer.current = null; setDragging(null); setDropTarget(null); setHeldAnimal(null);
      },
      onPointerCancel() { pointer.current = null; setDragging(null); setDropTarget(null); setHeldAnimal(null); },
    };
  }

  function traitPointerHandlers(id: string) {
    return {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (submitted || event.button !== 0 || (event.target as HTMLElement).closest('button, [data-animal-drag="true"]')) return;
        pointer.current = { id, kind: "trait", x: event.clientX, y: event.clientY, moved: false };
        suppressClick.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const start = pointer.current;
        if (!start || start.kind !== "trait" || start.id !== id) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8 && !start.moved) return;
        start.moved = true;
        setDraggingTrait({ id, x: event.clientX, y: event.clientY });
      },
      onPointerUp(event: PointerEvent<HTMLElement>) {
        if (pointer.current?.kind !== "trait") return;
        if (pointer.current.moved) {
          suppressClick.current = true;
          const animalId = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-animal-id]")?.dataset.animalId;
          if (animalId) assign(id, animalId);
        }
        pointer.current = null; setDraggingTrait(null);
      },
      onPointerCancel() { pointer.current = null; setDraggingTrait(null); },
    };
  }

  const results = board?.traitIds.map((id) => {
    const trait = traitMap.get(id)!;
    const ranked = board.animalIds.map((animalId) => ({ animalId, value: valueMap.get(`${animalId}:${id}`)! }))
      .sort((a, b) => trait.direction === "higher_wins"
        ? b.value.valueNumeric - a.value.valueNumeric : a.value.valueNumeric - b.value.valueNumeric);
    const assigned = assignments[id];
    const rank = ranked.findIndex((row) => row.animalId === assigned) + 1;
    return { trait, ranked, selected: ranked[rank - 1], rank,
      points: rank ? config.pointsByRank[rank - 1] : 0 };
  }) ?? [];
  const total = results.reduce((sum, row) => sum + row.points, 0);
  const optimalChoices = results.filter((row) => row.rank === 1).length;


  const submitControl = board ? <div className={presentation === "real" ? "lock" : "animalSubmit"}><button type="button" className={presentation === "real" ? "submitAnswersButton" : undefined} aria-disabled={Object.keys(assignments).length !== board.traitIds.length} onClick={() => {
          if (Object.keys(assignments).length < board.traitIds.length) {
            setMessage(`Choose an animal for all ${board.traitIds.length} traits first.`); return;
          }
          sound.play("result");
          setSubmitted(true);
          setMessage("");
          saveResult();
        }}>Submit answers</button>{message && <p role="status">{message}</p>}<span className="animalProgress" aria-live="polite">{Object.keys(assignments).length} / {board.traitIds.length} placed</span></div> : null;

  return <main className={`animalPage ${presentation === "cute" ? "animalSanctuary countyFair" : "realAnimalPage"}`} data-presentation={presentation} data-animal-count={board?.animalIds.length} data-view={view} data-submitted={submitted} data-motion={motionPaused ? "paused" : "playing"} data-board-habitat={board && board.animalIds.every((id) => ["frog", "salamander"].includes(animalMap.get(id)?.taxonomicGroup ?? "")) ? "pond" : board && board.animalIds.every((id) => ["turtle", "snake", "crocodilian", "lizard", "reptile"].includes(animalMap.get(id)?.taxonomicGroup ?? "")) ? "reptiles" : "forest"}>
    <div className={`animalShell shell ${submitted && view === "play" ? "resultsView" : presentation === "real" && view === "play" ? `activePlay ${mode}Round` : ""}`}>
      <header className="animalGeoHeader">
        <a href="/animals" className="animalGeoBrand"><span className="animalGeoLogo" aria-hidden="true"><svg viewBox="0 0 32 32" width="26" height="26" fill="currentColor"><ellipse cx="8" cy="10" rx="4" ry="5"/><ellipse cx="16" cy="7" rx="4" ry="5"/><ellipse cx="24" cy="10" rx="4" ry="5"/><path d="M7 24c0-5 5-11 9-11s9 6 9 11c0 6-6 3-9 3s-9 3-9-3Z"/></svg></span><h1>AnimalStats</h1></a>
        <nav className="animalGeoModes desktopNavGroup desktopGameNav" aria-label="Difficulty">{(["easy", "normal", "expert"] as const).map(difficulty => <button type="button" key={difficulty} className={`dailyModeButton ${mode === difficulty ? "active" : ""}`} aria-current={mode === difficulty ? "page" : undefined} onClick={() => { setFocusTrait(null); switchBoard(difficulty); }}>{ROUND_CONFIGS[difficulty].label}</button>)}</nav>
        <button className="animalGeoStatsButton headerLink" onClick={() => { setStatsMode(mode); setView("stats"); }}>My Stats</button>
        <details ref={menuRef} className="animalGeoMenu desktopSupportMenu"><summary><span className="fairDesktopHelp">Help &amp; tools</span><span className="fairMobileHelp">Help</span></summary><div onClick={event => { if ((event.target as HTMLElement).closest("button, a") && menuRef.current) menuRef.current.open = false; }}><button onClick={() => showHelp()}>How to play</button><button onClick={() => setPhotoCreditsOpen(true)}>Photo credits</button><button onClick={() => showHelp("scoring")}>Scoring</button><button onClick={() => setView("prizes")}>Categories</button><button onClick={() => setView("guide")}>Full data</button><button aria-pressed={sound.enabled} onClick={sound.toggle}>Game sounds: {sound.enabled ? "on" : "off"}</button>{presentation === "cute" && <button aria-pressed={motionPaused} onClick={() => setMotionPaused(!motionPaused)}>{motionPaused ? "Animate animals" : "Pause animation"}</button>}<GameTools categories={board?.traitIds.map(id => ({ id, name: traitMap.get(id)!.displayName })) ?? []} difficulty={mode} /><a href="/daily">GeoStats</a></div></details>
        <div className="gameAccount"><AccountControls difficulty={mode} hideLeaderboardLink compact /></div>
      </header>
      <section className="challengeBar animalGeoChallenge"><div className="challengeIdentity"><span className="kicker">{config.label} {playKind === "random" ? "Random" : "Daily"}</span></div><div className="challengeActions"><button type="button" aria-pressed={view === "play" && playKind === "daily"} onClick={() => { setFocusTrait(null); setPlayKind("daily"); setView("play"); switchBoard(mode); }}>Daily</button><button type="button" aria-pressed={view === "play" && playKind === "random"} onClick={() => { setFocusTrait(null); setPlayKind("random"); setView("play"); switchBoard(mode, randomAnimalBoardIndex(data, modeBoards, board, Math.random, recentBoards.current)); }}>Random</button>{view !== "play" && <button onClick={() => setView("play")}>Back to game</button>}{view === "play" && <><button onClick={nextBoard}>{playKind === "daily" ? "New random board" : "New board"}</button><button onClick={copyBoard}>{boardCopied ? "Link copied ✓" : "Copy link"}</button></>}</div></section>
      {unavailableBoard && <p role="status" className="animalCoverageNote">This challenge no longer passes the updated data checks. A current board is shown below.</p>}
      <div className="animalPresentationControl"><span className={presentation === "cute" ? "active" : ""}>Cute</span><button type="button" role="switch" aria-label="Static animal photos" aria-checked={presentation === "real"} className="animalPresentationLever" onClick={changePresentation}><span /></button><span className={presentation === "real" ? "active" : ""}>Static</span></div>
      {view === "prizes" || view === "guide" ? <AnimalCatalogView key={view} boards={boards} initialTab={view === "prizes" ? "categories" : "animals"} onPlay={playPrize} /> : view === "stats" ? <section className="animalHistory" aria-label="AnimalStats personal stats">
        <button type="button" className="personalBackButton" onClick={() => setView("play")}>← Back</button><h2>My Stats</h2><nav className="personalModeTabs" aria-label="Stats difficulty">{(["easy", "normal", "expert"] as const).map(difficulty => <button type="button" key={difficulty} className={statsMode === difficulty ? "active" : ""} aria-pressed={statsMode === difficulty} onClick={() => setStatsMode(difficulty)}>{ROUND_CONFIGS[difficulty].label}</button>)}</nav><p className="personalStatsIntro">{signedIn ? "Saved to your account." : "Saved on this device. Sign in to save future results to your account."}</p>
        <div className="personalStats animalStatGrid">{[["Average Score", stats.games ? stats.averageScore.toFixed(1) : "—"], ["Best Result", stats.games ? stats.best : "—"], ["Games Played", stats.games], ["Average Placement", stats.games ? stats.averagePlacement.toFixed(2) : "—"]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>

        {!signedIn && <p><a href="/account">Sign in</a> to save future AnimalStats results to your account.</p>}
        <h3>Game history</h3>{history.filter((row) => row.mode === statsMode).length ? <div className="animalHistoryTable"><table><thead><tr><th>Date</th><th>Play</th><th>Score</th><th>Optimal Choices</th></tr></thead><tbody>{history.filter((row) => row.mode === statsMode).map((row) => <tr key={row.id}><td>{row.date}</td><td>{row.kind}</td><td>{row.score} / {ROUND_CONFIGS[statsMode].maxScore}</td><td>{row.optimalChoices} / {ROUND_CONFIGS[statsMode].categoryCount}</td></tr>)}</tbody></table></div> : <p>Complete a board to start your history.</p>}
        <button className="animalNext" type="button" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(history, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "animalstats-history.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Download history</button>
        <button className="animalNext" type="button" onClick={() => setView("play")}>Back to game</button>
      </section> : !board ? <section className="animalEmpty"><h2>{playKind === "daily" ? "Daily boards are awaiting review" : "More field challenges are in preparation"}</h2><p>{playKind === "daily" ? "A daily board must pass source, uncertainty, and playability review. Numerical validation alone does not approve it." : "We are replacing repetitive boards with more distinctive comparisons. Try another difficulty or explore the Field Guide."}</p><button className="animalNext" type="button" onClick={() => { setPlayKind("random"); switchBoard(playKind === "daily" ? mode : "easy"); }}>{playKind === "daily" ? "Play a random candidate" : "Play Scout"}</button></section> : <>
      {focusTrait && <div className="fairFocusNotice"><span>{traitMap.get(focusTrait)?.displayName}</span><button type="button" onClick={() => { setFocusTrait(null); switchBoard(mode); }}>All categories ×</button></div>}
      {!submitted && <>
        <div className="animalToolbar"><p className="animalInstruction">Match animals to {presentation === "cute" ? "prizes" : "statistics"}. Use each animal once.</p><button type="button" className="animalNext" onClick={() => { setAssignments({}); setSelectedAnimal(null); setSelectedTrait(null); setMessage(""); }}>Reset choices</button></div>

        {presentation === "cute" ? <div className="animalPlayBoard sanctuaryBoard">
          <section className="animalPen" aria-label="Animal pen">
            <div className="penSky" aria-hidden="true"><i className="penSun"/><i className="penCloud penCloudOne"/><i className="penCloud penCloudTwo"/><i className="penButterfly">✦</i></div>
            <div className="penSign"><span>Animals</span><small>{board.animalIds.length - Object.keys(assignments).length} available</small></div>
            <div className="penFence penFenceBack" aria-hidden="true"/>
            <section className="animalBank" aria-label="Available animals">
              {board.animalIds.map((id, index) => {
                const animal = animalMap.get(id)!;
                const usedOn = Object.keys(assignments).find((key) => assignments[key] === id);
                return <button type="button" key={id} aria-label={animal.commonName} aria-pressed={selectedAnimal === id}
                  data-animal-id={id} data-name-open={heldAnimal === id || selectedAnimal === id} data-on-podium={!!usedOn}
                  className={`animalCard penAnimal ${usedOn ? "used" : ""} ${selectedAnimal === id ? "selected" : ""} ${dragging?.id === id ? "beingDragged" : ""}`}
                  style={{ "--animal-delay": `${index * -.71}s`, "--roam-direction": index % 2 ? "-1" : "1" } as CSSProperties}
                  {...animalPointerHandlers(id)}
                  onClick={() => {
                    if (suppressClick.current) { suppressClick.current = false; return; }
                    if (selectedTrait) assign(selectedTrait, id);
                    else { setSelectedAnimal(selectedAnimal === id ? null : id); setMessage(""); }
                  }}>
                  <AnimalSprite animal={animal}/>
                  <span className="animalNameTag">{animal.commonName}</span>
                  {usedOn && <small className="penAssigned" aria-label={`Assigned to ${traitMap.get(usedOn)?.displayName}`}>Entered</small>}
                </button>;
              })}
            </section>
            <div className="penFence penFenceFront" aria-hidden="true"/>
            <div className="penFlowers" aria-hidden="true"><i>✿</i><i>✿</i><i>✿</i></div>
          </section>
          <div className="podiumSectionTitle"><span>Prizes</span></div>
          <section className="animalTraits podiumGrid" aria-label="Trait podiums">
            {board.traitIds.map((id, index) => {
              const trait = traitMap.get(id)!;
              const animal = animalMap.get(assignments[id]);
              return <div role="button" tabIndex={0} key={id} data-trait-id={id} data-prize-family={trait.metricKey} className={`animalTrait traitPodium ${animal ? "occupied" : ""} ${selectedTrait === id || dropTarget === id ? "selected" : ""}`}
                {...traitPointerHandlers(id)}
                aria-label={`${trait.displayName}: ${animal ? animal.commonName : "empty podium"}`} aria-pressed={selectedTrait === id}
                onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); selectedAnimal ? assign(id, selectedAnimal) : setSelectedTrait(selectedTrait === id ? null : id); } }}
                onClick={() => {
                  if (suppressClick.current) { suppressClick.current = false; return; }
                  selectedAnimal ? assign(id, selectedAnimal) : setSelectedTrait(selectedTrait === id ? null : id);
                }}>
                {animal && <button type="button" className="podiumRemove" aria-label={`Remove ${animal.commonName} from ${trait.displayName}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); sound.play("remove"); setAssignments(previous => { const next = { ...previous }; delete next[id]; return next; }); setSelectedAnimal(null); setSelectedTrait(null); setMessage(""); }}>×</button>}
                <span className="podiumBadge" aria-hidden="true">★</span>
                <span className="podiumAnimal" data-animal-drag={animal ? "true" : undefined} {...(animal ? animalPointerHandlers(animal.id) : {})}>
                  {animal ? <><AnimalSprite animal={animal}/><span className="podiumNameTag">{animal.commonName}</span></> : <svg className="podiumEmpty" viewBox="0 0 180 160" aria-hidden="true"><ellipse cx="90" cy="136" rx="36" ry="6"/><path d="M64 43h52v31c0 33-52 33-52 0Z M64 49H49v18c0 14 12 19 22 19 M116 49h15v18c0 14-12 19-22 19 M90 99v24 M70 128h40"/><path d="m90 53 4 9 10 1-8 7 2 10-8-5-8 5 2-10-8-7 10-1Z"/></svg>}
                </span>
                <span className="podiumTop" aria-hidden="true"/>
                <span className="podiumPlaque">
                  <span className="animalTraitName"><AnimalCategoryLabel trait={trait} /></span>
                  <span className="animalTraitDefinition">{trait.playerHint ?? trait.definition}</span>
                  <span className="animalTraitChoice">{animal ? animal.commonName : "Enter a contestant"}</span>

                </span>
              </div>;
            })}
          </section>
        </div> : <div className={`grid playGrid ${selectedAnimal ? "holdingCountry" : ""} ${selectedTrait ? "choosingCountry" : ""}`}>
          <section className="panel bankPanel"><div className="panelTitle"><div><h3>Your animals</h3></div><small>{board.animalIds.length} animals · use each once</small></div>
            <div className="countries" aria-label="Available animals">{board.animalIds.map(id => { const animal = animalMap.get(id)!; const used = Object.values(assignments).includes(id); return <button type="button" key={id} data-animal-id={id} className={`country ${selectedAnimal === id ? "selected" : ""} ${used ? "used" : ""}`} aria-label={animal.commonName} aria-pressed={selectedAnimal === id} {...animalPointerHandlers(id)} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } if (selectedTrait) assign(selectedTrait, id); else setSelectedAnimal(selectedAnimal === id ? null : id); }}><span><AnimalPortrait animal={animal} photo={photoMap.get(id)} presentation="real" /></span><div><strong>{animal.commonName}</strong></div>{used && <b>USED</b>}</button>; })}</div>
          </section><div className="boardSpine" aria-hidden="true" />
          <section className="panel boardPanel"><div className="panelTitle"><div><h3>Make your matches</h3></div></div><div className="slots" aria-label="Measures to match">{board.traitIds.map(id => { const trait = traitMap.get(id)!; const animal = animalMap.get(assignments[id]); return <div key={id} data-trait-id={id} className={`slot ${animal ? "assigned" : ""} ${selectedTrait === id ? "selectedCategory" : ""} ${dropTarget === id ? "touchTarget" : ""}`} role="button" tabIndex={0} aria-label={`${trait.displayName}: ${animal ? animal.commonName : "empty match"}`} aria-pressed={selectedTrait === id} {...traitPointerHandlers(id)} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } selectedAnimal ? assign(id, selectedAnimal) : setSelectedTrait(selectedTrait === id ? null : id); }} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); selectedAnimal ? assign(id, selectedAnimal) : setSelectedTrait(selectedTrait === id ? null : id); } }}><span className="cornerNotch" aria-hidden="true" /><div className="category"><span className="desktopCategoryIcon">{animalTraitIcon(trait)}</span><div className="categoryCopy"><strong><AnimalCategoryLabel trait={trait} /></strong><small>{trait.playerHint ?? trait.definition}</small></div></div><div className={`choice ${animal ? "filled" : ""}`} data-animal-drag={animal ? "true" : undefined} {...(animal ? animalPointerHandlers(animal.id) : {})}>{animal ? <><span className="pieceFlag"><AnimalPortrait animal={animal} photo={photoMap.get(animal.id)} presentation="real" /></span><strong className="pieceName">{animal.commonName}</strong><button type="button" className="removePiece" aria-label={`Remove ${animal.commonName} from ${trait.displayName}`} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); sound.play("remove"); setAssignments(previous => { const next = { ...previous }; delete next[id]; return next; }); setSelectedAnimal(null); setSelectedTrait(null); }}>×</button></> : <em>{selectedAnimal ? "Place here" : selectedTrait === id ? "Choose an animal" : "Assign animal"}</em>}</div></div>; })}</div>{submitControl}</section>
        </div>}

        {draggingTrait && <div className="animalDragGhost animalTraitGhost" style={{ left: draggingTrait.x, top: draggingTrait.y }}>{traitMap.get(draggingTrait.id)?.displayName}</div>}
        {dragging && <div className="animalDragGhost sanctuaryDragGhost" style={{ left: dragging.x, top: dragging.y }}><AnimalPortrait animal={animalMap.get(dragging.id)!} photo={photoMap.get(dragging.id)} presentation={presentation} /><span>{animalMap.get(dragging.id)?.commonName}</span></div>}
        {presentation === "cute" && submitControl}
      </>}
      {submitted && <>
        {accountMessage && <p role="status" className="animalSaveStatus">{accountMessage}</p>}
        <AnimalResults data={data} board={board} results={results} mode={mode} total={total} optimalChoices={optimalChoices} presentation={presentation} onModeChange={difficulty => { setFocusTrait(null); switchBoard(difficulty); }} onNext={nextBoard} shareActions={<><details className="scoreShareOptions"><summary className="shareScore">Share score</summary><div className="scoreShareMenu"><button type="button" onClick={() => void shareResult()}>{copied ? "Score copied ✓" : "Copy score"}</button><button type="button" onClick={() => void shareResult(true)}>More sharing options</button></div></details><span className="sr-only" role="status">{copied ? "Score copied to clipboard" : ""}</span><AnimalScoreImage key={board.id} total={total} maximum={config.maxScore} optimal={optimalChoices} categories={board.traitIds.length} difficulty={config.label} kind={playKind} date={date} challengeUrl={() => challengeUrl(board.id!)} /></>} />
        <div className="resultsGameTools"><GameTools categories={board.traitIds.map(id=>({id,name:traitMap.get(id)!.displayName}))} difficulty={mode}/></div>
      </>}
      </>}
    </div>
    {manualScoreCopy && <div className="modal copyFallback" role="dialog" aria-modal="true" aria-label={manualCopyKind === "score" ? "Copy your score" : "Copy challenge link"} onClick={event=>{if(event.target===event.currentTarget)setManualScoreCopy("");}}><div ref={copyPanelRef}><h2>{manualCopyKind === "score" ? "Copy your score" : "Copy challenge link"}</h2><p>Your browser blocked automatic copying. Select the text below and copy it.</p><textarea aria-label={manualCopyKind === "score" ? "Score to copy" : "Challenge link to copy"} readOnly value={manualScoreCopy} onFocus={event=>event.currentTarget.select()} rows={7} autoFocus/><button type="button" onClick={()=>setManualScoreCopy("")}>Close</button></div></div>}
    {photoCreditsOpen && <AnimalPhotoCredits photos={data.photos} animals={data.animals} onClose={() => setPhotoCreditsOpen(false)} />}
    {helpOpen && <div className="modal rulesModal" onClick={event => event.target === event.currentTarget && setHelpOpen(false)}><section ref={helpRef} className="rulesModalCard" role="dialog" aria-modal="true" aria-labelledby="rulesTitle" onKeyDown={event => { if (event.key === "Escape") setHelpOpen(false); }}><h2 id="rulesTitle">{helpTopic === "scoring" ? "Scoring" : "How to play"}</h2>{helpTopic === "play" ? <ol><li><strong>Choose an animal and a prize.</strong> Click either one first, or drag in either direction.</li><li><strong>Use each animal once.</strong> Move to swap prizes, or select × to remove a choice.</li><li><strong>Submit your answers.</strong> See your placements and explore the rankings.</li></ol> : <><p>First place among the animals on your board earns 100 points.</p><p>{config.label}: {config.pointsByRank.map((points, index) => `${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"} = ${points}`).join(" · ")} points.</p><p>Your score adds up all {config.categoryCount} matches, for a maximum of {config.maxScore}.</p></>}<button type="button" onClick={() => setHelpOpen(false)}>Back to game</button></section></div>}

  </main>;
}
