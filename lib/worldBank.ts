import type { Category } from "./categories";
import { isUnRecognizedCountry } from "./playableCountries";
import { canonicalCountryName } from "./canonicalCountries";
import { fetchCategorySourceMetadata } from "./categoryMetadata";

export type CountryInfo = { id: string; name: string; region: string; flag: string };
export type Observation = { countryId: string; countryName: string; value: number; year: string };
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
};

const COUNTRY_OVERRIDES: Record<string, string> = { XKX: "🇽🇰" };
let playableCountriesPromise: Promise<CountryInfo[]> | null = null;

function flagFromIso2(iso2: string) {
  if (!iso2 || iso2.length !== 2) return "🌐";
  return String.fromCodePoint(...iso2.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0)));
}

async function fetchJsonWithRetry(url: string, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`World Bank returned HTTP ${response.status}.`);
      const json = await response.json();
      const apiMessage = Array.isArray(json) ? json?.[0]?.message?.[0]?.value : null;
      if (apiMessage) throw new Error(`World Bank API: ${apiMessage}`);
      return json;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("World Bank request failed.");
}

export async function fetchCountries(): Promise<CountryInfo[]> {
  if (!playableCountriesPromise) {
    playableCountriesPromise = (async () => {
      const json = await fetchJsonWithRetry("https://api.worldbank.org/v2/country?format=json&per_page=400");
      const rows = json?.[1] ?? [];
      return rows
        // World Bank aggregate entities (World, income groups, regions, etc.) use region.id = NA.
        // Keep actual countries and territories only; do not use capitalCity because several valid
        // playable territories omit it in World Bank metadata.
        .filter((row: any) => row.id?.length === 3 && row.region?.id && row.region.id !== "NA" && isUnRecognizedCountry(row.id))
        .map((row: any) => ({
          id: row.id,
          name: canonicalCountryName(row.id, row.name),
          region: row.region.value,
          flag: COUNTRY_OVERRIDES[row.id] ?? flagFromIso2(row.iso2Code)
        }))
        .sort((a: CountryInfo, b: CountryInfo) => a.name.localeCompare(b.name));
    })();
  }
  return playableCountriesPromise;
}

export async function fetchWorldBankCategory(category: Category): Promise<CategoryDataset> {
  const [countries, json, metadata] = await Promise.all([
    fetchCountries(),
    fetchJsonWithRetry(`https://api.worldbank.org/v2/country/all/indicator/${category.indicator}?format=json&per_page=20000&mrnev=8`),
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
