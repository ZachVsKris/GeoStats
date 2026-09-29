import type { BoardCandidate, BoardType } from "./animalstats";
import type { DailyDifficulty } from "./gameRules";

const PATTERN: Record<DailyDifficulty, BoardType[]> = {
  easy: ["themed", "clustered", "cross-animal"],
  normal: ["clustered", "cross-animal", "themed"],
  expert: ["cross-animal", "themed", "clustered"],
};

export function orderAnimalPilotBoards(boards: BoardCandidate[], date: string) {
  const day = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
  const modes: DailyDifficulty[] = ["easy", "normal", "expert"];
  return modes.flatMap((mode) => {
    const pool = boards.filter((board) => board.mode === mode);
    const desiredType = PATTERN[mode][day % 3];
    const options = pool.filter((board) => board.boardType === desiredType);
    const selected = (options.length ? options : pool)[Math.floor(day / 3) % (options.length || pool.length)];
    if (!selected) return [];
    const rest = pool.filter((board) => board !== selected);
    const second = rest.find((board) => board.boardType !== selected.boardType);
    const third = rest.find((board) => board !== second && board.boardType !== selected.boardType && board.boardType !== second?.boardType) ?? rest.find((board) => board !== second);
    const leading = [selected, second, third].filter((board): board is BoardCandidate => Boolean(board));
    return [...leading, ...pool.filter((board) => !leading.includes(board))];
  });
}
