"use client";

import { useEffect, useState } from "react";
import { ROUND_CONFIGS, type DailyDifficulty } from "../lib/gameRules";
import AccountControls from "./AccountControls";

type AllTimeLeader = {
  rank: number;
  username: string;
  averageScore: number;
  rating: number;
  completedGames: number;
  isCurrentPlayer: boolean;
};
type LoadError = { kind: "network" | "server"; message: string } | null;

function requestedDifficulty(): DailyDifficulty {
  if (typeof window === "undefined") return "easy";
  const value = new URLSearchParams(window.location.search).get("difficulty");
  return value === "normal" || value === "expert" ? value : "easy";
}

function updateLocation(difficulty: DailyDifficulty) {
  const url = new URL(window.location.href);
  url.searchParams.set("difficulty", difficulty);
  url.searchParams.delete("view");
  url.searchParams.delete("date");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function LeaderboardView() {
  const [difficulty, setDifficulty] = useState<DailyDifficulty>(() => requestedDifficulty());
  const [alltime, setAlltime] = useState<AllTimeLeader[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const syncFromLocation = () => {
      setDifficulty(requestedDifficulty());
    };
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    async function loadLeaderboard() {
      try {
        const response = await fetch(`/api/leaderboard?difficulty=${difficulty}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError({ kind: "server", message: data.error ?? "The standings could not be loaded right now." });
          return;
        }
        setAlltime(data.leaders ?? []);
        setSignedIn(data.signedIn === true);
      } catch (caught) {
        if ((caught as Error).name !== "AbortError") {
          setError({ kind: "network", message: "GeoStats could not reach the standings service. Check your connection and try again." });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadLeaderboard();
    return () => controller.abort();
  }, [difficulty, reloadKey]);

  function chooseDifficulty(next: DailyDifficulty) {
    setDifficulty(next);
    updateLocation(next);
  }

  const config = ROUND_CONFIGS[difficulty];
  const currentPlayerIsRanked = alltime.some((leader) => leader.isCurrentPlayer);
  return <section className="leaderboardPage panel">
    <div className="leaderboardPageIntro">
      <span className="kicker">All-time standings</span>
      <h1>Leaderboard</h1>
      <p>See how GeoStats players perform over time. Scout, Adventurer, and Expert each have separate verified standings.</p>
      <p className="leaderboardMethodNote">Rating balances normalized score with opponent strength once a Daily has enough players. Completed games increase confidence, not points; five games are required to qualify.</p>
    </div>
    <div className="leaderboardModeTabs" role="tablist" aria-label="Daily difficulty">
      <button type="button" role="tab" aria-selected={difficulty === "easy"} aria-controls="leaderboard-results" className={difficulty === "easy" ? "active" : ""} onClick={() => chooseDifficulty("easy")}>Scout</button>
      <button type="button" role="tab" aria-selected={difficulty === "normal"} aria-controls="leaderboard-results" className={difficulty === "normal" ? "active" : ""} onClick={() => chooseDifficulty("normal")}>Adventurer</button>
      <button type="button" role="tab" aria-selected={difficulty === "expert"} aria-controls="leaderboard-results" className={difficulty === "expert" ? "active" : ""} onClick={() => chooseDifficulty("expert")}>Expert</button>
    </div>
    <div id="leaderboard-results" role="tabpanel" aria-live="polite" aria-busy={loading}>
      {loading ? <div className="leaderboardSkeleton" aria-label={`Loading ${config.label} leaderboard`}>
        <span>Loading {config.label} standings…</span>
        {[0, 1, 2, 3, 4].map((row) => <div key={row} aria-hidden="true"><i /><i /><i /><i /><i /></div>)}
      </div> : error ? <div className="leaderboardError" role="alert">
        <strong>Standings unavailable</strong>
        <p>{error.message}</p>
        <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Try again</button>
      </div> : alltime.length ? <div className="publicLeaderboard allTimeLeaderboard" role="table" aria-label={`${config.label} all-time standings`}>
        <div className="publicLeaderboardHeader" role="row"><span role="columnheader">Rank</span><span role="columnheader">Player</span><span role="columnheader">Average score</span><span role="columnheader">Rating</span><span role="columnheader">Completed games</span></div>
        {alltime.map((leader) => <div role="row" key={`${leader.rank}-${leader.username}`} className={leader.isCurrentPlayer ? "currentPlayerRow" : undefined} aria-label={leader.isCurrentPlayer ? `${leader.username}, your standing` : undefined}><b role="cell">{leader.rank}</b><span role="cell">{leader.username}{leader.isCurrentPlayer && <small className="currentPlayerBadge">You</small>}</span><span role="cell">{leader.averageScore.toFixed(1)} / {config.maxScore}</span><strong role="cell">{leader.rating.toFixed(1)}</strong><span role="cell">{leader.completedGames}</span></div>)}
      </div> : <div className="leaderboardEmpty">No one has qualified for the {config.label} leaderboard yet. Five completed Dailies are required.</div>}
    </div>
    {!loading && !error && (!signedIn ? <div className="leaderboardJoinPrompt"><strong>Create a free account to join the standings</strong><p>Unlock Expert Daily, save verified scores across all three modes, and compete under a public GeoStats username. Your email stays private.</p><AccountControls context="leaderboard" ctaLabel="Sign in to join leaderboard" hideLeaderboardLink /><small>Scout and Adventurer remain playable without an account.</small></div> : !currentPlayerIsRanked ? <div className="leaderboardQualificationNote">You’re signed in. Complete five {config.label} Dailies to qualify for these standings.</div> : null)}
    <div className="leaderboardPageActions"><a href={config.path}>Play today’s {config.label} Daily</a></div>
  </section>;
}
