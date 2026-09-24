import type { Category } from "./categories";
import type { DailyDifficulty } from "./gameRules";
import { displayedValueKey } from "./valueFormatting";

type ValueObservation = { value: number };
export type ValueDataset = {
  category: Category;
  byCountry: Map<string, ValueObservation>;
};

const DISPLAY_KEY_CACHE = new WeakMap<ValueDataset, Map<string, string>>();

function countryDisplayKey(dataset: ValueDataset, countryId: string) {
  let byCountry = DISPLAY_KEY_CACHE.get(dataset);
  if (!byCountry) {
    byCountry = new Map<string, string>();
    DISPLAY_KEY_CACHE.set(dataset, byCountry);
  }
  const cached = byCountry.get(countryId);
  if (cached !== undefined) return cached;
  const value = dataset.byCountry.get(countryId)?.value;
  if (value === undefined) return undefined;
  const key = displayedValueKey(value, dataset.category);
  byCountry.set(countryId, key);
  return key;
}

export function candidateKeepsDisplayedValuesDistinct(
  datasets: ValueDataset[],
  selectedCountryIds: Iterable<string>,
  candidateId: string,
) {
  const selected = [...selectedCountryIds];
  for (const dataset of datasets) {
    const candidateKey = countryDisplayKey(dataset, candidateId);
    if (candidateKey === undefined) return false;
    for (const selectedId of selected) {
      const selectedKey = countryDisplayKey(dataset, selectedId);
      if (selectedKey === undefined || selectedKey === candidateKey) return false;
    }
  }
  return true;
}

const MINIMUM_RELATIVE_GAP: Record<DailyDifficulty, number> = { easy: 0.04, normal: 0.03, expert: 0.02 };

function displayedNumber(key: string) {
  const match = /^\$?(-?[\d,]+(?:\.(\d+))?)([KMBT]?)/.exec(key);
  if (!match) return null;
  const scale = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[match[3] as "K" | "M" | "B" | "T"] ?? 1;
  return { value: Number(match[1].replaceAll(",", "")) * scale, step: scale * 10 ** -(match[2]?.length ?? 0) };
}

/** Check the actual bank, for every category, without excluding a category from the catalog. */
export function candidateKeepsValuesSeparated(
  datasets: ValueDataset[],
  selectedCountryIds: Iterable<string>,
  candidateId: string,
  difficulty: DailyDifficulty,
) {
  for (const dataset of datasets) {
    const candidate = dataset.byCountry.get(candidateId)?.value;
    const candidateKey = countryDisplayKey(dataset, candidateId);
    if (candidate === undefined || candidateKey === undefined) return false;
    for (const selectedId of selectedCountryIds) {
      const selected = dataset.byCountry.get(selectedId)?.value;
      const selectedKey = countryDisplayKey(dataset, selectedId);
      if (selected === undefined || selectedKey === undefined || selectedKey === candidateKey) return false;

      // Historical dates retain only the pre-existing distinct displayed-value rule.
      if (dataset.category.measurementType === "historical_date") continue;
      const higher = Math.max(candidate, selected);
      const lower = Math.min(candidate, selected);
      if ((higher - lower) / Math.max(Math.abs(higher), Math.abs(lower), Number.MIN_VALUE) + 1e-12 < MINIMUM_RELATIVE_GAP[difficulty]) return false;

      const shownA = displayedNumber(candidateKey);
      const shownB = displayedNumber(selectedKey);
      if (shownA && shownB) {
        const step = Math.min(shownA.step, shownB.step);
        if (Math.abs(shownA.value - shownB.value) <= step + step * 1e-8) return false;
      }
    }
  }
  return true;
}

export function displayedTieGroups(dataset: ValueDataset, countryIds: Iterable<string>) {
  const groups = new Map<string, string[]>();
  for (const countryId of countryIds) {
    const key = countryDisplayKey(dataset, countryId);
    if (key === undefined) continue;
    const ids = groups.get(key) ?? [];
    ids.push(countryId);
    groups.set(key, ids);
  }
  return [...groups.entries()].filter(([, ids]) => ids.length > 1);
}
