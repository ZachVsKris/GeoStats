import { LEGACY_V16_2_3_ROUND_CONFIGS, ROUND_CONFIGS, type DailyDifficulty } from "./gameRules";
import { bayesianLeaderboardRating, clampRating, hybridDailyPerformance, usesCurrentScoreScale } from "./leaderboardRating";

export type RatingScore = {
  user_id: string;
  challenge_date: string;
  difficulty: DailyDifficulty;
  score: number;
  rules_version: string | null;
};

const modes: DailyDifficulty[] = ["easy", "normal", "expert"];
const mean = (values: number[], fallback = 0) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
const variance = (values: number[], center = mean(values)) => mean(values.map((value) => (value - center) ** 2));

/** The same per-mode performance and ten-game confidence adjustment used by the former standings. */
export function personalRatings(rows: RatingScore[], userId: string): Record<DailyDifficulty, number | null> {
  const ratings = { easy: null, normal: null, expert: null } as Record<DailyDifficulty, number | null>;
  for (const mode of modes) {
    const scores = rows.filter((row) => row.difficulty === mode && Number.isFinite(row.score));
    if (!scores.length) continue;
    const ratio = (row: RatingScore) => row.score / (usesCurrentScoreScale(row.rules_version)
      ? ROUND_CONFIGS[mode].maxScore : LEGACY_V16_2_3_ROUND_CONFIGS[mode].maxScore);
    const ratios = scores.map(ratio);
    const globalMean = mean(ratios, .5);
    const globalVariance = Math.max(variance(ratios, globalMean), .0064);
    const byDate = new Map<string, number[]>();
    for (const row of scores) byDate.set(row.challenge_date, [...(byDate.get(row.challenge_date) ?? []), ratio(row)]);
    const dayStats = new Map<string, { mean: number; std: number; players: number }>();
    for (const [date, dayRatios] of byDate) {
      const count = dayRatios.length;
      const shrunkMean = (mean(dayRatios, globalMean) * count + globalMean * 8) / (count + 8);
      const shrunkVariance = (variance(dayRatios) * count + globalVariance * 8) / (count + 8);
      dayStats.set(date, { mean: shrunkMean, std: Math.max(Math.sqrt(shrunkVariance), .08), players: count });
    }
    const performances = scores.map((row) => {
      const day = dayStats.get(row.challenge_date)!;
      const relative = clampRating(50 + 15 * ((ratio(row) - day.mean) / day.std));
      return hybridDailyPerformance(ratio(row), relative, day.players);
    });
    const baseline = mean(performances, globalMean * 100);
    const own = performances.filter((_, index) => scores[index].user_id === userId);
    if (own.length) ratings[mode] = Number(bayesianLeaderboardRating(mean(own, baseline), own.length, baseline).toFixed(1));
  }
  return ratings;
}
