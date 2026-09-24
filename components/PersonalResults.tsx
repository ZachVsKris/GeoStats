"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { DAILY_DIFFICULTIES, ROUND_CONFIGS, type DailyDifficulty } from "../lib/gameRules";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

type Result = { challenge_date: string; difficulty: DailyDifficulty; score: number; average_placement: number | null; rules_version: string | null };
type Ratings = Record<DailyDifficulty, number | null>;
const emptyRatings: Ratings = { easy: null, normal: null, expert: null };

export default function PersonalResults() {
  const [results, setResults] = useState<Result[]>([]);
  const [ratings, setRatings] = useState<Ratings>(emptyRatings);
  const [mode, setMode] = useState<DailyDifficulty>("easy");
  const [showRatingInfo, setShowRatingInfo] = useState(false);
  const [status, setStatus] = useState<"loading" | "guest" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    async function load() {
      try {
        const response = await fetch("/api/me/results", { cache: "no-store" });
        if (!active) return;
        if (response.status === 401) { setStatus("guest"); return; }
        if (!response.ok) throw new Error("Failed to load results");
        const payload = await response.json() as { results: Result[]; ratings: Ratings };
        setResults(payload.results);
        setRatings(payload.ratings);
        setStatus("ready");
      } catch { if (active) setStatus("error"); }
    }
    void load();
    const { data: { subscription } } = supabase?.auth.onAuthStateChange(() => { if (active) void load(); }) ?? { data: { subscription: null } };
    return () => { active = false; subscription?.unsubscribe(); };
  }, []);

  const config = ROUND_CONFIGS[mode];
  const history = results.filter((r) => r.difficulty === mode && Number.isFinite(r.score));
  const average = history.length ? (history.reduce((sum, r) => sum + r.score, 0) / history.length).toFixed(1) : "—";
  const placementResults = history.filter((r) => Number.isFinite(r.average_placement));
  const averagePlacement = placementResults.length
    ? (placementResults.reduce((sum, r) => sum + Number(r.average_placement), 0) / placementResults.length).toFixed(1)
    : "—";
  const best = history.length ? Math.max(...history.map((r) => r.score)) : null;
  const isGuestPreview = status === "guest";

  function selectMode(next: DailyDifficulty) { setMode(next); setShowRatingInfo(false); }
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, current: DailyDifficulty) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const index = DAILY_DIFFICULTIES.indexOf(current);
    const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
    selectMode(DAILY_DIFFICULTIES[next]);
    document.getElementById(`stats-tab-${DAILY_DIFFICULTIES[next]}`)?.focus();
  }

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.assign("/daily");
    }
  }

  return <section className="panel personalResults"><button type="button" className="personalBackButton" onClick={goBack}>← Back</button><h1>My Stats</h1>
    {status === "loading" && <p>Loading your results…</p>}
    {status === "guest" && <p className="personalStatsIntro">Sign in or create an account to get a player rating and track your Daily history, average score, and best result over time.</p>}
    {status === "error" && <p role="alert">Your results could not be loaded. Please refresh the page.</p>}
    {(status === "guest" || status === "ready") && <>
      <div className="personalModeTabs" role="tablist" aria-label="Daily difficulty">
        {DAILY_DIFFICULTIES.map((difficulty) => <button key={difficulty} id={`stats-tab-${difficulty}`} type="button" role="tab" aria-selected={mode === difficulty} aria-controls="personal-stats-panel" tabIndex={mode === difficulty ? 0 : -1} onClick={() => selectMode(difficulty)} onKeyDown={(event) => moveTab(event, difficulty)}>{ROUND_CONFIGS[difficulty].label}</button>)}
      </div>
      <div id="personal-stats-panel" role="tabpanel" aria-labelledby={`stats-tab-${mode}`}>
        <div className={`personalStats${isGuestPreview ? " personalStatsPreview" : ""}`} aria-label={isGuestPreview ? `${config.label} stats preview` : undefined}>
          <div><strong>{isGuestPreview ? "—" : history.length}</strong><span>Dailies completed</span></div>
          <div><strong>{isGuestPreview ? "—" : average}<small> / {config.maxScore}</small></strong><span>Average score</span></div>
          <div><strong>{isGuestPreview ? "—" : best ?? "—"}<small> / {config.maxScore}</small></strong><span>Best result</span></div>
          <div><strong>{isGuestPreview || ratings[mode] == null ? "—" : ratings[mode].toFixed(1)}<small> / 100</small></strong><span className="ratingLabel">Player rating <button type="button" className="ratingInfoButton" aria-label="How is player rating calculated?" aria-expanded={showRatingInfo} aria-controls="rating-explanation" onClick={() => setShowRatingInfo((open) => !open)}>i</button></span></div>
          <div><strong>{isGuestPreview ? "—" : averagePlacement}<small> / {config.countryCount}</small></strong><span>Average placement</span></div>
        </div>
        {showRatingInfo && <div id="rating-explanation" className="ratingExplanation">
          <p>Your rating reflects both <strong>how well you score</strong> and <strong>how consistently you’ve played</strong>.</p>
          <p>Your average score matters most. Games played adds confidence to that average, so one unusually good or bad game won’t determine your rating.</p>
          <p>As you play more games, your rating gets closer to your true average performance.</p>
        </div>}
        {!isGuestPreview && <><h2>{config.label} history</h2>
          {history.length ? <div className="personalHistory">{history.map((r) => <div key={`${r.challenge_date}-${r.difficulty}`} className="personalHistoryRow"><time dateTime={r.challenge_date}>{r.challenge_date}</time><strong>{r.score} / {config.maxScore}</strong><span>{r.average_placement == null ? "—" : `${Number(r.average_placement).toFixed(1)} / ${config.countryCount}`} placement</span></div>)}</div> : <p>No saved {config.label} results yet. Play a Daily while signed in to start your history.</p>}</>}
      </div>
    </>}
  </section>;
}
