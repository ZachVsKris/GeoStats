import type { Category } from "./categories";

export type CategorySemanticProfile = {
  family: string;
  topic: string;
  broadDomain: string;
  knowledgeCluster: string;
};

const STOP_WORDS = new Set([
  "highest", "lowest", "largest", "smallest", "most", "least", "fastest", "slowest",
  "rate", "ratio", "share", "amount", "number", "total", "average", "annual", "growth",
  "people", "population", "country", "countries", "relevant", "during", "year", "per",
  "of", "the", "a", "an", "and", "or", "to", "from", "by", "in", "with", "who", "are",
  "is", "as", "each", "using", "reported", "measured", "live", "new", "mapped",
]);

const TOKEN_ALIASES: Record<string, string> = {
  unemployed: "employment",
  unemployment: "employment",
  employed: "employment",
  employment: "employment",
  labour: "labor",
  refugees: "displacement",
  refugee: "displacement",
  asylum: "displacement",
  stateless: "displacement",
  displacement: "displacement",
  applications: "applications",
  originating: "origin",
  origin: "origin",
  hosted: "destination",
  received: "destination",
  receiving: "destination",
  births: "birth",
  deaths: "mortality",
  mortality: "mortality",
  vaccination: "immunization",
  vaccinated: "immunization",
  vaccine: "immunization",
  exports: "export",
  exported: "export",
  imports: "import",
  imported: "import",
  forests: "forest",
  agricultural: "agriculture",
  crops: "crop",
  productivity: "productivity",
  subscriptions: "subscription",
  rivers: "river",
  lakes: "lake",
  borders: "border",
};

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const PROFILE_CACHE = new WeakMap<Category, CategorySemanticProfile>();
const TOKEN_CACHE = new WeakMap<Category, Set<string>>();
const CONFLICT_CACHE = new WeakMap<Category, WeakMap<Category, boolean>>();

function searchable(category: Category) {
  return slug([
    category.id,
    category.name,
    category.shortName,
    category.indicator,
    category.warehouseSourceIndicatorCode,
    category.family,
    category.semanticFamily,
    category.semanticTopic,
    category.knowledgeCluster,
  ].filter(Boolean).join(" "));
}

