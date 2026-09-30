import { animalBoardGroup } from "./animalstatsVariety";
import type { AnimalDataset, BoardCandidate, BoardType } from "./animalstats";
import type { DailyDifficulty } from "./gameRules";

const SUBJECTS: Record<DailyDifficulty, string[]> = {
 easy: ["mammals", "amphibians", "bears", "birds"],
 normal: ["reptiles", "mammals", "birds", "reptiles"],
 expert: ["mammals"],
};
const PATTERN: Record<DailyDifficulty, BoardType[]> = {
  easy: ["themed", "clustered", "cross-animal"],
  normal: ["clustered", "cross-animal", "themed"],
  expert: ["cross-animal", "themed", "clustered"],
};

export function orderAnimalPilotBoards(boards: BoardCandidate[], date: string, data?: AnimalDataset) {
  const day = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
  const modes: DailyDifficulty[] = ["easy", "normal", "expert"];
  const usedGroups = new Set<string>();
  return modes.flatMap((mode) => {
    const pool = boards.filter((board) => board.mode === mode);
    const desiredType = PATTERN[mode][day % 3];
    const subject = SUBJECTS[mode][day % SUBJECTS[mode].length];
    const targeted = data ? pool.filter((board) => animalBoardGroup(data, board) === subject) : [];
    const diverse = data ? pool.filter((board) => !usedGroups.has(animalBoardGroup(data, board))) : pool;
    const nonBirds = data ? pool.filter((board) => animalBoardGroup(data, board) !== "birds") : [];
    const preferred = mode === "easy" && nonBirds.length ? nonBirds : targeted.length ? targeted : diverse.length ? diverse : pool;
    const options = preferred.filter((board) => board.boardType === desiredType);
    const behaviorBoards = mode === "easy" && data ? preferred.filter((board) => board.traitIds.some((id) => ["movement","sleep","space"].includes(data.traits.find((trait) => trait.id === id)?.gameplayFamily ?? ""))) : [];
    const selectionPool = behaviorBoards.length ? behaviorBoards : options.length ? options : preferred;
    const selected = selectionPool[Math.floor(day / 3) % selectionPool.length];
    if (!selected) return [];
    if (data) usedGroups.add(animalBoardGroup(data, selected));
    const rest = pool.filter((board) => board !== selected);
    const second = rest.find((board) => board.boardType !== selected.boardType);
    const third = rest.find((board) => board !== second && board.boardType !== selected.boardType && board.boardType !== second?.boardType) ?? rest.find((board) => board !== second);
    const leading = [selected, second, third].filter((board): board is BoardCandidate => Boolean(board));
    return [...leading, ...pool.filter((board) => !leading.includes(board))];
  });
}
