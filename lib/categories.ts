export type Direction = "high" | "low";
export type DataSourceId =
  | "worldbank"
  | "faostat"
  | "who"
  | "unesco"
  | "untourism"
  | "naturalearth"
  | "comtrade"
  | "eia"
  | "unhcr";
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
  // Player-facing subtitle. It must explicitly state whether the measure is a total, per-person/rate, percentage/share, or physical unit.
  description: string;
  decimals?: number;
  minimumYear?: number;
  requireCommonYear?: boolean;
  expectedRange?: [number, number];
  certified: true;
  certificationGrade: CertificationGrade;
  coverageFloor: number;
  enabled?: boolean;
  // Optional editorial metadata used by the round composer. Existing categories
  // fall back to their family and indicator when these are omitted.
  roundType?: string;
  similarityGroup?: string;
  productSpecificTrade?: boolean;
};

// Every playable category is certified against one authoritative dataset.
// External-source categories can use the same schema once their independent adapter and verifier ship.
const wb = (category: Omit<Category, "source" | "dataset" | "certified" | "certificationGrade" | "coverageFloor"> & Partial<Pick<Category, "certificationGrade" | "coverageFloor">>): Category => ({
  source: "worldbank",
  dataset: "World Development Indicators",
  certified: true,
  certificationGrade: category.certificationGrade ?? "A",
  coverageFloor: category.coverageFloor ?? 100,
  ...category,
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

const warehouse = (
  source: Extract<DataSourceId, "comtrade" | "eia" | "unhcr">,
  dataset: string,
  category: Omit<Category, "source" | "dataset" | "certified" | "certificationGrade" | "coverageFloor"> & Partial<Pick<Category, "certificationGrade" | "coverageFloor">>,
): Category => ({
  source,
  dataset,
  certified: true,
  certificationGrade: category.certificationGrade ?? "A",
  coverageFloor: category.coverageFloor ?? 60,
  ...category,
  minimumYear: Math.max(2022, category.minimumYear ?? 2022),
});

const comtrade = (category: Parameters<typeof warehouse>[2]) => warehouse("comtrade", "UN Comtrade International Merchandise Trade Statistics", category);
const eia = (category: Parameters<typeof warehouse>[2]) => warehouse("eia", "EIA International Energy Data", category);
const unhcr = (category: Parameters<typeof warehouse>[2]) => warehouse("unhcr", "UNHCR Refugee Data Finder", category);

const WAREHOUSE_CATEGORIES: Category[] = [
  comtrade({ id: "comtrade:most-coffee-exported", name: "Largest coffee exports", shortName: "Coffee exports", indicator: "comtrade:most-coffee-exported", icon: "☕", unit: "USD", family: "Trade", direction: "high", description: "Annual coffee export value, current US dollars (total)", coverageFloor: 80, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-food-exports" }),
  comtrade({ id: "comtrade:most-tea-exported", name: "Largest tea exports", shortName: "Tea exports", indicator: "comtrade:most-tea-exported", icon: "🍵", unit: "USD", family: "Trade", direction: "high", description: "Annual tea export value, current US dollars (total)", coverageFloor: 65, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-food-exports" }),
  comtrade({ id: "comtrade:most-rice-exported", name: "Largest rice exports", shortName: "Rice exports", indicator: "comtrade:most-rice-exported", icon: "🍚", unit: "USD", family: "Trade", direction: "high", description: "Annual rice export value, current US dollars (total)", coverageFloor: 65, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-food-exports" }),
  comtrade({ id: "comtrade:most-wheat-exported", name: "Largest wheat exports", shortName: "Wheat exports", indicator: "comtrade:most-wheat-exported", icon: "🌾", unit: "USD", family: "Trade", direction: "high", description: "Annual wheat export value, current US dollars (total)", coverageFloor: 60, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-food-exports" }),
  comtrade({ id: "comtrade:most-cocoa-beans-exported", name: "Largest cocoa-bean exports", shortName: "Cocoa exports", indicator: "comtrade:most-cocoa-beans-exported", icon: "🍫", unit: "USD", family: "Trade", direction: "high", description: "Annual cocoa-bean export value, current US dollars (total)", coverageFloor: 45, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-food-exports" }),
  comtrade({ id: "comtrade:most-chocolate-exported", name: "Largest chocolate exports", shortName: "Chocolate exports", indicator: "comtrade:most-chocolate-exported", icon: "🍫", unit: "USD", family: "Trade", direction: "high", description: "Annual chocolate export value, current US dollars (total)", coverageFloor: 85, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-food-exports" }),
  comtrade({ id: "comtrade:most-bananas-exported", name: "Largest banana exports", shortName: "Banana exports", indicator: "comtrade:most-bananas-exported", icon: "🍌", unit: "USD", family: "Trade", direction: "high", description: "Annual banana export value, current US dollars (total)", coverageFloor: 55, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-food-exports" }),
  comtrade({ id: "comtrade:most-wine-exported", name: "Largest wine exports", shortName: "Wine exports", indicator: "comtrade:most-wine-exported", icon: "🍷", unit: "USD", family: "Trade", direction: "high", description: "Annual wine export value, current US dollars (total)", coverageFloor: 75, productSpecificTrade: true, roundType: "product-trade", similarityGroup: "comtrade-food-exports" }),
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
  unhcr({ id: "unhcr:most-stateless-people", name: "Most stateless people", shortName: "Stateless people", indicator: "unhcr:most-stateless-people", icon: "🪪", unit: "people", family: "Displacement", direction: "high", description: "Total stateless people reported in the country", coverageFloor: 35, roundType: "displacement-stock", similarityGroup: "unhcr-protection" }),
  unhcr({ id: "unhcr:most-other-people-needing-protection", name: "Most other people needing international protection", shortName: "Other people protected", indicator: "unhcr:most-other-people-needing-protection", icon: "🛟", unit: "people", family: "Displacement", direction: "high", description: "Total other people in need of international protection", coverageFloor: 25, roundType: "displacement-stock", similarityGroup: "unhcr-protection" }),
  unhcr({ id: "unhcr:most-asylum-applications-received", name: "Most asylum applications received", shortName: "Applications received", indicator: "unhcr:most-asylum-applications-received", icon: "📨", unit: "applications", family: "Displacement", direction: "high", description: "Total asylum applications received by the country of asylum", coverageFloor: 75, roundType: "displacement-flow", similarityGroup: "unhcr-applications" }),
  unhcr({ id: "unhcr:most-asylum-applications-by-origin", name: "Most asylum applications by origin", shortName: "Applications by origin", indicator: "unhcr:most-asylum-applications-by-origin", icon: "📤", unit: "applications", family: "Displacement", direction: "high", description: "Total asylum applications filed by people from the listed country of origin", coverageFloor: 70, roundType: "displacement-flow", similarityGroup: "unhcr-applications" }),
  unhcr({ id: "unhcr:most-refugees-returned-home", name: "Most refugees returned home", shortName: "Refugees returned", indicator: "unhcr:most-refugees-returned-home", icon: "🏡", unit: "people", family: "Displacement", direction: "high", description: "Total refugees who returned to their country of origin", coverageFloor: 35, roundType: "displacement-solution", similarityGroup: "unhcr-solutions" }),
  unhcr({ id: "unhcr:most-returned-idps", name: "Most internally displaced people returned", shortName: "IDPs returned", indicator: "unhcr:most-returned-idps", icon: "↩️", unit: "people", family: "Displacement", direction: "high", description: "Total internally displaced people who returned", coverageFloor: 25, roundType: "displacement-solution", similarityGroup: "unhcr-solutions" }),
  unhcr({ id: "unhcr:most-refugees-naturalized", name: "Most refugees naturalized", shortName: "Refugees naturalized", indicator: "unhcr:most-refugees-naturalized", icon: "🪪", unit: "people", family: "Displacement", direction: "high", description: "Total refugees reported as naturalized in the country of asylum", coverageFloor: 20, roundType: "displacement-solution", similarityGroup: "unhcr-solutions" }),
];

export const CATEGORIES: Category[] = [
  ...WAREHOUSE_CATEGORIES,
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
  wb({id:"cerealYield",name:"Highest cereal yield",shortName:"Cereal yield",indicator:"AG.YLD.CREL.KG",icon:"🌽",unit:"kg/hectare",family:"Agriculture",direction:"high",description:"Kilograms produced per harvested hectare",decimals:0,minimumYear:2020}),
  wb({id:"foodExportsShare",name:"Highest food share of exports",shortName:"Food exports",indicator:"TX.VAL.FOOD.ZS.UN",icon:"🍎",unit:"% of merchandise exports",family:"Trade",direction:"high",description:"Food, percent of merchandise exports",decimals:1,expectedRange:[0,100]}),
  wb({id:"foodImportsShare",name:"Highest food share of imports",shortName:"Food imports",indicator:"TM.VAL.FOOD.ZS.UN",icon:"🥫",unit:"% of merchandise imports",family:"Trade",direction:"high",description:"Food, percent of merchandise imports",decimals:1,expectedRange:[0,100]}),
  wb({id:"merchExports",name:"Largest merchandise exports",shortName:"Merchandise exports",indicator:"TX.VAL.MRCH.CD.WT",icon:"🚢",unit:"USD",family:"Trade",direction:"high",description:"Current US dollars (total)"}),
  wb({id:"highTechExports",name:"Largest high-tech exports",shortName:"High-tech exports",indicator:"TX.VAL.TECH.CD",icon:"🛰️",unit:"USD",family:"Trade",direction:"high",description:"Current US dollars (total)"}),
  wb({id:"co2Total",name:"Highest total CO₂ emissions",shortName:"CO₂ emissions",indicator:"EN.GHG.CO2.MT.CE.AR5",icon:"🏭",unit:"Mt CO₂e",family:"Environment",direction:"high",description:"Carbon dioxide emissions excluding land-use change and forestry, million tonnes CO₂ equivalent (total)"}),
  wb({id:"co2PerCapita",name:"Highest CO₂ emissions per person",shortName:"CO₂ per capita",indicator:"EN.GHG.CO2.PC.CE.AR5",icon:"☁️",unit:"t CO₂e/person",family:"Environment",direction:"high",description:"Carbon dioxide emissions excluding land-use change and forestry, tonnes CO₂ equivalent per person",decimals:2}),
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
  wb({id:"merchImports",name:"Largest merchandise imports",shortName:"Merchandise imports",indicator:"TM.VAL.MRCH.CD.WT",icon:"📥",unit:"USD",family:"Trade",direction:"high",description:"Current US dollars (total)"}),
  wb({id:"fixedBroadband",name:"Highest fixed broadband subscriptions per 100 people",shortName:"Fixed broadband",indicator:"IT.NET.BBND.P2",icon:"🛜",unit:"per 100 people",family:"Technology",direction:"high",description:"Subscriptions per 100 people",decimals:1}),
  wb({id:"fixedTelephone",name:"Highest fixed telephone subscriptions per 100 people",shortName:"Fixed telephones",indicator:"IT.MLT.MAIN.P2",icon:"☎️",unit:"per 100 people",family:"Technology",direction:"high",description:"Subscriptions per 100 people",decimals:1}),
  wb({id:"basicWater",name:"Highest basic drinking-water access",shortName:"Drinking water access",indicator:"SH.H2O.BASW.ZS",icon:"🚰",unit:"%",family:"Infrastructure",direction:"high",description:"Percent of population using at least basic services",decimals:1,expectedRange:[0,100]}),
  wb({id:"renewableConsumption",name:"Highest renewable energy consumption",shortName:"Renewable consumption",indicator:"EG.FEC.RNEW.ZS",icon:"♻️",unit:"%",family:"Energy",direction:"high",description:"Percent of total final energy consumption",decimals:1,expectedRange:[0,100]}),
  wb({id:"agLandArea",name:"Largest agricultural land area",shortName:"Agricultural land area",indicator:"AG.LND.AGRI.K2",icon:"🚜",unit:"km²",family:"Agriculture",direction:"high",description:"Total area, square kilometers"}),
  wb({id:"airFreight",name:"Most air freight",shortName:"Air freight",indicator:"IS.AIR.GOOD.MT.K1",icon:"🛫",unit:"million ton-km",family:"Transport",direction:"high",description:"Million metric ton-kilometers",decimals:1}),
  wb({id:"railFreight",name:"Most rail freight",shortName:"Rail freight",indicator:"IS.RRS.GOOD.MT.K6",icon:"🚂",unit:"million ton-km",family:"Transport",direction:"high",description:"Million metric ton-kilometers",decimals:1,coverageFloor:80,certificationGrade:"B"}),
  wb({id:"methane",name:"Highest methane emissions",shortName:"Methane emissions",indicator:"EN.GHG.CH4.MT.CE.AR5",icon:"🌫️",unit:"Mt CO₂e",family:"Environment",direction:"high",description:"Methane emissions excluding land-use change and forestry, million tonnes CO₂ equivalent (total)"}),
  wb({id:"roadFatalities",name:"Lowest road fatality rate",shortName:"Road fatalities",indicator:"SH.STA.TRAF.P5",icon:"🚗",unit:"per 100,000",family:"Transport",direction:"low",description:"Estimated deaths per 100,000 people",decimals:1}),
  wb({id:"oilRents",name:"Highest oil-rent dependence",shortName:"Oil rents",indicator:"NY.GDP.PETR.RT.ZS",icon:"🛢️",unit:"% of GDP",family:"Resources",direction:"high",description:"Oil rents, percent of GDP",decimals:2}),
  wb({id:"gasRents",name:"Highest natural-gas-rent dependence",shortName:"Natural gas rents",indicator:"NY.GDP.NGAS.RT.ZS",icon:"🔥",unit:"% of GDP",family:"Resources",direction:"high",description:"Natural gas rents, percent of GDP",decimals:2}),
  wb({id:"mineralRents",name:"Highest mineral-rent dependence",shortName:"Mineral rents",indicator:"NY.GDP.MINR.RT.ZS",icon:"⛏️",unit:"% of GDP",family:"Resources",direction:"high",description:"Mineral rents, percent of GDP",decimals:2}),
  wb({id:"militaryShare",name:"Highest military spending share",shortName:"Military spending % GDP",indicator:"MS.MIL.XPND.GD.ZS",icon:"🪖",unit:"% of GDP",family:"Government",direction:"high",description:"Military spending, percent of GDP",decimals:2}),
  // FAOSTAT QCL. Indicator format is item-code:element-filter-code. Production uses filter element 2510 and tonnes.


];