function contains(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function normalizedBroadDomain(category: Category) {
  if (category.broadDomain?.trim()) {
    const domain = slug(category.broadDomain);
    const repaired: Record<string, string> = {
      conomy: "economy",
      nvironment: "environment",
      nergy: "energy",
      ransport: "transport",
      echnology: "technology",
      overnment: "government",
      rade: "trade",
      emographics: "demographics",
      ealth: "health",
      griculture: "agriculture",
      ulture: "culture",
      limate: "climate",
    };
    return repaired[domain] ?? domain;
  }
  const family = slug(category.family || category.roundType || "other");
  if (["crops", "fruit", "vegetables", "livestock", "dairy", "agriculture"].includes(family)) return "agriculture";
  if (["geography", "land", "climate"].includes(family)) return "physical-geography";
  if (["population", "demographics"].includes(family)) return "demographics";
  if (["trade", "economy", "labor"].includes(family)) return family;
  if (["health", "vaccination"].includes(family)) return "health";
  return family || "other";
}

function naturalEarthProfile(text: string, category: Category, broadDomain: string): CategorySemanticProfile | null {
  const topic = slug(category.similarityGroup || category.id);
  if (contains(text, [/river/])) return { family: "physical-waterways-rivers", topic, broadDomain, knowledgeCluster: "physical-waterways" };
  if (contains(text, [/lake/])) return { family: "physical-waterways-lakes", topic, broadDomain, knowledgeCluster: "physical-waterways" };
  if (contains(text, [/glaciat/, /glacier/, /snow/])) return { family: "physical-ice", topic, broadDomain, knowledgeCluster: "physical-ice" };
  if (contains(text, [/coastline/, /coast/])) return { family: "physical-coastline", topic, broadDomain, knowledgeCluster: "physical-coastline" };
  if (contains(text, [/border/, /neighbor/])) return { family: "physical-borders", topic, broadDomain, knowledgeCluster: "physical-borders" };
  if (contains(text, [/north-south-span/, /east-west-span/, /geographic-span/])) return { family: "physical-span", topic, broadDomain, knowledgeCluster: "physical-span" };
  if (contains(text, [/northernmost/, /southernmost/, /equator/, /latitude/])) return { family: "physical-position", topic, broadDomain, knowledgeCluster: "physical-position" };
  if (contains(text, [/land-area/, /land-areas/, /continuous-land/])) return { family: "physical-land-form", topic, broadDomain, knowledgeCluster: "physical-land-form" };
  return null;
}

export function inferSemanticProfile(category: Category): CategorySemanticProfile {
  const cached = PROFILE_CACHE.get(category);
  if (cached) return cached;

  const text = searchable(category);
  const explicitFamily = category.strategyFamily?.trim() || category.semanticFamily?.trim();
  const explicitTopic = category.semanticTopic?.trim();
  const broadDomain = normalizedBroadDomain(category);
  const finish = (profile: CategorySemanticProfile) => {
    PROFILE_CACHE.set(category, profile);
    return profile;
  };

  if (category.knowledgeCluster?.trim() && explicitFamily) {
    return finish({
      family: slug(explicitFamily),
      topic: slug(explicitTopic || category.similarityGroup || category.indicator || category.id),
      broadDomain,
      knowledgeCluster: slug(category.knowledgeCluster),
    });
  }

  if (category.source === "pewreligion") {
    const family = contains(text, [/divers/]) ? "religious-diversity" : "religious-composition";
    return finish({
      family,
      topic: slug(category.similarityGroup || category.id),
      broadDomain: "culture",
      knowledgeCluster: "religious-composition",
    });
  }

  if (category.source === "smithsoniangvp") {
    return finish({
      family: contains(text, [/elevation/, /highest/]) ? "volcano-elevation" : "volcano-count",
      topic: slug(category.similarityGroup || category.id),
      broadDomain: "geology",
      knowledgeCluster: "volcanoes",
    });
  }

  if (category.source === "usgs") {
    return finish({
      family: contains(text, [/strongest/, /magnitude/]) ? "earthquake-magnitude" : "earthquake-frequency",
      topic: slug(category.similarityGroup || category.id),
      broadDomain: "natural-hazards",
      knowledgeCluster: "earthquakes",
    });
  }

  if (category.source === "worldcover") {
    return finish({
      family: "land-cover",
      topic: slug(category.similarityGroup || category.id),
      broadDomain: "physical-geography",
      knowledgeCluster: "land-cover",
    });
  }

  if (category.source === "hydrosheds") {
    return finish({
      family: contains(text, [/lake/]) ? "hydrography-lakes" : "hydrography-rivers",
      topic: slug(category.similarityGroup || category.id),
      broadDomain: "physical-geography",
      knowledgeCluster: "physical-waterways",
    });
  }

  if (category.source === "elevation") {
    return finish({
      family: "terrain-elevation",
      topic: slug(category.similarityGroup || category.id),
      broadDomain: "physical-geography",
      knowledgeCluster: "terrain-elevation",
    });
  }

  // Forced-displacement measures may have different direction-specific families,
  // but they all reward essentially the same geopolitical knowledge. The shared
  // knowledge cluster enforces the user-facing one-per-board rule.
  if (category.source === "unhcr" || contains(text, [/refugee/, /asylum/, /stateless/, /displacement/])) {
    const family = contains(text, [/origin/, /originating/, /by-origin/])
      ? "forced-displacement-origin"
      : contains(text, [/hosted/, /received/, /destination/, /receiving/])
        ? "forced-displacement-destination"
        : contains(text, [/stateless/])
          ? "statelessness"
          : "forced-displacement";
    return finish({
      family,
      topic: slug(category.similarityGroup || category.id),
      broadDomain: "displacement",
      knowledgeCluster: "forced-displacement",
    });
  }

  if (category.source === "naturalearth") {
    const physical = naturalEarthProfile(text, category, "physical-geography");
    if (physical) return finish(physical);
  }

  if (category.source === "faostat") {
    const livestock = contains(text, [/cattle/, /cow/, /buffalo/, /sheep/, /goat/, /chicken/, /duck/, /turkey/, /camel/, /horse/, /pig/, /livestock/, /meat/, /milk/, /eggs?/]);
    if (contains(text, [/(^|-)yield($|-)/])) {
      return finish({ family: livestock ? "livestock-yield" : "crop-yield", topic: slug(category.similarityGroup || category.id), broadDomain: "agriculture", knowledgeCluster: livestock ? "livestock-efficiency" : "crop-efficiency" });
    }
    if (contains(text, [/(^|-)production($|-)/])) {
      return finish({ family: livestock ? "livestock-production" : "crop-production", topic: slug(category.similarityGroup || category.id), broadDomain: "agriculture", knowledgeCluster: livestock ? "livestock-output" : "crop-output" });
    }
    if (contains(text, [/population/, /stocks?/, /animals?/])) {
      return finish({ family: "livestock-population", topic: slug(category.similarityGroup || category.id), broadDomain: "agriculture", knowledgeCluster: "livestock-population" });
    }
    if (contains(text, [/area-harvested/, /harvested-area/])) {
      return finish({ family: "crop-harvested-area", topic: slug(category.similarityGroup || category.id), broadDomain: "agriculture", knowledgeCluster: "crop-area" });
    }
  }

  if (category.source === "comtrade" || category.productSpecificTrade) {
    const topic = slug(explicitTopic || category.similarityGroup || category.indicator || category.id);
    return finish({
      family: explicitFamily ? slug(explicitFamily) : `product-export-${topic}`,
      topic,
      broadDomain: "trade",
      knowledgeCluster: "product-exports",
    });
  }

  if (contains(text, [/employment-to-population/, /employment-population/, /unemployment/, /labor-force-participation/, /labour-force-participation/, /neet/])) {
    return finish({ family: "labor-market-utilization", topic: slug(category.similarityGroup || category.id), broadDomain: "labor", knowledgeCluster: "labor-market-utilization" });
  }
  if (contains(text, [/labor-productivity/, /labour-productivity/, /productivity-growth/])) {
    return finish({ family: "labor-productivity", topic: slug(category.similarityGroup || category.id), broadDomain: "labor", knowledgeCluster: "labor-productivity" });
  }
  if (contains(text, [/self-employment/, /wage-employment/, /employment-status/, /informal-employment/])) {
    return finish({ family: "employment-status", topic: slug(category.similarityGroup || category.id), broadDomain: "labor", knowledgeCluster: "employment-status" });
  }

  if (contains(text, [/gdp/, /gross-domestic-product/, /economic-output/, /largest-economy/])) {
    return finish({ family: "economic-output", topic: slug(category.similarityGroup || category.id), broadDomain: "economy", knowledgeCluster: "economic-output" });
  }
  if (contains(text, [/forest-area/, /forest-cover/, /forest-percent/, /forest-share/, /least-forest/])) {
    return finish({ family: "forest-cover", topic: slug(category.similarityGroup || category.id), broadDomain: "environment", knowledgeCluster: "forest-cover" });
  }
  if (contains(text, [/urban-population/, /rural-population/, /urbanization/, /settlement-share/])) {
    return finish({ family: "settlement-share", topic: slug(category.similarityGroup || category.id), broadDomain: "demographics", knowledgeCluster: "population-composition" });
  }
  if (contains(text, [/older-population/, /youngest-population/, /population-age/, /age-65/, /age-0-14/])) {
    return finish({ family: "population-age", topic: slug(category.similarityGroup || category.id), broadDomain: "demographics", knowledgeCluster: "population-age" });
  }
  if (contains(text, [/population-count/, /largest-population/, /population-growth/])) {
    return finish({ family: "population-size", topic: slug(category.similarityGroup || category.id), broadDomain: "demographics", knowledgeCluster: "population-size" });
  }
  if (contains(text, [/co2/, /methane/, /greenhouse-gas/, /emissions/])) {
    return finish({ family: "emissions", topic: slug(category.similarityGroup || category.id), broadDomain: "environment", knowledgeCluster: "emissions" });
  }
  if (contains(text, [/freshwater/, /water-withdrawal/, /water-stress/, /water-resources/])) {
    return finish({ family: "freshwater", topic: slug(category.similarityGroup || category.id), broadDomain: "environment", knowledgeCluster: "freshwater" });
  }
  if (contains(text, [/tourism/, /tourist/, /tourism-revenue/, /tourist-arrival/])) {
    return finish({ family: "tourism", topic: slug(category.similarityGroup || category.id), broadDomain: "economy", knowledgeCluster: "tourism" });
  }
  if (contains(text, [/electricity-generation/, /energy-use/, /energy-consumption/, /energy-from/, /oil-share-of-electricity/])) {
    return finish({ family: "energy-system", topic: slug(category.similarityGroup || category.id), broadDomain: "energy", knowledgeCluster: "energy-system" });
  }
  if (contains(text, [/life-expectancy/])) return finish({ family: "life-expectancy", topic: slug(category.similarityGroup || category.id), broadDomain: "health", knowledgeCluster: "population-health" });
  if (contains(text, [/infant-mortality/])) return finish({ family: "infant-mortality", topic: slug(category.similarityGroup || category.id), broadDomain: "health", knowledgeCluster: "mortality" });
  if (contains(text, [/maternal-mortality/])) return finish({ family: "maternal-mortality", topic: slug(category.similarityGroup || category.id), broadDomain: "health", knowledgeCluster: "mortality" });
  if (contains(text, [/vaccination/, /immunization/, /measles-vaccine/, /hepatitis-b/])) return finish({ family: "immunization-coverage", topic: slug(category.similarityGroup || category.id), broadDomain: "health", knowledgeCluster: "immunization" });
  if (contains(text, [/merchandise-export/, /general-export/, /exports-share/])) return finish({ family: "general-exports", topic: slug(category.similarityGroup || category.id), broadDomain: "trade", knowledgeCluster: "aggregate-trade" });
  if (contains(text, [/merchandise-import/, /general-import/])) return finish({ family: "general-imports", topic: slug(category.similarityGroup || category.id), broadDomain: "trade", knowledgeCluster: "aggregate-trade" });
  if (contains(text, [/school/, /education/, /literacy/, /learning/, /completion/])) return finish({ family: explicitFamily ? slug(explicitFamily) : "education-outcomes", topic: slug(category.similarityGroup || category.id), broadDomain: "education", knowledgeCluster: "education-outcomes" });
  if (contains(text, [/broadband/, /mobile-subscription/, /telephone-subscription/, /internet/])) return finish({ family: "telecommunications", topic: slug(category.similarityGroup || category.id), broadDomain: "technology", knowledgeCluster: "telecommunications-adoption" });

  const fallback = explicitFamily || category.similarityGroup || category.indicator || category.id;
  const family = slug(fallback);
  return finish({
    family,
    topic: slug(explicitTopic || fallback),
    broadDomain,
    knowledgeCluster: slug(category.knowledgeCluster || family),
  });
}

function semanticTokens(category: Category) {
  const cached = TOKEN_CACHE.get(category);
  if (cached) return cached;

  const text = [category.name, category.shortName, category.indicator, category.semanticTopic, category.family]
    .filter(Boolean)
    .join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const tokens = text.match(/[a-z0-9]+/g) ?? [];
  const result = new Set(tokens
    .map((token) => TOKEN_ALIASES[token] ?? token)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token)));
  TOKEN_CACHE.set(category, result);
  return result;
}

