import type { Category } from "./categories";

const LOCALE = "en-US";

function normalizedUnit(category: Category) {
  const unit = String(category.unit || "").trim();
  return unit.toLowerCase() === "an" ? "animals" : unit;
}

function isCurrencyUnit(unit: string) {
  const normalized = unit.toLowerCase().replace(/\s+/g, " ");
  return normalized === "usd"
    || normalized === "usd/person"
    || normalized.includes("current us$")
    || normalized.includes("current usd")
    || normalized.includes("us dollars")
    || normalized.includes("u.s. dollars");
}

function currencySuffix(unit: string) {
  const normalized = unit.toLowerCase();
  return normalized.includes("person") || normalized.includes("capita") ? " per person" : "";
}

function compactNumber(value: number, digits: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1e12) return `${(value / 1e12).toFixed(digits)}T`;
  if (absolute >= 1e9) return `${(value / 1e9).toFixed(digits)}B`;
  if (absolute >= 1e6) return `${(value / 1e6).toFixed(digits)}M`;
  if (absolute >= 1e3) return `${(value / 1e3).toFixed(digits)}K`;
  return value.toLocaleString(LOCALE, { maximumFractionDigits: digits });
}

/** The exact string players see. Gameplay tie checks use this same function. */
export function formatCategoryValue(value: number, category: Category) {
  const unit = normalizedUnit(category);
  const decimals = Math.max(0, Math.min(6, category.decimals ?? 1));

  if (isCurrencyUnit(unit)) {
    const absolute = Math.abs(value);
    const suffix = currencySuffix(unit);
    if (absolute >= 1e12) return `$${(value / 1e12).toFixed(2)}T${suffix}`;
    if (absolute >= 1e9) return `$${(value / 1e9).toFixed(1)}B${suffix}`;
    if (absolute >= 1e6) return `$${(value / 1e6).toFixed(1)}M${suffix}`;
    return `${value.toLocaleString(LOCALE, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: decimals,
    })}${suffix}`;
  }

  const compactUnits = new Set([
    "people",
    "passengers",
    "arrivals",
    "departures",
    "passenger-km",
    "hectares",
    "km²",
    "square kilometers",
    "tonnes",
    "animals",
  ]);
  if (compactUnits.has(unit) && Math.abs(value) >= 1e6) {
    return `${compactNumber(value, Math.abs(value) >= 1e9 ? 2 : 1)} ${unit}`;
  }

  return `${value.toLocaleString(LOCALE, { maximumFractionDigits: decimals })}${unit ? ` ${unit}` : ""}`;
}

/** Stable gameplay comparison key at player-visible precision. */
export function displayedValueKey(value: number, category: Category) {
  return formatCategoryValue(value, category);
}

/** Full-precision value for source/audit views without changing gameplay display. */
export function formatExactCategoryValue(value: number, category: Category) {
  const unit = normalizedUnit(category);
  if (isCurrencyUnit(unit)) {
    return `${value.toLocaleString(LOCALE, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 6,
    })}${currencySuffix(unit)}`;
  }
  return `${value.toLocaleString(LOCALE, { maximumFractionDigits: 8 })}${unit ? ` ${unit}` : ""}`;
}

export function displayedDistribution(values: number[], category: Category) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const key = displayedValueKey(value, category);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const largestTie = total && counts.size
    ? Math.max(...counts.values())
    : 0;
  return {
    distinctCount: counts.size,
    mostCommonShare: total ? largestTie / total : 1,
    counts,
  };
}
