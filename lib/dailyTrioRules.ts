import type { Category } from "./categories";
import type { Round } from "./challengeCodec";
import { validateRound } from "./dataEngine";
import { semanticConflict } from "./categorySemantics";
import {
  DAILY_DIFFICULTIES,
  ROUND_CONFIGS,
  configForDifficultyDimensions,
  broadDomain,
  isAgricultureCategory,
  isDisplacementCategory,
  isDemographicCategory,
  isPhysicalCategory,
  isReligionCategory,
  isFoodConsumptionCategory,
  isTradeCategory,
  knowledgeCluster,
  type DailyDifficulty,
} from "./gameRules";

export type DailyTrioLike = Record<DailyDifficulty, Round>;

export const MAX_TRIO_DISPLACEMENT_CATEGORIES = 1;
export const MAX_TRIO_DEMOGRAPHIC_CATEGORIES = 2;
export const MAX_TRIO_AGRICULTURE_CATEGORIES = 3;
export const MAX_TRIO_TRADE_CATEGORIES = 3;
export const MAX_TRIO_RELIGION_CATEGORIES = 2;
export const MAX_TRIO_FOOD_CONSUMPTION_CATEGORIES = 3;
export const MAX_TRIO_EMISSIONS_CATEGORIES = 1;
export const MAX_TRIO_SERVICE_COMPOSITION_CATEGORIES = 1;

/**
 * Physical geography is a strong selection target, not a validity requirement.
 * Until the physical catalog is larger, failing to reach the target must never
 * make all three Daily modes unavailable.
 */
export const TARGET_TRIO_PHYSICAL_CATEGORIES = 2;

function isEmissionsCategory(category: Category) {
  const cluster = knowledgeCluster(category);
  return cluster === "greenhouse-gas-emissions" || cluster === "emissions";
}

function isServiceCompositionCategory(category: Category) {
  return knowledgeCluster(category) === "service-composition";
}

export function categoryConflictsWithExistingTrio(category: Category, existing: Category[]) {
  if (existing.some((other) => other.id === category.id || semanticConflict(other, category))) return true;
  if (isDisplacementCategory(category) && existing.filter(isDisplacementCategory).length >= MAX_TRIO_DISPLACEMENT_CATEGORIES) return true;
  if (isDemographicCategory(category) && existing.filter(isDemographicCategory).length >= MAX_TRIO_DEMOGRAPHIC_CATEGORIES) return true;
  if (isAgricultureCategory(category) && existing.filter(isAgricultureCategory).length >= MAX_TRIO_AGRICULTURE_CATEGORIES) return true;
  if (isTradeCategory(category) && existing.filter(isTradeCategory).length >= MAX_TRIO_TRADE_CATEGORIES) return true;
  if (isReligionCategory(category) && existing.filter(isReligionCategory).length >= MAX_TRIO_RELIGION_CATEGORIES) return true;
  if (isFoodConsumptionCategory(category) && existing.filter(isFoodConsumptionCategory).length >= MAX_TRIO_FOOD_CONSUMPTION_CATEGORIES) return true;
  if (isEmissionsCategory(category) && existing.filter(isEmissionsCategory).length >= MAX_TRIO_EMISSIONS_CATEGORIES) return true;
  if (isServiceCompositionCategory(category) && existing.filter(isServiceCompositionCategory).length >= MAX_TRIO_SERVICE_COMPOSITION_CATEGORIES) return true;
  return false;
}

export function pairwiseCountryOverlap(first: Round, second: Round) {
  const firstIds = new Set(first.bank.map((country) => country.id));
  return second.bank.filter((country) => firstIds.has(country.id)).length;
}

export function trioCategoryCounts(trio: DailyTrioLike) {
  const categories = DAILY_DIFFICULTIES.flatMap((difficulty) =>
    trio[difficulty].categories.map((dataset) => dataset.category),
  );
  const domains = new Map<string, number>();
  for (const category of categories) {
    const domain = broadDomain(category);
    domains.set(domain, (domains.get(domain) ?? 0) + 1);
  }
  return {
    categories,
    displacement: categories.filter(isDisplacementCategory).length,
    demographics: categories.filter(isDemographicCategory).length,
    agriculture: categories.filter(isAgricultureCategory).length,
    trade: categories.filter(isTradeCategory).length,
    religion: categories.filter(isReligionCategory).length,
    foodConsumption: categories.filter(isFoodConsumptionCategory).length,
    emissions: categories.filter(isEmissionsCategory).length,
    serviceComposition: categories.filter(isServiceCompositionCategory).length,
    physical: categories.filter(isPhysicalCategory).length,
    domains,
  };
}

/**
 * These are nonfatal quality signals. They are recorded in generation
 * diagnostics but are deliberately excluded from validateDailyTrio().
 */
