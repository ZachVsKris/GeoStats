import { ROUND_CONFIGS, type DailyDifficulty } from "./gameRules";
import { usesCurrentScoreScale } from "./leaderboardRating";

export type RatingScore = {
  difficulty: DailyDifficulty;
  score: number;
  rules_version: string | null;
};

const CONFIDENCE_GAMES = 10;
const STARTING_RATING = 50;

/** One mode's average score percentage, weighted against a 50-point, ten-game starting value. */
export function personalRatings(rows: RatingScore[]): Record<DailyDifficulty, number | null> {
  const ratings: Record<DailyDifficulty, number | null> = { easy: null, normal: null, expert: null };
  for (const mode of ["easy", "normal", "expert"] as const) {
    const scores = rows.filter((row) => row.difficulty === mode && usesCurrentScoreScale(row.rules_version) && Number.isFinite(row.score));
    if (!scores.length) continue;
    const totalPercent = scores.reduce((total, row) => {
      const max = ROUND_CONFIGS[mode].maxScore;
      return total + row.score / max * 100;
    }, 0);
    ratings[mode] = Number(((totalPercent + STARTING_RATING * CONFIDENCE_GAMES) / (scores.length + CONFIDENCE_GAMES)).toFixed(1));
  }
  return ratings;
}
