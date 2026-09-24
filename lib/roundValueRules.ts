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
const MINIMUM_TEMPORAL_YEARS: Record<DailyDifficulty, number> = { easy: 4, normal: 3, expert: 2 };

function calendarDate(value: number) {
  if (!Number.isSafeInteger(value)) return null;
  const year = Math.trunc(value / 10000);
  const month = Math.trunc((value % 10000) / 100);
  const day = value % 100;
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function datesAreSeparated(a: number, b: number, years: number, fullDate: boolean) {
  if (!fullDate) return Number.isInteger(a) && Number.isInteger(b) && Math.abs(a - b) >= years;
  const first = calendarDate(a);
  const second = calendarDate(b);
  if (!first || !second) return false;
  const earlier = first < second ? first : second;
  const later = first < second ? second : first;
  const anniversary = new Date(earlier.getTime());
  anniversary.setUTCFullYear(anniversary.getUTCFullYear() + years);
  return later >= anniversary;
}

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

      // The measured observation year on other categories is never the ranked variable.
      if (dataset.category.measurementType === "historical_date") {
        if (!datesAreSeparated(candidate, selected, MINIMUM_TEMPORAL_YEARS[difficulty], dataset.category.historicalValueFormat === "date")) return false;
        continue;
      }
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
