import type { Category, DataSourceId } from "./categories";

export type TrustStatus = "approved" | "caution" | "quarantined";
export type EvidenceLabel = "Observed/administrative" | "Internationally harmonized" | "Modeled estimate" | "Mixed observed and modeled" | "Geospatially derived" | "Independent bibliometric";

export type CategoryTrustProfile = {
  credibilityScore: number;
  trustStatus: TrustStatus;
  trustReason: string;
  evidenceLabel: EvidenceLabel;
  dailyEligible: boolean;
};

const EXPLICIT_QUARANTINE_IDS = new Set([
  "internet",
]);

const EXPLICIT_QUARANTINE_INDICATORS = new Set([
  "IT.NET.USER.ZS",
]);

const LOW_CONFIDENCE_TITLE_PATTERNS = [
  /school internet access/i,
  /lower-secondary.*(?:reading|mathematics).*proficiency/i,
  /informal-employment/i,
  /women in management/i,
  /average working week/i,
  /youth NEET/i,
];

function sourceBaseline(source: DataSourceId): CategoryTrustProfile {
  switch (source) {
    case "comtrade":
      return { credibilityScore: 96, trustStatus: "approved", trustReason: "Customs transaction records standardized by the United Nations.", evidenceLabel: "Observed/administrative", dailyEligible: true };
    case "eia":
      return { credibilityScore: 91, trustStatus: "approved", trustReason: "Physical energy statistics compiled and standardized by the U.S. EIA.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "faostat":
      return { credibilityScore: 88, trustStatus: "approved", trustReason: "FAO-standardized agricultural statistics; some country gaps may be estimated.", evidenceLabel: "Mixed observed and modeled", dailyEligible: true };
    case "faostatfbs":
      return { credibilityScore: 88, trustStatus: "approved", trustReason: "FAOSTAT Food Balances harmonize national food supply available for consumption. They describe apparent consumption, not direct dietary surveys.", evidenceLabel: "Mixed observed and modeled", dailyEligible: true };
    case "naturalearth":
      return { credibilityScore: 90, trustStatus: "approved", trustReason: "Calculated consistently from one global geometry dataset rather than national claims.", evidenceLabel: "Geospatially derived", dailyEligible: true };
    case "unhcr":
      return { credibilityScore: 86, trustStatus: "approved", trustReason: "Operational registration and asylum records standardized by UNHCR.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "who":
      return { credibilityScore: 84, trustStatus: "approved", trustReason: "WHO-standardized health-system, survey, and modeled estimates with published methods.", evidenceLabel: "Mixed observed and modeled", dailyEligible: true };
    case "unesco":
      return { credibilityScore: 80, trustStatus: "caution", trustReason: "UIS harmonizes national administrative and survey data, but cross-country definitions can still vary.", evidenceLabel: "Mixed observed and modeled", dailyEligible: true };
    case "ilostat":
      return { credibilityScore: 83, trustStatus: "approved", trustReason: "ILO-harmonized labor-force surveys and modeled estimates under international standards.", evidenceLabel: "Modeled estimate", dailyEligible: true };
    case "unsdg":
      return { credibilityScore: 94, trustStatus: "approved", trustReason: "Official UN Global SDG Indicators Database series retain the published unit, aggregate dimensions, release, and data-nature metadata from designated custodian agencies.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "untourism":
      return { credibilityScore: 84, trustStatus: "approved", trustReason: "International tourism statistics harmonized under UN Tourism definitions.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "worldbank":
      return { credibilityScore: 86, trustStatus: "approved", trustReason: "World Development Indicators compiled from recognized international sources with documented metadata.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "pewreligion":
      return { credibilityScore: 84, trustStatus: "caution", trustReason: "Pew combines censuses, surveys, population registers, and demographic estimation. The reference year and estimated nature of the figures must be shown.", evidenceLabel: "Mixed observed and modeled", dailyEligible: true };
    case "smithsoniangvp":
      return { credibilityScore: 94, trustStatus: "approved", trustReason: "Smithsonian Global Volcanism Program records use a documented global Holocene-volcano catalog.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "usgs":
      return { credibilityScore: 94, trustStatus: "approved", trustReason: "USGS earthquake records use a fixed magnitude threshold and time window from the ANSS catalog.", evidenceLabel: "Observed/administrative", dailyEligible: true };
    case "worldcover":
      return { credibilityScore: 92, trustStatus: "approved", trustReason: "Land-cover shares are calculated consistently from one fixed ESA WorldCover release.", evidenceLabel: "Geospatially derived", dailyEligible: true };
    case "hydrosheds":
      return { credibilityScore: 92, trustStatus: "approved", trustReason: "River and lake summaries are calculated consistently from one fixed HydroSHEDS product and disclosed inclusion threshold.", evidenceLabel: "Geospatially derived", dailyEligible: true };
    case "elevation":
      return { credibilityScore: 92, trustStatus: "approved", trustReason: "Terrain summaries are calculated consistently from one fixed global elevation grid, land mask, and boundary set.", evidenceLabel: "Geospatially derived", dailyEligible: true };
    case "unescoheritage":
      return { credibilityScore: 95, trustStatus: "approved", trustReason: "Official UNESCO World Heritage inventory with published criteria and property records.", evidenceLabel: "Observed/administrative", dailyEligible: true };
    case "aquastat":
      return { credibilityScore: 88, trustStatus: "approved", trustReason: "FAO-harmonized water-resource and use statistics with published definitions.", evidenceLabel: "Mixed observed and modeled", dailyEligible: true };
    case "usgsminerals":
      return { credibilityScore: 92, trustStatus: "approved", trustReason: "USGS commodity-specific country mine-production estimates and official summaries.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "faofisheries":
      return { credibilityScore: 88, trustStatus: "approved", trustReason: "FAO-harmonized capture and aquaculture production statistics.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "unmembership":
      return { credibilityScore: 98, trustStatus: "approved", trustReason: "Official United Nations membership records provide the date each current Member State was admitted.", evidenceLabel: "Observed/administrative", dailyEligible: true };
    case "ipu":
      return { credibilityScore: 96, trustStatus: "approved", trustReason: "Official Inter-Parliamentary Union Parline records with structured country-history fields and explicit milestone definitions.", evidenceLabel: "Observed/administrative", dailyEligible: true };
    case "constitute":
      return { credibilityScore: 93, trustStatus: "approved", trustReason: "Constitute distributes Comparative Constitutions Project records with explicit in-force status and enactment-year metadata.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "unwpp":
      return { credibilityScore: 97, trustStatus: "approved", trustReason: "UN World Population Prospects provides harmonized demographic estimates under a documented global methodology; v16.2.6 uses a fixed historical estimate year and excludes projections.", evidenceLabel: "Modeled estimate", dailyEligible: true };
    case "worldbankclimate":
      return { credibilityScore: 92, trustStatus: "approved", trustReason: "World Bank Climate Knowledge Portal distributes a common CRU climatology used consistently across countries and a fixed 1991–2020 reference period.", evidenceLabel: "Geospatially derived", dailyEligible: true };
    case "imfweo":
      return { credibilityScore: 95, trustStatus: "approved", trustReason: "IMF World Economic Outlook harmonizes macroeconomic country series; v16.2.6 pins a historical observation year and excludes forecasts from gameplay.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "unescoich":
      return { credibilityScore: 96, trustStatus: "approved", trustReason: "Official UNESCO Intangible Cultural Heritage inventory records are used directly with explicit country attribution rules.", evidenceLabel: "Observed/administrative", dailyEligible: true };
    case "noaatsunami":
      return { credibilityScore: 95, trustStatus: "approved", trustReason: "NOAA/NCEI Global Historical Tsunami Database event records are filtered with a fixed validity rule and reproducible country attribution.", evidenceLabel: "Observed/administrative", dailyEligible: true };
    case "whoghed":
      return { credibilityScore: 94, trustStatus: "approved", trustReason: "WHO Global Health Expenditure Database harmonizes national health-account expenditure data under the System of Health Accounts framework.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "undesamigrant":
      return { credibilityScore: 96, trustStatus: "approved", trustReason: "UN DESA International Migrant Stock provides a dedicated harmonized global migrant-stock dataset with explicit reference years and country definitions.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "wtoservices":
      return { credibilityScore: 95, trustStatus: "approved", trustReason: "WTO commercial-services statistics are compiled under international trade-in-services standards and validated on a common year/unit basis.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "untourismdirect":
      return { credibilityScore: 94, trustStatus: "approved", trustReason: "Direct UN Tourism statistics use the organization’s tourism definitions and avoid the previously rejected distributed World Bank repair path.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "fifa":
      return { credibilityScore: 98, trustStatus: "approved", trustReason: "Official FIFA men\'s World Cup participation records are used directly to derive each current participating country\'s first finals appearance.", evidenceLabel: "Observed/administrative", dailyEligible: true };
    case "ioc":
      return { credibilityScore: 98, trustStatus: "approved", trustReason: "Official IOC Olympic participation records are used directly to derive each current participating country\'s first modern Olympic appearance.", evidenceLabel: "Observed/administrative", dailyEligible: true };
    case "worldbankhistory":
      return { credibilityScore: 90, trustStatus: "approved", trustReason: "Historical milestones are reproducibly derived from exact consecutive-year World Development Indicator threshold crossings with explicit eligible subsets.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "globalfindex2025":
      return { credibilityScore: 90, trustStatus: "approved", trustReason: "World Bank Global Findex harmonizes nationally representative survey measures across economies with published questionnaire and weighting methods.", evidenceLabel: "Mixed observed and modeled", dailyEligible: true };
    case "faofra2025":
      return { credibilityScore: 95, trustStatus: "approved", trustReason: "FAO Global Forest Resources Assessment uses a documented international reporting framework and official country submissions with quality review.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "unicefdata":
      return { credibilityScore: 94, trustStatus: "approved", trustReason: "UNICEF harmonizes administrative, survey, and modeled child and household indicators using published international definitions.", evidenceLabel: "Mixed observed and modeled", dailyEligible: true };
    case "undphdr":
      return { credibilityScore: 92, trustStatus: "approved", trustReason: "UNDP Human Development Reports publish internationally harmonized indicators and documented composite methodology; editorial gates still exclude opaque or redundant concepts.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "vdemv16":
      return { credibilityScore: 85, trustStatus: "caution", trustReason: "V-Dem combines expert-coded indicators under a published measurement model. Only clear, non-duplicative concepts may pass GeoStats editorial and semantic gates.", evidenceLabel: "Modeled estimate", dailyEligible: true };
    case "faostatfoodsecurity":
      return { credibilityScore: 90, trustStatus: "approved", trustReason: "FAO food-security indicators use documented international methods; modeled measures remain explicitly identified and subject to comparability gates.", evidenceLabel: "Mixed observed and modeled", dailyEligible: true };
    case "koppengeiger":
      return { credibilityScore: 96, trustStatus: "approved", trustReason: "Country climate-class shares are reproducibly derived from the fixed peer-reviewed Köppen-Geiger 1991–2020 raster and one country geometry set.", evidenceLabel: "Geospatially derived", dailyEligible: true };
    case "worldbankinfra":
      return { credibilityScore: 86, trustStatus: "approved", trustReason: "World Development Indicators infrastructure and connectivity series are compiled from recognized international sources with documented metadata.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "faostatlanduse":
      return { credibilityScore: 90, trustStatus: "approved", trustReason: "FAOSTAT Land Use applies standardized international land-use definitions to official and estimated country observations.", evidenceLabel: "Mixed observed and modeled", dailyEligible: true };
    case "faostatworldcover":
      return { credibilityScore: 92, trustStatus: "approved", trustReason: "FAOSTAT land-cover statistics are consistently derived from ESA WorldCover 2021 using a fixed global methodology.", evidenceLabel: "Geospatially derived", dailyEligible: true };
    case "worldbankwbl":
      return { credibilityScore: 90, trustStatus: "caution", trustReason: "World Bank Women, Business and the Law codes legal and policy frameworks under a published methodology; composite concepts remain subject to player-comprehension gates.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
    case "jmpwash":
      return { credibilityScore: 94, trustStatus: "approved", trustReason: "WHO/UNICEF JMP harmonizes household WASH estimates from surveys, censuses, and administrative sources using published service-level definitions.", evidenceLabel: "Mixed observed and modeled", dailyEligible: true };
    case "unwup2025":
    case "unwupcities2025":
      return { credibilityScore: 97, trustStatus: "approved", trustReason: "UN World Urbanization Prospects 2025 provides harmonized country and city urbanization estimates under a documented global methodology.", evidenceLabel: "Modeled estimate", dailyEligible: true };
  }
}

function worldBankProfile(category: Category, base: CategoryTrustProfile): CategoryTrustProfile {
  const indicator = category.indicator;
  if (indicator === "IP.JRN.ARTC.SC") {
    return {
      credibilityScore: 86,
      trustStatus: "approved",
      trustReason: "Independent Scopus/NSF bibliometric count based on author affiliations, not a number supplied by national governments. Absolute output should not be interpreted as research quality.",
      evidenceLabel: "Independent bibliometric",
      dailyEligible: true,
    };
  }
  if (indicator.startsWith("IT.")) {
    return {
      ...base,
      credibilityScore: indicator === "IT.NET.USER.ZS" ? 55 : 76,
      trustStatus: indicator === "IT.NET.USER.ZS" ? "quarantined" : "caution",
      trustReason: indicator === "IT.NET.USER.ZS"
        ? "Internet-use estimates can combine household surveys, regulator/operator reporting, and imputation with uneven national definitions. Excluded from Daily play until independently corroborated."
        : "Telecommunications administrative data are standardized by the ITU, but subscription counts and national reporting practices can differ.",
      evidenceLabel: "Mixed observed and modeled",
      dailyEligible: indicator !== "IT.NET.USER.ZS",
    };
  }
  if (indicator.startsWith("IP.")) {
    return { ...base, credibilityScore: 82, trustStatus: "caution", trustReason: "Independent or administrative intellectual-property/bibliometric records, but totals reflect country size and filing/publication systems.", evidenceLabel: "Observed/administrative" };
  }
  if (indicator.startsWith("MS.")) {
    return { ...base, credibilityScore: 85, trustReason: "SIPRI series uses budgets, official documents, and independent estimation rather than accepting a single government assertion.", evidenceLabel: "Internationally harmonized" };
  }
  if (indicator.startsWith("SL.")) {
    return { ...base, credibilityScore: 80, trustStatus: "caution", trustReason: "Labor-force surveys and ILO harmonization improve comparability, although survey definitions and modeled values remain relevant.", evidenceLabel: "Mixed observed and modeled" };
  }
  if (indicator.startsWith("SH.") || indicator.startsWith("SP.DYN.")) {
    return { ...base, credibilityScore: 88, trustReason: "International health/demographic estimates combine civil registration, surveys, and transparent statistical adjustment.", evidenceLabel: "Mixed observed and modeled" };
  }
  if (indicator.startsWith("TX.") || indicator.startsWith("TM.")) {
    return { ...base, credibilityScore: 95, trustReason: "Customs and trade records harmonized through international statistical systems.", evidenceLabel: "Observed/administrative" };
  }
  if (indicator.startsWith("NY.") || indicator.startsWith("NE.") || indicator.startsWith("NV.")) {
    return { ...base, credibilityScore: 91, trustReason: "National accounts reconciled under international accounting standards and cross-checked across related aggregates.", evidenceLabel: "Internationally harmonized" };
  }
  if (indicator.startsWith("AG.") || indicator.startsWith("ER.")) {
    return { ...base, credibilityScore: 90, trustReason: "Internationally standardized land, agriculture, or environmental statistics with documented definitions.", evidenceLabel: "Internationally harmonized" };
  }
  return base;
}

export function trustProfileForCategory(category: Category): CategoryTrustProfile {
  let profile = sourceBaseline(category.source);
  if (category.source === "worldbank") profile = worldBankProfile(category, profile);

  if (category.source === "naturalearth" && (category.id === "natural-earth:coastline" || category.indicator === "longest-coastline" || /coastline/i.test(category.name))) {
    profile = {
      ...profile,
      credibilityScore: 84,
      trustStatus: "caution",
      trustReason: "Coastline length is derived reproducibly from the fixed Natural Earth 1:10m geometry. It is scale-dependent (coastline paradox), so GeoStats presents it as a consistent geospatial estimate rather than an absolute physical truth.",
      evidenceLabel: "Geospatially derived",
      dailyEligible: true,
    };
  }

  if (category.source === "eia" && /(?:crude oil|natural gas|coal) produced/i.test(category.name)) {
    profile = {
      ...profile,
      credibilityScore: 82,
      trustStatus: "caution",
      trustReason: `${profile.trustReason} Random and Daily boards must also pass a nonzero/tie-concentration gate.`,
    };
  }

  if (category.source === "who" && /^WHS(?:4_117|8_110|4_543)$/.test(category.indicator)) {
    profile = {
      ...profile,
      credibilityScore: 82,
      trustStatus: "caution",
      trustReason: "WHO immunization coverage series. The result is retained only as the standardized WHO series and is labeled as reported/estimated coverage rather than an independently measured census.",
    };
  }

  if (EXPLICIT_QUARANTINE_IDS.has(category.id) || EXPLICIT_QUARANTINE_INDICATORS.has(category.indicator) || LOW_CONFIDENCE_TITLE_PATTERNS.some((pattern) => pattern.test(category.name))) {
    return {
      ...profile,
      credibilityScore: Math.min(profile.credibilityScore, 55),
      trustStatus: "quarantined",
      trustReason: profile.trustStatus === "quarantined" ? profile.trustReason : "Excluded from Daily play because cross-country comparability or face-validity risk is too high without additional corroboration.",
      dailyEligible: false,
    };
  }

  return profile;
}

export function applyCategoryTrustPolicy(category: Category): Category {
  const profile = trustProfileForCategory(category);
  const credibilityScore = category.credibilityScore ?? profile.credibilityScore;
  const trustStatus = category.trustStatus ?? profile.trustStatus;
  return {
    ...category,
    credibilityScore,
    trustStatus,
    trustReason: category.trustReason ?? profile.trustReason,
    evidenceLabel: category.evidenceLabel ?? profile.evidenceLabel,
    enabled: category.enabled !== false && profile.dailyEligible && trustStatus !== "quarantined" && credibilityScore >= 75,
  };
}
