"use client";

import { useEffect, useState } from "react";
import { ROUND_CONFIGS, LEGACY_V16_2_3_ROUND_CONFIGS, type DailyDifficulty } from "../lib/gameRules";
import { usesCurrentScoreScale } from "../lib/leaderboardRating";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

type Result = { challenge_date: string; difficulty: DailyDifficulty; score: number; average_placement: number | null; firsts: number | null; completed_at: string; rules_version: string | null };

export default function PersonalResults() {
  const [results, setResults] = useState<Result[]>([]);
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
        const payload = await response.json() as { results: Result[] };
        setResults(payload.results);
        setStatus("ready");
      } catch { if (active) setStatus("error"); }
    }
    void load();
    const { data: { subscription } } = supabase?.auth.onAuthStateChange(() => { if (active) void load(); }) ?? { data: { subscription: null } };
    return () => { active = false; subscription?.unsubscribe(); };
  }, []);
  const valid = results.filter((r) => r.difficulty in ROUND_CONFIGS && Number.isFinite(r.score));
  const maximum = (r: Result) => (usesCurrentScoreScale(r.rules_version) ? ROUND_CONFIGS : LEGACY_V16_2_3_ROUND_CONFIGS)[r.difficulty].maxScore;
  const count = valid.length;
  const percentage = count ? Math.round(valid.reduce((sum, r) => sum + r.score / maximum(r), 0) / count * 100) : 0;
  const recent = valid.slice(0, 10);
  const rating = recent.length ? Math.round(recent.reduce((sum, r) => sum + r.score / maximum(r), 0) / recent.length * 100) : 0;
  return <section className="panel personalResults"><h1>My Stats</h1>
    {status === "loading" && <p>Loading your results…</p>}
    {status === "guest" && <p>Sign in or create an account to save Daily results and see your history here. Use the account button above to get started.</p>}
    {status === "error" && <p role="alert">Your results could not be loaded. Please refresh the page.</p>}
    {status === "ready" && (count ? <>
      <div className="personalStats"><div><strong>{count}</strong><span>Dailies completed</span></div><div><strong>{rating}</strong><span>Personal rating · last {recent.length} games, out of 100</span></div><div><strong>{percentage}%</strong><span>Average of possible points</span></div><div><strong>{Math.max(...valid.map((r) => Math.round(r.score / maximum(r) * 100)))}%</strong><span>Best result</span></div></div>
      <h2>Result history</h2><div className="personalHistory">{valid.map((r) => <div key={`${r.challenge_date}-${r.difficulty}`} className="personalHistoryRow"><time dateTime={r.challenge_date}>{r.challenge_date}</time><span>{ROUND_CONFIGS[r.difficulty].label}</span><strong>{r.score} / {maximum(r)}</strong><span>{Math.round(r.score / maximum(r) * 100)}%</span></div>)}</div>
    </> : <p>No saved results yet. Play a Daily while signed in to start your history.</p>)}
  </section>;
}
