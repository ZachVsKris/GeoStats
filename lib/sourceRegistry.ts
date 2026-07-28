import type { DataSourceId } from "./categories";

export type SourceDefinition = {
  id: DataSourceId;
  name: string;
  homepage: string;
  verifier: string;
  playable: boolean;
  note?: string;
};

export const SOURCE_REGISTRY: Record<DataSourceId, SourceDefinition> = {
  worldbank: {
    id: "worldbank",
    name: "World Bank World Development Indicators",
    homepage: "https://data.worldbank.org/indicator",
    verifier: "scripts/verify-worldbank.mjs",
    playable: true,
  },
  faostat: {
    id: "faostat",
    name: "FAOSTAT",
    homepage: "https://www.fao.org/faostat/en/",
    verifier: "scripts/verify-faostat.mjs",
    playable: true,
  },
  who: {
    id: "who",
    name: "WHO Global Health Observatory",
    homepage: "https://www.who.int/data/gho",
    verifier: "scripts/verify-distributed.mjs --source who",
    playable: true,
    note: "Official WHO series distributed through the World Bank WDI API",
  },
  unesco: {
    id: "unesco",
    name: "UNESCO Institute for Statistics",
    homepage: "https://databrowser.uis.unesco.org/",
    verifier: "scripts/verify-distributed.mjs --source unesco",
    playable: true,
    note: "Official UIS series distributed through the World Bank WDI API",
  },
  untourism: {
    id: "untourism",
    name: "UN Tourism",
    homepage: "https://www.unwto.org/tourism-data/un-tourism-tourism-dashboard",
    verifier: "scripts/verify-distributed.mjs --source untourism",
    playable: true,
    note: "Official UN Tourism series distributed through the World Bank WDI API",
  },
  ilostat: {
    id: "ilostat",
    name: "ILOSTAT",
    homepage: "https://rshiny.ilo.org/dataexplorer/",
    verifier: "scripts/test-ilostat-importer.py",
    playable: true,
    note: "Only the latest completed-year aggregate estimates are eligible",
  },
  naturalearth: {
    id: "naturalearth",
    name: "Natural Earth",
    homepage: "https://www.naturalearthdata.com/",
    verifier: "scripts/test-natural-earth-importer.py",
    playable: true,
    note: "Five curated geometry-derived categories are served from the warehouse snapshot",
  },
  comtrade: {
    id: "comtrade",
    name: "UN Comtrade",
    homepage: "https://comtradeplus.un.org/",
    verifier: "scripts/test-comtrade-importer.py",
    playable: true,
    note: "Approved categories are served from the GeoStats warehouse common-year snapshot",
  },
  eia: {
    id: "eia",
    name: "U.S. Energy Information Administration",
    homepage: "https://www.eia.gov/international/",
    verifier: "scripts/test-eia-importer.py",
    playable: true,
    note: "Approved categories are served from the GeoStats warehouse common-year snapshot",
  },
  unhcr: {
    id: "unhcr",
    name: "UNHCR Refugee Data Finder",
    homepage: "https://www.unhcr.org/refugee-statistics/",
    verifier: "scripts/test-unhcr-importer.py",
    playable: true,
    note: "Approved categories are served from the GeoStats warehouse common-year snapshot",
  },
};

export function categorySourceUrl(source: DataSourceId, indicator: string) {
  if (source === "worldbank") return `https://data.worldbank.org/indicator/${indicator}?name_desc=false`;
  if (source === "faostat") return "https://www.fao.org/faostat/en/#data/QCL";
  if (source === "who") return `https://data.worldbank.org/indicator/${indicator}?name_desc=false`;
  if (source === "unesco") return `https://data.worldbank.org/indicator/${indicator}?name_desc=false`;
  if (source === "untourism") return `https://data.worldbank.org/indicator/${indicator}?name_desc=false`;
  if (source === "ilostat") return "https://rshiny.ilo.org/dataexplorer/";
  if (source === "naturalearth") return "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/";
  if (source === "comtrade") return "https://comtradeplus.un.org/";
  if (source === "eia") return "https://www.eia.gov/opendata/browser/international";
  if (source === "unhcr") return "https://www.unhcr.org/refugee-statistics/";
  throw new Error(`Unsupported source: ${source satisfies never}`);
}

export function categoryMethodologyUrl(source: DataSourceId, indicator: string) {
  if (source === "worldbank") return `https://databank.worldbank.org/metadataglossary/world-development-indicators/series/${indicator}`;
  if (source === "faostat") return "https://www.fao.org/faostat/en/#definitions";
  if (source === "who") return "https://www.who.int/data/gho/indicator-metadata-registry";
  if (source === "unesco") return "https://uis.unesco.org/en/methodology";
  if (source === "untourism") return "https://www.unwto.org/methodology";
  if (source === "ilostat") return "https://ilostat.ilo.org/resources/concepts-and-definitions/";
  if (source === "naturalearth") return "https://www.naturalearthdata.com/about/terms-of-use/";
  if (source === "comtrade") return "https://unstats.un.org/unsd/trade/eg-imts/IMTS%202010%20(English).pdf";
  if (source === "eia") return "https://www.eia.gov/opendata/documentation.php";
  if (source === "unhcr") return "https://www.unhcr.org/refugee-statistics/methodology/";
  throw new Error(`Unsupported source: ${source satisfies never}`);
}
