import type { Animal, AnimalDataset, Trait } from "./animalstats";

/** Editorial publication floors, not claims of scientific completeness. */
export const ANIMAL_COVERAGE_MINIMUMS = { broad: 50, scoped: 20, breed: 8 } as const;
const mammalTraits = new Set(["gestation", "shortest_gestation", "litter_size", "female_maturity", "male_maturity", "weaning_age", "earliest_weaning", "birth_weight", "lightest_newborn", "litters_per_year", "interbirth_interval", "weaning_mass", "mammal_tail_length_upper", "adult_intestine_length", "resting_breathing_frequency", "measured_eye_length", "behavioral_visual_acuity", "recorded_chewing_rate", "milk_fat_concentration", "milk_sugar_concentration", "milk_protein_concentration", "diet_food_group_count", "maximum_hibernation_bout", "measured_adult_ear_length"]);
const mammalSources = new Set(["pantheria-range-maps", "asm-mdd-v25-counts", "tucker-rogers-2014-diet"]);
export function animalComparisonScope(trait: Trait): { kind: "broad" | "scoped" | "breed"; label: string } {
  if (trait.id.startsWith("pet_dog_")) return { kind: "breed", label: "Dog breeds" };
  if (trait.id.startsWith("pet_cat_")) return { kind: "breed", label: "Cat breeds" };
  const base = trait.id.replace(/__low$/, "");
  if (mammalTraits.has(base) || mammalSources.has(trait.canonicalSourceId)) return {kind:"scoped", label:"Mammals"};
  if (base === "aquatic_length_upper" || base === "habitat_depth_ceiling" || base === "field_max_dive") return {kind:"scoped", label:"Aquatic animals"};
  if (trait.eligibilityGroups.length) return {kind:"scoped", label: trait.eligibilityGroups.length === 1 ? trait.eligibilityGroups[0].replaceAll("-", " ") : "Defined animal groups"};
  return {kind:"broad", label:"Across animal groups"};
}
export function animalMajorGroup(animal: Animal) {
  const group = animal.taxonomicGroup;
  if (["bear", "carnivore", "large-mammal", "primate", "marsupial", "rodent", "marine-mammal", "mammal", "monotreme", "insectivore", "treeshrew", "lagomorph", "bat"].includes(group) || animal.entityType === "breed") return "mammals";
  if (["lizard", "snake", "turtle", "crocodilian", "reptile"].includes(group)) return "reptiles";
  if (["frog", "salamander", "amphibian"].includes(group)) return "amphibians";
  if (["fish", "shark", "ray"].includes(group)) return "fish";
  if (["bivalve", "gastropod", "cephalopod", "mollusc"].includes(group)) return "molluscs";
  return group;
}
export function auditAnimalCoverage(data: AnimalDataset) {
  const animals = new Map(data.animals.map(a => [a.id, a]));
  return data.traits.map(trait => {
    const scope = animalComparisonScope(trait);
    const ids = new Set(data.values.filter(v => {
      const a = animals.get(v.animalId);
      return v.traitId === trait.id && (a?.extinctionStatus ?? "living") === (trait.id.startsWith("extinct_") ? "extinct" : "living") && a?.active && a.familiarityTier !== "edge" && v.confidence === "approved" && v.observationType !== "imputed" && Number.isFinite(v.valueNumeric) && v.valueNumeric > 0 && v.sourceId === trait.canonicalSourceId && v.unit === trait.unit && v.measurementBasis === trait.measurementBasis && (!trait.eligibilityGroups.length || trait.eligibilityGroups.includes(a.taxonomicGroup));
    }).map(v => v.animalId));
    const majorGroups = [...new Set([...ids].map(id => animalMajorGroup(animals.get(id)!)))];
    const minimum = ANIMAL_COVERAGE_MINIMUMS[scope.kind];
    return {traitId:trait.id, label:trait.displayName, scope:scope.label, kind:scope.kind, count:ids.size, minimum, majorGroups, eligible:ids.size >= minimum && (scope.kind !== "broad" || majorGroups.length >= 3)};
  });
}
export function publishedAnimalTraitIds(data: AnimalDataset) {
  const audit = new Map(auditAnimalCoverage(data).map(row => [row.traitId, row]));
  return new Set(data.traits.filter(t => t.prototypeCategory && audit.get(t.id)?.eligible && (t.oneSided || (t.counterTraitId && audit.get(t.counterTraitId)?.eligible))).map(t => t.id));
}