export function dailyTrioPreferenceWarnings(trio: DailyTrioLike) {
  const counts = trioCategoryCounts(trio);
  const warnings: string[] = [];
  if (counts.physical < TARGET_TRIO_PHYSICAL_CATEGORIES) {
    warnings.push(
      `The Daily trio contains ${counts.physical} physical-geography categor${counts.physical === 1 ? "y" : "ies"}; ${TARGET_TRIO_PHYSICAL_CATEGORIES} remain the preferred target.`,
    );
  }
  const largestDomain = Math.max(0, ...counts.domains.values());
  if (largestDomain > 6) {
    warnings.push(`One broad domain appears ${largestDomain} times across the trio; greater domain variety is preferred.`);
  }
  return warnings;
}

export function validateDailyTrio(trio: DailyTrioLike, options: { allowLegacyDimensions?: boolean } = {}) {
  const errors: string[] = [];

  for (const difficulty of DAILY_DIFFICULTIES) {
    const round = trio[difficulty];
    const currentConfig = ROUND_CONFIGS[difficulty];
    const config = configForDifficultyDimensions(
      difficulty,
      round.categories.length,
      round.bank.length,
      options.allowLegacyDimensions === true,
    );
    if (!config) {
      errors.push(`${currentConfig.label} must contain ${currentConfig.categoryCount} categories and ${currentConfig.countryCount} countries.`);
      continue;
    }
    for (const error of validateRound(round.categories, round.bank)) {
      errors.push(`${config.label}: ${error}`);
    }
  }

  for (let firstIndex = 0; firstIndex < DAILY_DIFFICULTIES.length; firstIndex += 1) {
    const firstDifficulty = DAILY_DIFFICULTIES[firstIndex];
    const first = trio[firstDifficulty];
    for (let secondIndex = firstIndex + 1; secondIndex < DAILY_DIFFICULTIES.length; secondIndex += 1) {
      const secondDifficulty = DAILY_DIFFICULTIES[secondIndex];
      const second = trio[secondDifficulty];
      const overlap = pairwiseCountryOverlap(first, second);
      if (overlap > 1) {
        errors.push(`${ROUND_CONFIGS[firstDifficulty].label} and ${ROUND_CONFIGS[secondDifficulty].label} share ${overlap} countries; at most one is allowed.`);
      }
      for (const firstDataset of first.categories) {
        for (const secondDataset of second.categories) {
          if (firstDataset.category.id === secondDataset.category.id) {
            errors.push(`${firstDataset.category.name} appears in more than one Daily mode.`);
          } else if (semanticConflict(firstDataset.category, secondDataset.category)) {
            errors.push(`${firstDataset.category.name} and ${secondDataset.category.name} are too conceptually similar to appear across Daily modes.`);
          }
        }
      }
    }
  }

  const counts = trioCategoryCounts(trio);
  if (counts.displacement > MAX_TRIO_DISPLACEMENT_CATEGORIES) {
    errors.push(`The Daily trio uses ${counts.displacement} forced-displacement categories; at most ${MAX_TRIO_DISPLACEMENT_CATEGORIES} is allowed.`);
  }
  if (counts.demographics > MAX_TRIO_DEMOGRAPHIC_CATEGORIES) {
    errors.push(`The Daily trio uses ${counts.demographics} population, demographic, or settlement categories; at most ${MAX_TRIO_DEMOGRAPHIC_CATEGORIES} is allowed.`);
  }
  if (counts.agriculture > MAX_TRIO_AGRICULTURE_CATEGORIES) {
    errors.push(`The Daily trio uses ${counts.agriculture} agriculture categories; at most ${MAX_TRIO_AGRICULTURE_CATEGORIES} are allowed.`);
  }
  if (counts.trade > MAX_TRIO_TRADE_CATEGORIES) {
    errors.push(`The Daily trio uses ${counts.trade} trade categories; at most ${MAX_TRIO_TRADE_CATEGORIES} are allowed.`);
  }
  if (counts.religion > MAX_TRIO_RELIGION_CATEGORIES) {
    errors.push(`The Daily trio uses ${counts.religion} religion categories; at most ${MAX_TRIO_RELIGION_CATEGORIES} are allowed.`);
  }
  if (counts.foodConsumption > MAX_TRIO_FOOD_CONSUMPTION_CATEGORIES) {
    errors.push(`The Daily trio uses ${counts.foodConsumption} food-consumption categories; at most ${MAX_TRIO_FOOD_CONSUMPTION_CATEGORIES} are allowed.`);
  }
  if (counts.emissions > MAX_TRIO_EMISSIONS_CATEGORIES) {
    errors.push(`The Daily trio uses ${counts.emissions} closely related emissions categories; at most ${MAX_TRIO_EMISSIONS_CATEGORIES} is allowed.`);
  }
  if (counts.serviceComposition > MAX_TRIO_SERVICE_COMPOSITION_CATEGORIES) {
    errors.push(`The Daily trio uses ${counts.serviceComposition} service-composition categories; at most ${MAX_TRIO_SERVICE_COMPOSITION_CATEGORIES} is allowed.`);
  }

  return [...new Set(errors)];
}
