import type { Category } from "./categories";

export type CategorySourceMetadata = {
  categoryId?: string;
  sourceUrl?: string;
  methodologyUrl?: string;
  evidenceLabel?: string;
  credibilityScore?: number;
  trustStatus?: string;
  trustReason?: string;
  modeledObservationShare?: number | null;
  officialObservationShare?: number | null;
};

export async function fetchCategorySourceMetadata(category: Category): Promise<CategorySourceMetadata | null> {
  try {
    const params = new URLSearchParams({ source: category.source, indicator: category.warehouseSourceIndicatorCode ?? category.indicator });
    const response = await fetch(`/api/category-metadata?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as CategorySourceMetadata;
  } catch {
    return null;
  }
}

export async function fetchCategorySourceMetadataBatch(categories: Category[]): Promise<Map<string, CategorySourceMetadata>> {
  if (!categories.length) return new Map();
  try {
    const ids = categories.map((category) => category.id).join(",");
    const response = await fetch(`/api/category-metadata?ids=${encodeURIComponent(ids)}`, { cache: "no-store" });
    if (!response.ok) return new Map();
    const payload = await response.json() as { categories?: Array<CategorySourceMetadata & { requestedId?: string }> };
    return new Map((payload.categories ?? []).map((item) => [item.requestedId ?? item.categoryId ?? "", item]));
  } catch {
    return new Map();
  }
}
