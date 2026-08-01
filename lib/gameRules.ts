import type { Category } from "./categories";
import { categoryBroadDomain, categoryKnowledgeCluster, inferSemanticProfile, semanticConflict } from "./categorySemantics";

export type DailyDifficulty = "easy" | "normal" | "expert";

export type RoundConfig = {
  difficulty: DailyDifficulty;
  label: string;
  path: string;
  randomPath: string;
  categoryCount: number;
  countryCount: number;
  decoyCount: number;
  maxScore: number;
  topFinishRank: number;
  minRoundTypes: number;
  maxSameSource: number;
  maxAgricultureCategories: number;
  maxFaostatCategories: number;
  maxBroadDomain: number;
  maxCountriesPerContinent: number;
  pointsByRank: readonly number[];
};

export const DAILY_DIFFICULTIES: readonly DailyDifficulty[] = ["easy", "normal", "expert"];

export const ROUND_CONFIGS: Record<DailyDifficulty, RoundConfig> = {
  easy: {
    difficulty: "easy",
    label: "Scout",
    path: "/daily",
    randomPath: "/random/easy",
    categoryCount: 4,
    countryCount: 5,
    decoyCount: 1,
    maxScore: 400,
    topFinishRank: 2,
    minRoundTypes: 3,
    maxSameSource: 2,
    maxAgricultureCategories: 1,
    maxFaostatCategories: 1,
    maxBroadDomain: 2,
    maxCountriesPerContinent: 2,
    pointsByRank: [100, 75, 50, 25, 0],
  },
  normal: {
    difficulty: "normal",
    label: "Adventurer",
    path: "/daily/adventurer",
    randomPath: "/random",
    categoryCount: 6,
    countryCount: 8,
    decoyCount: 2,
    maxScore: 600,
    topFinishRank: 3,
    minRoundTypes: 4,
    maxSameSource: 2,
    maxAgricultureCategories: 2,
    maxFaostatCategories: 2,
    maxBroadDomain: 2,
    maxCountriesPerContinent: 3,
    pointsByRank: [100, 85, 70, 55, 40, 25, 10, 0],
  },
  expert: {
    difficulty: "expert",
    label: "Expert",
    path: "/daily/expert",
    randomPath: "/random/expert",
    categoryCount: 8,
    countryCount: 10,
    decoyCount: 2,
    maxScore: 800,
    topFinishRank: 5,
    minRoundTypes: 5,
    maxSameSource: 3,
    maxAgricultureCategories: 2,
    maxFaostatCategories: 2,
    maxBroadDomain: 2,
    maxCountriesPerContinent: 3,
    pointsByRank: [100, 90, 80, 70, 60, 50, 40, 30, 20, 10],
  },
};

export const DEFAULT_DIFFICULTY: DailyDifficulty = "easy";
export const CATEGORY_COUNT = ROUND_CONFIGS[DEFAULT_DIFFICULTY].categoryCount;
export const COUNTRY_COUNT = ROUND_CONFIGS[DEFAULT_DIFFICULTY].countryCount;
export const DECOY_COUNT = ROUND_CONFIGS[DEFAULT_DIFFICULTY].decoyCount;
export const MAX_SCORE = ROUND_CONFIGS[DEFAULT_DIFFICULTY].maxScore;
export const TOP_FINISH_RANK = ROUND_CONFIGS[DEFAULT_DIFFICULTY].topFinishRank;
export const MIN_ROUND_TYPES = ROUND_CONFIGS[DEFAULT_DIFFICULTY].minRoundTypes;
export const MAX_PER_ROUND_TYPE = 2;
export const MAX_GENERAL_TRADE = 2;
export const MAX_TOTAL_TRADE = 3;
export const MAX_BOARD_WINNER_GLOBAL_RANK = 30;

const ROUND_TYPE_OVERRIDES: Record<string, string> = {
  exports: "Trade",
  imports: "Trade",
  exportsShare: "Trade",
};