export function categorySemanticSimilarity(first: Category, second: Category) {
  const a = semanticTokens(first);
  const b = semanticTokens(second);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = new Set([...a, ...b]).size;
  const jaccard = union ? intersection / union : 0;
  const dice = (2 * intersection) / Math.max(1, a.size + b.size);
  // A short title being wholly contained in a longer, unrelated title used to
  // generate a misleading 88% warning. Jaccard/Dice reward shared substance
  // without treating one common token set as near-duplication by itself.
  return Math.max(jaccard, dice * 0.92);
}

export const MAX_SAME_BOARD_SEMANTIC_SIMILARITY = 0.82;

// These clusters describe one underlying concept with several closely related
// cuts. They are hard one-per-board and one-per-Daily-trio conflicts even when
// the narrower strategyFamily differs (for example, temperate vs savanna).
const HARD_CONFLICT_KNOWLEDGE_CLUSTERS = new Set([
  "climate-classification",
  "emissions",
  "forced-displacement",
  "physical-ice",
  "religious-composition",
  "service-composition",
  "telecommunications-adoption",
]);

/**
 * Normalizes concepts whose imported metadata is intentionally specific to one
 * indicator. These buckets are broader than strategyFamily: they represent
 * knowledge a player would experience as the same question appearing twice in
 * one board or Daily trio.
 */
