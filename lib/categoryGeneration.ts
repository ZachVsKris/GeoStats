import type { Category } from "./categories";
import { broadDomain, semanticFamily, knowledgeCluster, type DailyDifficulty } from "./gameRules";
import { subsetExposureBoost } from "./categoryEligibility";

export type WorldKnowledgeBucket =
  | "people-society"
  | "economy-trade"
  | "food-agriculture"
  | "physical-geography"
  | "environment-resources"
  | "government-history"
  | "infrastructure-technology";

export type GenerationPriority = "anchor" | "standard" | "specialty";

export type CategoryExposure = {
  category: Record<string, number>;
  family: Record<string, number>;
  bucket: Record<string, number>;
};

export const EMPTY_CATEGORY_EXPOSURE: CategoryExposure = { category: {}, family: {}, bucket: {} };

/**
 * A deliberately coarse world-knowledge taxonomy. It is separate from the
 * catalog's narrower domains so raw catalog size (for example, many individual
 * crop or export categories) does not dictate the subject mix players see.
 */
export function worldKnowledgeBucket(category: Category): WorldKnowledgeBucket {
  const domain = broadDomain(category);
  const cluster = knowledgeCluster(category);
  const family = category.family.toLowerCase();

  if (["physical-geography", "geography", "climate", "geology", "natural-hazards", "land"].includes(domain)
      || /geograph|climate|geolog|hazard|terrain|elevation/.test(`${domain} ${cluster} ${family}`)) {
    return "physical-geography";
  }
  if (["demographics", "health", "education", "labor", "religion", "displacement"].includes(domain)
      || /population|demograph|relig|health|education|labor|migration|displacement/.test(`${domain} ${cluster} ${family}`)) {
    return "people-society";
  }
  if (["agriculture", "food", "food-consumption", "crops", "livestock"].includes(domain)
      || /agric|crop|livestock|dairy|fruit|vegetable|food-consumption/.test(`${domain} ${cluster} ${family}`)) {
    return "food-agriculture";
  }
  if (["environment", "energy", "resources", "freshwater"].includes(domain)
      || /environment|freshwater|water-resource|energy|resource/.test(`${domain} ${cluster} ${family}`)) {
    return "environment-resources";
  }
  if (["government", "history", "culture"].includes(domain)
      || /government|history|historical|culture|constitution|civic/.test(`${domain} ${cluster} ${family}`)) {
    return "government-history";
  }
  if (["infrastructure", "transport", "technology", "knowledge"].includes(domain)
      || /infrastructure|transport|telecom|technology|knowledge|internet/.test(`${domain} ${cluster} ${family}`)) {
    return "infrastructure-technology";
  }
  return "economy-trade";
}

/**
 * Player appeal is intentionally separate from data validity. Every category
 * reaching this function has already passed the hard catalog gates; this only
 * determines how central it should be to the game experience.
 */
export function generationPriority(category: Category): GenerationPriority {
  const understand = category.immediateComprehensionScore ?? category.understandabilityScore ?? 82;
  const interest = category.gameplayInterestScore ?? category.funScore ?? 82;
  const uniqueness = category.uniquenessScore ?? 80;
  const text = `${category.name} ${category.shortName} ${category.semanticTopic ?? ""}`.toLowerCase();

  if (
    (understand >= 90 && interest >= 90 && uniqueness >= 72)
    || /\b(population|gdp|life expectancy|fertility|rain|temperature|world cup|olympic|volcano|earthquake|coastline|neighbor|religion|forest|oil|internet|military|refugee)\b/.test(text)
  ) return "anchor";
  if (understand < 76 || interest < 74 || /secondary income|primary income|financial account|net errors|imf repurchases|technical cooperation/.test(text)) {
    return "specialty";
  }
  return "standard";
}

export function priorityScore(category: Category, difficulty: DailyDifficulty) {
  const priority = generationPriority(category);
  if (difficulty === "easy") return priority === "anchor" ? 8 : priority === "standard" ? 2 : -5;
  if (difficulty === "normal") return priority === "anchor" ? 5 : priority === "standard" ? 2 : -2;
  return priority === "anchor" ? 2.5 : priority === "standard" ? 1.5 : .5;
}

export function categorySubsetExposureBoost(category: Category, exposure?: CategoryExposure) {
  const exact = Math.max(0, exposure?.category[category.id] ?? 0);
  return subsetExposureBoost(category, exact);
}

export function categoryRecencyPenalty(category: Category, exposure?: CategoryExposure) {
  if (!exposure) return 0;
  const exact = Math.max(0, exposure.category[category.id] ?? 0);
  const family = Math.max(0, exposure.family[semanticFamily(category)] ?? 0);
  const bucket = Math.max(0, exposure.bucket[worldKnowledgeBucket(category)] ?? 0);
  // Exact repeats dominate. Families matter enough to stop commodity/variant
  // whiplash, while bucket exposure is deliberately light to avoid visible quotas.
  return exact * 1.0 + family * .28 + bucket * .055;
}

export function bucketSpreadScore(categories: Category[]) {
  const counts = new Map<WorldKnowledgeBucket, number>();
  for (const category of categories) {
    const bucket = worldKnowledgeBucket(category);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const distinct = counts.size;
  const max = Math.max(0, ...counts.values());
  return distinct * 2.2 - Math.max(0, max - 2) * 2.6;
}
