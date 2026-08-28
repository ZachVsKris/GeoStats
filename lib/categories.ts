import { applyCategoryTrustPolicy, type EvidenceLabel, type TrustStatus } from "./categoryTrust";
export type Direction = "high" | "low";
export type DataSourceId =
  | "worldbank"
  | "faostat"
  | "faostatfbs"
  | "who"
  | "unesco"
  | "untourism"
  | "naturalearth"
  | "comtrade"
  | "eia"
  | "unhcr"
  | "ilostat"
  | "unsdg"
  | "pewreligion"
  | "smithsoniangvp"
  | "usgs"
  | "worldcover"
  | "hydrosheds"
  | "elevation"
  | "unescoheritage"
  | "aquastat"
  | "usgsminerals"
  | "faofisheries"
  | "unmembership"
  | "constitute"
  | "ipu"
  | "unwpp"
  | "worldbankclimate"
  | "imfweo"
  | "unescoich"
  | "noaatsunami"
  | "whoghed"
  | "undesamigrant"
  | "wtoservices"
  | "untourismdirect"
  | "fifa"
  | "ioc"
  | "worldbankhistory"
  | "globalfindex2025"
  | "faofra2025"
  | "unicefdata"
  | "undphdr"
  | "vdemv16"
  | "faostatfoodsecurity"
  | "koppengeiger"
  | "worldbankinfra"
  | "faostatlanduse"
  | "faostatworldcover"
  | "worldbankwbl"
  | "jmpwash"
  | "unwup2025"
  | "unwupcities2025";
export type CertificationGrade = "A" | "B";
export type Category = {
  id: string;
  source: DataSourceId;
  dataset: string;
  name: string;
  shortName: string;
  indicator: string;
  icon: string;
  unit: string;
  family: string;
  direction: Direction;
  // Full plain-language explanation used in source/detail views.
  description: string;
  // Short, complete sentence shown on the board. Never an ellipsized source definition.
  boardDescription?: string;
  decimals?: number;
  minimumYear?: number;
  requireCommonYear?: boolean;
  expectedRange?: [number, number];
  certified: true;
  certificationGrade: CertificationGrade;
  coverageFloor: number;
  globalCoverage?: number;
  commonYear?: number;
  // v16.2.6 expansion-recovery: the legitimate comparison universe can be a
  // complete, explicitly defined subset rather than an arbitrary 195-country floor.
  eligibleUniverseType?: "universal" | "defined_subset";
  eligibleUniverseRule?: string;
  eligibleCountryCount?: number;
  eligibleCountryIds?: string[];
  coverageWithinEligibleUniverse?: number;
  excludedCountryReason?: string;
  enabled?: boolean;
  // Optional editorial metadata used by the round composer. Existing categories
  // fall back to their family and indicator when these are omitted.
  roundType?: string;
  similarityGroup?: string;
  // Board-quality concepts. semanticFamily is a hard one-per-board grouping;
  // semanticTopic is the narrower indicator concept used for review and diagnostics.
  semanticFamily?: string;
  semanticTopic?: string;
  // Narrow hard-conflict family. Unlike knowledgeCluster, this may be used as a one-per-board rule.
  strategyFamily?: string;
  // Structured measure metadata. Player wording must not control generator behavior.
  measureType?: "total" | "share" | "rate" | "index" | "count" | "physical" | "historical" | "other";
  normalizationType?: "absolute" | "per-person" | "per-area" | "percentage" | "rate" | "none" | "other";
  // Player-facing measurement family used for subtle visual coding.
  measurementType?: "total" | "share" | "per_capita" | "historical_date" | "other";
  historicalValueFormat?: "year" | "date";
  // v15.4 board-composition metadata. Broad domains balance the board;
  // knowledge clusters prevent multiple categories that reward the same strategy.
  broadDomain?: string;
  knowledgeCluster?: string;
  catalogTier?: "daily" | "quarantined";
  productSpecificTrade?: boolean;
  // Warehouse-backed categories are loaded from the curated Supabase common-year snapshot.
  warehouseBacked?: boolean;
  warehouseSourceIndicatorCode?: string;
  // Trust and source metadata are filled by the v13.5 policy and can be overridden by warehouse metadata.
  sourceUrl?: string;
  methodologyUrl?: string;
  evidenceLabel?: EvidenceLabel;
  credibilityScore?: number;
  trustStatus?: TrustStatus;
  trustReason?: string;
  // v14 transparency, reproducibility, and player-quality metadata.
  plainLanguageDescription?: string;
  technicalDefinition?: string;
  unitExplanation?: string;
  sourcePageUrl?: string;
  // The only source URL exposed to players. Exact official data views are preferred; a safe human-readable general official portal is allowed with a warning.
  playerSourceUrl?: string;
  playerSourceStatus?: "pending" | "exact" | "general" | "needs_exact_url" | "invalid" | "unavailable";
  playerSourceReason?: string;
  playerSourceCheckedAt?: string;
  contentReviewStatus?: "pending" | "approved" | "excluded";
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
  // Static/reference datasets show a version or reference period instead of pretending the import year is an observation year.
  referenceLabel?: string;
  showObservationYear?: boolean;
  retrievedAt?: string;
  licenseName?: string;
  licenseUrl?: string;
  sourceQuery?: Record<string, unknown> | string;
  derivationMethod?: string;
  derivationVersion?: string;
  inputDatasets?: Array<Record<string, unknown> | string>;
  verifiabilityScore?: number;
  verifiabilityStatus?: string;
  understandabilityScore?: number;
  funScore?: number;
  objectiveStatus?: "objective" | "composite" | "subjective" | "uncertain";
  playerQualityStatus?: "approved" | "caution" | "blocked" | "review";
  playerQualityReason?: string;
  // Ranking completeness is separate from raw row coverage. A category may be
  // top-end complete when omitted countries are source-confirmed zeros or clearly
  // unable to alter the meaningful top ranking.
  rankingCompletenessStatus?: "comprehensive" | "top_end_complete" | "non_comprehensive" | "unreviewed";
  rankingCompletenessReason?: string;
  topValueDistinctCount?: number;
  topValueFeasible?: boolean;
  // v14.4 diagnostics. These never replace the canonical policy result.
  playabilityWarnings?: string[];
};


const CURATED_WORLD_BANK_CATEGORY_IDS = new Set<string>([
  "population",
  "merchExports",
  "merchImports",
  "gdp",
  "populationGrowth",
  "gdpPc",
  "older",
  "rural",
  "young",
  "gdpGrowth",
  "agValue",
  "protected",
  "manufacturing",
  "fixedTelephone",
  "healthSpend",
  "industryShare",
  "fixedBroadband",
  "fertility",
  "journalArticles",
  "mobile",
  "infantMortality",
  "healthSpendShare",
  "femaleLabor",
  "exportsShare",
  "forestArea",
  "land",
  "life",
  "density",
  "arableHa",
  "foodExportsShare",
  "forestPct",
  "arablePct",
  "investmentShare",
  "highTechExports",
  "foodImportsShare",
  "grossSavings",
  "basicWater",
  "militarySpend",
  "electricityAccess",
  "militaryShare",
  "electricUse",
  "energyUse",
  "freshwater",
  "airPassengers",
  "co2Total",
  "co2PerCapita",
  "methane",
]);

const CURATED_EXISTING_WAREHOUSE_IDS = new Set<string>([
  "comtrade:most-electrical-equipment-exported",
  "comtrade:most-pharmaceuticals-exported",
  "comtrade:most-aircraft-exported",
  "comtrade:most-cars-exported",
  "comtrade:most-coffee-exported",
  "comtrade:most-rice-exported",
  "comtrade:most-wine-exported",
  "unhcr:most-refugees-hosted",
  "unhcr:most-refugees-originating",
  "unhcr:most-asylum-applications-received",
  "unhcr:most-asylum-applications-by-origin",
  "eia:most-crude-oil-produced",
]);

// Every playable category is certified against one authoritative dataset.
// External-source categories can use the same schema once their independent adapter and verifier ship.
const wb = (category: Omit<Category, "source" | "dataset" | "certified" | "certificationGrade" | "coverageFloor"> & Partial<Pick<Category, "certificationGrade" | "coverageFloor">>): Category => ({
  source: "worldbank",
  dataset: "World Development Indicators",
  certified: true,
  certificationGrade: category.certificationGrade ?? "A",
  coverageFloor: category.coverageFloor ?? 100,
  ...category,
  enabled: category.enabled ?? CURATED_WORLD_BANK_CATEGORY_IDS.has(category.id),
  minimumYear: Math.max(2022, category.minimumYear ?? 2022),
});


const fao = (category: Omit<Category, "source" | "dataset" | "certified" | "certificationGrade" | "coverageFloor"> & Partial<Pick<Category, "certificationGrade" | "coverageFloor">>): Category => ({
  source: "faostat",
  dataset: "Crops and livestock products (QCL)",
  certified: true,
  certificationGrade: category.certificationGrade ?? "A",
  coverageFloor: category.coverageFloor ?? 70,
  ...category,
  minimumYear: Math.max(2022, category.minimumYear ?? 2022),
});


const distributed = (source: Extract<DataSourceId, "who" | "unesco" | "untourism">, dataset: string, category: Omit<Category, "source" | "dataset" | "certified" | "certificationGrade" | "coverageFloor"> & Partial<Pick<Category, "certificationGrade" | "coverageFloor">>): Category => ({
  source,
  dataset,
  certified: true,
  certificationGrade: category.certificationGrade ?? "A",
  coverageFloor: category.coverageFloor ?? 90,
  ...category,
  minimumYear: Math.max(2022, category.minimumYear ?? 2022),
});

