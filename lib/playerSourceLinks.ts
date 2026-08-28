import type { Category, DataSourceId } from "./categories";

export type PlayerSourceStatus = "pending" | "exact" | "general" | "needs_exact_url" | "invalid" | "unavailable";

const RAW_OR_DOWNLOAD_EXTENSION = /\.(?:csv|tsv|json|xml|zip|gz|gzip|xlsx?|parquet)(?:$|[?#])/i;
const RAW_OR_DOWNLOAD_PATH = /\/(?:api|bulk|download|downloads)(?:\/|$)/i;
const RAW_OR_DOWNLOAD_QUERY = /(?:^|[?&])(?:format|download|output|type)=(?:csv|tsv|json|xml|zip|xlsx?|parquet)(?:&|$)/i;
const FORCED_DOWNLOAD_QUERY = /(?:^|[?&])(?:download|attachment)=/i;
const RAW_HOST = /(^|\.)(?:api|comtradeapi)\./i;

export function isHumanReadableExternalUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (RAW_HOST.test(url.hostname)) return false;
    const complete = `${url.pathname}${url.search}${url.hash}`;
    if (RAW_OR_DOWNLOAD_EXTENSION.test(complete)) return false;
    if (RAW_OR_DOWNLOAD_PATH.test(url.pathname)) return false;
    if (RAW_OR_DOWNLOAD_QUERY.test(url.search)) return false;
    if (FORCED_DOWNLOAD_QUERY.test(url.search)) return false;
    return true;
  } catch {
    return false;
  }
}

export function worldBankPlayerSourceUrl(indicator: string) {
  return `https://data.worldbank.org/indicator/${encodeURIComponent(indicator)}`;
}

const GENERAL_OFFICIAL_SOURCE_PAGES: Partial<Record<DataSourceId, string>> = {
  faostat: "https://www.fao.org/faostat/en/",
  faostatfbs: "https://www.fao.org/faostat/en/#data/FBS",
  who: "https://www.who.int/data/gho/data",
  unesco: "https://databrowser.uis.unesco.org/",
  untourism: "https://www.unwto.org/tourism-statistics",
  naturalearth: "https://www.naturalearthdata.com/",
  comtrade: "https://comtradeplus.un.org/",
  eia: "https://www.eia.gov/international/data/world",
  unhcr: "https://www.unhcr.org/refugee-statistics/",
  ilostat: "https://ilostat.ilo.org/data/",
  pewreligion: "https://www.pewresearch.org/religion/feature/religious-composition-by-country-2010-2020/",
  smithsoniangvp: "https://volcano.si.edu/volcanolist_holocene.cfm",
  usgs: "https://earthquake.usgs.gov/earthquakes/search/",
  worldcover: "https://esa-worldcover.org/en/data-access",
  hydrosheds: "https://www.hydrosheds.org/products",
  elevation: "https://www.gebco.net/data-products-gridded-bathymetry-data",
  unescoheritage: "https://whc.unesco.org/en/list/",
  aquastat: "https://www.fao.org/aquastat/en/databases/maindatabase/",
  usgsminerals: "https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries",
  faofisheries: "https://www.fao.org/statistics/data-collection/fishery-and-aquaculture/en",
  unmembership: "https://www.un.org/about-us/member-states",
  constitute: "https://www.constituteproject.org/constitutions",
  ipu: "https://data.ipu.org/compare/",
  unwpp: "https://population.un.org/wpp/",
  worldbankclimate: "https://climateknowledgeportal.worldbank.org/",
  imfweo: "https://www.imf.org/en/Publications/WEO/weo-database/2026/April",
  unescoich: "https://data.unesco.org/",
  noaatsunami: "https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/tsunamis",
  whoghed: "https://apps.who.int/nha/database/",
  undesamigrant: "https://www.un.org/development/desa/pd/content/international-migrant-stock",
  wtoservices: "https://data.wto.org/en/dataset/comservices",
  untourismdirect: "https://www.unwto.org/tourism-data",
  worldbankhistory: "https://data.worldbank.org/",
  globalfindex2025: "https://www.worldbank.org/en/publication/globalfindex/download-data",
  faofra2025: "https://fra-data.fao.org/",
  unicefdata: "https://data.unicef.org/resources/resource-type/datasets/",
  undphdr: "https://hdr.undp.org/data-center",
  vdemv16: "https://www.v-dem.net/data/the-v-dem-dataset/",
  faostatfoodsecurity: "https://data.fao.org/catalog/dataset/955d6564-40a9-48b4-b51b-f19d65bb3539",
  koppengeiger: "https://doi.org/10.1038/s41597-023-02549-6",
  worldbankinfra: "https://data.worldbank.org/",
  faostatlanduse: "https://www.fao.org/faostat/en/#data/RL",
  faostatworldcover: "https://www.fao.org/faostat/en/#data/LC",
  worldbankwbl: "https://wbl.worldbank.org/",
  jmpwash: "https://washdata.org/data/household#!/",
  unwup2025: "https://population.un.org/wup/",
  unwupcities2025: "https://population.un.org/wup/",
  fifa: "https://www.fifa.com/tournaments/mens/worldcup",
  ioc: "https://olympics.com/ioc/olympic-games",
};

export function generalOfficialSourcePage(source: DataSourceId) {
  return GENERAL_OFFICIAL_SOURCE_PAGES[source] ?? null;
}

export function sourceSpecificLinkLooksExact(source: DataSourceId, indicator: string, value: string | null | undefined) {
  if (!isHumanReadableExternalUrl(value)) return false;
  const url = new URL(value!);
  const decoded = decodeURIComponent(`${url.pathname}${url.search}${url.hash}`).toLowerCase();
  const expected = indicator.toLowerCase();
  if (source === "worldbank") {
    return url.hostname === "data.worldbank.org" && decoded.includes(`/indicator/${expected}`);
  }
  if (source === "unesco") {
    return url.hostname === "databrowser.uis.unesco.org" && url.pathname.startsWith("/browser/") && decoded.includes(expected);
  }
  // Other providers require a successful server-side player-link audit. A
  // generic dataset landing page is never promoted to an exact player link.
  return false;
}

export function hasUsablePlayerSourceStatus(status: string | null | undefined) {
  return status === "exact" || status === "general";
}

export function resolvePlayerSourceUrl(category: Pick<Category, "source" | "indicator" | "playerSourceUrl" | "playerSourceStatus" | "sourcePageUrl" | "sourceUrl" | "methodologyUrl">) {
  if (hasUsablePlayerSourceStatus(category.playerSourceStatus) && isHumanReadableExternalUrl(category.playerSourceUrl)) {
    return category.playerSourceUrl;
  }
  if (category.source === "worldbank") return worldBankPlayerSourceUrl(category.indicator);
  for (const candidate of [category.sourcePageUrl, category.sourceUrl, category.methodologyUrl, generalOfficialSourcePage(category.source)]) {
    if (isHumanReadableExternalUrl(candidate)) return candidate!;
  }
  return null;
}
