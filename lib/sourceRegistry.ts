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
    verifier: "scripts/test-faostat-importer.py",
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
    verifier: "scripts/test-who-importer.py",
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
    verifier: "scripts/test-tourism-migration-importer.py",
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
    homepage: "https://www.fao.org/aquastat/en/", verifier: "scripts/test-aquastat-importer.py", playable: true,
  },
  usgsminerals: {
    id: "usgsminerals", name: "USGS Mineral Commodity Summaries",
    homepage: "https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries", verifier: "scripts/test-usgs-minerals-importer.py", playable: true,
  },
  faofisheries: {
    id: "faofisheries", name: "FAO Fisheries and Aquaculture Statistics",
    homepage: "https://www.fao.org/statistics/data-collection/fishery-and-aquaculture/en", verifier: "scripts/test-fao-fisheries-importer.py", playable: true,
  },

  unmembership: {
    id: "unmembership",
    name: "United Nations Member States",
    homepage: "https://www.un.org/about-us/member-states",
    verifier: "scripts/test-historical-importer.py",
    playable: true,
    note: "Official UN membership admission dates.",
  },
  ipu: {
    id: "ipu",
    name: "Inter-Parliamentary Union Parline",
    homepage: "https://data.ipu.org/",
    verifier: "scripts/test-historical-importer.py",
    playable: true,
    note: "Official Parline country-history fields used only for broad, explicitly defined historical milestones.",
  },
  constitute: {
    id: "constitute",
    name: "Constitute Project / Comparative Constitutions Project",
    homepage: "https://www.constituteproject.org/constitutions",
    verifier: "scripts/test-historical-importer.py",
    playable: true,
    note: "Current in-force constitution enactment years from Constitute; historic and draft constitutions are excluded.",
  },
  unwpp: { id: "unwpp", name: "UN World Population Prospects 2024", homepage: "https://population.un.org/wpp/", verifier: "scripts/test-un-wpp-importer.py", playable: true, note: "v16.2.6 uses the fixed 2023 estimate year; projections are never ranked." },
  worldbankclimate: { id: "worldbankclimate", name: "World Bank Climate Knowledge Portal / CRU TS", homepage: "https://climateknowledgeportal.worldbank.org/", verifier: "scripts/test-world-bank-climate-importer.py", playable: true, note: "Country comparisons use the fixed 1991–2020 observed climatology." },
  imfweo: { id: "imfweo", name: "IMF World Economic Outlook", homepage: "https://www.imf.org/en/Publications/WEO/weo-database/2026/April", verifier: "scripts/test-imf-weo-importer.py", playable: true, note: "v16.2.6 pins historical 2024 values and excludes forecasts." },
  unescoich: { id: "unescoich", name: "UNESCO Intangible Cultural Heritage DataHub", homepage: "https://data.unesco.org/", verifier: "scripts/test-unesco-ich-importer.py", playable: true },
  noaatsunami: { id: "noaatsunami", name: "NOAA Global Historical Tsunami Database", homepage: "https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/tsunamis", verifier: "scripts/test-noaa-tsunami-importer.py", playable: true, note: "Historical record counts include only NOAA source events with event validity > 0." },
  whoghed: { id: "whoghed", name: "WHO Global Health Expenditure Database", homepage: "https://apps.who.int/nha/database/", verifier: "scripts/test-who-ghed-importer.py", playable: true, note: "v16.2.6 uses an official GHED bulk export and keeps the old World Bank-distributed repair path blocked." },
  undesamigrant: { id: "undesamigrant", name: "UN DESA International Migrant Stock 2024", homepage: "https://www.un.org/development/desa/pd/content/international-migrant-stock", verifier: "scripts/test-un-desa-migrant-stock-importer.py", playable: true, note: "Official UN DESA migrant-stock totals/shares; current-country normalization and common-year coverage remain fail-closed." },
  wtoservices: { id: "wtoservices", name: "WTO Trade in Commercial Services", homepage: "https://data.wto.org/en/dataset/comservices", verifier: "scripts/test-wto-services-importer.py", playable: true, note: "Official WTO commercial-services bulk data; total trade is exports plus imports in the same common year and unit." },
  untourismdirect: { id: "untourismdirect", name: "UN Tourism Data Dashboard", homepage: "https://www.unwto.org/tourism-data", verifier: "scripts/test-un-tourism-importer.py", playable: true, note: "Direct UN Tourism bulk/dashboard export; does not reuse the failed World Bank-distributed repair path." },
  fifa: { id: "fifa", name: "FIFA Men\'s World Cup participation history", homepage: "https://www.fifa.com/tournaments/mens/worldcup", verifier: "scripts/test-sports-history-importer.py", playable: true, note: "First-appearance chronology uses only countries with an official men\'s World Cup appearance." },
  ioc: { id: "ioc", name: "IOC modern Olympic Games participation history", homepage: "https://olympics.com/ioc/olympic-games", verifier: "scripts/test-sports-history-importer.py", playable: true, note: "First-appearance chronology uses only countries with an official modern Olympic appearance." },
  worldbankhistory: { id: "worldbankhistory", name: "World Bank historical milestone derivations", homepage: "https://data.worldbank.org/", verifier: "scripts/test-historical-importer.py", playable: true, note: "Exact consecutive-year threshold crossings derived reproducibly from World Development Indicators." },
  globalfindex2025: { id: "globalfindex2025", name: "World Bank Global Findex 2025", homepage: "https://www.worldbank.org/en/publication/globalfindex/download-data", verifier: "scripts/test-global-findex-importer.py", playable: true },
  faofra2025: { id: "faofra2025", name: "FAO Global Forest Resources Assessment 2025", homepage: "https://fra-data.fao.org/", verifier: "scripts/test-fao-fra-2025-importer.py", playable: true },
  unicefdata: { id: "unicefdata", name: "UNICEF Data Warehouse", homepage: "https://data.unicef.org/resources/resource-type/datasets/", verifier: "scripts/test-unicef-data-importer.py", playable: true },
  undphdr: { id: "undphdr", name: "UNDP Human Development Reports Data Center", homepage: "https://hdr.undp.org/data-center", verifier: "scripts/test-undp-hdr-importer.py", playable: true },
  vdemv16: { id: "vdemv16", name: "V-Dem Country-Year Core v16", homepage: "https://www.v-dem.net/data/the-v-dem-dataset/", verifier: "scripts/test-vdem-v16-importer.py", playable: true, note: "Only curated, player-comprehensible concepts may pass editorial and semantic gates." },
  faostatfoodsecurity: { id: "faostatfoodsecurity", name: "FAOSTAT Food Security Indicators", homepage: "https://data.fao.org/catalog/dataset/955d6564-40a9-48b4-b51b-f19d65bb3539", verifier: "scripts/test-faostat-food-security-importer.py", playable: true },
  koppengeiger: { id: "koppengeiger", name: "Köppen-Geiger 1991–2020 climate classification", homepage: "https://doi.org/10.1038/s41597-023-02549-6", verifier: "scripts/test-koppen-geiger-importer.py", playable: true, note: "Country summaries are reproducibly derived from the fixed 1991–2020 raster and country geometry." },
  worldbankinfra: { id: "worldbankinfra", name: "World Bank WDI Infrastructure & Connectivity", homepage: "https://data.worldbank.org/", verifier: "scripts/test-world-bank-infrastructure-importer.py", playable: true },
  faostatlanduse: { id: "faostatlanduse", name: "FAOSTAT Land Use", homepage: "https://www.fao.org/faostat/en/#data/RL", verifier: "scripts/test-faostat-land-use-importer.py", playable: true },
  faostatworldcover: { id: "faostatworldcover", name: "FAOSTAT / ESA WorldCover 2021 land cover", homepage: "https://www.fao.org/faostat/en/#data/LC", verifier: "scripts/test-faostat-worldcover-importer.py", playable: true },
  worldbankwbl: { id: "worldbankwbl", name: "World Bank Women, Business and the Law 2026", homepage: "https://wbl.worldbank.org/", verifier: "scripts/test-world-bank-wbl-importer.py", playable: true },
  jmpwash: { id: "jmpwash", name: "WHO/UNICEF Joint Monitoring Programme", homepage: "https://washdata.org/data/household#!/", verifier: "scripts/test-jmp-wash-importer.py", playable: true },
  unwup2025: { id: "unwup2025", name: "UN World Urbanization Prospects 2025", homepage: "https://population.un.org/wup/", verifier: "scripts/test-un-wup-2025-importer.py", playable: true },
  unwupcities2025: { id: "unwupcities2025", name: "UN World Urbanization Prospects 2025 — Cities", homepage: "https://population.un.org/wup/", verifier: "scripts/test-un-wup-2025-cities-importer.py", playable: true },
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
  if (source === "unmembership") return "https://www.un.org/about-us/member-states";
  if (source === "ipu") return "https://data.ipu.org/compare/";
  if (source === "constitute") return "https://www.constituteproject.org/constitutions";
  if (source === "unwpp") return "https://population.un.org/wpp/";
  if (source === "worldbankclimate") return "https://climateknowledgeportal.worldbank.org/";
  if (source === "imfweo") return "https://www.imf.org/en/Publications/WEO/weo-database/2026/April";
  if (source === "unescoich") return "https://data.unesco.org/";
  if (source === "noaatsunami") return "https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/tsunamis";
  if (source === "whoghed") return "https://apps.who.int/nha/database/";
  if (source === "undesamigrant") return "https://www.un.org/development/desa/pd/content/international-migrant-stock";
  if (source === "wtoservices") return "https://data.wto.org/en/dataset/comservices";
  if (source === "untourismdirect") return "https://www.unwto.org/tourism-data";
  if (source === "fifa") return "https://www.fifa.com/tournaments/mens/worldcup";
  if (source === "ioc") return "https://olympics.com/ioc/olympic-games";
  if (source === "worldbankhistory") return "https://data.worldbank.org/";
  if (source === "globalfindex2025") return "https://www.worldbank.org/en/publication/globalfindex/download-data";
  if (source === "faofra2025") return "https://fra-data.fao.org/";
  if (source === "unicefdata") return "https://data.unicef.org/resources/resource-type/datasets/";
  if (source === "undphdr") return "https://hdr.undp.org/data-center";
  if (source === "vdemv16") return "https://www.v-dem.net/data/the-v-dem-dataset/";
  if (source === "faostatfoodsecurity") return "https://data.fao.org/catalog/dataset/955d6564-40a9-48b4-b51b-f19d65bb3539";
  if (source === "koppengeiger") return "https://doi.org/10.1038/s41597-023-02549-6";
  if (source === "worldbankinfra") return "https://data.worldbank.org/";
  if (source === "faostatlanduse") return "https://www.fao.org/faostat/en/#data/RL";
  if (source === "faostatworldcover") return "https://www.fao.org/faostat/en/#data/LC";
  if (source === "worldbankwbl") return "https://wbl.worldbank.org/";
  if (source === "jmpwash") return "https://washdata.org/data/household#!/";
  if (source === "unwup2025" || source === "unwupcities2025") return "https://population.un.org/wup/";
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
  if (source === "unmembership") return "https://www.un.org/en/about-us/about-un-membership";
  if (source === "ipu") return "https://data.ipu.org/data-dictionary/";
  if (source === "constitute") return "https://www.constituteproject.org/content/data";
  if (source === "unwpp") return "https://population.un.org/wpp/Publications/Files/WPP2024_Methodology-Report_Final.pdf";
  if (source === "worldbankclimate") return "https://climateknowledgeportal.worldbank.org/metadata";
  if (source === "imfweo") return "https://www.imf.org/en/Publications/WEO/weo-database/2026/April/select-aggr-data";
  if (source === "unescoich") return "https://ich.unesco.org/en/lists";
  if (source === "noaatsunami") return "https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-data";
  if (source === "whoghed") return "https://apps.who.int/nha/database/DocumentationCentre/en";
  if (source === "undesamigrant") return "https://www.un.org/development/desa/pd/content/international-migrant-stock";
  if (source === "wtoservices") return "https://www.wto.org/english/res_e/statis_e/tradeserv_stat_e.htm";
  if (source === "untourismdirect") return "https://www.unwto.org/tourism-data/country-profile-inbound-tourism";
  if (source === "fifa") return "https://www.fifa.com/tournaments/mens/worldcup";
  if (source === "ioc") return "https://olympics.com/ioc/olympic-games";
  if (source === "worldbankhistory") return "https://data.worldbank.org/";
  if (source === "globalfindex2025") return "https://www.worldbank.org/en/publication/globalfindex/download-data";
  if (source === "faofra2025") return "https://fra-data.fao.org/";
  if (source === "unicefdata") return "https://data.unicef.org/resources/resource-type/datasets/";
  if (source === "undphdr") return "https://hdr.undp.org/data-center";
  if (source === "vdemv16") return "https://www.v-dem.net/data/the-v-dem-dataset/";
  if (source === "faostatfoodsecurity") return "https://data.fao.org/catalog/dataset/955d6564-40a9-48b4-b51b-f19d65bb3539";
  if (source === "koppengeiger") return "https://doi.org/10.1038/s41597-023-02549-6";
  if (source === "worldbankinfra") return "https://data.worldbank.org/";
  if (source === "faostatlanduse") return "https://www.fao.org/faostat/en/#data/RL";
  if (source === "faostatworldcover") return "https://www.fao.org/faostat/en/#data/LC";
  if (source === "worldbankwbl") return "https://wbl.worldbank.org/";
  if (source === "jmpwash") return "https://washdata.org/data/household#!/";
  if (source === "unwup2025" || source === "unwupcities2025") return "https://population.un.org/wup/";
  throw new Error(`Unsupported source: ${source satisfies never}`);
}