const who = (category: Parameters<typeof distributed>[2]) => distributed("who", "WHO Global Health Observatory (distributed through WDI)", category);
const unesco = (category: Parameters<typeof distributed>[2]) => distributed("unesco", "UNESCO Institute for Statistics (distributed through WDI)", category);
const tourism = (category: Parameters<typeof distributed>[2]) => distributed("untourism", "UN Tourism statistics (distributed through WDI)", category);

const WAREHOUSE_DATASETS: Record<Extract<DataSourceId, "faostat" | "who" | "unesco" | "ilostat" | "naturalearth" | "comtrade" | "eia" | "unhcr">, string> = {
  faostat: "FAOSTAT Crops and livestock products (QCL)",
  who: "WHO Global Health Observatory",
  unesco: "UNESCO Institute for Statistics",
  ilostat: "ILOSTAT",
  naturalearth: "Natural Earth geometry-derived country statistics",
  comtrade: "UN Comtrade International Merchandise Trade Statistics",
  eia: "EIA International Energy Data",
  unhcr: "UNHCR Refugee Data Finder",
};

const warehouse = (
  source: Extract<DataSourceId, "faostat" | "who" | "unesco" | "ilostat" | "naturalearth" | "comtrade" | "eia" | "unhcr">,
  dataset: string,
  category: Omit<Category, "source" | "dataset" | "certified" | "certificationGrade" | "coverageFloor"> & Partial<Pick<Category, "certificationGrade" | "coverageFloor">>,
): Category => ({
  source,
  dataset,
  certified: true,
  certificationGrade: category.certificationGrade ?? "A",
  coverageFloor: category.coverageFloor ?? 60,
  ...category,
  enabled: category.enabled ?? CURATED_EXISTING_WAREHOUSE_IDS.has(category.id),
  warehouseBacked: true,
  minimumYear: Math.max(2022, category.minimumYear ?? 2022),
});

const comtrade = (category: Parameters<typeof warehouse>[2]) => warehouse("comtrade", WAREHOUSE_DATASETS.comtrade, category);
const eia = (category: Parameters<typeof warehouse>[2]) => warehouse("eia", WAREHOUSE_DATASETS.eia, category);
const unhcr = (category: Parameters<typeof warehouse>[2]) => warehouse("unhcr", WAREHOUSE_DATASETS.unhcr, category);

type CuratedExternalSource = Extract<DataSourceId, "faostat" | "who" | "unesco" | "ilostat" | "naturalearth">;
const warehouseExternal = (
  category: Omit<Category, "source" | "dataset" | "certified" | "certificationGrade" | "coverageFloor"> &
    Partial<Pick<Category, "certificationGrade" | "coverageFloor">> &
    { warehouseSourceIndicatorCode: string },
): Category => {
  const sourceToken = category.id.split(":", 1)[0];
  const source = (sourceToken === "natural-earth" ? "naturalearth" : sourceToken) as CuratedExternalSource;
  if (!(source in WAREHOUSE_DATASETS)) throw new Error(`Unsupported curated warehouse source: ${sourceToken}`);
  return warehouse(source, WAREHOUSE_DATASETS[source], { ...category, enabled: true });
};

