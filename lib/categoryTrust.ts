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
  "natural-earth:coastline",
]);

const EXPLICIT_QUARANTINE_INDICATORS = new Set([
  "IT.NET.USER.ZS",
  "longest-coastline",
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
    case "constitute":
      return { credibilityScore: 93, trustStatus: "approved", trustReason: "Constitute distributes Comparative Constitutions Project records with explicit in-force status and enactment-year metadata.", evidenceLabel: "Internationally harmonized", dailyEligible: true };
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
