import type { BoardCandidate, BoardType } from "./animalstats";
import type { DailyDifficulty } from "./gameRules";

const PATTERN: Record<"easy" | "normal", BoardType[]> = {
  easy: ["themed", "clustered", "cross-animal"],
  normal: ["clustered", "cross-animal", "themed"],
};

export function orderAnimalPilotBoards(boards: BoardCandidate[], date: string) {
  const day = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
  const modes: DailyDifficulty[] = ["easy", "normal", "expert"];
  return modes.flatMap((mode) => {
    const pool = boards.filter((board) => board.mode === mode);
    const desiredType = mode === "expert" ? "themed" : PATTERN[mode][day % 3];
    const options = pool.filter((board) => board.boardType === desiredType);
    const selected = (options.length ? options : pool)[Math.floor(day / 3) % (options.length || pool.length)];
    return selected ? [selected, ...pool.filter((board) => board !== selected)] : [];
  });
}
