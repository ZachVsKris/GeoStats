import type { Category } from "./categories";
import { roundHasRequiredDiversity, type RoundConfig } from "./gameRules";

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
