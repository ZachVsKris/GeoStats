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
  faostatfbs: {
    id: "faostatfbs",
    name: "FAOSTAT Food Balances",
    homepage: "https://www.fao.org/faostat/en/#data/FBS",
    verifier: "scripts/test-faostat-food-balances-importer.py",
    playable: true,
    note: "Per-person food supply available for consumption; not direct dietary-survey intake.",
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
    verifier: "retired from the v15.9 active catalog",
    playable: false,
    note: "Retained only so historical board snapshots and source metadata remain readable.",
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
  pewreligion: {
    id: "pewreligion",
    name: "Pew Research Center religious composition estimates",
    homepage: "https://www.pewresearch.org/religion/feature/religious-composition-by-country-2010-2020/",
    verifier: "scripts/test-pew-religion-importer.py",
    playable: true,
    note: "2020 demographic estimates; every player-facing category identifies the estimate year and methodology.",
  },
  smithsoniangvp: {
    id: "smithsoniangvp",
    name: "Smithsonian Global Volcanism Program",
    homepage: "https://volcano.si.edu/volcanolist_holocene.cfm",
    verifier: "scripts/test-smithsonian-volcano-importer.py",
    playable: true,
    note: "Holocene volcanoes, approximately the last 12,000 years.",
  },
  usgs: {
    id: "usgs",
    name: "USGS Earthquake Catalog",
    homepage: "https://earthquake.usgs.gov/earthquakes/search/",
    verifier: "scripts/test-usgs-earthquake-importer.py",
    playable: true,
    note: "Fixed-period and fixed-magnitude earthquake categories only.",
  },
  worldcover: {
    id: "worldcover",
    name: "ESA WorldCover",
    homepage: "https://esa-worldcover.org/en/data-access",
    verifier: "deferred until a fully automatic official-source importer is available",
    playable: false,
    note: "Country summaries use one fixed WorldCover release and source-defined land-cover classes.",
  },
  hydrosheds: {
    id: "hydrosheds",
    name: "HydroSHEDS",
    homepage: "https://www.hydrosheds.org/products",
    verifier: "deferred until a fully automatic official-source importer is available",
    playable: false,
    note: "HydroRIVERS and HydroLAKES thresholds are shown in the source specification.",
  },
  elevation: {
    id: "elevation",
    name: "Global elevation summary",
    homepage: "https://www.gebco.net/data-products-gridded-bathymetry-data",
    verifier: "deferred until a fully automatic official-source importer is available",
    playable: false,
    note: "Country summaries must use one fixed elevation grid, land mask and boundary set.",
  },
  unescoheritage: {
    id: "unescoheritage", name: "UNESCO World Heritage Centre",
    homepage: "https://whc.unesco.org/en/list/", verifier: "retired from the v16 active catalog", playable: false,
  },
  aquastat: {
    id: "aquastat", name: "FAO AQUASTAT",
    homepage: "https://www.fao.org/aquastat/en/", verifier: "deferred until a fully automatic official-source importer is available", playable: false,
  },
  usgsminerals: {
    id: "usgsminerals", name: "USGS Mineral Commodity Summaries",
    homepage: "https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries", verifier: "deferred until a fully automatic official-source importer is available", playable: false,
  },
  faofisheries: {
    id: "faofisheries", name: "FAO Fisheries and Aquaculture Statistics",
    homepage: "https://www.fao.org/statistics/data-collection/fishery-and-aquaculture/en", verifier: "deferred until a fully automatic official-source importer is available", playable: false,
  },

};

export function categorySourceUrl(source: DataSourceId, indicator: string) {
  if (source === "worldbank") return `https://data.worldbank.org/indicator/${indicator}?name_desc=false`;
  if (source === "faostat") return "https://www.fao.org/faostat/en/#data/QCL";
  if (source === "faostatfbs") return "https://www.fao.org/faostat/en/#data/FBS";
  if (source === "who") return `https://data.worldbank.org/indicator/${indicator}?name_desc=false`;
  if (source === "unesco") return `https://data.worldbank.org/indicator/${indicator}?name_desc=false`;
  if (source === "untourism") return `https://data.worldbank.org/indicator/${indicator}?name_desc=false`;
  if (source === "ilostat") return "https://rshiny.ilo.org/dataexplorer/";
  if (source === "naturalearth") return "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/";
  if (source === "comtrade") return "https://comtradeplus.un.org/";
  if (source === "eia") return "https://www.eia.gov/opendata/browser/international";
  if (source === "unhcr") return "https://www.unhcr.org/refugee-statistics/";
  if (source === "pewreligion") return "https://www.pewresearch.org/religion/feature/religious-composition-by-country-2010-2020/";
  if (source === "smithsoniangvp") return "https://volcano.si.edu/volcanolist_holocene.cfm";
  if (source === "usgs") return "https://earthquake.usgs.gov/earthquakes/search/";
  if (source === "worldcover") return "https://esa-worldcover.org/en/data-access";
  if (source === "hydrosheds") return "https://www.hydrosheds.org/products";
  if (source === "unescoheritage") return "https://whc.unesco.org/en/list/";
  if (source === "aquastat") return "https://www.fao.org/aquastat/en/databases/maindatabase/";
  if (source === "usgsminerals") return "https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries";
  if (source === "faofisheries") return "https://www.fao.org/statistics/data-collection/fishery-and-aquaculture/en";
  if (source === "elevation") return "https://www.gebco.net/data-products-gridded-bathymetry-data";
  throw new Error(`Unsupported source: ${source satisfies never}`);
}

export function categoryMethodologyUrl(source: DataSourceId, indicator: string) {
  if (source === "worldbank") return `https://databank.worldbank.org/metadataglossary/world-development-indicators/series/${indicator}`;
  if (source === "faostat") return "https://www.fao.org/faostat/en/#definitions";
  if (source === "faostatfbs") return "https://www.fao.org/faostat/en/#definitions";
  if (source === "who") return "https://www.who.int/data/gho/indicator-metadata-registry";
  if (source === "unesco") return "https://uis.unesco.org/en/methodology";
  if (source === "untourism") return "https://www.unwto.org/methodology";
  if (source === "ilostat") return "https://ilostat.ilo.org/resources/concepts-and-definitions/";
  if (source === "naturalearth") return "https://www.naturalearthdata.com/about/terms-of-use/";
  if (source === "comtrade") return "https://unstats.un.org/unsd/trade/eg-imts/IMTS%202010%20(English).pdf";
  if (source === "eia") return "https://www.eia.gov/opendata/documentation.php";
  if (source === "unhcr") return "https://www.unhcr.org/refugee-statistics/methodology/";
  if (source === "pewreligion") return "https://www.pewresearch.org/religion/2025/06/09/how-the-global-religious-landscape-changed-from-2010-to-2020-methodology/";
  if (source === "smithsoniangvp") return "https://volcano.si.edu/gvp_votw.cfm";
  if (source === "usgs") return "https://earthquake.usgs.gov/fdsnws/event/1/";
  if (source === "worldcover") return "https://esa-worldcover.org/en/data-access";
  if (source === "hydrosheds") return "https://www.hydrosheds.org/products";
  if (source === "unescoheritage") return "https://whc.unesco.org/en/list/";
  if (source === "aquastat") return "https://www.fao.org/aquastat/en/databases/maindatabase/";
  if (source === "usgsminerals") return "https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries";
  if (source === "faofisheries") return "https://www.fao.org/statistics/data-collection/fishery-and-aquaculture/en";
  if (source === "elevation") return "https://www.gebco.net/data-products-gridded-bathymetry-data";
  throw new Error(`Unsupported source: ${source satisfies never}`);
}
