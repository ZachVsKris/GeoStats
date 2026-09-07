import type { Category } from "./categories";
import { categoryBroadDomain } from "./categorySemantics";

// Presentation only. These six colors do not replace the generator's finer
// semantic families, source checks, or conflict rules.
export const CATEGORY_COLOR_KEY = [
  ["theme-nature", "Nature"],
  ["theme-people", "People"],
  ["theme-culture", "Culture"],
  ["theme-food", "Food"],
  ["theme-economy", "Economy"],
  ["theme-technology", "Technology"],
] as const;

type Theme = (typeof CATEGORY_COLOR_KEY)[number][0];
const DOMAIN_THEMES: Record<string, Theme> = {
  "physical-geography": "theme-nature", geography: "theme-nature", land: "theme-nature",
  environment: "theme-nature", climate: "theme-nature", geology: "theme-nature",
  "natural-hazards": "theme-nature", resources: "theme-nature", freshwater: "theme-nature",
  demographics: "theme-people", population: "theme-people", health: "theme-people",
  education: "theme-people", labor: "theme-people", society: "theme-people", displacement: "theme-people",
  history: "theme-culture", culture: "theme-culture", religion: "theme-culture",
  language: "theme-culture", sports: "theme-culture", civics: "theme-people", politics: "theme-people",
  food: "theme-food", agriculture: "theme-food", consumption: "theme-food",
  "food-consumption": "theme-food", crops: "theme-food", livestock: "theme-food",
  economy: "theme-economy", trade: "theme-economy", finance: "theme-economy", government: "theme-economy",
  energy: "theme-technology", transport: "theme-technology", infrastructure: "theme-technology",
  technology: "theme-technology", science: "theme-technology", knowledge: "theme-technology",
};

export function categoryThemeClass(category: Category): Theme {
  // Canonical subject metadata prevents incidental words from taking over:
  // food exports stay Economy; forests stay Nature; health milestones Culture.
  const domain = categoryBroadDomain(category);
  if (domain === "government" && /prison|detainee|trial|justice|crime|election|parliament/i.test(`${category.name} ${category.semanticTopic ?? ""}`)) return "theme-people";
  return DOMAIN_THEMES[domain] ?? "theme-people";
}