const WAREHOUSE_CATEGORIES: Category[] = [
  comtrade({ id: "comtrade:most-coffee-exported", name: "Largest coffee exports", shortName: "Coffee exports", indicator: "comtrade:most-coffee-exported", icon: "☕", unit: "USD", family: "Trade", direction: "high", description: "Annual coffee export value, current US dollars (total)", coverageFloor: 80, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "commodity-coffee" }),
  comtrade({ id: "comtrade:most-tea-exported", name: "Largest tea exports", shortName: "Tea exports", indicator: "comtrade:most-tea-exported", icon: "🍵", unit: "USD", family: "Trade", direction: "high", description: "Annual tea export value, current US dollars (total)", coverageFloor: 65, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-food-exports" }),
  comtrade({ id: "comtrade:most-rice-exported", name: "Largest rice exports", shortName: "Rice exports", indicator: "comtrade:most-rice-exported", icon: "🍚", unit: "USD", family: "Trade", direction: "high", description: "Annual rice export value, current US dollars (total)", coverageFloor: 65, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "commodity-rice" }),
  comtrade({ id: "comtrade:most-wheat-exported", name: "Largest wheat exports", shortName: "Wheat exports", indicator: "comtrade:most-wheat-exported", icon: "🌾", unit: "USD", family: "Trade", direction: "high", description: "Annual wheat export value, current US dollars (total)", coverageFloor: 60, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-food-exports" }),
  comtrade({ id: "comtrade:most-cocoa-beans-exported", name: "Largest cocoa-bean exports", shortName: "Cocoa exports", indicator: "comtrade:most-cocoa-beans-exported", icon: "🍫", unit: "USD", family: "Trade", direction: "high", description: "Annual cocoa-bean export value, current US dollars (total)", coverageFloor: 45, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-food-exports" }),
  comtrade({ id: "comtrade:most-chocolate-exported", name: "Largest chocolate exports", shortName: "Chocolate exports", indicator: "comtrade:most-chocolate-exported", icon: "🍫", unit: "USD", family: "Trade", direction: "high", description: "Annual chocolate export value, current US dollars (total)", coverageFloor: 85, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-food-exports" }),
  comtrade({ id: "comtrade:most-bananas-exported", name: "Largest banana exports", shortName: "Banana exports", indicator: "comtrade:most-bananas-exported", icon: "🍌", unit: "USD", family: "Trade", direction: "high", description: "Annual banana export value, current US dollars (total)", coverageFloor: 55, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-food-exports" }),
  comtrade({ id: "comtrade:most-wine-exported", name: "Largest wine exports", shortName: "Wine exports", indicator: "comtrade:most-wine-exported", icon: "🍷", unit: "USD", family: "Trade", direction: "high", description: "Annual wine export value, current US dollars (total)", coverageFloor: 75, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "commodity-wine" }),
  comtrade({ id: "comtrade:most-cars-exported", name: "Largest car exports", shortName: "Car exports", indicator: "comtrade:most-cars-exported", icon: "🚗", unit: "USD", family: "Trade", direction: "high", description: "Annual passenger-car export value, current US dollars (total)", coverageFloor: 80, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-manufactured-exports" }),
  comtrade({ id: "comtrade:most-pharmaceuticals-exported", name: "Largest pharmaceutical exports", shortName: "Pharma exports", indicator: "comtrade:most-pharmaceuticals-exported", icon: "💊", unit: "USD", family: "Trade", direction: "high", description: "Annual pharmaceutical export value, current US dollars (total)", coverageFloor: 100, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-manufactured-exports" }),
  comtrade({ id: "comtrade:most-electrical-equipment-exported", name: "Largest electrical-equipment exports", shortName: "Electrical exports", indicator: "comtrade:most-electrical-equipment-exported", icon: "🔌", unit: "USD", family: "Trade", direction: "high", description: "Annual electrical-equipment export value, current US dollars (total)", coverageFloor: 120, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-manufactured-exports" }),
  comtrade({ id: "comtrade:most-clothing-exported", name: "Largest clothing exports", shortName: "Clothing exports", indicator: "comtrade:most-clothing-exported", icon: "👕", unit: "USD", family: "Trade", direction: "high", description: "Annual knitted and non-knitted clothing export value, current US dollars (total)", coverageFloor: 105, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-manufactured-exports" }),
  comtrade({ id: "comtrade:most-crude-oil-exported", name: "Largest crude-oil exports", shortName: "Crude-oil exports", indicator: "comtrade:most-crude-oil-exported", icon: "🛢️", unit: "USD", family: "Trade", direction: "high", description: "Annual crude-petroleum export value, current US dollars (total)", coverageFloor: 45, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-resource-exports" }),
  comtrade({ id: "comtrade:most-gold-exported", name: "Largest gold exports", shortName: "Gold exports", indicator: "comtrade:most-gold-exported", icon: "🥇", unit: "USD", family: "Trade", direction: "high", description: "Annual gold export value, current US dollars (total)", coverageFloor: 60, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-resource-exports" }),
  comtrade({ id: "comtrade:most-aircraft-exported", name: "Largest aircraft exports", shortName: "Aircraft exports", indicator: "comtrade:most-aircraft-exported", icon: "✈️", unit: "USD", family: "Trade", direction: "high", description: "Annual aircraft and spacecraft export value, current US dollars (total)", coverageFloor: 55, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-manufactured-exports" }),

  eia({ id: "eia:most-crude-oil-produced", name: "Most crude oil produced", shortName: "Crude-oil production", indicator: "eia:most-crude-oil-produced", icon: "🛢️", unit: "thousand barrels/day", family: "Energy", direction: "high", description: "Total crude-oil production in the EIA-reported physical unit", coverageFloor: 45, roundType: "energy-production", similarityGroup: "eia-fossil-production" }),
  eia({ id: "eia:most-natural-gas-produced", name: "Most natural gas produced", shortName: "Gas production", indicator: "eia:most-natural-gas-produced", icon: "🔥", unit: "billion cubic feet", family: "Energy", direction: "high", description: "Total natural-gas production in the EIA-reported physical unit", coverageFloor: 60, roundType: "energy-production", similarityGroup: "eia-fossil-production" }),
  eia({ id: "eia:most-coal-produced", name: "Most coal produced", shortName: "Coal production", indicator: "eia:most-coal-produced", icon: "⛏️", unit: "million short tons", family: "Energy", direction: "high", description: "Total coal production in the EIA-reported physical unit", coverageFloor: 55, roundType: "energy-production", similarityGroup: "eia-fossil-production" }),
  eia({ id: "eia:most-electricity-generated", name: "Most electricity generated", shortName: "Electricity generation", indicator: "eia:most-electricity-generated", icon: "⚡", unit: "billion kWh", family: "Energy", direction: "high", description: "Total annual electricity generation in the EIA-reported physical unit", coverageFloor: 130, roundType: "energy-generation", similarityGroup: "eia-electricity-generation" }),
  eia({ id: "eia:most-renewable-electricity-generated", name: "Most renewable electricity generated", shortName: "Renewable generation", indicator: "eia:most-renewable-electricity-generated", icon: "♻️", unit: "billion kWh", family: "Energy", direction: "high", description: "Total annual renewable electricity generation in the EIA-reported physical unit", coverageFloor: 110, roundType: "energy-generation", similarityGroup: "eia-electricity-generation" }),
  eia({ id: "eia:most-hydroelectricity-generated", name: "Most hydroelectricity generated", shortName: "Hydro generation", indicator: "eia:most-hydroelectricity-generated", icon: "💧", unit: "billion kWh", family: "Energy", direction: "high", description: "Total annual hydroelectric generation in the EIA-reported physical unit", coverageFloor: 85, roundType: "energy-generation", similarityGroup: "eia-electricity-generation" }),
  eia({ id: "eia:most-wind-electricity-generated", name: "Most wind electricity generated", shortName: "Wind generation", indicator: "eia:most-wind-electricity-generated", icon: "🌬️", unit: "billion kWh", family: "Energy", direction: "high", description: "Total annual wind electricity generation in the EIA-reported physical unit", coverageFloor: 75, roundType: "energy-generation", similarityGroup: "eia-electricity-generation" }),
  eia({ id: "eia:most-solar-electricity-generated", name: "Most solar electricity generated", shortName: "Solar generation", indicator: "eia:most-solar-electricity-generated", icon: "☀️", unit: "billion kWh", family: "Energy", direction: "high", description: "Total annual solar electricity generation in the EIA-reported physical unit", coverageFloor: 75, roundType: "energy-generation", similarityGroup: "eia-electricity-generation" }),
  eia({ id: "eia:most-nuclear-electricity-generated", name: "Most nuclear electricity generated", shortName: "Nuclear generation", indicator: "eia:most-nuclear-electricity-generated", icon: "☢️", unit: "billion kWh", family: "Energy", direction: "high", description: "Total annual nuclear electricity generation in the EIA-reported physical unit", coverageFloor: 30, roundType: "energy-generation", similarityGroup: "eia-electricity-generation" }),
  eia({ id: "eia:most-primary-energy-consumed", name: "Most primary energy consumed", shortName: "Primary energy", indicator: "eia:most-primary-energy-consumed", icon: "🔋", unit: "quadrillion Btu", family: "Energy", direction: "high", description: "Total primary-energy consumption in the EIA-reported physical unit", coverageFloor: 130, roundType: "energy-consumption", similarityGroup: "eia-energy-consumption" }),
  eia({ id: "eia:most-petroleum-consumed", name: "Most petroleum consumed", shortName: "Petroleum consumption", indicator: "eia:most-petroleum-consumed", icon: "⛽", unit: "thousand barrels/day", family: "Energy", direction: "high", description: "Total petroleum consumption in the EIA-reported physical unit", coverageFloor: 115, roundType: "energy-consumption", similarityGroup: "eia-energy-consumption" }),
  eia({ id: "eia:most-natural-gas-consumed", name: "Most natural gas consumed", shortName: "Gas consumption", indicator: "eia:most-natural-gas-consumed", icon: "🔥", unit: "billion cubic feet", family: "Energy", direction: "high", description: "Total natural-gas consumption in the EIA-reported physical unit", coverageFloor: 110, roundType: "energy-consumption", similarityGroup: "eia-energy-consumption" }),
  eia({ id: "eia:most-coal-consumed", name: "Most coal consumed", shortName: "Coal consumption", indicator: "eia:most-coal-consumed", icon: "🏭", unit: "million short tons", family: "Energy", direction: "high", description: "Total coal consumption in the EIA-reported physical unit", coverageFloor: 95, roundType: "energy-consumption", similarityGroup: "eia-energy-consumption" }),
  eia({ id: "eia:most-electricity-exported", name: "Most electricity exported", shortName: "Electricity exports", indicator: "eia:most-electricity-exported", icon: "🔌", unit: "billion kWh", family: "Energy", direction: "high", description: "Total annual electricity exports in the EIA-reported physical unit", coverageFloor: 45, roundType: "energy-trade", similarityGroup: "eia-electricity-trade" }),
  eia({ id: "eia:most-electricity-imported", name: "Most electricity imported", shortName: "Electricity imports", indicator: "eia:most-electricity-imported", icon: "🔌", unit: "billion kWh", family: "Energy", direction: "high", description: "Total annual electricity imports in the EIA-reported physical unit", coverageFloor: 45, roundType: "energy-trade", similarityGroup: "eia-electricity-trade" }),

  unhcr({ id: "unhcr:most-refugees-hosted", name: "Most refugees hosted", shortName: "Refugees hosted", indicator: "unhcr:most-refugees-hosted", icon: "🏠", unit: "people", family: "Displacement", direction: "high", description: "Total refugees residing in the country of asylum", coverageFloor: 110, roundType: "displacement-hosting", similarityGroup: "unhcr-refugees" }),
  unhcr({ id: "unhcr:most-refugees-originating", name: "Most refugees originating", shortName: "Refugees originating", indicator: "unhcr:most-refugees-originating", icon: "🧳", unit: "people", family: "Displacement", direction: "high", description: "Total refugees whose country of origin is the listed country", coverageFloor: 100, roundType: "displacement-origin", similarityGroup: "unhcr-refugees" }),
  unhcr({ id: "unhcr:most-asylum-seekers-hosted", name: "Most asylum seekers hosted", shortName: "Asylum seekers hosted", indicator: "unhcr:most-asylum-seekers-hosted", icon: "📋", unit: "people", family: "Displacement", direction: "high", description: "Total asylum seekers residing in the country of asylum", coverageFloor: 90, roundType: "displacement-hosting", similarityGroup: "unhcr-asylum" }),
  unhcr({ id: "unhcr:most-asylum-seekers-originating", name: "Most asylum seekers originating", shortName: "Asylum seekers originating", indicator: "unhcr:most-asylum-seekers-originating", icon: "📝", unit: "people", family: "Displacement", direction: "high", description: "Total asylum seekers whose country of origin is the listed country", coverageFloor: 80, roundType: "displacement-origin", similarityGroup: "unhcr-asylum" }),
  unhcr({ id: "unhcr:most-internally-displaced-people", name: "Most internally displaced people", shortName: "Internally displaced", indicator: "unhcr:most-internally-displaced-people", icon: "⛺", unit: "people", family: "Displacement", direction: "high", description: "Total internally displaced people reported in the country", coverageFloor: 30, roundType: "displacement-stock", similarityGroup: "unhcr-internal-displacement" }),
  unhcr({ id: "unhcr:most-stateless-people", name: "Largest stateless population residing in the country", shortName: "Stateless residents", indicator: "unhcr:most-stateless-people", icon: "🪪", unit: "people", family: "Displacement", direction: "high", description: "Number of stateless people reported as living in each country", coverageFloor: 35, roundType: "displacement-stock", similarityGroup: "unhcr-protection" }),
  unhcr({ id: "unhcr:most-other-people-needing-protection", name: "Most other people needing international protection", shortName: "Other people protected", indicator: "unhcr:most-other-people-needing-protection", icon: "🛟", unit: "people", family: "Displacement", direction: "high", description: "Total other people in need of international protection", coverageFloor: 25, roundType: "displacement-stock", similarityGroup: "unhcr-protection" }),
  unhcr({ id: "unhcr:most-asylum-applications-received", name: "Most asylum applications received", shortName: "Applications received", indicator: "unhcr:most-asylum-applications-received", icon: "📨", unit: "applications", family: "Displacement", direction: "high", description: "Total asylum applications received by the country of asylum", coverageFloor: 75, roundType: "displacement-flow", similarityGroup: "unhcr-applications" }),
  unhcr({ id: "unhcr:most-asylum-applications-by-origin", name: "Most asylum applications by origin", shortName: "Applications by origin", indicator: "unhcr:most-asylum-applications-by-origin", icon: "📤", unit: "applications", family: "Displacement", direction: "high", description: "Total asylum applications filed by people from the listed country of origin", coverageFloor: 70, roundType: "displacement-flow", similarityGroup: "unhcr-applications" }),
  unhcr({ id: "unhcr:most-refugees-returned-home", name: "Most refugees returned home", shortName: "Refugees returned", indicator: "unhcr:most-refugees-returned-home", icon: "🏡", unit: "people", family: "Displacement", direction: "high", description: "Total refugees who returned to their country of origin", coverageFloor: 35, roundType: "displacement-solution", similarityGroup: "unhcr-solutions" }),
  unhcr({ id: "unhcr:most-returned-idps", name: "Most internally displaced people returned", shortName: "IDPs returned", indicator: "unhcr:most-returned-idps", icon: "↩️", unit: "people", family: "Displacement", direction: "high", description: "Total internally displaced people who returned", coverageFloor: 25, roundType: "displacement-solution", similarityGroup: "unhcr-solutions" }),
  unhcr({ id: "unhcr:most-refugees-naturalized", name: "Most refugees naturalized", shortName: "Refugees naturalized", indicator: "unhcr:most-refugees-naturalized", icon: "🪪", unit: "people", family: "Displacement", direction: "high", description: "Total refugees reported as naturalized in the country of asylum", coverageFloor: 20, roundType: "displacement-solution", similarityGroup: "unhcr-solutions" }),
];

const CURATED_EXTERNAL_CATEGORIES: Category[] = [
  warehouseExternal({ id: "faostat:01371:5510", name: "Most almonds produced", shortName: "almonds production", indicator: "QCL:'01371:5510", warehouseSourceIndicatorCode: "QCL:'01371:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01371" }),
  warehouseExternal({ id: "faostat:01343:5510", name: "Most apricot produced", shortName: "apricot production", indicator: "QCL:'01343:5510", warehouseSourceIndicatorCode: "QCL:'01343:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01343" }),
  warehouseExternal({ id: "faostat:01213:5510", name: "Most cauliflower and broccoli produced", shortName: "cauliflower and broccoli production", indicator: "QCL:'01213:5510", warehouseSourceIndicatorCode: "QCL:'01213:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01213" }),
  warehouseExternal({ id: "faostat:01344.02:5510", name: "Most cherries produced", shortName: "cherries production", indicator: "QCL:'01344.02:5510", warehouseSourceIndicatorCode: "QCL:'01344.02:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01344-02" }),
  warehouseExternal({ id: "faostat:01460:5510", name: "Most coconuts produced", shortName: "coconuts production", indicator: "QCL:'01460:5510", warehouseSourceIndicatorCode: "QCL:'01460:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01460" }),
  warehouseExternal({ id: "faostat:01705:5510", name: "Most dry peas produced", shortName: "dry peas production", indicator: "QCL:'01705:5510", warehouseSourceIndicatorCode: "QCL:'01705:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01705" }),
  warehouseExternal({ id: "faostat:01233:5510", name: "Most eggplants produced", shortName: "eggplants production", indicator: "QCL:'01233:5510", warehouseSourceIndicatorCode: "QCL:'01233:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01233" }),
  warehouseExternal({ id: "faostat:0231:5513", name: "Most eggs produced", shortName: "eggs production", indicator: "QCL:'0231:5513", warehouseSourceIndicatorCode: "QCL:'0231:5513", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-0231" }),
  warehouseExternal({ id: "faostat:01315:5510", name: "Most figs produced", shortName: "figs production", indicator: "QCL:'01315:5510", warehouseSourceIndicatorCode: "QCL:'01315:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01315" }),
  warehouseExternal({ id: "faostat:01242:5510", name: "Most green peas produced", shortName: "green peas production", indicator: "QCL:'01242:5510", warehouseSourceIndicatorCode: "QCL:'01242:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01242" }),
  warehouseExternal({ id: "faostat:02910:5510", name: "Most honey produced", shortName: "honey production", indicator: "QCL:'02910:5510", warehouseSourceIndicatorCode: "QCL:'02910:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-02910" }),
  warehouseExternal({ id: "faostat:01214:5510", name: "Most lettuce and chicory produced", shortName: "lettuce and chicory production", indicator: "QCL:'01214:5510", warehouseSourceIndicatorCode: "QCL:'01214:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01214" }),
  warehouseExternal({ id: "faostat:01324:5510", name: "Most mandarins and tangerines produced", shortName: "mandarins and tangerines production", indicator: "QCL:'01324:5510", warehouseSourceIndicatorCode: "QCL:'01324:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01324" }),
  warehouseExternal({ id: "faostat:01229:5510", name: "Most melons produced", shortName: "melons production", indicator: "QCL:'01229:5510", warehouseSourceIndicatorCode: "QCL:'01229:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01229" }),
  warehouseExternal({ id: "faostat:0118:5510", name: "Most millet produced", shortName: "millet production", indicator: "QCL:'0118:5510", warehouseSourceIndicatorCode: "QCL:'0118:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-0118" }),
  warehouseExternal({ id: "faostat:01270:5510", name: "Most mushrooms and truffles produced", shortName: "mushrooms and truffles production", indicator: "QCL:'01270:5510", warehouseSourceIndicatorCode: "QCL:'01270:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01270" }),
  warehouseExternal({ id: "faostat:0117:5510", name: "Most oats produced", shortName: "oats production", indicator: "QCL:'0117:5510", warehouseSourceIndicatorCode: "QCL:'0117:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-0117" }),
  warehouseExternal({ id: "faostat:01317:5510", name: "Most papaya produced", shortName: "papaya production", indicator: "QCL:'01317:5510", warehouseSourceIndicatorCode: "QCL:'01317:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01317" }),
  warehouseExternal({ id: "faostat:01345:5510", name: "Most peaches and nectarines produced", shortName: "peaches and nectarines production", indicator: "QCL:'01345:5510", warehouseSourceIndicatorCode: "QCL:'01345:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01345" }),
  warehouseExternal({ id: "faostat:0142:5510", name: "Most peanuts produced", shortName: "peanuts production", indicator: "QCL:'0142:5510", warehouseSourceIndicatorCode: "QCL:'0142:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-0142" }),
  warehouseExternal({ id: "faostat:01342.01:5510", name: "Most pears produced", shortName: "pears production", indicator: "QCL:'01342.01:5510", warehouseSourceIndicatorCode: "QCL:'01342.01:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01342-01" }),
  warehouseExternal({ id: "faostat:01346:5510", name: "Most plums and sloes produced", shortName: "plums and sloes production", indicator: "QCL:'01346:5510", warehouseSourceIndicatorCode: "QCL:'01346:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01346" }),
  warehouseExternal({ id: "faostat:F1726:5510", name: "Most pulses, total produced", shortName: "pulses, total production", indicator: "QCL:'F1726:5510", warehouseSourceIndicatorCode: "QCL:'F1726:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-f1726" }),
  warehouseExternal({ id: "faostat:01235:5510", name: "Most pumpkins, squash, and gourds produced", shortName: "pumpkins, squash, and gourds production", indicator: "QCL:'01235:5510", warehouseSourceIndicatorCode: "QCL:'01235:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01235" }),
  warehouseExternal({ id: "faostat:F1720:5510", name: "Most roots and tubers produced", shortName: "roots and tubers production", indicator: "QCL:'F1720:5510", warehouseSourceIndicatorCode: "QCL:'F1720:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-f1720" }),
  warehouseExternal({ id: "faostat:01444:5510", name: "Most sesame seeds produced", shortName: "sesame seeds production", indicator: "QCL:'01444:5510", warehouseSourceIndicatorCode: "QCL:'01444:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01444" }),
  warehouseExternal({ id: "faostat:0114:5510", name: "Most sorghum produced", shortName: "sorghum production", indicator: "QCL:'0114:5510", warehouseSourceIndicatorCode: "QCL:'0114:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-0114" }),
  warehouseExternal({ id: "faostat:01354:5510", name: "Most strawberries produced", shortName: "strawberries production", indicator: "QCL:'01354:5510", warehouseSourceIndicatorCode: "QCL:'01354:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01354" }),
  warehouseExternal({ id: "faostat:01445:5510", name: "Most sunflower seeds produced", shortName: "sunflower seeds production", indicator: "QCL:'01445:5510", warehouseSourceIndicatorCode: "QCL:'01445:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01445" }),
  warehouseExternal({ id: "faostat:01970:5510", name: "Most tobacco produced", shortName: "tobacco production", indicator: "QCL:'01970:5510", warehouseSourceIndicatorCode: "QCL:'01970:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01970" }),
  warehouseExternal({ id: "faostat:F1729:5510", name: "Most tree nuts produced", shortName: "tree nuts production", indicator: "QCL:'F1729:5510", warehouseSourceIndicatorCode: "QCL:'F1729:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-f1729" }),
  warehouseExternal({ id: "faostat:01376:5510", name: "Most walnuts produced", shortName: "walnuts production", indicator: "QCL:'01376:5510", warehouseSourceIndicatorCode: "QCL:'01376:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01376" }),
  warehouseExternal({ id: "faostat:01221:5510", name: "Most watermelons produced", shortName: "watermelons production", indicator: "QCL:'01221:5510", warehouseSourceIndicatorCode: "QCL:'01221:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01221" }),
  warehouseExternal({ id: "faostat:24212.02:5510", name: "Most wine produced", shortName: "wine production", indicator: "QCL:'24212.02:5510", warehouseSourceIndicatorCode: "QCL:'24212.02:5510", icon: "🌱", unit: "tonnes", family: "Agriculture", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "commodity-wine" }),
  warehouseExternal({ id: "faostat:0115:5510", name: "Most barley produced", shortName: "barley production", indicator: "QCL:'0115:5510", warehouseSourceIndicatorCode: "QCL:'0115:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-0115" }),
  warehouseExternal({ id: "faostat:24310.01:5510", name: "Most beer produced", shortName: "beer production", indicator: "QCL:'24310.01:5510", warehouseSourceIndicatorCode: "QCL:'24310.01:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-24310-01" }),
  warehouseExternal({ id: "faostat:2351f:5510", name: "Most cane and beet sugar produced", shortName: "cane and beet sugar production", indicator: "QCL:'2351f:5510", warehouseSourceIndicatorCode: "QCL:'2351f:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-2351f" }),
  warehouseExternal({ id: "faostat:01520.01:5510", name: "Most cassava produced", shortName: "cassava production", indicator: "QCL:'01520.01:5510", warehouseSourceIndicatorCode: "QCL:'01520.01:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01520-01" }),
  warehouseExternal({ id: "faostat:F1717:5510", name: "Most cereals produced", shortName: "cereals production", indicator: "QCL:'F1717:5510", warehouseSourceIndicatorCode: "QCL:'F1717:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-f1717" }),
  warehouseExternal({ id: "faostat:01610:5510", name: "Most coffee produced", shortName: "coffee production", indicator: "QCL:'01610:5510", warehouseSourceIndicatorCode: "QCL:'01610:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "commodity-coffee" }),
  warehouseExternal({ id: "faostat:0112:5510", name: "Most corn produced", shortName: "corn production", indicator: "QCL:'0112:5510", warehouseSourceIndicatorCode: "QCL:'0112:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-0112" }),
  warehouseExternal({ id: "faostat:01921.02:5510", name: "Most cotton produced", shortName: "cotton production", indicator: "QCL:'01921.02:5510", warehouseSourceIndicatorCode: "QCL:'01921.02:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01921-02" }),
  warehouseExternal({ id: "faostat:01701:5510", name: "Most dry beans produced", shortName: "dry beans production", indicator: "QCL:'01701:5510", warehouseSourceIndicatorCode: "QCL:'01701:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01701" }),
  warehouseExternal({ id: "faostat:01510:5510", name: "Most potatoes produced", shortName: "potatoes production", indicator: "QCL:'01510:5510", warehouseSourceIndicatorCode: "QCL:'01510:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01510" }),
  warehouseExternal({ id: "faostat:0113:5510", name: "Most rice produced", shortName: "rice production", indicator: "QCL:'0113:5510", warehouseSourceIndicatorCode: "QCL:'0113:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "commodity-rice" }),
  warehouseExternal({ id: "faostat:0141:5510", name: "Most soybeans produced", shortName: "soybeans production", indicator: "QCL:'0141:5510", warehouseSourceIndicatorCode: "QCL:'0141:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-0141" }),
  warehouseExternal({ id: "faostat:01801:5510", name: "Most sugar beets produced", shortName: "sugar beets production", indicator: "QCL:'01801:5510", warehouseSourceIndicatorCode: "QCL:'01801:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01801" }),
  warehouseExternal({ id: "faostat:01802:5510", name: "Most sugarcane produced", shortName: "sugarcane production", indicator: "QCL:'01802:5510", warehouseSourceIndicatorCode: "QCL:'01802:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01802" }),
  warehouseExternal({ id: "faostat:01530:5510", name: "Most sweet potatoes produced", shortName: "sweet potatoes production", indicator: "QCL:'01530:5510", warehouseSourceIndicatorCode: "QCL:'01530:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01530" }),
  warehouseExternal({ id: "faostat:0111:5510", name: "Most wheat produced", shortName: "wheat production", indicator: "QCL:'0111:5510", warehouseSourceIndicatorCode: "QCL:'0111:5510", icon: "🌾", unit: "tonnes", family: "Crops", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-0111" }),
  warehouseExternal({ id: "faostat:F1811:5510", name: "Most butter and ghee produced", shortName: "butter and ghee production", indicator: "QCL:'F1811:5510", warehouseSourceIndicatorCode: "QCL:'F1811:5510", icon: "🥛", unit: "tonnes", family: "Dairy", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-f1811" }),
  warehouseExternal({ id: "faostat:F1745:5510", name: "Most cheese produced", shortName: "cheese production", indicator: "QCL:'F1745:5510", warehouseSourceIndicatorCode: "QCL:'F1745:5510", icon: "🥛", unit: "tonnes", family: "Dairy", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-f1745" }),
  warehouseExternal({ id: "faostat:01341:5510", name: "Most apples produced", shortName: "apples production", indicator: "QCL:'01341:5510", warehouseSourceIndicatorCode: "QCL:'01341:5510", icon: "🍎", unit: "tonnes", family: "Fruit", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01341" }),
  warehouseExternal({ id: "faostat:01311:5510", name: "Most avocado produced", shortName: "avocado production", indicator: "QCL:'01311:5510", warehouseSourceIndicatorCode: "QCL:'01311:5510", icon: "🍎", unit: "tonnes", family: "Fruit", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01311" }),
  warehouseExternal({ id: "faostat:01312:5510", name: "Most bananas produced", shortName: "bananas production", indicator: "QCL:'01312:5510", warehouseSourceIndicatorCode: "QCL:'01312:5510", icon: "🍎", unit: "tonnes", family: "Fruit", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01312" }),
  warehouseExternal({ id: "faostat:F1738:5510", name: "Most fruit produced", shortName: "fruit production", indicator: "QCL:'F1738:5510", warehouseSourceIndicatorCode: "QCL:'F1738:5510", icon: "🍎", unit: "tonnes", family: "Fruit", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-f1738" }),
  warehouseExternal({ id: "faostat:01321:5510", name: "Most grapefruits and pomelos produced", shortName: "grapefruits and pomelos production", indicator: "QCL:'01321:5510", warehouseSourceIndicatorCode: "QCL:'01321:5510", icon: "🍎", unit: "tonnes", family: "Fruit", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01321" }),
  warehouseExternal({ id: "faostat:01330:5510", name: "Most grapes produced", shortName: "grapes production", indicator: "QCL:'01330:5510", warehouseSourceIndicatorCode: "QCL:'01330:5510", icon: "🍎", unit: "tonnes", family: "Fruit", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01330" }),
  warehouseExternal({ id: "faostat:01322:5510", name: "Most lemons and limes produced", shortName: "lemons and limes production", indicator: "QCL:'01322:5510", warehouseSourceIndicatorCode: "QCL:'01322:5510", icon: "🍎", unit: "tonnes", family: "Fruit", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01322" }),
  warehouseExternal({ id: "faostat:01316:5510", name: "Most mangoes, guavas, and mangosteens produced", shortName: "mangoes, guavas, and mangosteens production", indicator: "QCL:'01316:5510", warehouseSourceIndicatorCode: "QCL:'01316:5510", icon: "🍎", unit: "tonnes", family: "Fruit", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01316" }),
  warehouseExternal({ id: "faostat:01323:5510", name: "Most oranges produced", shortName: "oranges production", indicator: "QCL:'01323:5510", warehouseSourceIndicatorCode: "QCL:'01323:5510", icon: "🍎", unit: "tonnes", family: "Fruit", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01323" }),
  warehouseExternal({ id: "faostat:01318:5510", name: "Most pineapple produced", shortName: "pineapple production", indicator: "QCL:'01318:5510", warehouseSourceIndicatorCode: "QCL:'01318:5510", icon: "🍎", unit: "tonnes", family: "Fruit", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01318" }),
  warehouseExternal({ id: "faostat:F1806:5510", name: "Most beef and buffalo meat produced", shortName: "beef and buffalo meat production", indicator: "QCL:'F1806:5510", warehouseSourceIndicatorCode: "QCL:'F1806:5510", icon: "🐄", unit: "tonnes", family: "Livestock", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-f1806" }),
  warehouseExternal({ id: "faostat:21121:5510", name: "Most chicken meat produced", shortName: "chicken meat production", indicator: "QCL:'21121:5510", warehouseSourceIndicatorCode: "QCL:'21121:5510", icon: "🐄", unit: "tonnes", family: "Livestock", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-21121" }),
  warehouseExternal({ id: "faostat:02211:5510", name: "Most cow's milk produced", shortName: "cow's milk production", indicator: "QCL:'02211:5510", warehouseSourceIndicatorCode: "QCL:'02211:5510", icon: "🐄", unit: "tonnes", family: "Livestock", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-02211" }),
  warehouseExternal({ id: "faostat:02292:5510", name: "Most goat milk produced", shortName: "goat milk production", indicator: "QCL:'02292:5510", warehouseSourceIndicatorCode: "QCL:'02292:5510", icon: "🐄", unit: "tonnes", family: "Livestock", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-02292" }),
  warehouseExternal({ id: "faostat:21113.01:5510", name: "Most pork produced", shortName: "pork production", indicator: "QCL:'21113.01:5510", warehouseSourceIndicatorCode: "QCL:'21113.01:5510", icon: "🐄", unit: "tonnes", family: "Livestock", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-21113-01" }),
  warehouseExternal({ id: "faostat:F1807:5510", name: "Most sheep and goat meat produced", shortName: "sheep and goat meat production", indicator: "QCL:'F1807:5510", warehouseSourceIndicatorCode: "QCL:'F1807:5510", icon: "🐄", unit: "tonnes", family: "Livestock", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-f1807" }),
  warehouseExternal({ id: "faostat:01212:5510", name: "Most cabbage produced", shortName: "cabbage production", indicator: "QCL:'01212:5510", warehouseSourceIndicatorCode: "QCL:'01212:5510", icon: "🥕", unit: "tonnes", family: "Vegetables", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01212" }),
  warehouseExternal({ id: "faostat:01251:5510", name: "Most carrots and turnips produced", shortName: "carrots and turnips production", indicator: "QCL:'01251:5510", warehouseSourceIndicatorCode: "QCL:'01251:5510", icon: "🥕", unit: "tonnes", family: "Vegetables", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01251" }),
  warehouseExternal({ id: "faostat:01232:5510", name: "Most cucumbers and gherkins produced", shortName: "cucumbers and gherkins production", indicator: "QCL:'01232:5510", warehouseSourceIndicatorCode: "QCL:'01232:5510", icon: "🥕", unit: "tonnes", family: "Vegetables", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01232" }),
  warehouseExternal({ id: "faostat:01231:5510", name: "Most green chilies and peppers produced", shortName: "green chilies and peppers production", indicator: "QCL:'01231:5510", warehouseSourceIndicatorCode: "QCL:'01231:5510", icon: "🥕", unit: "tonnes", family: "Vegetables", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01231" }),
  warehouseExternal({ id: "faostat:01253.02:5510", name: "Most onions and shallots produced", shortName: "onions and shallots production", indicator: "QCL:'01253.02:5510", warehouseSourceIndicatorCode: "QCL:'01253.02:5510", icon: "🥕", unit: "tonnes", family: "Vegetables", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01253-02" }),
  warehouseExternal({ id: "faostat:01234:5510", name: "Most tomatoes produced", shortName: "tomatoes production", indicator: "QCL:'01234:5510", warehouseSourceIndicatorCode: "QCL:'01234:5510", icon: "🥕", unit: "tonnes", family: "Vegetables", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-01234" }),
  warehouseExternal({ id: "faostat:F1735:5510", name: "Most vegetables produced", shortName: "vegetables production", indicator: "QCL:'F1735:5510", warehouseSourceIndicatorCode: "QCL:'F1735:5510", icon: "🥕", unit: "tonnes", family: "Vegetables", direction: "high", description: "Total national production in the source-reported physical unit", coverageFloor: 60, roundType: "Agriculture", similarityGroup: "faostat-item-f1735" }),
  warehouseExternal({ id: "who:WHS4_117", name: "Highest HepB3 vaccination coverage", shortName: "HepB3 coverage", indicator: "WHS4_117", warehouseSourceIndicatorCode: "WHS4_117", icon: "💉", unit: "%", family: "Health", direction: "high", description: "WHO HepB3 immunization coverage among 1-year-olds", coverageFloor: 150, similarityGroup: "vaccination-coverage" }),
  warehouseExternal({ id: "who:WHS8_110", name: "Highest MCV1 vaccination coverage", shortName: "MCV1 coverage", indicator: "WHS8_110", warehouseSourceIndicatorCode: "WHS8_110", icon: "💉", unit: "%", family: "Health", direction: "high", description: "WHO MCV1 immunization coverage among 1-year-olds", coverageFloor: 150, similarityGroup: "vaccination-coverage" }),
  warehouseExternal({ id: "who:WHS4_543", name: "Highest BCG vaccination coverage", shortName: "BCG coverage", indicator: "WHS4_543", warehouseSourceIndicatorCode: "WHS4_543", icon: "💉", unit: "%", family: "Health", direction: "high", description: "WHO BCG immunization coverage among 1-year-olds", coverageFloor: 120, similarityGroup: "vaccination-coverage" }),
  warehouseExternal({ id: "who:MDG_0000000026", name: "Lowest maternal mortality", shortName: "Maternal mortality", indicator: "MDG_0000000026", warehouseSourceIndicatorCode: "MDG_0000000026", icon: "🩺", unit: "per 100,000 births", family: "Health", direction: "low", description: "Maternal deaths per 100,000 live births", coverageFloor: 150, similarityGroup: "maternal-mortality" }),
  warehouseExternal({ id: "who:PHE_HHAIR_PROP_POP_CLEAN_FUELS", name: "Highest share using clean cooking fuels", shortName: "Clean cooking access", indicator: "PHE_HHAIR_PROP_POP_CLEAN_FUELS", warehouseSourceIndicatorCode: "PHE_HHAIR_PROP_POP_CLEAN_FUELS", icon: "🔥", unit: "%", family: "Infrastructure", direction: "high", description: "Percentage of the population primarily relying on clean fuels and technologies for cooking", coverageFloor: 150, similarityGroup: "clean-cooking-access" }),
  warehouseExternal({ id: "ilostat:lowest-unemployment", name: "Lowest unemployment rate", shortName: "Unemployment", indicator: "UNE_2EAP_SEX_AGE_RT_A", warehouseSourceIndicatorCode: "UNE_2EAP_SEX_AGE_RT_A", icon: "💼", unit: "%", family: "Labor", direction: "low", description: "Unemployment as a share of the labor force", coverageFloor: 120, similarityGroup: "unemployment-rate" }),
  warehouseExternal({ id: "ilostat:employment-population", name: "Highest employment-to-population ratio", shortName: "Employment ratio", indicator: "EMP_2WAP_SEX_AGE_RT_A", warehouseSourceIndicatorCode: "EMP_2WAP_SEX_AGE_RT_A", icon: "👷", unit: "%", family: "Labor", direction: "high", description: "Employed people as a share of the working-age population", coverageFloor: 120, similarityGroup: "employment-population-ratio" }),
  warehouseExternal({ id: "ilostat:labor-income-share", name: "Highest labor-income share of GDP", shortName: "Labor income share", indicator: "SDG_1041_NOC_RT_A", warehouseSourceIndicatorCode: "SDG_1041_NOC_RT_A", icon: "💵", unit: "% of GDP", family: "Labor", direction: "high", description: "Labor income as a share of GDP", coverageFloor: 120, similarityGroup: "labor-income-share" }),
  warehouseExternal({ id: "ilostat:output-worker", name: "Highest output per worker", shortName: "Output per worker", indicator: "GDP_205U_NOC_NB_A", warehouseSourceIndicatorCode: "GDP_205U_NOC_NB_A", icon: "⚙️", unit: "PPP dollars/worker", family: "Economy", direction: "high", description: "Output per employed person", coverageFloor: 120, similarityGroup: "output-per-worker" }),
  warehouseExternal({ id: "ilostat:productivity-growth", name: "Fastest labor-productivity growth", shortName: "Productivity growth", indicator: "SDG_0821_NOC_RT_A", warehouseSourceIndicatorCode: "SDG_0821_NOC_RT_A", icon: "📈", unit: "%", family: "Economy", direction: "high", description: "Annual growth in output per worker", coverageFloor: 120, similarityGroup: "labor-productivity-growth" }),
  warehouseExternal({ id: "natural-earth:north-south-span", name: "Largest north-south span", shortName: "North-south span", indicator: "largest-north-south-span", warehouseSourceIndicatorCode: "largest-north-south-span", icon: "↕️", unit: "degrees latitude", family: "Geography", direction: "high", description: "Latitude span between the country’s northernmost and southernmost points", coverageFloor: 150, similarityGroup: "north-south-span" }),
  warehouseExternal({ id: "natural-earth:northernmost", name: "Northernmost country", shortName: "Northernmost", indicator: "northernmost-country", warehouseSourceIndicatorCode: "northernmost-country", icon: "🧭", unit: "degrees latitude", family: "Geography", direction: "high", description: "Northernmost point of the country", coverageFloor: 150, similarityGroup: "latitude-extremes" }),
  warehouseExternal({ id: "natural-earth:southernmost", name: "Southernmost country", shortName: "Southernmost", indicator: "southernmost-country", warehouseSourceIndicatorCode: "southernmost-country", icon: "🧭", unit: "degrees latitude", family: "Geography", direction: "low", description: "Southernmost point of the country", coverageFloor: 150, similarityGroup: "latitude-extremes" }),
  warehouseExternal({ id: "natural-earth:coastline", name: "Longest coastline", shortName: "Coastline", indicator: "longest-coastline", warehouseSourceIndicatorCode: "longest-coastline", icon: "🌊", unit: "km", family: "Geography", direction: "high", description: "Estimated coastline length from one consistent global geometry dataset", coverageFloor: 150, similarityGroup: "coastline-length" }),
  warehouseExternal({ id: "natural-earth:land-border", name: "Longest total land border", shortName: "Land border", indicator: "longest-land-border", warehouseSourceIndicatorCode: "longest-land-border", icon: "🗺️", unit: "km", family: "Geography", direction: "high", description: "Total international land-border length from one consistent global geometry dataset", coverageFloor: 150, similarityGroup: "land-border-length" }),
  warehouseExternal({ id: "natural-earth:land-neighbors", name: "Most bordering countries", shortName: "Border neighbors", indicator: "most-land-neighbors", warehouseSourceIndicatorCode: "most-land-neighbors", icon: "🧩", unit: "neighbors", family: "Geography", direction: "high", description: "Number of countries sharing a land border, derived consistently from Natural Earth geometry", coverageFloor: 150, similarityGroup: "land-border-neighbors" }),
];

const RAW_CATEGORIES: Category[] = [
  ...WAREHOUSE_CATEGORIES,
  ...CURATED_EXTERNAL_CATEGORIES,
  wb({id:"population",name:"Largest population",shortName:"Population",indicator:"SP.POP.TOTL",icon:"👥",unit:"people",family:"Population",direction:"high",description:"Total resident population, people"}),
  wb({id:"populationGrowth",name:"Fastest population growth",shortName:"Population growth",indicator:"SP.POP.GROW",icon:"📈",unit:"%",family:"Population",direction:"high",description:"Annual percent change in population",decimals:2,minimumYear:2022,requireCommonYear:true,expectedRange:[-10,10]}),
  wb({id:"density",name:"Highest population density",shortName:"Population density",indicator:"EN.POP.DNST",icon:"🏙️",unit:"people/km²",family:"Population",direction:"high",description:"People per square kilometer of land area",decimals:1}),
  wb({id:"urban",name:"Highest urban population share",shortName:"Urban population",indicator:"SP.URB.TOTL.IN.ZS",icon:"🏢",unit:"%",family:"Population",direction:"high",description:"Percent of population living in urban areas",decimals:1,expectedRange:[0,100]}),
  wb({id:"rural",name:"Highest rural population share",shortName:"Rural population",indicator:"SP.RUR.TOTL.ZS",icon:"🏡",unit:"%",family:"Population",direction:"high",description:"Percent of population living in rural areas",decimals:1,expectedRange:[0,100]}),
  wb({id:"life",name:"Highest life expectancy",shortName:"Life expectancy",indicator:"SP.DYN.LE00.IN",icon:"❤️",unit:"years",family:"Health",direction:"high",description:"Life expectancy at birth, years",decimals:1}),
  wb({id:"fertility",name:"Highest fertility rate",shortName:"Fertility rate",indicator:"SP.DYN.TFRT.IN",icon:"👶",unit:"births/woman",family:"Health",direction:"high",description:"Births per woman",decimals:2}),
  wb({id:"infantMortality",name:"Lowest infant mortality",shortName:"Infant mortality",indicator:"SP.DYN.IMRT.IN",icon:"🩺",unit:"per 1,000",family:"Health",direction:"low",description:"Infant deaths per 1,000 live births",decimals:1}),
  wb({id:"older",name:"Oldest population",shortName:"Age 65+",indicator:"SP.POP.65UP.TO.ZS",icon:"🧓",unit:"%",family:"Population",direction:"high",description:"Percent of population age 65 and older",decimals:1}),
  wb({id:"young",name:"Youngest population",shortName:"Age 0–14",indicator:"SP.POP.0014.TO.ZS",icon:"🧒",unit:"%",family:"Population",direction:"high",description:"Percent of population age 14 and younger",decimals:1}),
  wb({id:"gdp",name:"Largest economy",shortName:"GDP",indicator:"NY.GDP.MKTP.CD",icon:"💰",unit:"USD",family:"Economy",direction:"high",description:"Total GDP, current US dollars"}),
  wb({id:"gdpPc",name:"Highest GDP per person",shortName:"GDP per capita",indicator:"NY.GDP.PCAP.CD",icon:"💵",unit:"USD/person",family:"Economy",direction:"high",description:"GDP in current US dollars per person"}),
  wb({id:"gdpGrowth",name:"Fastest economic growth",shortName:"GDP growth",indicator:"NY.GDP.MKTP.KD.ZG",icon:"🚀",unit:"%",family:"Economy",direction:"high",description:"Annual percent change in real GDP",decimals:2,minimumYear:2022,requireCommonYear:true,expectedRange:[-50,50]}),
  wb({id:"exports",name:"Largest exports",shortName:"Exports",indicator:"NE.EXP.GNFS.CD",icon:"📦",unit:"USD",family:"Economy",direction:"high",description:"Goods and services, current US dollars (total)"}),
  wb({id:"imports",name:"Largest imports",shortName:"Imports",indicator:"NE.IMP.GNFS.CD",icon:"🚢",unit:"USD",family:"Economy",direction:"high",description:"Goods and services, current US dollars (total)"}),
  wb({id:"manufacturing",name:"Largest manufacturing output",shortName:"Manufacturing",indicator:"NV.IND.MANF.CD",icon:"🏭",unit:"USD",family:"Economy",direction:"high",description:"Manufacturing value added, current US dollars (total)"}),
  wb({id:"agValue",name:"Largest agricultural economy",shortName:"Agriculture output",indicator:"NV.AGR.TOTL.CD",icon:"🚜",unit:"USD",family:"Agriculture",direction:"high",description:"Agriculture, forestry and fishing value added, current US dollars (total)"}),
  wb({id:"land",name:"Largest land area",shortName:"Land area",indicator:"AG.LND.TOTL.K2",icon:"🗺️",unit:"km²",family:"Land",direction:"high",description:"Total land area, square kilometers"}),
  wb({id:"forestArea",name:"Largest forest area",shortName:"Forest area",indicator:"AG.LND.FRST.K2",icon:"🌲",unit:"km²",family:"Land",direction:"high",description:"Total forest area, square kilometers"}),
  wb({id:"forestPct",name:"Highest forest coverage",shortName:"Forest coverage",indicator:"AG.LND.FRST.ZS",icon:"🌳",unit:"%",family:"Land",direction:"high",description:"Percent of land area covered by forest",decimals:1,expectedRange:[0,100]}),
  wb({id:"leastForest",name:"Least forest coverage",shortName:"Least forest",indicator:"AG.LND.FRST.ZS",icon:"🪵",unit:"%",family:"Land",direction:"low",description:"Percent of land area covered by forest",decimals:1,expectedRange:[0,100]}),
  wb({id:"agLand",name:"Highest farmland share",shortName:"Agricultural land",indicator:"AG.LND.AGRI.ZS",icon:"🌾",unit:"%",family:"Agriculture",direction:"high",description:"Percent of land area used for agriculture",decimals:1}),
  wb({id:"arablePct",name:"Highest arable-land share",shortName:"Arable land",indicator:"AG.LND.ARBL.ZS",icon:"🌱",unit:"%",family:"Agriculture",direction:"high",description:"Percent of land area that is arable",decimals:1}),
  wb({id:"arableHa",name:"Most arable land",shortName:"Arable hectares",indicator:"AG.LND.ARBL.HA",icon:"🧑‍🌾",unit:"hectares",family:"Agriculture",direction:"high",description:"Total arable land, hectares"}),
  wb({id:"rain",name:"Highest average rainfall",shortName:"Rainfall",indicator:"AG.LND.PRCP.MM",icon:"🌧️",unit:"mm/year",family:"Climate",direction:"high",description:"Annual average precipitation, millimeters",decimals:0}),
  wb({id:"dry",name:"Lowest average rainfall",shortName:"Least rainfall",indicator:"AG.LND.PRCP.MM",icon:"🏜️",unit:"mm/year",family:"Climate",direction:"low",description:"Annual average precipitation, millimeters",decimals:0}),
  wb({id:"renewable",name:"Highest renewable electricity share",shortName:"Renewable electricity",indicator:"EG.ELC.RNEW.ZS",icon:"⚡",unit:"%",family:"Energy",direction:"high",description:"Percent of electricity output from renewable sources",decimals:1}),
  wb({id:"energyUse",name:"Highest energy use per person",shortName:"Energy use",indicator:"EG.USE.PCAP.KG.OE",icon:"🔌",unit:"kg oil eq./person",family:"Energy",direction:"high",description:"Kilograms of oil equivalent per person",decimals:0}),
  wb({id:"electricUse",name:"Highest electricity use per person",shortName:"Electric power use",indicator:"EG.USE.ELEC.KH.PC",icon:"💡",unit:"kWh/person",family:"Energy",direction:"high",description:"Kilowatt-hours per person",decimals:0}),
  wb({id:"internet",name:"Highest internet usage",shortName:"Internet usage",indicator:"IT.NET.USER.ZS",icon:"🌐",unit:"%",family:"Technology",direction:"high",description:"Percent of population using the internet",decimals:1,expectedRange:[0,100]}),
  wb({id:"mobile",name:"Highest mobile subscriptions per 100 people",shortName:"Mobile subscriptions",indicator:"IT.CEL.SETS.P2",icon:"📱",unit:"per 100 people",family:"Technology",direction:"high",description:"Subscriptions per 100 people",decimals:1}),
  wb({id:"airPassengers",name:"Most airline passengers",shortName:"Air passengers",indicator:"IS.AIR.PSGR",icon:"✈️",unit:"passengers",family:"Transport",direction:"high",description:"Total passengers carried by registered air carriers"}),
  wb({id:"rail",name:"Most rail passenger travel",shortName:"Rail passengers",indicator:"IS.RRS.PASG.KM",icon:"🚆",unit:"passenger-km",family:"Transport",direction:"high",description:"Passenger-kilometers traveled by rail"}),
  wb({id:"protected",name:"Highest protected-land share",shortName:"Protected land",indicator:"ER.LND.PTLD.ZS",icon:"🦌",unit:"%",family:"Environment",direction:"high",description:"Percent of land area protected",decimals:1}),
  wb({id:"freshwater",name:"Most renewable freshwater",shortName:"Freshwater resources",indicator:"ER.H2O.INTR.K3",icon:"💧",unit:"billion m³",family:"Environment",direction:"high",description:"Total internal renewable freshwater, billion cubic meters",decimals:1}),
  wb({id:"healthSpend",name:"Highest health spending per person",shortName:"Health spending",indicator:"SH.XPD.CHEX.PC.CD",icon:"🏥",unit:"USD/person",family:"Health",direction:"high",description:"Current health spending in US dollars per person",decimals:0}),
  wb({id:"education",name:"Highest education spending share",shortName:"Education spending",indicator:"SE.XPD.TOTL.GD.ZS",icon:"🎓",unit:"% of GDP",family:"Education",direction:"high",description:"Government education spending, percent of GDP",decimals:2}),
  wb({id:"femaleLabor",name:"Highest female labor participation",shortName:"Female labor force",indicator:"SL.TLF.CACT.FE.ZS",icon:"👩‍💼",unit:"%",family:"Labor",direction:"high",description:"Percent of women ages 15+ in the labor force",decimals:1}),
  wb({id:"unemploymentLow",name:"Lowest unemployment",shortName:"Unemployment",indicator:"SL.UEM.TOTL.ZS",icon:"💼",unit:"%",family:"Labor",direction:"low",description:"Percent of total labor force unemployed",decimals:1}),
  wb({id:"cerealProduction",name:"Most cereal produced",shortName:"Cereal production",indicator:"AG.PRD.CREL.MT",icon:"🌾",unit:"metric tons",family:"Agriculture",direction:"high",description:"Total cereal production, metric tons",decimals:0,minimumYear:2020}),
  wb({id:"foodExportsShare",name:"Highest food share of exports",shortName:"Food exports",indicator:"TX.VAL.FOOD.ZS.UN",icon:"🍎",unit:"% of merchandise exports",family:"Trade",direction:"high",description:"Food, percent of merchandise exports",decimals:1,expectedRange:[0,100]}),
  wb({id:"foodImportsShare",name:"Highest food share of imports",shortName:"Food imports",indicator:"TM.VAL.FOOD.ZS.UN",icon:"🥫",unit:"% of merchandise imports",family:"Trade",direction:"high",description:"Food, percent of merchandise imports",decimals:1,expectedRange:[0,100]}),
  wb({id:"merchExports",name:"Most merchandise exports",shortName:"Merchandise exports",indicator:"TX.VAL.MRCH.CD.WT",icon:"🚢",unit:"USD",family:"Trade",direction:"high",description:"Current US dollars (total)"}),
  wb({id:"highTechExports",name:"Largest high-tech exports",shortName:"High-tech exports",indicator:"TX.VAL.TECH.CD",icon:"🛰️",unit:"USD",family:"Trade",direction:"high",description:"Current US dollars (total)"}),
  wb({id:"co2Total",name:"Highest total CO₂ emissions",shortName:"CO₂ emissions",indicator:"EN.GHG.CO2.MT.CE.AR5",icon:"🏭",unit:"Mt CO₂e",family:"Environment",direction:"high",description:"Carbon dioxide emissions excluding land-use change and forestry, million tonnes CO₂ equivalent (total)"}),
  wb({id:"co2PerCapita",name:"Most CO₂ emissions per person",shortName:"CO₂ per capita",indicator:"EN.GHG.CO2.PC.CE.AR5",icon:"☁️",unit:"t CO₂e/person",family:"Environment",direction:"high",description:"Carbon dioxide emissions excluding land-use change and forestry, tonnes CO₂ equivalent per person",decimals:2}),
  wb({id:"electricityAccess",name:"Highest electricity access",shortName:"Electricity access",indicator:"EG.ELC.ACCS.ZS",icon:"🔋",unit:"%",family:"Infrastructure",direction:"high",description:"Percent of population with access",decimals:1,expectedRange:[0,100]}),
  wb({id:"sanitation",name:"Highest safely managed sanitation access",shortName:"Sanitation access",indicator:"SH.STA.SMSS.ZS",icon:"🚿",unit:"%",family:"Infrastructure",direction:"high",description:"Percent of population using safely managed services",decimals:1,expectedRange:[0,100]}),
  wb({id:"journalArticles",name:"Most scientific journal articles",shortName:"Scientific articles",indicator:"IP.JRN.ARTC.SC",icon:"🔬",unit:"articles",family:"Knowledge",direction:"high",description:"Scientific and technical articles (total)"}),
  wb({id:"patents",name:"Most resident patent applications",shortName:"Patent applications",indicator:"IP.PAT.RESD",icon:"💡",unit:"applications",family:"Knowledge",direction:"high",description:"Applications filed by residents (total)"}),
  wb({id:"militarySpend",name:"Highest military spending",shortName:"Military spending",indicator:"MS.MIL.XPND.CD",icon:"🛡️",unit:"USD",family:"Government",direction:"high",description:"Current US dollars (total)"}),
  wb({id:"urbanAbsolute",name:"Largest urban population",shortName:"Urban population total",indicator:"SP.URB.TOTL",icon:"🌆",unit:"people",family:"Population",direction:"high",description:"Total people living in urban areas"}),
  wb({id:"ruralAbsolute",name:"Largest rural population",shortName:"Rural population total",indicator:"SP.RUR.TOTL",icon:"🌄",unit:"people",family:"Population",direction:"high",description:"Total people living in rural areas"}),
  wb({id:"healthSpendShare",name:"Highest health spending share",shortName:"Health spending % GDP",indicator:"SH.XPD.CHEX.GD.ZS",icon:"⚕️",unit:"% of GDP",family:"Health",direction:"high",description:"Current health spending, percent of GDP",decimals:1,expectedRange:[0,30]}),
  wb({id:"servicesShare",name:"Highest services share of GDP",shortName:"Services share",indicator:"NV.SRV.TOTL.ZS",icon:"🏦",unit:"% of GDP",family:"Economy",direction:"high",description:"Services value added, percent of GDP",decimals:1,expectedRange:[0,100]}),
  wb({id:"industryShare",name:"Highest industry share of GDP",shortName:"Industry share",indicator:"NV.IND.TOTL.ZS",icon:"🏗️",unit:"% of GDP",family:"Economy",direction:"high",description:"Industry value added, percent of GDP",decimals:1,expectedRange:[0,100]}),
  wb({id:"exportsShare",name:"Highest exports share of GDP",shortName:"Exports % GDP",indicator:"NE.EXP.GNFS.ZS",icon:"📤",unit:"% of GDP",family:"Economy",direction:"high",description:"Goods and services exports, percent of GDP",decimals:1}),
  wb({id:"grossSavings",name:"Highest gross savings rate",shortName:"Gross savings",indicator:"NY.GNS.ICTR.ZS",icon:"🏦",unit:"% of GDP",family:"Economy",direction:"high",description:"Gross domestic savings, percent of GDP",decimals:1,expectedRange:[-100,100]}),
  wb({id:"investmentShare",name:"Highest investment share",shortName:"Investment",indicator:"NE.GDI.TOTL.ZS",icon:"🏗️",unit:"% of GDP",family:"Economy",direction:"high",description:"Gross capital formation, percent of GDP",decimals:1,expectedRange:[0,100]}),
  wb({id:"householdConsumption",name:"Highest household consumption",shortName:"Household consumption",indicator:"NE.CON.PRVT.CD",icon:"🛒",unit:"USD",family:"Economy",direction:"high",description:"Current US dollars (total)"}),
  wb({id:"governmentConsumption",name:"Highest government consumption",shortName:"Government consumption",indicator:"NE.CON.GOVT.CD",icon:"🏛️",unit:"USD",family:"Government",direction:"high",description:"Current US dollars (total)"}),
  wb({id:"merchImports",name:"Most merchandise imports",shortName:"Merchandise imports",indicator:"TM.VAL.MRCH.CD.WT",icon:"📥",unit:"USD",family:"Trade",direction:"high",description:"Current US dollars (total)"}),
  wb({id:"fixedBroadband",name:"Most fixed broadband subscriptions",shortName:"Fixed broadband",indicator:"IT.NET.BBND.P2",icon:"🛜",unit:"per 100 people",family:"Technology",direction:"high",description:"Subscriptions per 100 people",decimals:1}),
  wb({id:"fixedTelephone",name:"Highest fixed telephone subscriptions per 100 people",shortName:"Fixed telephones",indicator:"IT.MLT.MAIN.P2",icon:"☎️",unit:"per 100 people",family:"Technology",direction:"high",description:"Subscriptions per 100 people",decimals:1}),
  wb({id:"basicWater",name:"Highest basic drinking-water access",shortName:"Drinking water access",indicator:"SH.H2O.BASW.ZS",icon:"🚰",unit:"%",family:"Infrastructure",direction:"high",description:"Percent of population using at least basic services",decimals:1,expectedRange:[0,100]}),
  wb({id:"renewableConsumption",name:"Highest renewable energy consumption",shortName:"Renewable consumption",indicator:"EG.FEC.RNEW.ZS",icon:"♻️",unit:"%",family:"Energy",direction:"high",description:"Percent of total final energy consumption",decimals:1,expectedRange:[0,100]}),
  wb({id:"agLandArea",name:"Largest agricultural land area",shortName:"Agricultural land area",indicator:"AG.LND.AGRI.K2",icon:"🚜",unit:"km²",family:"Agriculture",direction:"high",description:"Total area, square kilometers"}),
  wb({id:"airFreight",name:"Most air freight",shortName:"Air freight",indicator:"IS.AIR.GOOD.MT.K1",icon:"🛫",unit:"million ton-km",family:"Transport",direction:"high",description:"Million metric ton-kilometers",decimals:1}),
  wb({id:"railFreight",name:"Most rail freight",shortName:"Rail freight",indicator:"IS.RRS.GOOD.MT.K6",icon:"🚂",unit:"million ton-km",family:"Transport",direction:"high",description:"Million metric ton-kilometers",decimals:1,coverageFloor:80,certificationGrade:"B"}),
  wb({id:"methane",name:"Most methane emissions",shortName:"Methane emissions",indicator:"EN.GHG.CH4.MT.CE.AR5",icon:"🌫️",unit:"Mt CO₂e",family:"Environment",direction:"high",description:"Methane emissions excluding land-use change and forestry, million tonnes CO₂ equivalent (total)"}),
  wb({id:"roadFatalities",name:"Lowest road fatality rate",shortName:"Road fatalities",indicator:"SH.STA.TRAF.P5",icon:"🚗",unit:"per 100,000",family:"Transport",direction:"low",description:"Estimated deaths per 100,000 people",decimals:1}),
  wb({id:"oilRents",name:"Highest oil-rent dependence",shortName:"Oil rents",indicator:"NY.GDP.PETR.RT.ZS",icon:"🛢️",unit:"% of GDP",family:"Resources",direction:"high",description:"Oil rents, percent of GDP",decimals:2}),
  wb({id:"gasRents",name:"Highest natural-gas-rent dependence",shortName:"Natural gas rents",indicator:"NY.GDP.NGAS.RT.ZS",icon:"🔥",unit:"% of GDP",family:"Resources",direction:"high",description:"Natural gas rents, percent of GDP",decimals:2}),
  wb({id:"mineralRents",name:"Highest mineral-rent dependence",shortName:"Mineral rents",indicator:"NY.GDP.MINR.RT.ZS",icon:"⛏️",unit:"% of GDP",family:"Resources",direction:"high",description:"Mineral rents, percent of GDP",decimals:2}),
  wb({id:"militaryShare",name:"Highest military spending share",shortName:"Military spending % GDP",indicator:"MS.MIL.XPND.GD.ZS",icon:"🪖",unit:"% of GDP",family:"Government",direction:"high",description:"Military spending, percent of GDP",decimals:2}),
  // FAOSTAT QCL. Indicator format is item-code:element-filter-code. Production uses filter element 2510 and tonnes.


];

export const CATEGORIES: Category[] = RAW_CATEGORIES.map(applyCategoryTrustPolicy);
