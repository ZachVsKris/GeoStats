import type { Category } from "./categories";

export type CategorySemanticProfile = {
  family: string;
  topic: string;
  broadDomain: string;
};

const STOP_WORDS = new Set([
  "highest", "lowest", "largest", "smallest", "most", "least", "fastest", "slowest",
  "rate", "ratio", "share", "amount", "number", "total", "average", "annual", "growth",
  "people", "population", "country", "countries", "relevant", "during", "year", "per",
  "of", "the", "a", "an", "and", "or", "to", "from", "by", "in", "with", "who", "are",
  "is", "as", "each", "using", "reported", "measured", "live", "new",
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
    category.description,
    category.indicator,
    category.warehouseSourceIndicatorCode,
    category.family,
  ].filter(Boolean).join(" "));
}

function contains(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function inferSemanticProfile(category: Category): CategorySemanticProfile {
  const cached = PROFILE_CACHE.get(category);
  if (cached) return cached;

  const text = searchable(category);
  const explicitFamily = category.semanticFamily?.trim();
  const explicitTopic = category.semanticTopic?.trim();
  const broadDomain = slug(category.family || category.roundType || "other") || "other";
  const finish = (profile: CategorySemanticProfile) => {
    PROFILE_CACHE.set(category, profile);
    return profile;
  };

  if (explicitFamily) {
    return finish({
      family: slug(explicitFamily),
      topic: slug(explicitTopic || category.similarityGroup || category.indicator || category.id),
      broadDomain,
    });
  }

  // Forced displacement: origin-based counts require nearly identical player reasoning,
  // as do destination/host-based counts. Keep the two directions separate.
  if (category.source === "unhcr" || contains(text, [/refugee/, /asylum/, /displacement/])) {
    if (contains(text, [/origin/, /originating/, /by-origin/])) {
      return finish({ family: "forced-displacement-origin", topic: slug(category.similarityGroup || category.id), broadDomain: "displacement" });
    }
    if (contains(text, [/hosted/, /received/, /destination/, /receiving/])) {
      return finish({ family: "forced-displacement-destination", topic: slug(category.similarityGroup || category.id), broadDomain: "displacement" });
    }
    return finish({ family: "forced-displacement", topic: slug(category.similarityGroup || category.id), broadDomain: "displacement" });
  }

  // Employment-to-population, unemployment, and labor-force participation are distinct
  // statistics but effectively the same board concept for players.
  if (contains(text, [/employment-to-population/, /employment-population/, /unemployment/, /labor-force-participation/, /labour-force-participation/])) {
    return finish({ family: "labor-market-utilization", topic: slug(category.similarityGroup || category.id), broadDomain: "labor" });
  }
  if (contains(text, [/labor-productivity/, /labour-productivity/, /productivity-growth/])) {
    return finish({ family: "labor-productivity", topic: slug(category.similarityGroup || category.id), broadDomain: "labor" });
  }
  if (contains(text, [/self-employment/, /wage-employment/, /employment-status/])) {
    return finish({ family: "employment-status", topic: slug(category.similarityGroup || category.id), broadDomain: "labor" });
  }

  if (category.source === "faostat") {
    if (contains(text, [/(^|-)yield($|-)/])) return finish({ family: "crop-yield", topic: slug(category.similarityGroup || category.id), broadDomain: "agriculture" });
    if (contains(text, [/(^|-)production($|-)/])) return finish({ family: "crop-production", topic: slug(category.similarityGroup || category.id), broadDomain: "agriculture" });
    if (contains(text, [/area-harvested/, /harvested-area/])) return finish({ family: "crop-harvested-area", topic: slug(category.similarityGroup || category.id), broadDomain: "agriculture" });
  }

  if (contains(text, [/gdp/, /gross-domestic-product/, /economic-output/])) {
    return finish({ family: "economic-output", topic: slug(category.similarityGroup || category.id), broadDomain: "economy" });
  }
  if (contains(text, [/forest-area/, /forest-cover/, /forest-percent/, /forest-share/, /least-forest/])) {
    return finish({ family: "forest-cover", topic: slug(category.similarityGroup || category.id), broadDomain: "environment" });
  }
  if (contains(text, [/urban-population/, /rural-population/, /urbanization/, /settlement-share/])) {
    return finish({ family: "settlement-share", topic: slug(category.similarityGroup || category.id), broadDomain: "population" });
  }
  if (contains(text, [/life-expectancy/])) return finish({ family: "life-expectancy", topic: slug(category.similarityGroup || category.id), broadDomain: "health" });
  if (contains(text, [/infant-mortality/])) return finish({ family: "infant-mortality", topic: slug(category.similarityGroup || category.id), broadDomain: "health" });
  if (contains(text, [/maternal-mortality/])) return finish({ family: "maternal-mortality", topic: slug(category.similarityGroup || category.id), broadDomain: "health" });
  if (contains(text, [/vaccination/, /immunization/, /measles-vaccine/])) return finish({ family: "immunization-coverage", topic: slug(category.similarityGroup || category.id), broadDomain: "health" });
  if (contains(text, [/merchandise-export/, /general-export/, /exports-share/])) return finish({ family: "general-exports", topic: slug(category.similarityGroup || category.id), broadDomain: "trade" });
  if (contains(text, [/merchandise-import/, /general-import/])) return finish({ family: "general-imports", topic: slug(category.similarityGroup || category.id), broadDomain: "trade" });

  const fallback = category.similarityGroup || category.indicator || category.id;
  return finish({ family: slug(fallback), topic: slug(fallback), broadDomain });
}

function semanticTokens(category: Category) {
  const cached = TOKEN_CACHE.get(category);
  if (cached) return cached;

  const text = [category.name, category.shortName, category.description, category.family]
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
  const containment = intersection / Math.max(1, Math.min(a.size, b.size));
  return Math.max(jaccard, containment * 0.88);
}

export const MAX_SAME_BOARD_SEMANTIC_SIMILARITY = 0.82;

export function semanticConflict(first: Category, second: Category) {
  const cached = CONFLICT_CACHE.get(first)?.get(second);
  if (cached !== undefined) return cached;

  const firstProfile = inferSemanticProfile(first);
  const secondProfile = inferSemanticProfile(second);
  const conflict = firstProfile.family === secondProfile.family
    || categorySemanticSimilarity(first, second) >= MAX_SAME_BOARD_SEMANTIC_SIMILARITY;

  const firstMap = CONFLICT_CACHE.get(first) ?? new WeakMap<Category, boolean>();
  firstMap.set(second, conflict);
  CONFLICT_CACHE.set(first, firstMap);
  const secondMap = CONFLICT_CACHE.get(second) ?? new WeakMap<Category, boolean>();
  secondMap.set(first, conflict);
  CONFLICT_CACHE.set(second, secondMap);
  return conflict;
}
