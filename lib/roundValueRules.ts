import type { Category } from "./categories";
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
