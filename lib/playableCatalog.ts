import { CATEGORIES, type Category, type DataSourceId } from "./categories";
import { applyCategoryTrustPolicy, type EvidenceLabel, type TrustStatus } from "./categoryTrust";

export type PlayableCategoryRow = {
  id: string;
  title: string;
  short_title?: string | null;
  description: string;
  icon?: string | null;
  unit: string;
  value_type?: string | null;
  ranking_direction: "high" | "low";
  family: string;
  source_organization: string;
  source_dataset: string;
  source_indicator_code: string;
  source_url: string;
  methodology_url?: string | null;
  plain_language_description?: string | null;
  technical_definition?: string | null;
  unit_explanation?: string | null;
  source_page_url?: string | null;
  player_source_url?: string | null;
  player_source_status?: string | null;
  player_source_reason?: string | null;
  player_source_checked_at?: string | null;
  content_review_status?: string | null;
  content_review_reason?: string | null;
  content_review_version?: string | null;
  immediate_comprehension_score?: number | null;
  gameplay_interest_score?: number | null;
  uniqueness_score?: number | null;
  link_quality_score?: number | null;
  exact_query_url?: string | null;
  download_url?: string | null;
  api_url?: string | null;
  dataset_release?: string | null;
  retrieved_at?: string | null;
  license_name?: string | null;
  license_url?: string | null;
  source_query?: Record<string, unknown> | string | null;
  derivation_method?: string | null;
  derivation_version?: string | null;
  input_datasets?: Array<Record<string, unknown> | string> | null;
  verifiability_score?: number | null;
  verifiability_status?: string | null;
  understandability_score?: number | null;
  fun_score?: number | null;
  objective_status?: string | null;
  player_quality_status?: string | null;
  player_quality_reason?: string | null;
  minimum_year?: number | null;
  common_year?: number | null;
  common_year_coverage?: number | null;
  quality_score?: number | null;
  concept_group?: string | null;
  semantic_family?: string | null;
  semantic_topic?: string | null;
  metadata?: Record<string, unknown> | null;
  credibility_score?: number | null;
  credibility_status?: string | null;
  credibility_reason?: string | null;
  evidence_label?: string | null;
  enabled?: boolean | null;
  eligible_daily?: boolean | null;
  review_status?: string | null;
  curation_status?: string | null;
  validation_status?: string | null;
  validation_version?: string | null;
  validated_at?: string | null;
  computed_playable_v15?: boolean | null;
  editorial_status?: string | null;
  hard_gate_ready?: boolean | null;
  political_self_reported?: boolean | null;
  confusing?: boolean | null;
  esoteric?: boolean | null;
  subjective_or_composite?: boolean | null;
  stale_data?: boolean | null;
  poor_coverage?: boolean | null;
  duplicate_of?: string | null;
  effective_semantic_group?: string | null;
};

const SOURCE_IDS: Record<string, DataSourceId> = {
  "World Bank": "worldbank",
  "FAOSTAT": "faostat",
  "WHO": "who",
  "UNESCO UIS": "unesco",
  "ILOSTAT": "ilostat",
  "Natural Earth": "naturalearth",
  "UN Comtrade": "comtrade",
  "U.S. EIA": "eia",
  "UNHCR": "unhcr",
  "UN Tourism": "untourism",
};

const FAMILY_ICONS: Record<string, string> = {
  Agriculture: "🌾",
  Climate: "🌦️",
  Crops: "🌾",
  Dairy: "🥛",
  Displacement: "🧳",
  Economy: "💰",
  Education: "🎓",
  Energy: "⚡",
  Environment: "🌍",
  Fruit: "🍎",
  Geography: "🗺️",
  Government: "🏛️",
  Health: "⚕️",
  Infrastructure: "🏗️",
  Knowledge: "📚",
  Labor: "👷",
  Land: "🌲",
  Livestock: "🐄",
  Population: "👥",
  Technology: "💻",
  Trade: "📦",
  Transport: "✈️",
  Vaccination: "💉",
  Vegetables: "🥕",
};

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function sourceIndicatorKey(source: DataSourceId, indicator: string, direction: Category["direction"]) {
  return `${source}|${indicator}|${direction}`;
}

function staticIndicator(category: Category) {
  return category.warehouseSourceIndicatorCode ?? category.indicator;
}

