import type { Category } from "./categories";
import { canonicalCountryName } from "./canonicalCountries";
import { fetchCategorySourceMetadata } from "./categoryMetadata";
import type { Continent } from "./continents";
import { STATIC_COUNTRIES } from "./staticCountries";

export type CountryInfo = { id: string; name: string; region: string; continent: Continent; flag: string; population?: number };
export type Observation = { countryId: string; countryName: string; value: number; year: string };
export type WorldBankImportSnapshot = {
  observations: Observation[];
  commonYear: number;
  commonYearCoverage: number;
  latestYear: number;
  countryCoverage: number;
  apiUrl: string;
  sourceQuery: Record<string, string>;
  officialSeriesName: string;
  officialUnit: string;
  technicalDefinition: string;
  retrievedAt: string;
};
export type CategoryDataset = {
  category: Category;
  observations: Observation[];
  year: string;
  sourceUrl?: string;
  methodologyUrl?: string;
  evidenceLabel?: string;
  credibilityScore?: number;
  trustStatus?: string;
  trustReason?: string;
  sourcePageUrl?: string;
  playerSourceUrl?: string;
  playerSourceStatus?: string;
  playerSourceReason?: string;
  playerSourceCheckedAt?: string;
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
  verifiabilityScore?: number;
  verifiabilityStatus?: string;
  understandabilityScore?: number;
  funScore?: number;
  objectiveStatus?: string;
  playerQualityStatus?: string;
  playerQualityReason?: string;
  contentReviewStatus?: string;
  contentReviewReason?: string;
  immediateComprehensionScore?: number;
  gameplayInterestScore?: number;
  uniquenessScore?: number;
  linkQualityScore?: number;
};

export async function fetchCountries(): Promise<CountryInfo[]> {
  return [...STATIC_COUNTRIES];
}

export async function fetchWorldBankImportSnapshot(category: Category): Promise<WorldBankImportSnapshot> {
  const apiUrl = worldBankIndicatorApiUrl(category.indicator);
  const [countries, json, metadataJson] = await Promise.all([
    fetchCountries(),
    fetchJsonWithRetry(apiUrl),
    fetchJsonWithRetry(worldBankIndicatorMetadataUrl(category.indicator)),
  ]);
  const playableIds = new Set(countries.map((country) => country.id));
  const rows = json?.[1] ?? [];
  const minimumYear = Math.max(WORLD_BANK_IMPORT_START_YEAR, category.minimumYear ?? WORLD_BANK_IMPORT_START_YEAR);
  const observations: Observation[] = [];
  const seen = new Map<string, number>();
  const coverageByYear = new Map<number, Set<string>>();
  const allCountries = new Set<string>();

  for (const row of rows) {
    const id = String(row.countryiso3code ?? "");
    const value = Number(row.value);
    const year = Number(row.date);
    if (!playableIds.has(id) || !Number.isFinite(value) || !Number.isInteger(year) || year < minimumYear) continue;
    const duplicateKey = `${id}:${year}`;
    const priorValue = seen.get(duplicateKey);
    if (priorValue !== undefined && Math.abs(priorValue - value) > 1e-9) {
      throw new Error(`${category.shortName} returned contradictory values for ${id} in ${year}.`);
    }
    if (priorValue !== undefined) continue;
    seen.set(duplicateKey, value);
    allCountries.add(id);
    const yearCountries = coverageByYear.get(year) ?? new Set<string>();
    yearCountries.add(id);
    coverageByYear.set(year, yearCountries);
    observations.push({
      countryId: id,
      countryName: canonicalCountryName(id, row.country?.value ?? id),
      value,
      year: String(year),
    });
  }

  if (!coverageByYear.size) {
    throw new Error(`${category.shortName} has no playable-country observations from ${minimumYear} onward.`);
  }
  const commonYear = [...coverageByYear.keys()].sort((left, right) => {
    const leftCoverage = coverageByYear.get(left)?.size ?? 0;
    const rightCoverage = coverageByYear.get(right)?.size ?? 0;
    const leftScore = Math.min(leftCoverage, 150) * 3 - Math.max(0, WORLD_BANK_CURRENT_YEAR - left) * 8;
    const rightScore = Math.min(rightCoverage, 150) * 3 - Math.max(0, WORLD_BANK_CURRENT_YEAR - right) * 8;
    return rightScore - leftScore || right - left;
  })[0];
  const snapshot = observations.filter((observation) => Number(observation.year) === commonYear);
  if (snapshot.length < category.coverageFloor) {
    throw new Error(`${category.shortName} has only ${snapshot.length} playable countries in the selected common year ${commonYear}; ${category.coverageFloor} are required.`);
  }

  const indicatorRow = Array.isArray(metadataJson?.[1]) ? metadataJson[1][0] : null;
  const rowIndicatorName = rows.find((row: any) => row?.indicator?.value)?.indicator?.value;
  const officialSeriesName = String(indicatorRow?.name ?? rowIndicatorName ?? "").trim();
  if (!officialSeriesName) throw new Error(`World Bank metadata did not identify series ${category.indicator}.`);
  const officialUnit = String(indicatorRow?.unit ?? "").trim();
  const technicalDefinition = String(indicatorRow?.sourceNote ?? indicatorRow?.source_note ?? officialSeriesName).trim();
  return {
    observations: snapshot,
    commonYear,
    commonYearCoverage: snapshot.length,
    latestYear: Math.max(...coverageByYear.keys()),
    countryCoverage: allCountries.size,
    apiUrl,
    sourceQuery: {
      indicator: category.indicator,
      country: "all",
      date: `${WORLD_BANK_IMPORT_START_YEAR}:${WORLD_BANK_CURRENT_YEAR}`,
    },
    officialSeriesName,
    officialUnit,
    technicalDefinition,
    retrievedAt: new Date().toISOString(),
  };
}

