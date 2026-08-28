import type { Category } from "./categories";

export type EligibleUniverseBand = "195" | "100-194" | "50-99" | "20-49" | "<20" | "unknown";

export function eligibleUniverseSize(category: Category) {
  const explicit = Number(category.eligibleCountryCount ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  const listed = category.eligibleCountryIds?.length ?? 0;
  if (listed > 0) return listed;
  return category.eligibleUniverseType === "universal" ? 195 : undefined;
}

export function eligibleUniverseBand(category: Category): EligibleUniverseBand {
  const size = eligibleUniverseSize(category);
  if (!size) return "unknown";
  if (size >= 195) return "195";
  if (size >= 100) return "100-194";
  if (size >= 50) return "50-99";
  if (size >= 20) return "20-49";
  return "<20";
}

/** Small capped selection-side correction for legitimate subset categories. */
export function subsetExposureBoost(category: Category, recentExactExposure = 0) {
  if (category.eligibleUniverseType !== "defined_subset") return 0;
  const size = eligibleUniverseSize(category);
  if (!size || size < 12) return 0;
  const structural = size >= 100 ? 0.35 : size >= 50 ? 0.7 : size >= 20 ? 1.05 : 1.25;
  const recencyFactor = recentExactExposure <= 0 ? 1 : 1 / (1 + recentExactExposure / 4);
  return Math.min(1.35, structural * recencyFactor);
}
