import type { BoardCandidate } from "./animalstats";
import type { DailyDifficulty } from "./gameRules";

const modes: DailyDifficulty[] = ["easy", "normal", "expert"];
type PackedBoard = [string | null, number, number, number, number[], number[], string[] | null];
export type AnimalBoardTransport = { version: 1; animals: string[]; traits: string[]; types: (NonNullable<BoardCandidate["boardType"]> | null)[]; rows: PackedBoard[] };

/** Dictionary encoding changes transport size only; challenge IDs and order stay exact. */
export function packAnimalBoards(boards: BoardCandidate[]): AnimalBoardTransport {
  const animals = [...new Set(boards.flatMap(board => board.animalIds))];
  const traits = [...new Set(boards.flatMap(board => board.traitIds))];
  const types = [...new Set(boards.map(board => board.boardType ?? null))];
  const animalIndex = new Map(animals.map((id, index) => [id, index]));
  const traitIndex = new Map(traits.map((id, index) => [id, index]));
  const typeIndex = new Map(types.map((id, index) => [id, index]));
  return { version: 1, animals, traits, types, rows: boards.map(board => [
    board.id ?? null, modes.indexOf(board.mode), typeIndex.get(board.boardType ?? null)!,
    board.collection === "extinct-special" ? 1 : board.collection === "living" ? 0 : 2,
    board.animalIds.map(id => animalIndex.get(id)!), board.traitIds.map(id => traitIndex.get(id)!),
    board.biogeographicRegions ?? null,
  ]) };
}
export function unpackAnimalBoards(packed: AnimalBoardTransport): BoardCandidate[] {
  return packed.rows.map(([id, mode, type, collection, animals, traits, regions]) => ({
    id: id ?? undefined, mode: modes[mode], boardType: (packed.types[type] ?? undefined) as BoardCandidate["boardType"],
    collection: collection === 1 ? "extinct-special" : collection === 0 ? "living" : undefined,
    animalIds: animals.map(index => packed.animals[index]), traitIds: traits.map(index => packed.traits[index]),
    biogeographicRegions: regions ?? undefined,
  }));
}
