import { ROUND_CONFIGS, type DailyDifficulty } from "./gameRules";

export type BoardType = "themed" | "clustered" | "cross-animal";
export type ReviewLabel = "PASS" | "TOO_OBVIOUS" | "UNKNOWABLE" | "BAD_METRIC" | "DATA_CONCERN" | "FAMILIARITY_FAIL";

export type Animal = {
  id: string;
  commonName: string;
  scientificName: string;
  taxonomicGroup: string;
  parentTaxon?: string;
  familiarityTier: "core" | "familiar" | "edge";
  active: boolean;
  biogeographicRegions?: string[];
  regionSourceUrl?: string;
};

export type Source = {
  id: string;
  name: string;
  sourceClass: "institutional-database" | "curated-trait-database" | "primary-research" | "institutional-account";
  url: string;
  versionYear: string;
  retrievedAt: string;
  license: string;
};

export type AnimalPhoto = {
  animalId: string;
  assetUrl: string;
  originalUrl: string;
  creator: string;
  license: string;
  attribution: string;
  approved: boolean;
};

export type Trait = {
  id: string;
  displayName: string;
  gameplayFamily?: string;
  playerHint?: string;
  prototypeCategory?: boolean;
  categoryKind?: "intuitive" | "specialist";
  metricKey?: string;
  counterTraitId?: string;
  definition: string;
  direction: "higher_wins" | "lower_wins";
  unit: string;
  eligibilityGroups: string[]; // Empty means all groups.
  canonicalSourceId: string;
  separationMethod: "positive_ratio_5_percent";
  measurementBasis: string;
};

export type AnimalTraitValue = {
  animalId: string;
  traitId: string;
  valueNumeric: number;
  unit: string;
  valueMin?: number;
  valueMax?: number;
  sex: string;
  lifeStage: string;
  measurementBasis: string;
  sourceId: string;
  observationType: "observed" | "compiled" | "imputed";
  confidence: "approved" | "review" | "rejected";
  notes: string;
  recordOrigin?: string;
  uncertaintyKind?: "source-range" | "not-reported";
  uncertaintyStatus?: "reported" | "not-reported";
  sourceQuality?: string;
  sampleSizeCategory?: string;
};

export type AnimalDataset = {
  animals: Animal[];
  traits: Trait[];
  sources: Source[];
  photos: AnimalPhoto[];
  values: AnimalTraitValue[];
};

export type BoardCandidate = {
  id?: string;
  title?: string;
  mode: DailyDifficulty;
  boardType: BoardType;
  animalIds: string[];
  traitIds: string[];
  reviewLabel?: ReviewLabel;
  biogeographicRegions?: string[];
  editorial?: { families: string[]; multiTraitContenders: number; policy: string };
};

export type BoardValidation = {
  valid: boolean;
  rejectionReasons: string[];
  winners: Record<string, string>;
  optimalScore: number;
};

const unique = (items: string[]) => new Set(items).size === items.length;
const present = (value: string) => Boolean(value.trim());

