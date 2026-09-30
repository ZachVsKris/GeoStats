import type { AnimalDataset, BoardCandidate } from "./animalstats";

const MAMMALS = new Set(["carnivore", "bear", "large-mammal", "primate", "marsupial", "rodent", "marine-mammal", "monotreme", "insectivore", "treeshrew"]);
const REPTILES = new Set(["crocodilian", "snake", "lizard", "reptile", "turtle"]);
export function animalBoardGroup(data: AnimalDataset, board: BoardCandidate) {
  const map = new Map(data.animals.map((animal) => [animal.id, animal.taxonomicGroup]));
  const groups = board.animalIds.map((id) => map.get(id) ?? "unknown");
  if (groups.every((group) => group === "bird")) return "birds";
  if (groups.every((group) => group === "bear")) return "bears";
  if (groups.every((group) => MAMMALS.has(group))) return "mammals";
  if (groups.every((group) => REPTILES.has(group))) return "reptiles";
  if (groups.every((group) => ["frog", "salamander"].includes(group))) return "amphibians";
  return "mixed";
}

/** Choose a subject group first, so a large bird catalog cannot dominate random play. */
export function randomAnimalBoardIndex(data: AnimalDataset, pool: BoardCandidate[], current?: BoardCandidate, random = Math.random) {
  if (!pool.length) return 0;
  const grouped = new Map<string, number[]>();
  pool.forEach((board, index) => {
    const group = animalBoardGroup(data, board);
    grouped.set(group, [...(grouped.get(group) ?? []), index]);
  });
  const currentGroup = current ? animalBoardGroup(data, current) : undefined;
  const alternatives = [...grouped.keys()].filter((group) => group !== currentGroup);
  const groups = alternatives.length ? alternatives : [...grouped.keys()];
  const group = groups[Math.floor(random() * groups.length)];
  const choices = grouped.get(group)!.filter((index) => pool[index] !== current);
  const available = choices.length ? choices : grouped.get(group)!;
  return available[Math.floor(random() * available.length)];
}
