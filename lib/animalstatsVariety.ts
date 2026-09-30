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
  const currentLineup = current?.animalIds.slice().sort().join(",");
  const choices = grouped.get(group)!.filter((index) => pool[index].animalIds.slice().sort().join(",") !== currentLineup);
  const available = choices.length ? choices : grouped.get(group)!;
  const currentRegions = new Set(current?.biogeographicRegions ?? []);
  const regionCounts = new Map<string, number>();
  available.forEach(index => pool[index].biogeographicRegions?.forEach(region => regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1)));
  const freshRegions = [...regionCounts.keys()].filter(region => !currentRegions.has(region));
  if (freshRegions.length) {
    // Give regions equal chances rather than rewarding plentiful European study records.
    const region = freshRegions[Math.floor(random() * freshRegions.length)];
    const regional = available.filter(index => pool[index].biogeographicRegions?.includes(region));
    return regional[Math.floor(random() * regional.length)];
  }
  return available[Math.floor(random() * available.length)];
}