export function validateAnimalDataset(data: AnimalDataset): string[] {
  const reasons: string[] = [];
  for (const [name, ids] of [
    ["animal", data.animals.map((item) => item.id)],
    ["trait", data.traits.map((item) => item.id)],
    ["source", data.sources.map((item) => item.id)],
    ["photo", data.photos.map((item) => item.animalId)],
    ["value", data.values.map((item) => `${item.animalId}:${item.traitId}`)],
  ] as const) {
    if (!unique(ids)) reasons.push(`duplicate ${name} identifier`);
  }
  const animals = new Set(data.animals.map((item) => item.id));
  const sources = new Set(data.sources.map((item) => item.id));
  const traits = new Map(data.traits.map((item) => [item.id, item]));
  for (const source of data.sources) {
    if (![source.name, source.url, source.versionYear, source.retrievedAt, source.license].every(present))
      reasons.push(`source ${source.id}: incomplete provenance or license`);
  }
  for (const trait of data.traits) {
    if (!sources.has(trait.canonicalSourceId) || ![trait.displayName, trait.definition, trait.unit, trait.measurementBasis].every(present))
      reasons.push(`trait ${trait.id}: incomplete definition or canonical source`);
  }
  for (const trait of data.traits.filter((item) => item.prototypeCategory)) {
    const counter = traits.get(trait.counterTraitId ?? "");
    if (!counter?.prototypeCategory || counter.counterTraitId !== trait.id || counter.direction === trait.direction || counter.metricKey !== trait.metricKey || counter.measurementBasis !== trait.measurementBasis || counter.canonicalSourceId !== trait.canonicalSourceId) reasons.push(`trait ${trait.id}: invalid counter category`);
  }
  for (const photo of data.photos) {
    if (!animals.has(photo.animalId) || ![photo.assetUrl, photo.originalUrl, photo.creator, photo.license, photo.attribution].every(present))
      reasons.push(`photo ${photo.animalId}: incomplete attribution or animal`);
  }
  for (const value of data.values) {
    const trait = traits.get(value.traitId);
    if (!animals.has(value.animalId) || !trait || !sources.has(value.sourceId))
      reasons.push(`value ${value.animalId}:${value.traitId}: unknown animal, trait, or source`);
    if (trait && value.unit !== trait.unit) reasons.push(`value ${value.animalId}:${value.traitId}: unit mismatch`);
    if (!Number.isFinite(value.valueNumeric) || value.valueNumeric <= 0)
      reasons.push(`value ${value.animalId}:${value.traitId}: positive finite value required`);
    if (value.observationType === "imputed") reasons.push(`value ${value.animalId}:${value.traitId}: imputed value`);
    if (![value.sex, value.lifeStage, value.measurementBasis].every(present))
      reasons.push(`value ${value.animalId}:${value.traitId}: incomplete measurement definition`);
    if (value.valueMin !== undefined && value.valueMin > value.valueNumeric ||
        value.valueMax !== undefined && value.valueMax < value.valueNumeric ||
        value.valueMin !== undefined && value.valueMax !== undefined && value.valueMin > value.valueMax)
      reasons.push(`value ${value.animalId}:${value.traitId}: invalid bounds`);
  }
  return reasons;
}

