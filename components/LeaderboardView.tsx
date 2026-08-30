"use client";

import { useEffect, useState } from "react";
import { ROUND_CONFIGS, type DailyDifficulty } from "../lib/gameRules";
import AccountControls from "./AccountControls";

type TodayLeader = { username: string; score: number; averagePlacement: number; firsts: number; topFinishes: number };
type AllTimeLeader = { username: string; games: number; averagePercent: number; averagePlacement: number; normalizedPerformance: number; rating: number };
type RatingMethod = { name?: string; description?: string; confidenceGames?: number; dayPriorGames?: number };
type LoadError = { kind: "auth" | "network" | "server"; message: string } | null;

function requestedDifficulty(): DailyDifficulty {
  if (typeof window === "undefined") return "easy";
  const value = new URLSearchParams(window.location.search).get("difficulty");
  return value === "normal" || value === "expert" ? value : "easy";
}

function requestedView(): "today" | "alltime" {
  if (typeof window === "undefined") return "today";
  return new URLSearchParams(window.location.search).get("view") === "alltime" ? "alltime" : "today";
}

function updateLocation(difficulty: DailyDifficulty, view: "today" | "alltime") {
  const url = new URL(window.location.href);
  url.searchParams.set("difficulty", difficulty);
  if (view === "alltime") url.searchParams.set("view", view);
  else url.searchParams.delete("view");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function LeaderboardView() {
  const [difficulty, setDifficulty] = useState<DailyDifficulty>("easy");
  const [tab, setTab] = useState<"today" | "alltime">("today");
  const [today, setToday] = useState<TodayLeader[]>([]);
  const [alltime, setAlltime] = useState<AllTimeLeader[]>([]);
  const [ratingMethod, setRatingMethod] = useState<RatingMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const syncFromLocation = () => {
      setDifficulty(requestedDifficulty());
      setTab(requestedView());
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
        const response = await fetch(`/api/leaderboard?view=${tab}&difficulty=${difficulty}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
          setError({ kind: "auth", message: "Your session expired. Sign in again to view the account-only standings." });
          return;
        }
        if (!response.ok) {
          setError({ kind: "server", message: data.error ?? "The standings could not be loaded right now." });
          return;
        }
        if (tab === "today") setToday(data.leaders ?? []);
        else {
          setAlltime(data.leaders ?? []);
          setRatingMethod(data.ratingMethod ?? null);
        }
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
  }, [tab, difficulty, reloadKey]);

  function chooseDifficulty(next: DailyDifficulty) {
    setDifficulty(next);
    updateLocation(next, tab);
  }

  function chooseTab(next: "today" | "alltime") {
    setTab(next);
    updateLocation(difficulty, next);
  }

  const rows = tab === "today" ? today : alltime;
  const config = ROUND_CONFIGS[difficulty];
  return <section className="leaderboardPage panel">
    <div className="leaderboardPageIntro">
      <span className="kicker">Account-only competition</span>
      <h1>Leaderboard</h1>
      <p>Scout, Adventurer, and Expert each have separate verified standings. Your score saves automatically when you finish a Daily while signed in.</p>
    </div>
    <div className="leaderboardModeTabs" role="tablist" aria-label="Daily difficulty">
      <button type="button" role="tab" aria-selected={difficulty === "easy"} aria-controls="leaderboard-results" className={difficulty === "easy" ? "active" : ""} onClick={() => chooseDifficulty("easy")}>Scout</button>
      <button type="button" role="tab" aria-selected={difficulty === "normal"} aria-controls="leaderboard-results" className={difficulty === "normal" ? "active" : ""} onClick={() => chooseDifficulty("normal")}>Adventurer</button>
      <button type="button" role="tab" aria-selected={difficulty === "expert"} aria-controls="leaderboard-results" className={difficulty === "expert" ? "active" : ""} onClick={() => chooseDifficulty("expert")}>Expert</button>
    </div>
    <div className="leaderboardTabs" role="tablist" aria-label="Leaderboard period">
      <button type="button" role="tab" aria-selected={tab === "today"} aria-controls="leaderboard-results" className={tab === "today" ? "active" : ""} onClick={() => chooseTab("today")}>Today</button>
      <button type="button" role="tab" aria-selected={tab === "alltime"} aria-controls="leaderboard-results" className={tab === "alltime" ? "active" : ""} onClick={() => chooseTab("alltime")}>All time</button>
    </div>
    {tab === "alltime" && <div className="ratingExplainer">
      <strong>Board-adjusted rating</strong>
      <span>{ratingMethod?.description ?? "Each score is compared with players on that same Daily, then a confidence adjustment balances performance with number of completed Dailies."}</span>
    </div>}
    <div id="leaderboard-results" role="tabpanel" aria-live="polite" aria-busy={loading}>
      {loading ? <div className="leaderboardEmpty">Loading {config.label} leaderboard…</div> : error ? <div className="leaderboardError" role="alert">
        <strong>Standings unavailable</strong>
        <p>{error.message}</p>
        {error.kind === "auth" ? <AccountControls context="leaderboard" ctaLabel="Sign in again" hideLeaderboardLink /> : <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Try again</button>}
      </div> : rows.length ? <div className={`publicLeaderboard ${tab === "alltime" ? "allTimeLeaderboard" : ""}`} role="table" aria-label={`${config.label} ${tab === "today" ? "today" : "all-time"} standings`}>
        <div className="publicLeaderboardHeader" role="row"><span role="columnheader">#</span><span role="columnheader">Player</span>{tab === "today" ? <><span role="columnheader">Score</span><span role="columnheader">Avg. place</span><span role="columnheader">Top {config.topFinishRank}</span></> : <><span role="columnheader">Avg. %</span><span role="columnheader">Board adj.</span><span role="columnheader">Dailies</span><span role="columnheader">Rating</span></>}</div>
        {tab === "today" ? today.map((leader, index) => <div role="row" key={`${leader.username}-${index}`}><b role="cell">{index + 1}</b><span role="cell">{leader.username}</span><strong role="cell">{leader.score}</strong><span role="cell">{leader.averagePlacement.toFixed(1)}</span><span role="cell">{leader.topFinishes}</span></div>) : alltime.map((leader, index) => <div role="row" key={leader.username}><b role="cell">{index + 1}</b><span role="cell">{leader.username}</span><span role="cell">{leader.averagePercent.toFixed(1)}%</span><span role="cell">{leader.normalizedPerformance.toFixed(1)}</span><span role="cell">{leader.games}</span><strong role="cell">{leader.rating.toFixed(1)}</strong></div>)}
      </div> : <div className="leaderboardEmpty">{tab === "today" ? `No verified ${config.label} scores yet today.` : `No one has qualified for the ${config.label} leaderboard yet. Five completed Dailies are required.`}</div>}
    </div>
    <div className="leaderboardPageActions"><a href={config.path}>Play today’s {config.label} Daily</a></div>
  </section>;
}
