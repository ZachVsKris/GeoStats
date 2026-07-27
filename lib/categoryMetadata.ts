import type { Category } from "./categories";

export type CategorySourceMetadata = {
  categoryId?: string;
  plainLanguageDescription?: string;
  technicalDefinition?: string;
  unitExplanation?: string;
  sourceUrl?: string;
  methodologyUrl?: string;
  sourcePageUrl?: string;
  playerSourceUrl?: string;
  playerSourceStatus?: string;
  playerSourceReason?: string;
  playerSourceCheckedAt?: string;
  contentReviewStatus?: string;
  contentReviewReason?: string;
  contentReviewVersion?: string;
  immediateComprehensionScore?: number;
  gameplayInterestScore?: number;
  uniquenessScore?: number;
  linkQualityScore?: number;
  exactQueryUrl?: string;
  downloadUrl?: string;
  apiUrl?: string;
  datasetRelease?: string;
  retrievedAt?: string;
  licenseName?: string;
  licenseUrl?: string;
  sourceQuery?: Record<string, unknown> | string;
  derivationMethod?: string;
  derivationVersion?: string;
  inputDatasets?: Array<Record<string, unknown> | string>;
  evidenceLabel?: string;
  credibilityScore?: number;
  trustStatus?: string;
  trustReason?: string;
  modeledObservationShare?: number | null;
  officialObservationShare?: number | null;
  verifiabilityScore?: number;
  verifiabilityStatus?: string;
  understandabilityScore?: number;
  funScore?: number;
  objectiveStatus?: string;
  playerQualityStatus?: string;
  playerQualityReason?: string;
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
