import assert from "node:assert/strict";
import {
  LEADERBOARD_CONFIDENCE_GAMES,
  LEADERBOARD_MINIMUM_GAMES,
  bayesianLeaderboardRating,
  hybridDailyPerformance,
  peerBlendWeight,
  usesCurrentScoreScale,
} from "../lib/leaderboardRating.ts";

assert.equal(LEADERBOARD_MINIMUM_GAMES, 5);
assert.equal(LEADERBOARD_CONFIDENCE_GAMES, 10);
assert.equal(usesCurrentScoreScale("16.2.3"), false);
assert.equal(usesCurrentScoreScale("16.2.4"), true);
assert.equal(usesCurrentScoreScale("16.3.0"), true);
assert.equal(usesCurrentScoreScale("17.0.0"), true);
assert.equal(usesCurrentScoreScale(null), false);
assert.equal(peerBlendWeight(1), 0);
assert.equal(peerBlendWeight(5), 0);
assert.equal(peerBlendWeight(20), 1);
assert.equal(peerBlendWeight(200), 1);

// Sparse boards are scored from the normalized absolute score, preventing a
// one-player day from collapsing to the arbitrary neutral rating of 50.
assert.equal(hybridDailyPerformance(.72, 50, 1), 72);
assert.equal(hybridDailyPerformance(.72, 50, 5), 72);
assert.equal(hybridDailyPerformance(.72, 80, 20), 80);
assert.equal(hybridDailyPerformance(.72, 80, 12.5), 76);

const fiveGameRating = bayesianLeaderboardRating(80, 5, 60);
const twentyGameRating = bayesianLeaderboardRating(80, 20, 60);
assert(fiveGameRating > 60 && fiveGameRating < 80);
assert(twentyGameRating > fiveGameRating && twentyGameRating < 80);
assert.equal(bayesianLeaderboardRating(60, 100, 60), 60);

console.log("Leaderboard rating tests passed.");
