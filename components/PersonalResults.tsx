"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { DAILY_DIFFICULTIES, ROUND_CONFIGS, LEGACY_V16_2_3_ROUND_CONFIGS, type DailyDifficulty } from "../lib/gameRules";
import { usesCurrentScoreScale } from "../lib/leaderboardRating";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

type Result = { challenge_date: string; difficulty: DailyDifficulty; score: number; rules_version: string | null };
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
  const maximum = (r: Result) => (usesCurrentScoreScale(r.rules_version) ? ROUND_CONFIGS : LEGACY_V16_2_3_ROUND_CONFIGS)[r.difficulty].maxScore;
  const currentScaleScore = (r: Result) => r.score / maximum(r) * config.maxScore;
  const average = history.length ? (history.reduce((sum, r) => sum + currentScaleScore(r), 0) / history.length).toFixed(1) : "—";
  const best = history.length ? Math.round(Math.max(...history.map(currentScaleScore))).toString() : "—";
  const hasOlderScores = history.some((r) => !usesCurrentScoreScale(r.rules_version));

  function selectMode(next: DailyDifficulty) { setMode(next); setShowRatingInfo(false); }
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, current: DailyDifficulty) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const index = DAILY_DIFFICULTIES.indexOf(current);
    const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
    selectMode(DAILY_DIFFICULTIES[next]);
    document.getElementById(`stats-tab-${DAILY_DIFFICULTIES[next]}`)?.focus();
  }

  return <section className="panel personalResults"><h1>My Stats</h1>
    {status === "loading" && <p>Loading your results…</p>}
    {status === "guest" && <p>Sign in or create an account to save Daily results and see your history here. Use the account button above to get started.</p>}
    {status === "error" && <p role="alert">Your results could not be loaded. Please refresh the page.</p>}
    {status === "ready" && <>
      <div className="personalModeTabs" role="tablist" aria-label="Daily difficulty">
        {DAILY_DIFFICULTIES.map((difficulty) => <button key={difficulty} id={`stats-tab-${difficulty}`} type="button" role="tab" aria-selected={mode === difficulty} aria-controls="personal-stats-panel" tabIndex={mode === difficulty ? 0 : -1} onClick={() => selectMode(difficulty)} onKeyDown={(event) => moveTab(event, difficulty)}>{ROUND_CONFIGS[difficulty].label}</button>)}
      </div>
      <div id="personal-stats-panel" role="tabpanel" aria-labelledby={`stats-tab-${mode}`}>
        <div className="personalStats">
          <div><strong>{history.length}</strong><span>Dailies completed</span></div>
          <div><strong>{average}{history.length > 0 && <small> / {config.maxScore}</small>}</strong><span>Average score</span></div>
          <div><strong>{best}{history.length > 0 && <small> / {config.maxScore}</small>}</strong><span>Best result</span></div>
          <div><strong>{ratings[mode] == null ? "—" : ratings[mode].toFixed(1)}{ratings[mode] != null && <small> / 100</small>}</strong><span className="ratingLabel">Player rating <button type="button" className="ratingInfoButton" aria-label="How is player rating calculated?" aria-expanded={showRatingInfo} aria-controls="rating-explanation" onClick={() => setShowRatingInfo((open) => !open)}>i</button></span></div>
        </div>
        {showRatingInfo && <p id="rating-explanation" className="ratingExplanation">Your rating uses the same method as the earlier leaderboard. It combines your score as a share of the possible points with how you performed against players on the same Daily. Peer comparison starts when five players complete that board and reaches full weight at 20. The result is adjusted toward the overall average until you have more completed games; the adjustment has the weight of 10 games. Ratings are out of 100 and may change as more players finish a board. With fewer than five Dailies in this mode, treat your rating as provisional.</p>}
        <h2>{config.label} history</h2>
        {history.length ? <><div className="personalHistory">{history.map((r) => <div key={`${r.challenge_date}-${r.difficulty}`} className="personalHistoryRow"><time dateTime={r.challenge_date}>{r.challenge_date}</time><strong>{r.score} / {maximum(r)}</strong></div>)}</div>
          {hasOlderScores && <p className="personalHistoryNote">Older results retain their original scores above. Average and best scores are converted to today’s {config.maxScore}-point scale for comparison.</p>}
        </> : <p>No saved {config.label} results yet. Play a Daily while signed in to start your history.</p>}
      </div>
    </>}
  </section>;
}
