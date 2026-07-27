import type { Category } from "./categories";
import type { CategoryDataset, Observation } from "./worldBank";

type WarehousePayload = {
  categoryId?: string;
  commonYear?: number;
  commonYearCoverage?: number;
  unit?: string | null;
  sourceUrl?: string | null;
  methodologyUrl?: string | null;
  sourcePageUrl?: string | null;
  playerSourceUrl?: string | null;
  playerSourceStatus?: string | null;
  playerSourceReason?: string | null;
  playerSourceCheckedAt?: string | null;
  contentReviewStatus?: string | null;
  contentReviewReason?: string | null;
  contentReviewVersion?: string | null;
  immediateComprehensionScore?: number | null;
  gameplayInterestScore?: number | null;
  uniquenessScore?: number | null;
  linkQualityScore?: number | null;
  exactQueryUrl?: string | null;
  downloadUrl?: string | null;
  apiUrl?: string | null;
  datasetRelease?: string | null;
  retrievedAt?: string | null;
  licenseName?: string | null;
  licenseUrl?: string | null;
  sourceQuery?: Record<string, unknown> | string | null;
  derivationMethod?: string | null;
  derivationVersion?: string | null;
  inputDatasets?: Array<Record<string, unknown> | string> | null;
  evidenceLabel?: string | null;
  credibilityScore?: number | null;
  trustStatus?: string | null;
  trustReason?: string | null;
  verifiabilityScore?: number | null;
  verifiabilityStatus?: string | null;
  understandabilityScore?: number | null;
  funScore?: number | null;
  objectiveStatus?: string | null;
  playerQualityStatus?: string | null;
  playerQualityReason?: string | null;
  validationStatus?: string | null;
  validationVersion?: string | null;
  validatedAt?: string | null;
  rankingComplete?: boolean;
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

  const expectedCoverage = Number(payload.commonYearCoverage ?? 0);
  if (payload.validationStatus !== "verified") {
    throw new Error(`${category.shortName} has not passed source-integrity validation.`);
  }
  if (!payload.rankingComplete || !expectedCoverage || observations.length !== expectedCoverage) {
    throw new Error(`${category.shortName} global ranking is incomplete (${observations.length} loaded; ${expectedCoverage || "unknown"} expected).`);
  }
  if (observations.length < category.coverageFloor) {
    throw new Error(`${category.shortName} has only ${observations.length} approved common-year countries; ${category.coverageFloor} are required.`);
  }
  const enrichedCategory: Category = {
    ...category,
    ...(payload.unit ? { unit: payload.unit } : {}),
    sourceUrl: payload.sourceUrl ?? category.sourceUrl,
    methodologyUrl: payload.methodologyUrl ?? category.methodologyUrl,
    sourcePageUrl: payload.sourcePageUrl ?? category.sourcePageUrl,
    playerSourceUrl: payload.playerSourceUrl ?? category.playerSourceUrl,
    playerSourceStatus: (payload.playerSourceStatus as Category["playerSourceStatus"]) ?? category.playerSourceStatus,
    playerSourceReason: payload.playerSourceReason ?? category.playerSourceReason,
    playerSourceCheckedAt: payload.playerSourceCheckedAt ?? category.playerSourceCheckedAt,
    contentReviewStatus: (payload.contentReviewStatus as Category["contentReviewStatus"]) ?? category.contentReviewStatus,
    contentReviewReason: payload.contentReviewReason ?? category.contentReviewReason,
    contentReviewVersion: payload.contentReviewVersion ?? category.contentReviewVersion,
    immediateComprehensionScore: payload.immediateComprehensionScore ?? category.immediateComprehensionScore,
    gameplayInterestScore: payload.gameplayInterestScore ?? category.gameplayInterestScore,
    uniquenessScore: payload.uniquenessScore ?? category.uniquenessScore,
    linkQualityScore: payload.linkQualityScore ?? category.linkQualityScore,
    exactQueryUrl: payload.exactQueryUrl ?? category.exactQueryUrl,
    downloadUrl: payload.downloadUrl ?? category.downloadUrl,
    apiUrl: payload.apiUrl ?? category.apiUrl,
    datasetRelease: payload.datasetRelease ?? category.datasetRelease,
    retrievedAt: payload.retrievedAt ?? category.retrievedAt,
    licenseName: payload.licenseName ?? category.licenseName,
    licenseUrl: payload.licenseUrl ?? category.licenseUrl,
    sourceQuery: payload.sourceQuery ?? category.sourceQuery,
    derivationMethod: payload.derivationMethod ?? category.derivationMethod,
    derivationVersion: payload.derivationVersion ?? category.derivationVersion,
    inputDatasets: payload.inputDatasets ?? category.inputDatasets,
    evidenceLabel: (payload.evidenceLabel as Category["evidenceLabel"]) ?? category.evidenceLabel,
    credibilityScore: payload.credibilityScore ?? category.credibilityScore,
    trustStatus: (payload.trustStatus as Category["trustStatus"]) ?? category.trustStatus,
    trustReason: payload.trustReason ?? category.trustReason,
    verifiabilityScore: payload.verifiabilityScore ?? category.verifiabilityScore,
    verifiabilityStatus: payload.verifiabilityStatus ?? category.verifiabilityStatus,
    understandabilityScore: payload.understandabilityScore ?? category.understandabilityScore,
    funScore: payload.funScore ?? category.funScore,
    objectiveStatus: (payload.objectiveStatus as Category["objectiveStatus"]) ?? category.objectiveStatus,
    playerQualityStatus: (payload.playerQualityStatus as Category["playerQualityStatus"]) ?? category.playerQualityStatus,
    playerQualityReason: payload.playerQualityReason ?? category.playerQualityReason,
    globalCoverage: expectedCoverage,
  };
  return {
    category: enrichedCategory,
    observations,
    year: String(payload.commonYear ?? observations[0]?.year ?? "Latest available"),
    sourceUrl: payload.sourceUrl ?? undefined,
    methodologyUrl: payload.methodologyUrl ?? undefined,
    sourcePageUrl: payload.sourcePageUrl ?? undefined,
    playerSourceUrl: payload.playerSourceUrl ?? undefined,
    playerSourceStatus: payload.playerSourceStatus ?? undefined,
    playerSourceReason: payload.playerSourceReason ?? undefined,
    playerSourceCheckedAt: payload.playerSourceCheckedAt ?? undefined,
    contentReviewStatus: payload.contentReviewStatus ?? undefined,
    contentReviewReason: payload.contentReviewReason ?? undefined,
    immediateComprehensionScore: payload.immediateComprehensionScore ?? undefined,
    gameplayInterestScore: payload.gameplayInterestScore ?? undefined,
    uniquenessScore: payload.uniquenessScore ?? undefined,
    linkQualityScore: payload.linkQualityScore ?? undefined,
    exactQueryUrl: payload.exactQueryUrl ?? undefined,
    downloadUrl: payload.downloadUrl ?? undefined,
    apiUrl: payload.apiUrl ?? undefined,
    datasetRelease: payload.datasetRelease ?? undefined,
    retrievedAt: payload.retrievedAt ?? undefined,
    licenseName: payload.licenseName ?? undefined,
    licenseUrl: payload.licenseUrl ?? undefined,
    sourceQuery: payload.sourceQuery ?? undefined,
    derivationMethod: payload.derivationMethod ?? undefined,
    derivationVersion: payload.derivationVersion ?? undefined,
    inputDatasets: payload.inputDatasets ?? undefined,
    evidenceLabel: payload.evidenceLabel ?? undefined,
    credibilityScore: payload.credibilityScore ?? undefined,
    trustStatus: payload.trustStatus ?? undefined,
    trustReason: payload.trustReason ?? undefined,
    verifiabilityScore: payload.verifiabilityScore ?? undefined,
    verifiabilityStatus: payload.verifiabilityStatus ?? undefined,
    understandabilityScore: payload.understandabilityScore ?? undefined,
    funScore: payload.funScore ?? undefined,
    objectiveStatus: payload.objectiveStatus ?? undefined,
    playerQualityStatus: payload.playerQualityStatus ?? undefined,
    playerQualityReason: payload.playerQualityReason ?? undefined,
  };
}
