import type { Category } from "./categories";
import { broadDomain, semanticFamily, knowledgeCluster, type DailyDifficulty } from "./gameRules";
import { subsetExposureBoost } from "./categoryEligibility";

/**
 * Macro-domains are intentionally broader than semantic families, but narrower
 * than the old seven-bucket model. They exist to expose catalog/generator
 * imbalance instead of hiding history, religion/culture and sports inside
 * catch-all buckets.
 */
export type WorldKnowledgeBucket =
  | "history"
  | "government-civics"
  | "culture-language-religion"
  | "sports"
  | "physical-geography"
  | "geology-natural-hazards"
  | "climate-environment-resources"
  | "health-demographics"
  | "education-labor-society"
  | "infrastructure-technology-science"
  | "economy-finance"
  | "trade"
  | "food-agriculture";

export type GenerationPriority = "anchor" | "standard" | "specialty";

export type CategoryExposure = {
  category: Record<string, number>;
  family: Record<string, number>;
  bucket: Record<string, number>;
};

export const EMPTY_CATEGORY_EXPOSURE: CategoryExposure = { category: {}, family: {}, bucket: {} };

const UNDERREPRESENTED_BUCKET_BOOST: Partial<Record<WorldKnowledgeBucket, number>> = {
  history: 5.5,
  "government-civics": 3.5,
  "culture-language-religion": 4.5,
  sports: 6,
  "physical-geography": 3.5,
  "geology-natural-hazards": 3.5,
  "climate-environment-resources": 1.5,
  "health-demographics": 1.25,
  "infrastructure-technology-science": 1.25,
  "economy-finance": -1.5,
  trade: -2.5,
  "food-agriculture": -3,
};

export function worldKnowledgeBucket(category: Category): WorldKnowledgeBucket {
  const domain = broadDomain(category);
  const cluster = knowledgeCluster(category);
  const family = category.family.toLowerCase();
  const text = `${domain} ${cluster} ${family} ${category.name} ${category.shortName}`.toLowerCase();

  if (/\bsport|world cup|fifa|olympic|paralympic|football|soccer\b/.test(text) || domain === "sports") return "sports";
  if (domain === "history" || /histor|chronolog|suffrage|independence|constitution-year|admission-date|milestone/.test(text)) return "history";
  if (["government", "politics", "civics"].includes(domain) || /government|parliament|election|constitution|civic|politic/.test(text)) return "government-civics";
  if (["religion", "culture", "language"].includes(domain) || /relig|language|culture|heritage|ethnolingu|linguistic/.test(text)) return "culture-language-religion";
  if (["geology", "natural-hazards"].includes(domain) || /geolog|volcan|earthquake|tsunami|seismic|tectonic/.test(text)) return "geology-natural-hazards";
  if (["physical-geography", "geography", "land"].includes(domain) || /geograph|terrain|elevation|coast|river|lake|border|neighbor|glaciat/.test(text)) return "physical-geography";
  if (["climate", "environment", "energy", "resources", "freshwater"].includes(domain) || /climate|environment|freshwater|water-resource|energy|resource|forest|emission/.test(text)) return "climate-environment-resources";
  if (["demographics", "health", "population", "displacement"].includes(domain) || /population|demograph|health|mortality|fertility|migration|displacement|refugee|asylum/.test(text)) return "health-demographics";
  if (["education", "labor", "society"].includes(domain) || /education|school|literacy|labor|labour|employment|social/.test(text)) return "education-labor-society";
  if (["infrastructure", "transport", "technology", "knowledge", "science"].includes(domain) || /infrastructure|transport|telecom|technology|internet|science|research|patent/.test(text)) return "infrastructure-technology-science";
  if (domain === "trade" || /export|import|trade|comtrade/.test(text)) return "trade";
  if (["agriculture", "food", "food-consumption", "crops", "livestock"].includes(domain) || /agric|crop|livestock|dairy|fruit|vegetable|food-consumption|food balance/.test(text)) return "food-agriculture";
  return "economy-finance";
}

/** Player appeal is separate from data validity; this only affects exposure. */
export function generationPriority(category: Category): GenerationPriority {
  const understand = category.immediateComprehensionScore ?? category.understandabilityScore ?? 82;
  const interest = category.gameplayInterestScore ?? category.funScore ?? 82;
  const uniqueness = category.uniquenessScore ?? 80;
  const text = `${category.name} ${category.shortName} ${category.semanticTopic ?? ""}`.toLowerCase();

  if (
    (understand >= 90 && interest >= 90 && uniqueness >= 72)
    || /\b(population|gdp|life expectancy|fertility|rain|temperature|world cup|olympic|volcano|earthquake|coastline|neighbor|religion|forest|oil|internet|military|refugee|suffrage|independence)\b/.test(text)
  ) return "anchor";
  if (understand < 76 || interest < 74 || /secondary income|primary income|financial account|net errors|imf repurchases|technical cooperation/.test(text)) return "specialty";
  return "standard";
}

export function priorityScore(category: Category, difficulty: DailyDifficulty) {
  const priority = generationPriority(category);
  const bucketBoost = UNDERREPRESENTED_BUCKET_BOOST[worldKnowledgeBucket(category)] ?? 0;
  const difficultyWeight = difficulty === "easy" ? 1 : difficulty === "normal" ? .8 : .55;
  const base = difficulty === "easy"
    ? (priority === "anchor" ? 8 : priority === "standard" ? 2 : -5)
    : difficulty === "normal"
      ? (priority === "anchor" ? 5 : priority === "standard" ? 2 : -2)
      : (priority === "anchor" ? 2.5 : priority === "standard" ? 1.5 : .5);
  return base + bucketBoost * difficultyWeight;
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
  return exact * 1.4 + family * .34 + bucket * .045;
}

export function bucketSpreadScore(categories: Category[]) {
  const counts = new Map<WorldKnowledgeBucket, number>();
  for (const category of categories) {
    const bucket = worldKnowledgeBucket(category);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const distinct = counts.size;
  const max = Math.max(0, ...counts.values());
  return distinct * 2.5 - Math.max(0, max - 2) * 3.1;
}

/**
 * Deterministic top-level fair-exposure score used when selecting an anchor
 * category. Lower recent exposure is strongly preferred; quality remains a
 * tie-breaker rather than a gate that can starve an otherwise playable row.
 */
export function anchorExposureScore(category: Category, exposure?: CategoryExposure) {
  const exact = Math.max(0, exposure?.category[category.id] ?? 0);
  const family = Math.max(0, exposure?.family[semanticFamily(category)] ?? 0);
  const bucket = Math.max(0, exposure?.bucket[worldKnowledgeBucket(category)] ?? 0);
  const priority = generationPriority(category) === "anchor" ? 2.5 : generationPriority(category) === "specialty" ? -1 : 0;
  return -exact * 4.5 - family * .55 - bucket * .08 + (UNDERREPRESENTED_BUCKET_BOOST[worldKnowledgeBucket(category)] ?? 0) + priority;
}
