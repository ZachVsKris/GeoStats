import { animalBoardGroup, randomAnimalBoardIndex } from "./animalstatsVariety";
import { animalBoardComposition } from "./animalstatsComposition";
import type { AnimalDataset, BoardCandidate } from "./animalstats";
import type { DailyDifficulty } from "./gameRules";

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}

/** Opening challenges rotate by date using the same category/animal balance as random
 * play. This ordering never grants daily approval or changes a saved challenge. */
export function orderAnimalPilotBoards(boards: BoardCandidate[], date: string, data?: AnimalDataset) {
  const day = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
  const modes: DailyDifficulty[] = ["easy", "normal", "expert"];
  const usedGroups = new Set<string>();
  return modes.flatMap((mode, modeIndex) => {
    const pool = boards.filter(board => board.mode === mode && board.collection !== "extinct-special");
    const specials = boards.filter(board => board.mode === mode && board.collection === "extinct-special");
    if (!pool.length) return specials;
    let selected: BoardCandidate;
    if (data) {
      const composed = pool.filter(board => animalBoardComposition(data, board).eligible);
      const safe = composed.length ? composed : pool;
      const diverse = safe.filter(board => !usedGroups.has(animalBoardGroup(data, board)));
      const preferred = diverse.length ? diverse : safe;
      const previous = preferred[randomAnimalBoardIndex(data, preferred, undefined, seededRandom((day - 1) * 997 + modeIndex * 104729))];
      selected = preferred[randomAnimalBoardIndex(data, preferred, previous, seededRandom(day * 997 + modeIndex * 104729))];
      usedGroups.add(animalBoardGroup(data, selected));
    } else selected = pool[((day % pool.length) + pool.length) % pool.length];
    return [selected, ...pool.filter(board => board !== selected), ...specials];
  });
}