function hardConflictConcept(category: Category, profile: CategorySemanticProfile) {
  const text = searchable(category);
  const cluster = slug(category.knowledgeCluster || profile.knowledgeCluster);

  if (contains(text, [/border/, /neighbor/])) return "physical-borders";
  if (contains(text, [/glaciat/, /glacier/, /snow-cover/, /permanent-snow/])) return "physical-ice";
  if (contains(text, [/mobile-subscription/, /telephone-subscription/, /fixed-broadband/, /internet-subscription/])
    || cluster === "telecommunications-adoption") return "telecommunications-adoption";

  if (category.source === "comtrade" || category.productSpecificTrade) {
    return contains(text, [/import/]) ? "product-imports" : "product-exports";
  }

  if (category.source === "faostat") {
    const livestock = contains(text, [
      /livestock/, /cattle/, /cow/, /buffalo/, /sheep/, /goat/, /chicken/, /duck/,
      /turkey/, /camel/, /horse/, /mule/, /hinny/, /pig/, /animal/, /meat/, /milk/, /egg/,
    ]);
    if (livestock && contains(text, [/population/, /stocks?/])) return "livestock-population";
    if (livestock && contains(text, [/production/, /produced/, /output/])) return "livestock-output";
    if (!livestock && contains(text, [/production/, /produced/, /output/])) return "crop-output";
    if (!livestock && contains(text, [/area-harvested/, /harvested-area/])) return "crop-area";
  }

  return HARD_CONFLICT_KNOWLEDGE_CLUSTERS.has(cluster) ? cluster : null;
}

