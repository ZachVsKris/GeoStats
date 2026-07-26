import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/server";
import { newYorkDate } from "../../../lib/time";
import { ROUND_CONFIGS, type DailyDifficulty } from "../../../lib/gameRules";

type Profile = { username?: string; display_name?: string | null };
type ScoreRow = {
  user_id: string;
  challenge_date: string;
  difficulty: DailyDifficulty;
  score: number;
  average_placement: number | string;
  firsts: number;
  top_fives: number;
  profiles: Profile | Profile[] | null;
};
type LeaderEntry = {
  username: string;
  displayName: string | null;
  rawScores: number[];
  performances: number[];
  placements: number[];
};

const dailyDate = () => newYorkDate();
const profileOf = (raw: ScoreRow["profiles"]) => Array.isArray(raw) ? raw[0] : raw;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

function parseDifficulty(value: string | null): DailyDifficulty {
  return value === "normal" || value === "expert" ? value : "easy";
}

function mean(values: number[], fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function variance(values: number[], center = mean(values)) {
  return values.length ? mean(values.map((value) => (value - center) ** 2)) : 0;
}

export async function GET(request: Request) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ configured: false, leaders: [] });
  const url = new URL(request.url);
  const view = url.searchParams.get("view") === "today" ? "today" : "alltime";
  const difficulty = parseDifficulty(url.searchParams.get("difficulty"));
  let query = supabase
    .from("daily_scores")
    .select("user_id,challenge_date,difficulty,score,average_placement,firsts,top_fives,profiles(username,display_name)")
    .eq("difficulty", difficulty);

  if (view === "today") {
    query = query.eq("challenge_date", url.searchParams.get("date") || dailyDate());
  } else {
    query = query.lte("score", ROUND_CONFIGS[difficulty].maxScore);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as ScoreRow[];

  if (view === "today") {
    const leaders = rows.map((row) => {
      const profile = profileOf(row.profiles);
      return {
        username: profile?.username ?? "player",
        displayName: profile?.display_name ?? null,
        score: row.score,
        averagePlacement: Number(row.average_placement),
        firsts: row.firsts,
        topFinishes: row.top_fives,
      };
    }).sort((a, b) => b.score - a.score || a.averagePlacement - b.averagePlacement || b.firsts - a.firsts || b.topFinishes - a.topFinishes).slice(0, 100);
    return NextResponse.json({ view, difficulty, date: url.searchParams.get("date") || dailyDate(), leaders }, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  }

  const maxScore = ROUND_CONFIGS[difficulty].maxScore;
  const ratios = rows.map((row) => row.score / maxScore);
  const globalMean = mean(ratios, .5);
  const globalVariance = Math.max(variance(ratios, globalMean), .0064); // at least an 8-point standard deviation on a 0–100 scale
  const dayPriorGames = 8;
  const byDate = new Map<string, number[]>();
  for (const row of rows) {
    const list = byDate.get(row.challenge_date) ?? [];
    list.push(row.score / maxScore);
    byDate.set(row.challenge_date, list);
  }

  const dayStats = new Map<string, { mean: number; std: number; players: number }>();
  for (const [date, dayRatios] of byDate) {
    const observedMean = mean(dayRatios, globalMean);
    const observedVariance = variance(dayRatios, observedMean);
    const shrunkMean = (observedMean * dayRatios.length + globalMean * dayPriorGames) / (dayRatios.length + dayPriorGames);
    const shrunkVariance = (observedVariance * dayRatios.length + globalVariance * dayPriorGames) / (dayRatios.length + dayPriorGames);
    dayStats.set(date, { mean: shrunkMean, std: Math.max(Math.sqrt(shrunkVariance), .08), players: dayRatios.length });
  }

  const byUser = new Map<string, LeaderEntry>();
  const allPerformances: number[] = [];
  for (const row of rows) {
    const profile = profileOf(row.profiles);
    const current: LeaderEntry = byUser.get(row.user_id) ?? {
      username: profile?.username ?? "player",
      displayName: profile?.display_name ?? null,
      rawScores: [],
      performances: [],
      placements: [],
    };
    const ratio = row.score / maxScore;
    const stats = dayStats.get(row.challenge_date) ?? { mean: globalMean, std: Math.sqrt(globalVariance), players: 0 };
    const performance = clamp(50 + 15 * ((ratio - stats.mean) / stats.std), 0, 100);
    current.rawScores.push(row.score);
    current.performances.push(performance);
    current.placements.push(Number(row.average_placement));
    allPerformances.push(performance);
    byUser.set(row.user_id, current);
  }

  const baseline = mean(allPerformances, 50);
  const confidenceGames = 20;
  const leaders = [...byUser.values()].map((entry) => {
    const games = entry.rawScores.length;
    const average = mean(entry.rawScores);
    const averagePlacement = mean(entry.placements);
    const normalizedPerformance = mean(entry.performances, baseline);
    const rating = (normalizedPerformance * games + baseline * confidenceGames) / (games + confidenceGames);
    return {
      username: entry.username,
      displayName: entry.displayName,
      games,
      average: Math.round(average),
      averagePlacement: Number(averagePlacement.toFixed(2)),
      normalizedPerformance: Number(normalizedPerformance.toFixed(1)),
      rating: Number(rating.toFixed(1)),
    };
  }).filter((entry) => entry.games >= 5)
    .sort((a, b) => b.rating - a.rating || a.averagePlacement - b.averagePlacement || b.games - a.games || b.average - a.average)
    .slice(0, 100);

  return NextResponse.json({
    view,
    difficulty,
    maxScore,
    baseline: Number(baseline.toFixed(1)),
    leaders,
    ratingMethod: {
      name: "Board-relative Bayesian rating",
      description: "Each score is standardized against the player distribution for that same Daily, with small cohorts shrunk toward the mode-wide distribution. A 20-game confidence prior then balances performance and experience.",
      confidenceGames,
      dayPriorGames,
    },
  }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
