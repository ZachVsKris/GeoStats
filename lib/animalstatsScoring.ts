import { ROUND_CONFIGS } from "./gameRules";
import { validateAnimalBoard, type AnimalDataset, type BoardCandidate } from "./animalstats";
export function scoreAnimalAssignments(data: AnimalDataset, board: BoardCandidate, input: unknown) {
 if (!validateAnimalBoard(data, board).valid || !input || typeof input !== "object" || Array.isArray(input)) return null;
 const assignments = input as Record<string, unknown>;
 if (Object.keys(assignments).length !== board.traitIds.length || Object.keys(assignments).some((key) => !board.traitIds.includes(key))) return null;
 const chosen = board.traitIds.map((id) => assignments[id]);
 if (chosen.some((id) => typeof id !== "string" || !board.animalIds.includes(id)) || new Set(chosen).size !== chosen.length) return null;
 const ranks = board.traitIds.map((id) => {
  const trait = data.traits.find((row) => row.id === id)!;
  const ranked = board.animalIds.map((animalId) => ({ animalId, value: data.values.find((row) => row.animalId === animalId && row.traitId === id)!.valueNumeric })).sort((a,b) => trait.direction === "higher_wins" ? b.value - a.value : a.value - b.value);
  return ranked.findIndex((row) => row.animalId === assignments[id]) + 1;
 });
 return { score: ranks.reduce((sum, rank) => sum + ROUND_CONFIGS[board.mode].pointsByRank[rank - 1], 0), optimalChoices: ranks.filter((rank) => rank === 1).length, averagePlacement: ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length, ranks };
}
