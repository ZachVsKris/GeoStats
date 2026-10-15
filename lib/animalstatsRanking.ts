import type { AnimalTraitValue, Trait } from "./animalstats";

/** Catalog ties share competition ranks; playable boards still reject ties. */
export function rankAnimalValues(values: readonly AnimalTraitValue[], direction: Trait["direction"]) {
  const sorted = [...values].sort((a, b) => direction === "higher_wins"
    ? b.valueNumeric - a.valueNumeric : a.valueNumeric - b.valueNumeric);
  let rank = 0;
  return sorted.map((value, index) => {
    if (index === 0 || value.valueNumeric !== sorted[index - 1].valueNumeric) rank = index + 1;
    return { value, rank };
  });
}

/** Build once rather than scanning every observation for every catalog row. */
export function indexApprovedAnimalValues(values: readonly AnimalTraitValue[]) {
  const byTrait = new Map<string, AnimalTraitValue[]>();
  for (const value of values) {
    if (value.confidence !== "approved" || value.observationType === "imputed") continue;
    const list = byTrait.get(value.traitId);
    if (list) list.push(value); else byTrait.set(value.traitId, [value]);
  }
  return byTrait;
}
