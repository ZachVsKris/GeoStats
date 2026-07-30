"use client";

import { useEffect, useState } from "react";
import { ROUND_CONFIGS, type DailyDifficulty } from "../lib/gameRules";

type TodayLeader = { username: string; displayName: string | null; score: number; averagePlacement: number; firsts: number; topFinishes: number };
type AllTimeLeader = { username: string; displayName: string | null; games: number; average: number; averagePlacement: number; normalizedPerformance: number; rating: number };
type RatingMethod = { name?: string; description?: string; confidenceGames?: number; dayPriorGames?: number };

function requestedDifficulty(): DailyDifficulty {
  if (typeof window === "undefined") return "easy";
  const value = new URLSearchParams(window.location.search).get("difficulty");
  return value === "normal" || value === "expert" ? value : "easy";
}

export default function LeaderboardView() {
  const [difficulty, setDifficulty] = useState<DailyDifficulty>("easy");
  const [tab, setTab] = useState<"today" | "alltime">("today");
  const [today, setToday] = useState<TodayLeader[]>([]);
  const [alltime, setAlltime] = useState<AllTimeLeader[]>([]);
  const [ratingMethod, setRatingMethod] = useState<RatingMethod | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => setDifficulty(requestedDifficulty()), []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?view=${tab}&difficulty=${difficulty}`)
      .then((response) => response.json())
      .then((data) => {
        if (tab === "today") setToday(data.leaders ?? []);
        else {
          setAlltime(data.leaders ?? []);
          setRatingMethod(data.ratingMethod ?? null);
        }
      })
      .catch(() => tab === "today" ? setToday([]) : setAlltime([]))
      .finally(() => setLoading(false));
  }, [tab, difficulty]);

  const rows = tab === "today" ? today : alltime;
  const config = ROUND_CONFIGS[difficulty];
  return <section className="leaderboardPage panel">
    <div className="leaderboardPageIntro">
      <span className="kicker">Daily competition</span>
      <h1>Leaderboard</h1>
      <p>Scout, Adventurer, and Expert each have separate verified standings. Random games never count.</p>
    </div>
    <div className="leaderboardModeTabs" role="tablist" aria-label="Daily difficulty">
      <button className={difficulty === "easy" ? "active" : ""} onClick={() => setDifficulty("easy")}>Scout</button>
      <button className={difficulty === "normal" ? "active" : ""} onClick={() => setDifficulty("normal")}>Adventurer</button>
      <button className={difficulty === "expert" ? "active" : ""} onClick={() => setDifficulty("expert")}>Expert</button>
    </div>
    <div className="leaderboardTabs" role="tablist" aria-label="Leaderboard period">
      <button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}>Today</button>
      <button className={tab === "alltime" ? "active" : ""} onClick={() => setTab("alltime")}>All time</button>
    </div>
    {tab === "alltime" && <div className="ratingExplainer">
      <strong>Board-adjusted rating</strong>
      <span>{ratingMethod?.description ?? "Each score is compared with players on that same Daily, then a confidence adjustment balances performance with number of completed Dailies."}</span>
    </div>}
    {loading ? <div className="leaderboardEmpty">Loading {config.label} leaderboard…</div> : rows.length ? <div className={`publicLeaderboard ${tab === "alltime" ? "allTimeLeaderboard" : ""}`}>
      <div className="publicLeaderboardHeader"><span>#</span><span>Player</span>{tab === "today" ? <><span>Score</span><span>Avg. place</span><span>Top {config.topFinishRank}</span></> : <><span>Raw avg.</span><span>Board adj.</span><span>Dailies</span><span>Rating</span></>}</div>
      {tab === "today" ? today.map((leader, index) => <div key={`${leader.username}-${index}`}><b>{index + 1}</b><span>{leader.displayName || leader.username}</span><strong>{leader.score}</strong><span>{leader.averagePlacement.toFixed(1)}</span><span>{leader.topFinishes}</span></div>) : alltime.map((leader, index) => <div key={leader.username}><b>{index + 1}</b><span>{leader.displayName || leader.username}</span><span>{leader.average}</span><span>{leader.normalizedPerformance.toFixed(1)}</span><span>{leader.games}</span><strong>{leader.rating.toFixed(1)}</strong></div>)}
    </div> : <div className="leaderboardEmpty">{tab === "today" ? `No verified ${config.label} scores yet today.` : `No one has qualified for the ${config.label} leaderboard yet. Five completed Dailies are required.`}</div>}
    <div className="leaderboardPageActions"><a href={config.path}>Play today’s {config.label} Daily</a></div>
  </section>;
}
