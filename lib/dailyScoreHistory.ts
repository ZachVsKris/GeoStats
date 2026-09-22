import type { DailyDifficulty } from "./gameRules";

export type PendingDailyScore = {
  challengeDate: string;
  difficulty: DailyDifficulty;
  assignments: Record<string, string>;
  completedAt?: string;
};

const RESULT_PREFIX = "geostats:daily-result:";
const SYNCED_KEY = "geostats:synced-daily-scores-v1";

function scoreId(score: Pick<PendingDailyScore, "challengeDate" | "difficulty">) {
  return `${score.challengeDate}:${score.difficulty}`;
}

function validScore(value: unknown): value is PendingDailyScore {
  if (!value || typeof value !== "object") return false;
  const score = value as Partial<PendingDailyScore>;
  return /^\d{4}-\d{2}-\d{2}$/.test(score.challengeDate ?? "")
    && ["easy", "normal", "expert"].includes(score.difficulty ?? "")
    && Boolean(score.assignments)
    && Object.keys(score.assignments ?? {}).length > 0;
}

function syncedIds(storage: Storage) {
  try {
    const parsed = JSON.parse(storage.getItem(SYNCED_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
}

export function pendingDailyScores(storage: Storage): PendingDailyScore[] {
  const synced = syncedIds(storage);
  const scores = new Map<string, PendingDailyScore>();
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(RESULT_PREFIX)) continue;
    try {
      const score = JSON.parse(storage.getItem(key) || "null") as unknown;
      if (validScore(score) && !synced.has(scoreId(score))) scores.set(scoreId(score), score);
    } catch {
      // A damaged browser entry must not block the rest of the history.
    }
  }

  // Preserve scores created by the previous one-pending-score implementation.
  for (const difficulty of ["easy", "normal", "expert"] as const) {
    const legacyKey = `geostats-pending-daily-score-${difficulty}`;
    try {
      const score = JSON.parse(storage.getItem(legacyKey) || "null") as unknown;
      if (validScore(score) && !synced.has(scoreId(score))) scores.set(scoreId(score), score);
    } catch {
      // Ignore only the malformed legacy item.
    }
  }
  return [...scores.values()].sort((left, right) =>
    left.challengeDate.localeCompare(right.challengeDate)
      || left.difficulty.localeCompare(right.difficulty)
      || String(left.completedAt ?? "").localeCompare(String(right.completedAt ?? "")));
}

export function markDailyScoreSynced(storage: Storage, score: Pick<PendingDailyScore, "challengeDate" | "difficulty">) {
  const synced = syncedIds(storage);
  synced.add(scoreId(score));
  // A year of three daily modes is tiny, while bounding this list forever.
  storage.setItem(SYNCED_KEY, JSON.stringify([...synced].slice(-1_100)));
  storage.removeItem(`geostats-pending-daily-score-${score.difficulty}`);
}
