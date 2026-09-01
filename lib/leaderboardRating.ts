export const LEADERBOARD_MINIMUM_GAMES = 5;
export const LEADERBOARD_CONFIDENCE_GAMES = 10;
export const PEER_BLEND_START_PLAYERS = 5;
export const PEER_BLEND_FULL_PLAYERS = 20;

export function usesCurrentScoreScale(rulesVersion: string | null | undefined) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(rulesVersion ?? "");
  if (!match) return false;
  const [, major, minor, patch] = match.map(Number);
  return major > 16
    || (major === 16 && minor > 2)
    || (major === 16 && minor === 2 && patch >= 4);
}

export function clampRating(value: number, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function peerBlendWeight(players: number) {
  return clampRating(
    (players - PEER_BLEND_START_PLAYERS) / (PEER_BLEND_FULL_PLAYERS - PEER_BLEND_START_PLAYERS),
    0,
    1,
  );
}

export function hybridDailyPerformance(scoreRatio: number, peerRelativePerformance: number, players: number) {
  const absolutePerformance = clampRating(scoreRatio * 100);
  const peerWeight = peerBlendWeight(players);
  return absolutePerformance * (1 - peerWeight) + clampRating(peerRelativePerformance) * peerWeight;
}

export function bayesianLeaderboardRating(
  normalizedPerformance: number,
  games: number,
  fieldBaseline: number,
  confidenceGames = LEADERBOARD_CONFIDENCE_GAMES,
) {
  if (games < 0 || confidenceGames < 0) throw new Error("Game counts cannot be negative");
  const denominator = games + confidenceGames;
  if (!denominator) return clampRating(fieldBaseline);
  return clampRating((normalizedPerformance * games + fieldBaseline * confidenceGames) / denominator);
}
