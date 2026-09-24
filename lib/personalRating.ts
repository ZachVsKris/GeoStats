import { ROUND_CONFIGS, type DailyDifficulty } from "./gameRules";
import { usesCurrentScoreScale } from "./leaderboardRating";

export type RatingScore = {
  difficulty: DailyDifficulty;
  score: number;
  rules_version: string | null;
};

const CONFIDENCE_GAMES = 5;
const STARTING_RATING = 50;
const MINIMUM_GAMES = 5;

/** One mode's earned points divided by its possible points, with a five-game prior at 50. */
export function personalRatings(rows: RatingScore[]): Record<DailyDifficulty, number | null> {
  const ratings: Record<DailyDifficulty, number | null> = { easy: null, normal: null, expert: null };
  for (const mode of ["easy", "normal", "expert"] as const) {
    const scores = rows.filter((row) => row.difficulty === mode && usesCurrentScoreScale(row.rules_version) && Number.isFinite(row.score));
    if (scores.length < MINIMUM_GAMES) continue;
    const totalPoints = scores.reduce((total, row) => total + row.score, 0);
    const possiblePoints = scores.reduce((total) => total + ROUND_CONFIGS[mode].maxScore, 0);
    const performance = totalPoints / possiblePoints * 100;
    ratings[mode] = Number(((performance * scores.length + STARTING_RATING * CONFIDENCE_GAMES) / (scores.length + CONFIDENCE_GAMES)).toFixed(1));
  }
  return ratings;
}
