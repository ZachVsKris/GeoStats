import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "../../../lib/supabase/server";
import { LEGACY_V16_2_3_ROUND_CONFIGS, ROUND_CONFIGS, type DailyDifficulty } from "../../../lib/gameRules";
import { LEADERBOARD_RATING_VERSION } from "../../../lib/version";

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
  userId: string;
  username: string;
  rawScores: number[];
  scoreRatios: number[];
  performances: number[];
  placements: number[];
};

const profileOf = (raw: ScoreRow["profiles"]) => Array.isArray(raw) ? raw[0] : raw;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const publicJson = (body: unknown, status = 200) => NextResponse.json(body, {
  status,
  headers: { "Cache-Control": "no-store" },
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
  // Every v16.2.4+ release keeps the same board dimensions and score curves.
  // Do not force an ever-growing exact-version allowlist: older valid scores
  // must remain on the current mode scale as later catalog/UI releases ship.
  const patch = /^16\.2\.(\d+)$/.exec(row.rules_version ?? "")?.[1];
  const currentDimensionRules = patch !== undefined && Number(patch) >= 4;
  return currentDimensionRules
    ? ROUND_CONFIGS[row.difficulty].maxScore
    : LEGACY_V16_2_3_ROUND_CONFIGS[row.difficulty].maxScore;
}

export async function GET(request: Request) {
  const auth = await createSupabaseServerClient();
  const userResult = auth ? await auth.auth.getUser() : null;
  const currentUserId = userResult?.data.user?.id ?? null;
  const supabase = createSupabaseAdminClient();
  if (!supabase) return publicJson({ error: "The standings service is not configured." }, 503);
  const url = new URL(request.url);
  const difficulty = parseDifficulty(url.searchParams.get("difficulty"));
  const buildQuery = (columns: string) => {
    return supabase
      .from("daily_scores")
      .select(columns)
      .eq("difficulty", difficulty);
  };

  let { data, error } = await buildQuery("user_id,challenge_date,difficulty,score,average_placement,firsts,top_fives,board_normalization_version,leaderboard_rating_version,rules_version,profiles(username)");
  if (error && (error.code === "42703" || error.code === "PGRST204" || /normalization_version|rating_version/i.test(error.message ?? ""))) {
    const legacy = await buildQuery("user_id,challenge_date,difficulty,score,average_placement,firsts,top_fives,profiles(username)");
    data = legacy.data;
    error = legacy.error;
  }
  if (error) {
    console.error("Leaderboard query failed", { code: error.code, message: error.message, difficulty });
    return publicJson({ error: "The standings could not be loaded right now." }, 500);
  }
  const rawRows: unknown[] = Array.isArray(data) ? data : [];
  const rows = rawRows.filter(isScoreRow);

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
      userId: row.user_id,
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
    const averageScore = mean(entry.scoreRatios) * maxScore;
    const averagePlacement = mean(entry.placements);
    const normalizedPerformance = mean(entry.performances, baseline);
    const rating = (normalizedPerformance * games + baseline * confidenceGames) / (games + confidenceGames);
    return {
      userId: entry.userId,
      username: entry.username,
      games,
      averageScore: Number(averageScore.toFixed(1)),
      averagePlacement: Number(averagePlacement.toFixed(2)),
      normalizedPerformance: Number(normalizedPerformance.toFixed(1)),
      rating: Number(rating.toFixed(1)),
    };
  }).filter((entry) => entry.games >= 5)
    .sort((a, b) => b.rating - a.rating || a.averagePlacement - b.averagePlacement || b.games - a.games || b.averageScore - a.averageScore);

  const rankedWithPosition = ranked.map((entry, index) => ({ ...entry, rank: index + 1 }));
  const visible = rankedWithPosition.slice(0, 100);
  const currentOutsideTop = currentUserId
    ? rankedWithPosition.find((entry) => entry.userId === currentUserId && entry.rank > 100)
    : null;
  if (currentOutsideTop) visible.push(currentOutsideTop);
  const leaders = visible.map(({ rank, userId, username, games, averageScore, rating }) => ({
    rank,
    username,
    averageScore,
    rating,
    completedGames: games,
    isCurrentPlayer: userId === currentUserId,
  }));

  return publicJson({
    signedIn: Boolean(currentUserId),
    difficulty,
    maxScore,
    leaders,
    ratingVersion: LEADERBOARD_RATING_VERSION,
  });
}
