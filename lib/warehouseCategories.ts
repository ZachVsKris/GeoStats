import type { Category } from "./categories";
import type { CategoryDataset, Observation } from "./worldBank";

type WarehousePayload = {
  categoryId?: string;
  commonYear?: number;
  commonYearCoverage?: number;
  unit?: string | null;
  observations?: Array<{
    country_iso3: string;
    country_name: string;
    data_year: number;
    value: number;
  }>;
  error?: string;
};

export async function fetchWarehouseCategory(category: Category): Promise<CategoryDataset> {
  const response = await fetch(`/api/warehouse-category?category=${encodeURIComponent(category.id)}`, {
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as WarehousePayload;
  if (!response.ok) throw new Error(payload.error || `${category.shortName} warehouse data could not be loaded.`);

  const observations: Observation[] = (payload.observations ?? [])
    .map((row) => ({
      countryId: String(row.country_iso3),
      countryName: String(row.country_name || row.country_iso3),
      value: Number(row.value),
      year: String(row.data_year),
    }))
    .filter((row) => /^[A-Z]{3}$/.test(row.countryId) && Number.isFinite(row.value) && /^\d{4}$/.test(row.year));

  if (observations.length < category.coverageFloor) {
    throw new Error(`${category.shortName} has only ${observations.length} approved common-year countries; ${category.coverageFloor} are required.`);
  }
  return {
    category: payload.unit && category.source === "eia" ? { ...category, unit: payload.unit } : category,
    observations,
    year: String(payload.commonYear ?? observations[0]?.year ?? "Latest available"),
  };
}
