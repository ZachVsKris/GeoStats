import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "../../../lib/supabase/server";
import { newYorkDate } from "../../../lib/time";
import { LEGACY_V16_2_3_ROUND_CONFIGS, ROUND_CONFIGS, type DailyDifficulty } from "../../../lib/gameRules";
import { LEADERBOARD_RATING_VERSION, RULES_VERSION } from "../../../lib/version";

type Profile = { username?: string };
type ScoreRow = {
  user_id: string;
  challenge_date: string;
  difficulty: DailyDifficulty;
  score: number;
  average_placement: number | string;
  firsts: number;
  top_fives: number;
  board_normalization_version?: string | null;
  leaderboard_rating_version?: string | null;
  rules_version?: string | null;
  profiles: Profile | Profile[] | null;
};
type LeaderEntry = {
  username: string;
  rawScores: number[];
  scoreRatios: number[];
  performances: number[];
  placements: number[];
};

const dailyDate = () => newYorkDate();
const profileOf = (raw: ScoreRow["profiles"]) => Array.isArray(raw) ? raw[0] : raw;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const privateJson = (body: unknown, status = 200) => NextResponse.json(body, {
  status,
  headers: { "Cache-Control": "private, no-store" },
});

function isScoreRow(value: unknown): value is ScoreRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const difficulty = row.difficulty;
  const profiles = row.profiles;
  const validProfiles = profiles === null
    || (typeof profiles === "object" && !Array.isArray(profiles))
    || (Array.isArray(profiles) && profiles.every((profile) => profile && typeof profile === "object"));
  return typeof row.user_id === "string"
    && typeof row.challenge_date === "string"
    && (difficulty === "easy" || difficulty === "normal" || difficulty === "expert")
    && typeof row.score === "number"
    && (typeof row.average_placement === "number" || typeof row.average_placement === "string")
    && typeof row.firsts === "number"
    && typeof row.top_fives === "number"
    && validProfiles;
}

function parseDifficulty(value: string | null): DailyDifficulty {
  return value === "normal" || value === "expert" ? value : "easy";
}

function mean(values: number[], fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function variance(values: number[], center = mean(values)) {
  return values.length ? mean(values.map((value) => (value - center) ** 2)) : 0;
}

function scoreMaximum(row: Pick<ScoreRow, "difficulty" | "rules_version">) {
  // v16.2.5 changes catalog/UI policy but not the v16.2.4 board dimensions or
  // score curves. Scores from either release therefore share the current max.
  const currentDimensionRules = row.rules_version === "16.2.4" || row.rules_version === RULES_VERSION;
  return currentDimensionRules
    ? ROUND_CONFIGS[row.difficulty].maxScore
    : LEGACY_V16_2_3_ROUND_CONFIGS[row.difficulty].maxScore;
}

export async function GET(request: Request) {
  const auth = await createSupabaseServerClient();
  if (!auth) return privateJson({ error: "Accounts are not configured." }, 503);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) {
    return privateJson({ error: "Sign in to view the GeoStats leaderboard." }, 401);
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) return privateJson({ error: "The standings service is not configured." }, 503);
  const url = new URL(request.url);
  const view = url.searchParams.get("view") === "today" ? "today" : "alltime";
  const difficulty = parseDifficulty(url.searchParams.get("difficulty"));
  const requestedDate = url.searchParams.get("date");
  const challengeDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : dailyDate();
  const buildQuery = (columns: string) => {
    let query = supabase
      .from("daily_scores")
      .select(columns)
      .eq("difficulty", difficulty);
    if (view === "today") {
      query = query.eq("challenge_date", challengeDate);
    }
    return query;
  };

  let { data, error } = await buildQuery("user_id,challenge_date,difficulty,score,average_placement,firsts,top_fives,board_normalization_version,leaderboard_rating_version,rules_version,profiles(username)");
  if (error && (error.code === "42703" || error.code === "PGRST204" || /normalization_version|rating_version/i.test(error.message ?? ""))) {
    const legacy = await buildQuery("user_id,challenge_date,difficulty,score,average_placement,firsts,top_fives,profiles(username)");
    data = legacy.data;
    error = legacy.error;
  }
  if (error) {
    console.error("Leaderboard query failed", { code: error.code, message: error.message, difficulty, view });
    return privateJson({ error: "The standings could not be loaded right now." }, 500);
  }
  const rawRows: unknown[] = Array.isArray(data) ? data : [];
  const rows = rawRows.filter(isScoreRow);

  if (view === "today") {
    const ranked = rows.map((row) => {
      const profile = profileOf(row.profiles);
      return {
        username: profile?.username ?? "player",
        score: row.score,
        averagePlacement: Number(row.average_placement),
        firsts: row.firsts,
        topFinishes: row.top_fives,
      };
    }).sort((a, b) => b.score - a.score || a.averagePlacement - b.averagePlacement || b.firsts - a.firsts || b.topFinishes - a.topFinishes).slice(0, 100);
    const leaders = ranked.map(({ username, score }) => ({ username, score }));
    return privateJson({ view, difficulty, date: challengeDate, leaders });
  }

  const maxScore = ROUND_CONFIGS[difficulty].maxScore;
  const ratios = rows.map((row) => row.score / scoreMaximum(row));
  const globalMean = mean(ratios, .5);
  const globalVariance = Math.max(variance(ratios, globalMean), .0064); // at least an 8-point standard deviation on a 0–100 scale
  const dayPriorGames = 8;
  const byDate = new Map<string, number[]>();
  for (const row of rows) {
    const list = byDate.get(row.challenge_date) ?? [];
    list.push(row.score / scoreMaximum(row));
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
      rawScores: [],
      scoreRatios: [],
      performances: [],
      placements: [],
    };
    const ratio = row.score / scoreMaximum(row);
    const stats = dayStats.get(row.challenge_date) ?? { mean: globalMean, std: Math.sqrt(globalVariance), players: 0 };
    const performance = clamp(50 + 15 * ((ratio - stats.mean) / stats.std), 0, 100);
    current.rawScores.push(row.score);
    current.scoreRatios.push(ratio);
    current.performances.push(performance);
    current.placements.push(Number(row.average_placement));
    allPerformances.push(performance);
    byUser.set(row.user_id, current);
  }

  const baseline = mean(allPerformances, 50);
  const confidenceGames = 20;
  const ranked = [...byUser.values()].map((entry) => {
    const games = entry.rawScores.length;
    const averagePercent = mean(entry.scoreRatios) * 100;
    const averagePlacement = mean(entry.placements);
    const normalizedPerformance = mean(entry.performances, baseline);
    const rating = (normalizedPerformance * games + baseline * confidenceGames) / (games + confidenceGames);
    return {
      username: entry.username,
      games,
      averagePercent: Number(averagePercent.toFixed(1)),
      averagePlacement: Number(averagePlacement.toFixed(2)),
      normalizedPerformance: Number(normalizedPerformance.toFixed(1)),
      rating: Number(rating.toFixed(1)),
    };
  }).filter((entry) => entry.games >= 5)
    .sort((a, b) => b.rating - a.rating || a.averagePlacement - b.averagePlacement || b.games - a.games || b.averagePercent - a.averagePercent)
    .slice(0, 100);

  const leaders = ranked.map(({ username, games, averagePercent, rating }) => ({ username, games, averagePercent, rating }));

  return privateJson({
    view,
    difficulty,
    maxScore,
    leaders,
    ratingVersion: LEADERBOARD_RATING_VERSION,
  });
}