export async function fetchWorldBankCategory(category: Category): Promise<CategoryDataset> {
  const [countries, json, metadata] = await Promise.all([
    fetchCountries(),
    fetchJsonWithRetry(worldBankIndicatorApiUrl(category.indicator)),
    fetchCategorySourceMetadata(category),
  ]);
  const playableIds = new Set(countries.map((country) => country.id));
  const rows = json?.[1] ?? [];
  const latest = new Map<string, Observation>();
  const minimumYear = category.minimumYear ?? 2022;
  const seen = new Map<string, number>();

  for (const row of rows) {
    const id = row.countryiso3code;
    const value = Number(row.value);
    const year = String(row.date ?? "");
    if (!playableIds.has(id) || !Number.isFinite(value) || !/^\d{4}$/.test(year)) continue;
    if (Number(year) < minimumYear) continue;
    const duplicateKey = `${id}:${year}`;
    const priorValue = seen.get(duplicateKey);
    if (priorValue !== undefined && Math.abs(priorValue - value) > 1e-9) {
      throw new Error(`${category.shortName} returned contradictory values for ${id} in ${year}.`);
    }
    seen.set(duplicateKey, value);
    const prior = latest.get(id);
    if (!prior || Number(year) > Number(prior.year)) {
      latest.set(id, { countryId: id, countryName: canonicalCountryName(id, row.country?.value ?? id), value, year });
    }
  }

  const observations = [...latest.values()];
  if (observations.length < category.coverageFloor) {
    throw new Error(`${category.shortName} has only ${observations.length} playable countries with ${minimumYear}+ data; ${category.coverageFloor} are required.`);
  }
  const year = observations.map((o) => o.year).sort().reverse()[0] ?? `${minimumYear}+`;
  return {
    category: metadata ? {
      ...category,
      credibilityScore: metadata.credibilityScore ?? category.credibilityScore,
      trustStatus: (metadata.trustStatus as Category["trustStatus"]) ?? category.trustStatus,
      trustReason: metadata.trustReason ?? category.trustReason,
      evidenceLabel: (metadata.evidenceLabel as Category["evidenceLabel"]) ?? category.evidenceLabel,
      sourceUrl: metadata.sourceUrl ?? category.sourceUrl,
      methodologyUrl: metadata.methodologyUrl ?? category.methodologyUrl,
      sourcePageUrl: metadata.sourcePageUrl ?? category.sourcePageUrl,
      exactQueryUrl: metadata.exactQueryUrl ?? category.exactQueryUrl,
      downloadUrl: metadata.downloadUrl ?? category.downloadUrl,
      apiUrl: metadata.apiUrl ?? category.apiUrl,
      datasetRelease: metadata.datasetRelease ?? category.datasetRelease,
      retrievedAt: metadata.retrievedAt ?? category.retrievedAt,
      licenseName: metadata.licenseName ?? category.licenseName,
      licenseUrl: metadata.licenseUrl ?? category.licenseUrl,
      sourceQuery: metadata.sourceQuery ?? category.sourceQuery,
      derivationMethod: metadata.derivationMethod ?? category.derivationMethod,
      derivationVersion: metadata.derivationVersion ?? category.derivationVersion,
      inputDatasets: metadata.inputDatasets ?? category.inputDatasets,
      verifiabilityScore: metadata.verifiabilityScore ?? category.verifiabilityScore,
      verifiabilityStatus: metadata.verifiabilityStatus ?? category.verifiabilityStatus,
      understandabilityScore: metadata.understandabilityScore ?? category.understandabilityScore,
      funScore: metadata.funScore ?? category.funScore,
      objectiveStatus: (metadata.objectiveStatus as Category["objectiveStatus"]) ?? category.objectiveStatus,
      playerQualityStatus: (metadata.playerQualityStatus as Category["playerQualityStatus"]) ?? category.playerQualityStatus,
      playerQualityReason: metadata.playerQualityReason ?? category.playerQualityReason,
    } : category,
    observations,
    year,
    sourceUrl: metadata?.sourceUrl,
    methodologyUrl: metadata?.methodologyUrl,
    evidenceLabel: metadata?.evidenceLabel,
    credibilityScore: metadata?.credibilityScore,
    trustStatus: metadata?.trustStatus,
    trustReason: metadata?.trustReason,
    sourcePageUrl: metadata?.sourcePageUrl,
    exactQueryUrl: metadata?.exactQueryUrl,
    downloadUrl: metadata?.downloadUrl,
    apiUrl: metadata?.apiUrl,
    datasetRelease: metadata?.datasetRelease,
    retrievedAt: metadata?.retrievedAt,
    licenseName: metadata?.licenseName,
    licenseUrl: metadata?.licenseUrl,
    sourceQuery: metadata?.sourceQuery,
    derivationMethod: metadata?.derivationMethod,
    derivationVersion: metadata?.derivationVersion,
    inputDatasets: metadata?.inputDatasets,
    verifiabilityScore: metadata?.verifiabilityScore,
    verifiabilityStatus: metadata?.verifiabilityStatus,
    understandabilityScore: metadata?.understandabilityScore,
    funScore: metadata?.funScore,
    objectiveStatus: metadata?.objectiveStatus,
    playerQualityStatus: metadata?.playerQualityStatus,
    playerQualityReason: metadata?.playerQualityReason,
  };
}