function staticMatchMaps() {
  const byId = new Map(CATEGORIES.map((category) => [category.id, category]));
  const byIndicator = new Map<string, Category>();
  for (const category of CATEGORIES) {
    const key = sourceIndicatorKey(category.source, staticIndicator(category), category.direction);
    if (!byIndicator.has(key)) byIndicator.set(key, category);
  }
  return { byId, byIndicator };
}

function shortTitle(title: string) {
  return title
    .replace(/^(Highest|Lowest|Largest|Most|Fastest)\s+/i, "")
    .slice(0, 48);
}

function coverageFloor(row: PlayableCategoryRow, existing?: Category) {
  if (existing?.coverageFloor) return existing.coverageFloor;
  const coverage = Number(row.common_year_coverage ?? 100);
  return Math.max(45, Math.min(100, Math.floor(coverage * 0.6)));
}

function normalizedTrustStatus(value: string | null | undefined): TrustStatus | undefined {
  return value === "approved" || value === "caution" || value === "quarantined" ? value : undefined;
}

function normalizedEvidence(value: string | null | undefined): EvidenceLabel | undefined {
  const allowed: EvidenceLabel[] = [
    "Observed/administrative",
    "Internationally harmonized",
    "Modeled estimate",
    "Mixed observed and modeled",
    "Geospatially derived",
    "Independent bibliometric",
  ];
  return allowed.includes(value as EvidenceLabel) ? value as EvidenceLabel : undefined;
}

