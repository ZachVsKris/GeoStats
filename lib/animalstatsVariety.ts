import { animalBoardComposition } from "./animalstatsComposition";
import type { AnimalDataset, BoardCandidate } from "./animalstats";

const MAMMALS = new Set(["carnivore", "bear", "large-mammal", "primate", "marsupial", "rodent", "marine-mammal", "monotreme", "insectivore", "treeshrew", "lagomorph", "bat"]);
const REPTILES = new Set(["crocodilian", "snake", "lizard", "reptile", "turtle"]);
const groupMaps = new WeakMap<AnimalDataset, Map<string, string>>();
export function animalBoardGroup(data: AnimalDataset, board: BoardCandidate) {
  let map = groupMaps.get(data);
  if (!map) { map = new Map(data.animals.map(animal => [animal.id, animal.taxonomicGroup])); groupMaps.set(data, map); }
  const groups = board.animalIds.map((id) => map.get(id) ?? "unknown");
  if (groups.every((group) => group === "bird")) return "birds";
  if (groups.every((group) => group === "bear")) return "bears";
  if (groups.every((group) => MAMMALS.has(group))) return "mammals";
  if (groups.every((group) => REPTILES.has(group))) return "reptiles";
  if (groups.every((group) => ["frog", "salamander"].includes(group))) return "amphibians";
  return "mixed";
}

/** Default play favors at least three simple prizes out of four, or four out of six.
 * Older shared challenges remain directly addressable. */
export function animalBoardIsHighlyIntuitive(data: AnimalDataset, board: BoardCandidate) {
  const traits = new Map(data.traits.map(trait => [trait.id, trait]));
  const required = board.traitIds.length === 6 ? 4 : 3;
  return board.traitIds.filter(id => traits.get(id)?.categoryKind === "intuitive").length >= required;
}

type RotationIndex = { groups: Map<string, number[]>; labels: Map<string, string>; byLabel: Map<string, Map<string, number[]>> };
const rotationCache = new WeakMap<AnimalDataset, WeakMap<BoardCandidate[], RotationIndex>>();
function rotationIndex(data: AnimalDataset, pool: BoardCandidate[]) {
  let cache = rotationCache.get(data);
  if (!cache) { cache = new WeakMap(); rotationCache.set(data, cache); }
  const existing = cache.get(pool); if (existing) return existing;
  const labels = new Map(data.traits.map(t => [t.id, t.displayName]));
  const groups = new Map<string, number[]>(), byLabel = new Map<string, Map<string, number[]>>();
  const eligible = pool.map(b => animalBoardComposition(data, b).eligible);
  const hasEligible = eligible.some(Boolean);
  pool.forEach((board, index) => {
    if (hasEligible && !eligible[index]) return;
    const group = animalBoardGroup(data, board);
    groups.set(group, [...(groups.get(group) ?? []), index]);
    const categories = byLabel.get(group) ?? new Map<string, number[]>();
    board.traitIds.forEach(id => { const label = labels.get(id)!; categories.set(label, [...(categories.get(label) ?? []), index]); });
    byLabel.set(group, categories);
  });
  const result = { groups, labels, byLabel }; cache.set(pool, result); return result;
}
function weightedChoice<T>(items: T[], weight: (item: T) => number, random: () => number): T {
  const weights = items.map(weight), total = weights.reduce((a,b) => a+b, 0);
  let target = Math.min(1 - Number.EPSILON, Math.max(0, random())) * total;
  for (let i=0;i<items.length;i++) { target -= weights[i]; if (target < 0) return items[i]; }
  return items[items.length - 1];
}

/** Balance subjects, then categories, then animals. Board counts must not set exposure.
 * Recent lineups, repeated prizes and repeated animals receive lower probability.
 * A rare measurement never overrides source/composition eligibility. */
export function randomAnimalBoardIndex(data: AnimalDataset, pool: BoardCandidate[], current?: BoardCandidate, random = Math.random, recent: BoardCandidate[] = []) {
  if (!pool.length) return 0;
  const { groups: grouped, labels, byLabel } = rotationIndex(data, pool);
  const currentGroup = current ? animalBoardGroup(data, current) : undefined;
  const alternatives = [...grouped.keys()].filter(g => g !== currentGroup);
  // Expert has a smaller verified bird pool. Keep mammals more frequent and
  // soften group switching so four bird lineups cannot dominate every other round.
  const expert = (current?.mode ?? pool[0]?.mode) === "expert";
  const groups = expert ? [...grouped.keys()] : alternatives.length ? alternatives : [...grouped.keys()];
  const group = weightedChoice(groups, name => expert
    ? (name === "mammals" ? 3 : 1) * (name === currentGroup ? .65 : 1)
    : 1, random);
  const history = recent.length ? recent.slice(-12) : current ? [current] : [];
  const labelCounts = new Map<string, number>(), animalCounts = new Map<string, number>();
  for (const board of history) {
    board.traitIds.forEach(id => { const key = labels.get(id)!; labelCounts.set(key, (labelCounts.get(key) ?? 0)+1); });
    board.animalIds.forEach(id => animalCounts.set(id, (animalCounts.get(id) ?? 0)+1));
  }
  const lineup = current?.animalIds.slice().sort().join(",");
  const originalCategories = byLabel.get(group)!;
  const freshCategories = new Map([...originalCategories].map(([label, indexes]) => [label, indexes.filter(index => pool[index].animalIds.slice().sort().join(",") !== lineup)] as const).filter(([,indexes]) => indexes.length));
  const categories = freshCategories.size ? freshCategories : originalCategories;
  const category = weightedChoice([...categories.keys()], label => 1 / (1 + (labelCounts.get(label) ?? 0)) ** 2, random);
  let choices = categories.get(category)!;
  const fresh = choices.filter(index => pool[index].animalIds.slice().sort().join(",") !== lineup);
  if (fresh.length) choices = fresh;
  const animalBoards = new Map<string, number[]>();
  choices.forEach(index => pool[index].animalIds.forEach(id => animalBoards.set(id, [...(animalBoards.get(id) ?? []), index])));
  const targetAnimal = weightedChoice([...animalBoards.keys()], id => 1 / (1 + (animalCounts.get(id) ?? 0)) ** 2, random);
  choices = animalBoards.get(targetAnimal)!;
  const recentIds = new Set(history.map(b => b.id));
  const currentRegions = new Set(current?.biogeographicRegions ?? []);
  return weightedChoice(choices, index => {
    const b = pool[index];
    const repeatedAnimals = b.animalIds.reduce((n,id) => n+(animalCounts.get(id) ?? 0),0) / b.animalIds.length;
    const repeatedLabels = b.traitIds.reduce((n,id) => n+(labelCounts.get(labels.get(id)!) ?? 0),0) / b.traitIds.length;
    const newRegion = b.biogeographicRegions?.some(r => !currentRegions.has(r));
    return (newRegion ? 1.5 : 1) / ((recentIds.has(b.id) ? 12 : 1) * (1+repeatedAnimals) * (1+repeatedLabels));
  }, random);
}
