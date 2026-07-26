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
  minimum_year?: number | null;
  common_year_coverage?: number | null;
  quality_score?: number | null;
  concept_group?: string | null;
  metadata?: Record<string, unknown> | null;
  credibility_score?: number | null;
  credibility_status?: string | null;
  credibility_reason?: string | null;
  evidence_label?: string | null;
  enabled?: boolean | null;
  eligible_daily?: boolean | null;
  review_status?: string | null;
  curation_status?: string | null;
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
    if (row.enabled === false || row.eligible_daily === false || row.review_status === "rejected" || row.curation_status === "excluded") continue;
    if (row.credibility_status === "quarantined" || Number(row.credibility_score ?? 100) < 75) continue;

    const existing = byId.get(row.id) ?? byIndicator.get(sourceIndicatorKey(source, row.source_indicator_code, row.ranking_direction));
    const metadata = row.metadata ?? {};
    const category: Category = applyCategoryTrustPolicy({
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
      description: row.description || existing?.description || `${row.title}, using the source's documented definition.`,
      certified: true,
      certificationGrade: Number(row.quality_score ?? 0) >= 85 ? "A" : "B",
      coverageFloor: coverageFloor(row, existing),
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
      roundType: existing?.roundType || metadataString(metadata, "roundType") || (source === "comtrade" ? "product-trade" : row.family),
      similarityGroup: existing?.similarityGroup || row.concept_group || metadataString(metadata, "similarityGroup") || `${source}:${row.source_indicator_code}`,
      productSpecificTrade: existing?.productSpecificTrade ?? source === "comtrade",
    });

    if (category.enabled === false || category.trustStatus === "quarantined" || (category.credibilityScore ?? 0) < 75) continue;
    catalog.set(category.id, category);
  }

  return [...catalog.values()].sort((a, b) => a.id.localeCompare(b.id));
}

let browserCatalogPromise: Promise<Category[]> | null = null;

export function fetchPlayableCategoryCatalog(options: { refresh?: boolean } = {}) {
  if (typeof window === "undefined") return Promise.resolve(CATEGORIES.filter((category) => category.enabled !== false));
  if (!browserCatalogPromise || options.refresh) {
    browserCatalogPromise = fetch("/api/playable-categories", { cache: options.refresh ? "no-store" : "default" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as { categories?: Category[]; error?: string };
        if (!response.ok || !payload.categories?.length) throw new Error(payload.error || "The trusted category catalog could not be loaded.");
        return payload.categories;
      })
      .catch(() => CATEGORIES.filter((category) => category.enabled !== false));
  }
  return browserCatalogPromise;
}