export function buildPlayableCategoryCatalog(rows: PlayableCategoryRow[]): Category[] {
  const { byId, byIndicator } = staticMatchMaps();
  const catalog = new Map<string, Category>();

  for (const row of rows) {
    const source = SOURCE_IDS[row.source_organization];
    if (!source) continue;
    const existing = byId.get(row.id) ?? byIndicator.get(sourceIndicatorKey(source, row.source_indicator_code, row.ranking_direction));
    const metadata = row.metadata ?? {};
    let category: Category = applyCategoryTrustPolicy({
      ...(existing ?? {} as Category),
      id: existing?.id ?? row.id,
      source,
      dataset: row.source_dataset,
      name: row.title,
      shortName: row.short_title?.trim() || existing?.shortName || shortTitle(row.title),
      indicator: existing?.indicator ?? row.source_indicator_code,
      warehouseSourceIndicatorCode: row.source_indicator_code,
      icon: row.icon?.trim() || existing?.icon || FAMILY_ICONS[row.family] || "📊",
      unit: row.unit || existing?.unit || "value",
      family: row.family,
      direction: row.ranking_direction,
      description: row.plain_language_description?.trim() || row.description || existing?.description || `${row.title}, using the source's documented definition.`,
      plainLanguageDescription: row.plain_language_description?.trim() || row.description || existing?.plainLanguageDescription,
      technicalDefinition: row.technical_definition?.trim() || existing?.technicalDefinition,
      unitExplanation: row.unit_explanation?.trim() || existing?.unitExplanation,
      certified: true,
      certificationGrade: Number(row.quality_score ?? 0) >= 85 ? "A" : "B",
      coverageFloor: coverageFloor(row, existing),
      globalCoverage: Number(row.common_year_coverage ?? existing?.globalCoverage ?? 0) || existing?.globalCoverage,
      commonYear: Number(row.common_year ?? existing?.commonYear ?? 0) || existing?.commonYear,
      enabled: true,
      minimumYear: Math.max(2022, Number(row.minimum_year ?? existing?.minimumYear ?? 2022)),
      requireCommonYear: true,
      warehouseBacked: true,
      sourceUrl: row.source_url || existing?.sourceUrl,
      methodologyUrl: row.methodology_url || existing?.methodologyUrl,
      evidenceLabel: normalizedEvidence(row.evidence_label) ?? existing?.evidenceLabel,
      credibilityScore: row.credibility_score ?? existing?.credibilityScore,
      trustStatus: normalizedTrustStatus(row.credibility_status) ?? existing?.trustStatus,
      trustReason: row.credibility_reason || existing?.trustReason,
      sourcePageUrl: row.source_page_url || existing?.sourcePageUrl,
      playerSourceUrl: row.player_source_url || existing?.playerSourceUrl,
      playerSourceStatus: (row.player_source_status as Category["playerSourceStatus"]) || existing?.playerSourceStatus,
      playerSourceReason: row.player_source_reason || existing?.playerSourceReason,
      playerSourceCheckedAt: row.player_source_checked_at || existing?.playerSourceCheckedAt,
      contentReviewStatus: (row.content_review_status as Category["contentReviewStatus"]) || existing?.contentReviewStatus,
      contentReviewReason: row.content_review_reason || existing?.contentReviewReason,
      contentReviewVersion: row.content_review_version || existing?.contentReviewVersion,
      immediateComprehensionScore: row.immediate_comprehension_score ?? existing?.immediateComprehensionScore,
      gameplayInterestScore: row.gameplay_interest_score ?? existing?.gameplayInterestScore,
      uniquenessScore: row.uniqueness_score ?? existing?.uniquenessScore,
      linkQualityScore: row.link_quality_score ?? existing?.linkQualityScore,
      exactQueryUrl: row.exact_query_url || existing?.exactQueryUrl,
      downloadUrl: row.download_url || existing?.downloadUrl,
      apiUrl: row.api_url || existing?.apiUrl,
      datasetRelease: row.dataset_release || existing?.datasetRelease,
      retrievedAt: row.retrieved_at || existing?.retrievedAt,
      licenseName: row.license_name || existing?.licenseName,
      licenseUrl: row.license_url || existing?.licenseUrl,
      sourceQuery: row.source_query ?? existing?.sourceQuery,
      derivationMethod: row.derivation_method || existing?.derivationMethod,
      derivationVersion: row.derivation_version || existing?.derivationVersion,
      inputDatasets: row.input_datasets ?? existing?.inputDatasets,
      verifiabilityScore: row.verifiability_score ?? existing?.verifiabilityScore,
      verifiabilityStatus: row.verifiability_status || existing?.verifiabilityStatus,
      understandabilityScore: row.understandability_score ?? existing?.understandabilityScore,
      funScore: row.fun_score ?? existing?.funScore,
      objectiveStatus: (row.objective_status as Category["objectiveStatus"]) ?? existing?.objectiveStatus,
      playerQualityStatus: (row.player_quality_status as Category["playerQualityStatus"]) ?? existing?.playerQualityStatus,
      playerQualityReason: row.player_quality_reason || existing?.playerQualityReason,
      roundType: existing?.roundType || metadataString(metadata, "roundType") || (source === "comtrade" ? "product-trade" : row.family),
      similarityGroup: existing?.similarityGroup || row.concept_group || metadataString(metadata, "similarityGroup") || `${source}:${row.source_indicator_code}`,
      semanticFamily: row.effective_semantic_group || row.semantic_family || existing?.semanticFamily || metadataString(metadata, "semanticFamily"),
      semanticTopic: existing?.semanticTopic || row.semantic_topic || metadataString(metadata, "semanticTopic") || row.concept_group || undefined,
      productSpecificTrade: existing?.productSpecificTrade ?? source === "comtrade",
    });

    // v15 makes the database review state authoritative. The SQL view has
    // already combined the human editorial decision with strict integrity,
    // coverage, recency, credibility, and source-link requirements. Do not
    // re-apply the retired v14 matrix of overlapping legacy review fields.
    if (row.computed_playable_v15 !== true) continue;
    category = {
      ...category,
      enabled: true,
      playerSourceUrl: row.player_source_url || category.playerSourceUrl,
      playerSourceStatus: (row.player_source_status as Category["playerSourceStatus"]) || category.playerSourceStatus,
      playabilityWarnings: row.player_source_status === "general" ? ["General official source page only."] : [],
    };
    catalog.set(category.id, category);
  }

  return [...catalog.values()].sort((a, b) => a.id.localeCompare(b.id));
}

let browserCatalogPromise: Promise<Category[]> | null = null;

export function fetchPlayableCategoryCatalog(options: { refresh?: boolean } = {}) {
  if (typeof window === "undefined") return Promise.reject(new Error("The verified category catalog must be loaded by the server."));
  if (!browserCatalogPromise || options.refresh) {
    browserCatalogPromise = fetch("/api/playable-categories", { cache: options.refresh ? "no-store" : "default" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as { categories?: Category[]; error?: string };
        if (!response.ok || !payload.categories?.length) throw new Error(payload.error || "The trusted category catalog could not be loaded.");
        return payload.categories;
      })
      .catch((error) => {
        browserCatalogPromise = null;
        throw error;
      });
  }
  return browserCatalogPromise;
}
