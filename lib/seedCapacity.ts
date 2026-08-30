import type { Category } from "./categories";
import { roundHasRequiredDiversity, type RoundConfig } from "./gameRules";
import type { RoundCategory } from "./challengeCodec";
import type { CountryInfo } from "./worldBank";
import { categorySetHasFeasibleCountryBank } from "./puzzleEngine";

export type CategoryCapacityResult = {
  exactRawCategoryCombinations: string;
  estimatedRuleValidCategorySets: string;
  estimatedValidShare: number;
  confidence95: { low: string; high: string };
  catalogSize: number;
  categoryCount: number;
  samples: number;
  validSamples: number;
  exactRuleValidCount: false;
  note: string;
};

export type PlayableBoardCapacityResult = {
  exactRawCategoryCombinations: string;
  estimatedPlayableCategorySets: string;
  estimatedPlayableShare: number;
  confidence95: { low: string; high: string };
  catalogSize: number;
  categoryCount: number;
  samples: number;
  categoryRuleValidSamples: number;
  countryBankFeasibleSamples: number;
  timedOut: boolean;
  exactPlayableCount: false;
  feasibilityRules: string[];
  note: string;
};

function combinations(n: number, k: number) {
  if (k < 0 || k > n) return BigInt(0);
  let result = BigInt(1);
  for (let index = 1; index <= Math.min(k, n - k); index += 1) {
    result = (result * BigInt(n - index + 1)) / BigInt(index);
  }
  return result;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function randomCombination<T>(items: T[], size: number, rng: () => number) {
  const indexes = new Set<number>();
  while (indexes.size < size) indexes.add(Math.floor(rng() * items.length));
  return [...indexes].sort((a, b) => a - b).map((index) => items[index]);
}

function formatEstimated(value: number) {
  if (!Number.isFinite(value)) return "greater than Number.MAX_SAFE_INTEGER";
  return Math.max(0, Math.round(value)).toLocaleString("en-US", { useGrouping: false });
}

function wilsonInterval(successes: number, samples: number) {
  if (!samples) return { low: 0, high: 0 };
  const proportion = successes / samples;
  const z = 1.96;
  const denominator = 1 + (z * z) / samples;
  const center = (proportion + (z * z) / (2 * samples)) / denominator;
  const margin = z * Math.sqrt((proportion * (1 - proportion) / samples) + (z * z) / (4 * samples * samples)) / denominator;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

/**
 * Exact raw n-choose-k capacity plus a deterministic statistical estimate of
 * rule-valid category sets. Counting all rule-valid sets is equivalent to
 * counting fixed-size independent sets in a conflict graph and can become
 * prohibitively expensive; the API labels the estimate explicitly.
 */
export function estimateValidCategorySets(
  categories: Category[],
  config: RoundConfig,
  samples = 50_000,
): CategoryCapacityResult {
  const raw = combinations(categories.length, config.categoryCount);
  if (raw === BigInt(0)) {
    return {
      exactRawCategoryCombinations: "0",
      estimatedRuleValidCategorySets: "0",
      estimatedValidShare: 0,
      confidence95: { low: "0", high: "0" },
      catalogSize: categories.length,
      categoryCount: config.categoryCount,
      samples: 0,
      validSamples: 0,
      exactRuleValidCount: false,
      note: "The catalog is smaller than the requested board size.",
    };
  }

  const rng = seededRandom(0x144000 + config.categoryCount * 97 + categories.length);
  let valid = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    if (roundHasRequiredDiversity(randomCombination(categories, config.categoryCount, rng), config)) valid += 1;
  }

  const proportion = valid / samples;
  const z = 1.96;
  const denominator = 1 + (z * z) / samples;
  const center = (proportion + (z * z) / (2 * samples)) / denominator;
  const margin = z * Math.sqrt((proportion * (1 - proportion) / samples) + (z * z) / (4 * samples * samples)) / denominator;
  const rawNumber = Number(raw);

  return {
    exactRawCategoryCombinations: raw.toString(),
    estimatedRuleValidCategorySets: formatEstimated(rawNumber * proportion),
    estimatedValidShare: Number(proportion.toFixed(6)),
    confidence95: {
      low: formatEstimated(rawNumber * Math.max(0, center - margin)),
      high: formatEstimated(rawNumber * Math.min(1, center + margin)),
    },
    catalogSize: categories.length,
    categoryCount: config.categoryCount,
    samples,
    validSamples: valid,
    exactRuleValidCount: false,
    note: "Raw combinations are exact. Rule-valid combinations are a deterministic 50,000-sample estimate; display order is not counted.",
  };
}

/**
 * Bounded estimate of category sets that can actually produce at least one
 * country bank. It samples raw combinations, applies category diversity, then
 * invokes production country construction with the universal Top-20 winner
 * rule. It deliberately does not pretend to enumerate every possible country
 * bank for every category set.
 */
export function estimatePlayableBoardCapacity(
  datasets: RoundCategory[],
  countries: CountryInfo[],
  config: RoundConfig,
  options: { samples?: number; budgetMs?: number; perSetBudgetMs?: number } = {},
): PlayableBoardCapacityResult {
  const requestedSamples = Math.max(100, options.samples ?? 3_000);
  const deadline = Date.now() + Math.max(1_000, options.budgetMs ?? 80_000);
  const perSetBudgetMs = Math.max(2, options.perSetBudgetMs ?? 20);
  const raw = combinations(datasets.length, config.categoryCount);
  if (raw === BigInt(0)) {
    return {
      exactRawCategoryCombinations: "0",
      estimatedPlayableCategorySets: "0",
      estimatedPlayableShare: 0,
      confidence95: { low: "0", high: "0" },
      catalogSize: datasets.length,
      categoryCount: config.categoryCount,
      samples: 0,
      categoryRuleValidSamples: 0,
      countryBankFeasibleSamples: 0,
      timedOut: false,
      exactPlayableCount: false,
      feasibilityRules: ["global Top-20 winner", "distinct winners", "distinct displayed values", "country coverage", "continent limits", "category diversity"],
      note: "The catalog is smaller than the requested board size.",
    };
  }

  const rng = seededRandom(0x16280000 + config.categoryCount * 97 + datasets.length);
  let samples = 0;
  let categoryRuleValidSamples = 0;
  let countryBankFeasibleSamples = 0;
  while (samples < requestedSamples && Date.now() < deadline) {
    const categorySet = randomCombination(datasets, config.categoryCount, rng);
    const seed = `CAPACITY-${config.difficulty}-${samples}-${categorySet.map((item) => item.category.id).join("|")}`;
    samples += 1;
    if (!roundHasRequiredDiversity(categorySet.map((item) => item.category), config)) continue;
    categoryRuleValidSamples += 1;
    if (categorySetHasFeasibleCountryBank(categorySet, countries, config, seed, perSetBudgetMs)) {
      countryBankFeasibleSamples += 1;
    }
  }

  const proportion = samples ? countryBankFeasibleSamples / samples : 0;
  const interval = wilsonInterval(countryBankFeasibleSamples, samples);
  const rawNumber = Number(raw);
  return {
    exactRawCategoryCombinations: raw.toString(),
    estimatedPlayableCategorySets: formatEstimated(rawNumber * proportion),
    estimatedPlayableShare: Number(proportion.toFixed(6)),
    confidence95: {
      low: formatEstimated(rawNumber * interval.low),
      high: formatEstimated(rawNumber * interval.high),
    },
    catalogSize: datasets.length,
    categoryCount: config.categoryCount,
    samples,
    categoryRuleValidSamples,
    countryBankFeasibleSamples,
    timedOut: samples < requestedSamples,
    exactPlayableCount: false,
    feasibilityRules: ["global Top-20 winner", "distinct winners", "distinct displayed values", "country coverage", "continent limits", "category diversity"],
    note: "This is a deterministic bounded estimate of unordered category sets that can form at least one real country bank. It is not the number of all possible country-bank permutations.",
  };
}
