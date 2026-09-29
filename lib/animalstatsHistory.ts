import { ROUND_CONFIGS, type DailyDifficulty } from "./gameRules";
export const ANIMAL_HISTORY_KEY = "animalstats:history:v1";
export type AnimalGameResult = { id: string; boardId: string; date: string; mode: DailyDifficulty; kind: "daily" | "random"; score: number; optimalChoices: number; averagePlacement: number; ranks: number[]; completedAt: string };
export function readAnimalHistory(raw: string | null): AnimalGameResult[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((row): row is AnimalGameResult => Boolean(row && typeof row.id === "string" && typeof row.boardId === "string" && typeof row.date === "string" && typeof row.completedAt === "string" && ["easy", "normal", "expert"].includes(row.mode) && ["daily", "random"].includes(row.kind) && Number.isFinite(row.score) && row.score >= 0 && row.score <= ROUND_CONFIGS[row.mode as DailyDifficulty].maxScore && Number.isFinite(row.averagePlacement) && Number.isFinite(row.optimalChoices) && Array.isArray(row.ranks) && row.ranks.length === ROUND_CONFIGS[row.mode as DailyDifficulty].categoryCount && row.ranks.every((rank: unknown) => typeof rank === "number" && Number.isInteger(rank) && rank >= 1 && rank <= ROUND_CONFIGS[row.mode as DailyDifficulty].countryCount)));
  } catch { return []; }
}
export function animalStats(history: AnimalGameResult[], mode: DailyDifficulty) {
 const results = history.filter((result) => result.mode === mode);
 const games = results.length;
 const averageScore = games ? results.reduce((sum, row) => sum + row.score, 0) / games : 0;
 const averagePlacement = games ? results.reduce((sum, row) => sum + row.averagePlacement, 0) / games : 0;
 const performance = averageScore / ROUND_CONFIGS[mode].maxScore * 100;
 return { games, averageScore, averagePlacement, best: Math.max(0, ...results.map((row) => row.score)), rating: games >= 5 ? (performance * games + 50 * 5) / (games + 5) : null };
}