const SIMILARITY_GROUPS: Record<string, string> = {
  gdp: "gdp", gdpPc: "gdp", gdpGrowth: "gdp",
  urban: "settlement-share", rural: "settlement-share",
  population: "population-count", urbanAbsolute: "population-count", ruralAbsolute: "population-count",
  older: "population-age", young: "population-age",
  forestArea: "forest", forestPct: "forest", leastForest: "forest",
  agLand: "agricultural-land", agLandArea: "agricultural-land",
  arablePct: "arable-land", arableHa: "arable-land",
  rain: "rainfall", dry: "rainfall",
  renewable: "renewable-energy", renewableConsumption: "renewable-energy",
  mobile: "telecom-subscriptions", fixedBroadband: "telecom-subscriptions", fixedTelephone: "telecom-subscriptions",
  airPassengers: "air-transport", airFreight: "air-transport",
  rail: "rail-transport", railFreight: "rail-transport",
  cerealProduction: "cereal", cerealYield: "cereal",
  co2Total: "emissions", co2PerCapita: "emissions", methane: "emissions",
  militarySpend: "military-spending", militaryShare: "military-spending",
  imports: "general-imports", merchImports: "general-imports",
  exports: "general-exports", merchExports: "general-exports", exportsShare: "general-exports",
  foodExportsShare: "food-trade", foodImportsShare: "food-trade",
  oilRents: "resource-rents", gasRents: "resource-rents", mineralRents: "resource-rents",
  basicWater: "drinking-water-access",
};

const COMMODITY_WORDS = [
  "coffee", "tea", "rice", "wheat", "cocoa", "chocolate", "banana", "wine", "crude oil", "gold",
  "corn", "barley", "soybean", "potato", "cassava", "sugarcane", "cotton", "tobacco", "apple",
  "orange", "lemon", "grape", "avocado", "pineapple", "coconut", "peanut", "sesame", "sunflower",
];

export function roundType(category: Category) {
  return category.roundType ?? ROUND_TYPE_OVERRIDES[category.id] ?? category.family;
}