export function semanticConflict(first: Category, second: Category) {
  const cached = CONFLICT_CACHE.get(first)?.get(second);
  if (cached !== undefined) return cached;

  const firstProfile = inferSemanticProfile(first);
  const secondProfile = inferSemanticProfile(second);
  const firstStrategy = slug(first.strategyFamily || firstProfile.family);
  const secondStrategy = slug(second.strategyFamily || secondProfile.family);
  const firstConcept = hardConflictConcept(first, firstProfile);
  const secondConcept = hardConflictConcept(second, secondProfile);
  const firstSimilarityGroup = slug(first.similarityGroup || "");
  const secondSimilarityGroup = slug(second.similarityGroup || "");
  // Title similarity is an editorial warning, not a hard gameplay conflict.
  // Hard conflicts must be grounded in an explicit strategy family or other
  // structured semantic metadata; common words such as “Most” must not block
  // unrelated categories.
  const conflict = firstStrategy === secondStrategy
    || (Boolean(firstConcept) && firstConcept === secondConcept)
    || (Boolean(firstSimilarityGroup) && firstSimilarityGroup === secondSimilarityGroup);

  const firstMap = CONFLICT_CACHE.get(first) ?? new WeakMap<Category, boolean>();
  firstMap.set(second, conflict);
  CONFLICT_CACHE.set(first, firstMap);
  const secondMap = CONFLICT_CACHE.get(second) ?? new WeakMap<Category, boolean>();
  secondMap.set(first, conflict);
  CONFLICT_CACHE.set(second, secondMap);
  return conflict;
}

export function categoryBroadDomain(category: Category) {
  return inferSemanticProfile(category).broadDomain;
}

export function categoryKnowledgeCluster(category: Category) {
  return inferSemanticProfile(category).knowledgeCluster;
}
