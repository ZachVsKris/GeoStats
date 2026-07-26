import type { Category } from "./categories";
import type { CategoryDataset, Observation } from "./worldBank";

type WarehousePayload = {
  categoryId?: string;
  commonYear?: number;
  commonYearCoverage?: number;
  unit?: string | null;
  sourceUrl?: string | null;
  methodologyUrl?: string | null;
  evidenceLabel?: string | null;
  credibilityScore?: number | null;
  trustStatus?: string | null;
  trustReason?: string | null;
  observations?: Array<{
    country_iso3: string;
    country_name: string;
    data_year: number;
    value: number;
  }>;
  error?: string;
};

export async function fetchWarehouseCategory(category: Category): Promise<CategoryDataset> {
  const params = new URLSearchParams();
  if (category.warehouseSourceIndicatorCode) {
    params.set("source", category.source);
    params.set("indicator", category.warehouseSourceIndicatorCode);
  } else {
    params.set("category", category.id);
  }
  const response = await fetch(`/api/warehouse-category?${params.toString()}`, { cache: "no-store" });
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
  const enrichedCategory: Category = {
    ...category,
    ...(payload.unit ? { unit: payload.unit } : {}),
    sourceUrl: payload.sourceUrl ?? category.sourceUrl,
    methodologyUrl: payload.methodologyUrl ?? category.methodologyUrl,
    evidenceLabel: (payload.evidenceLabel as Category["evidenceLabel"]) ?? category.evidenceLabel,
    credibilityScore: payload.credibilityScore ?? category.credibilityScore,
    trustStatus: (payload.trustStatus as Category["trustStatus"]) ?? category.trustStatus,
    trustReason: payload.trustReason ?? category.trustReason,
  };
  return {
    category: enrichedCategory,
    observations,
    year: String(payload.commonYear ?? observations[0]?.year ?? "Latest available"),
    sourceUrl: payload.sourceUrl ?? undefined,
    methodologyUrl: payload.methodologyUrl ?? undefined,
    evidenceLabel: payload.evidenceLabel ?? undefined,
    credibilityScore: payload.credibilityScore ?? undefined,
    trustStatus: payload.trustStatus ?? undefined,
    trustReason: payload.trustReason ?? undefined,
  };
}