function faostatItemCode(category: Category) {
  if (category.source !== "faostat") return null;
  const value = category.warehouseSourceIndicatorCode ?? category.indicator;
  const match = value.match(/QCL:'?([^:]+):/i);
  return match?.[1]?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? null;
}

export function semanticFamily(category: Category) {
  return inferSemanticProfile(category).family;
}

export function strategyFamily(category: Category) {
  return category.strategyFamily?.trim() || inferSemanticProfile(category).family;
}

export function broadDomain(category: Category) {
  return categoryBroadDomain(category);
}

export function knowledgeCluster(category: Category) {
  return categoryKnowledgeCluster(category);
}

export function isPhysicalCategory(category: Category) {
  return broadDomain(category) === "physical-geography";
}

export function isDisplacementCategory(category: Category) {
  return knowledgeCluster(category) === "forced-displacement";
}

export function isDemographicCategory(category: Category) {
  const cluster = knowledgeCluster(category);
  const domain = broadDomain(category);
  return domain === "demographics" || [
    "population-count", "population-change", "population-age", "population-density",
    "settlement-pattern", "urbanization", "migration-stock"
  ].includes(cluster);
}

export function isReligionCategory(category: Category) {
  return knowledgeCluster(category) === "religious-composition";
}

export function isFoodConsumptionCategory(category: Category) {
  return knowledgeCluster(category) === "food-consumption" || category.source === "faostatfbs";
}

export function similarityGroup(category: Category) {
  const faoItem = faostatItemCode(category);
  if (faoItem) return `faostat-item-${faoItem}`;
  return category.similarityGroup ?? SIMILARITY_GROUPS[category.id] ?? `indicator:${category.indicator}`;
}

function commodityKey(category: Category) {
  const text = `${category.name} ${category.shortName}`.toLowerCase().replace(/-/g, " ");
  const word = COMMODITY_WORDS.find((candidate) => text.includes(candidate));
  return word ? word.replace(/\s+/g, "-") : null;
}

function aggregateCluster(category: Category) {
  if (category.source !== "faostat") return null;
  const code = faostatItemCode(category) ?? "";
  const isAggregate = /^f\d+/.test(code);
  const text = category.name.toLowerCase();
  let cluster: string | null = null;
  if (/cereal|wheat|corn|maize|rice|barley|oats|millet|sorghum/.test(text)) cluster = "cereals";
  else if (/fruit|apple|orange|lemon|lime|grape|banana|mango|guava|mangosteen|avocado|pineapple|apricot|peach|nectarine|pear|plum|cherr|fig|grapefruit|pomelo|mandarin|tangerine|strawberr|watermelon|melon/.test(text)) cluster = "fruit";
  else if (/vegetable|tomato|cabbage|carrot|turnip|cucumber|gherkin|pepper|onion|shallot|lettuce|chicory|cauliflower|broccoli|eggplant|pumpkin|squash|gourd|pea|mushroom|truffle/.test(text)) cluster = "vegetables";
  else if (/pulse|bean|pea/.test(text)) cluster = "pulses";
  else if (/root|tuber|potato|cassava/.test(text)) cluster = "roots-tubers";
  return cluster ? { cluster, isAggregate } : null;
}

export function isTradeCategory(category: Category) {
  return roundType(category) === "Trade" || category.productSpecificTrade === true;
}

export function isGeneralTradeCategory(category: Category) {
  return roundType(category) === "Trade" && category.productSpecificTrade !== true;
}

export function isAgricultureCategory(category: Category) {
  return category.source === "faostat" || ["Agriculture", "Crops", "Fruit", "Vegetables", "Livestock", "Dairy"].includes(category.family);
}

export function measureKind(category: Category) {
  if (category.normalizationType === "per-person") return "per-person";
  if (category.normalizationType === "percentage") return "percentage";
  if (category.normalizationType === "rate" || category.normalizationType === "per-area") return "rate";
  if (["total", "count", "physical"].includes(category.measureType ?? "")) return "total";
  if (category.measureType === "share") return "percentage";
  if (category.measureType === "rate") return "rate";
  if (category.measureType === "index") return "index";
  const unit = category.unit.toLowerCase();
  if (/per (person|capita)/.test(unit)) return "per-person";
  if (/per 100|per 1,000|per 100,000/.test(unit)) return "rate";
  if (/%|percent/.test(unit)) return "percentage";
  return "other";
}

function hasAggregateConflict(selected: Category[], category: Category) {
  const next = aggregateCluster(category);
  if (!next) return false;
  return selected.some((item) => {
    const prior = aggregateCluster(item);
    return prior?.cluster === next.cluster && (prior.isAggregate || next.isAggregate);
  });
}

function hasCommodityConflict(selected: Category[], category: Category) {
  const next = commodityKey(category);
  if (!next) return false;
  return selected.some((item) => {
    if (commodityKey(item) !== next) return false;
    return item.source !== category.source || isTradeCategory(item) !== isTradeCategory(category);
  });
}

export function canAddCategory(selected: Category[], category: Category, config: RoundConfig = ROUND_CONFIGS.normal) {
  // computed_playable_v16 is authoritative. Application code may reject a
  // malformed loaded dataset, but it must not recreate a hidden quality tier.
  if (category.enabled === false) return false;
  const type = roundType(category);
  if (selected.filter((item) => roundType(item) === type).length >= MAX_PER_ROUND_TYPE) return false;
  const group = similarityGroup(category);
  if (selected.some((item) => similarityGroup(item) === group)) return false;
  if (selected.some((item) => semanticConflict(item, category))) return false;
  const domain = broadDomain(category);
  if (selected.filter((item) => broadDomain(item) === domain).length >= config.maxBroadDomain) return false;
  if (selected.filter((item) => item.source === category.source).length >= config.maxSameSource) return false;
  if (category.source === "faostat" && selected.filter((item) => item.source === "faostat").length >= config.maxFaostatCategories) return false;
  if (isAgricultureCategory(category) && selected.filter(isAgricultureCategory).length >= config.maxAgricultureCategories) return false;
  if (isReligionCategory(category) && selected.filter(isReligionCategory).length >= 1) return false;
  if (isFoodConsumptionCategory(category) && selected.filter(isFoodConsumptionCategory).length >= 1) return false;
  if (isGeneralTradeCategory(category) && selected.filter(isGeneralTradeCategory).length >= MAX_GENERAL_TRADE) return false;
  if (isTradeCategory(category) && selected.filter(isTradeCategory).length >= MAX_TOTAL_TRADE) return false;
  if (hasAggregateConflict(selected, category) || hasCommodityConflict(selected, category)) return false;
  return true;
}

export function roundHasRequiredDiversity(categories: Category[], config: RoundConfig = ROUND_CONFIGS.normal) {
  if (categories.length !== config.categoryCount) return false;
  const types = new Set(categories.map(roundType));
  if (types.size < config.minRoundTypes) return false;
  for (const domain of new Set(categories.map(broadDomain))) {
    if (categories.filter((category) => broadDomain(category) === domain).length > config.maxBroadDomain) return false;
  }
  if (categories.filter(isGeneralTradeCategory).length > MAX_GENERAL_TRADE) return false;
  if (categories.filter(isTradeCategory).length > MAX_TOTAL_TRADE) return false;
  if (categories.filter((category) => category.source === "faostat").length > config.maxFaostatCategories) return false;
  if (categories.filter(isAgricultureCategory).length > config.maxAgricultureCategories) return false;
  if (categories.filter(isReligionCategory).length > 1) return false;
  if (categories.filter(isFoodConsumptionCategory).length > 1) return false;
  for (const source of new Set(categories.map((category) => category.source))) {
    if (categories.filter((category) => category.source === source).length > config.maxSameSource) return false;
  }
  if (new Set(categories.map(similarityGroup)).size !== categories.length) return false;
  for (let first = 0; first < categories.length; first += 1) {
    for (let second = first + 1; second < categories.length; second += 1) {
      if (semanticConflict(categories[first], categories[second])) return false;
    }
  }
  for (let index = 0; index < categories.length; index += 1) {
    if (!canAddCategory(categories.slice(0, index), categories[index], config)) return false;
  }
  return true;
}

export function roundHasCountryDiversity(countries: Array<{ continent: string }>, config: RoundConfig) {
  const counts = new Map<string, number>();
  for (const country of countries) {
    const next = (counts.get(country.continent) ?? 0) + 1;
    if (next > config.maxCountriesPerContinent) return false;
    counts.set(country.continent, next);
  }
  return true;
}

export function strongestGlobalWinnerRank(coverage: number) {
  return Math.min(MAX_BOARD_WINNER_GLOBAL_RANK, Math.max(1, Math.floor(coverage)));
}

export function configForDimensions(categoryCount: number, countryCount: number): RoundConfig | null {
  return Object.values(ROUND_CONFIGS).find((config) => config.categoryCount === categoryCount && config.countryCount === countryCount) ?? null;
}

export function pointsForBankSize(countryCount: number) {
  const config = Object.values(ROUND_CONFIGS).find((item) => item.countryCount === countryCount);
  return config?.pointsByRank ?? ROUND_CONFIGS.expert.pointsByRank;
}

export function difficultyFromPath(pathname: string): DailyDifficulty {
  if (pathname.includes("/expert")) return "expert";
  if (pathname.includes("/adventurer") || pathname.includes("/normal") || pathname === "/random") return "normal";
  return "easy";
}