export function validateAnimalBoard(data: AnimalDataset, board: BoardCandidate): BoardValidation {
  const reasons = validateAnimalDataset(data);
  const config = ROUND_CONFIGS[board.mode];
  const winners: Record<string, string> = {};
  const relatedTraits: string[][] = [["amphibian_min_maturity", "earliest_female_maturity", "female_maturity", "male_maturity", "raw_early_female_maturity", "raw_female_maturity"], ["amphibian_max_events", "clutches_per_year", "interbirth_interval", "litters_per_year", "raw_clutch_frequency", "raw_litter_frequency"], ["bird_hand_wing_index", "bird_kipps_distance", "bird_secondary_length", "bird_wing_length"], ["adult_body_mass", "amphibian_max_mass", "bird_mass", "raw_adult_mass", "smallest_adult_mass"], ["amphibian_max_clutch", "clutch_size", "egg_clutch_size", "litter_size", "raw_clutch_size", "raw_litter_size", "shark_litter_size", "fewest_shark_pups"], ["maximum_documented_lifespan", "wild_recorded_lifespan", "shortest_wild_lifespan"], ["gestation", "raw_gestation", "raw_short_gestation", "shortest_gestation"], ["earliest_weaning", "raw_weaning_age", "weaning_age"], ["birth_weight", "hatching_mass", "lightest_newborn", "raw_birth_mass", "raw_hatching_mass"], ["raw_weaning_mass", "weaning_mass"], ["incubation", "raw_incubation"], ["raw_egg_length", "raw_egg_mass", "raw_egg_width"]];
  if (relatedTraits.some((concept) => board.traitIds.filter((id) => concept.includes(id)).length > 1)) reasons.push("closely related traits on the same board");
  if (board.animalIds.length !== config.countryCount || !unique(board.animalIds)) reasons.push("wrong or duplicate animal count");
  if (board.traitIds.length !== config.categoryCount || !unique(board.traitIds)) reasons.push("wrong or duplicate trait count");
  const balanced = board.editorial?.policy === "intuitive-majority-distinct-winners-v5";
  const categories = board.traitIds.map((id) => data.traits.find((trait) => trait.id === id));
  if (balanced) {
    const lifeHistoryKeys = new Set(["pregnancy", "offspring", "incubation", "weaning", "maturity", "reproduction", "breeding", "egg-size"]);
    if (categories.filter(trait => lifeHistoryKeys.has(trait?.metricKey ?? "")).length > (board.mode === "expert" ? 3 : 1)) reasons.push("too many life-history prizes on one board");
    if (categories.some((trait) => /^(bird_beak_width|bird_beak_depth|bird_tarsus_length|bird_hand_wing_index)(?:__low)?$/.test(trait?.id ?? ""))) reasons.push("obscure bird anatomy is excluded");
    if (categories.some((trait) => !trait?.prototypeCategory || !trait.counterTraitId || !trait.metricKey) || categories.filter((trait) => trait?.categoryKind === "intuitive").length < Math.ceil(board.traitIds.length / 2)) reasons.push("board must have at least half intuitive categories");
    if (new Set(categories.map((trait) => trait?.metricKey)).size !== categories.length) reasons.push("repeated metric or opposite categories on the same board");
  }
  const families = board.traitIds.map((id) => data.traits.find((trait) => trait.id === id)?.gameplayFamily);
  if (families.filter((family) => family === "milk-composition").length > 1) reasons.push("only one milk-composition prize per board");
  if (!balanced && (families.some((family) => !family) || families.some((family) => families.filter((item) => item === family).length > (board.mode === "expert" && family === "anatomy" ? 2 : 1)) || new Set(families).size < families.length - (board.mode === "expert" ? 1 : 0))) reasons.push("repeated or unclassified gameplay family");
  if (!balanced && !families.some((family) => ["movement", "sleep", "space", "development", "offspring", "maturity", "care", "breeding"].includes(family ?? ""))) reasons.push("board lacks a distinctive behavior or performance trait");
  const animalMap = new Map(data.animals.map((item) => [item.id, item]));
  const traitMap = new Map(data.traits.map((item) => [item.id, item]));
  const sourceMap = new Map(data.sources.map((item) => [item.id, item]));
  const photoMap = new Map(data.photos.map((item) => [item.animalId, item]));
  const valueMap = new Map(data.values.map((item) => [`${item.animalId}:${item.traitId}`, item]));
  for (const id of board.animalIds) {
    const animal = animalMap.get(id);
    if (!animal || !animal.active || animal.familiarityTier === "edge") reasons.push(`animal ${id}: unavailable or unfamiliar`);
    if (!photoMap.get(id)?.approved) reasons.push(`animal ${id}: missing approved photo`);
    if (animal?.parentTaxon && board.animalIds.includes(animal.parentTaxon)) reasons.push(`animal ${id}: parent taxon also on board`);
  }
  for (const id of board.traitIds) {
    const trait = traitMap.get(id);
    if (!trait) { reasons.push(`trait ${id}: unknown`); continue; }
    const ranked: { animalId: string; value: AnimalTraitValue }[] = [];
    for (const animalId of board.animalIds) {
      const animal = animalMap.get(animalId);
      const value = valueMap.get(`${animalId}:${id}`);
      if (animal && trait.eligibilityGroups.length && !trait.eligibilityGroups.includes(animal.taxonomicGroup))
        reasons.push(`trait ${id}: ${animalId} ineligible`);
      if (!value || value.confidence !== "approved" || value.observationType === "imputed" ||
          value.sourceId !== trait.canonicalSourceId || !sourceMap.has(value.sourceId) ||
          value.unit !== trait.unit || value.measurementBasis !== trait.measurementBasis) {
        reasons.push(`trait ${id}: ${animalId} lacks comparable approved value`);
        continue;
      }
      ranked.push({ animalId, value });
    }
    if (ranked.length !== board.animalIds.length) continue;
    if (new Set(ranked.map((row) => row.value.sex)).size > 1 || new Set(ranked.map((row) => row.value.lifeStage)).size > 1) reasons.push(`trait ${id}: incompatible sex or life stage`);
    if (id === "maximum_documented_lifespan" && ranked.some((row) => row.value.recordOrigin !== "captivity")) reasons.push(`trait ${id}: captive record origin required`);
    if (["wild_recorded_lifespan", "shortest_wild_lifespan"].includes(id) && ranked.some((row) => row.value.recordOrigin !== "wild")) reasons.push(`trait ${id}: wild record origin required`);
    ranked.sort((a, b) => trait.direction === "higher_wins"
      ? b.value.valueNumeric - a.value.valueNumeric : a.value.valueNumeric - b.value.valueNumeric);
    for (let i = 0; i < ranked.length - 1; i++) {
      const first = ranked[i].value;
      const second = ranked[i + 1].value;
      const larger = Math.max(first.valueNumeric, second.valueNumeric);
      const smaller = Math.min(first.valueNumeric, second.valueNumeric);
      if (larger / smaller < 1.05 - 1e-12) reasons.push(`trait ${id}: ranks ${i + 1}-${i + 2} separated by less than 5%`);
      const firstMin = first.valueMin ?? first.valueNumeric;
      const firstMax = first.valueMax ?? first.valueNumeric;
      const secondMin = second.valueMin ?? second.valueNumeric;
      const secondMax = second.valueMax ?? second.valueNumeric;
      if (firstMin <= secondMax && secondMin <= firstMax)
        reasons.push(`trait ${id}: ranks ${i + 1}-${i + 2} have overlapping bounds`);
    }
    winners[id] = ranked[0].animalId;
  }
  if (Object.keys(winners).length === board.traitIds.length) {
    const rankVectors = board.traitIds.map((id) => {
      const trait = traitMap.get(id)!;
      const ordered = [...board.animalIds].sort((a, b) => trait.direction === "higher_wins" ? valueMap.get(`${b}:${id}`)!.valueNumeric - valueMap.get(`${a}:${id}`)!.valueNumeric : valueMap.get(`${a}:${id}`)!.valueNumeric - valueMap.get(`${b}:${id}`)!.valueNumeric);
      return board.animalIds.map((animalId) => ordered.indexOf(animalId) + 1);
    });
    for (let i = 0; i < rankVectors.length; i++) for (let j = i + 1; j < rankVectors.length; j++) {
      const n = board.animalIds.length;
      const correlation = 1 - 6 * rankVectors[i].reduce((sum, rank, index) => sum + (rank - rankVectors[j][index]) ** 2, 0) / (n * (n ** 2 - 1));
      if (!balanced && families[i] === "anatomy" && families[j] === "anatomy" && Math.abs(correlation) > .7) reasons.push("anatomy traits follow the same ordering");
      if ((!balanced && Math.abs(correlation) > .9) || Math.abs(correlation) >= 1) reasons.push("traits have nearly identical or reversed rankings");
    }
    const contenders = board.animalIds.filter((_, index) => rankVectors.filter((ranks) => ranks[index] <= 2).length >= 2).length;
    if (contenders < 2) reasons.push("too few animals compete across traits");
  }
  if (Object.keys(winners).length === board.traitIds.length && !unique(Object.values(winners)))
    reasons.push("category winners are not distinct; perfect score unattainable");
  return { valid: reasons.length === 0, rejectionReasons: [...new Set(reasons)], winners,
    optimalScore: reasons.length ? 0 : config.maxScore };
}
