import type { Category } from "./categories";
import type { Round } from "./challengeCodec";
import { validateRound } from "./dataEngine";
import {
  DAILY_DIFFICULTIES,
  ROUND_CONFIGS,
  broadDomain,
  isAgricultureCategory,
  isDisplacementCategory,
  isPhysicalCategory,
  isReligionCategory,
  isTradeCategory,
  type DailyDifficulty,
} from "./gameRules";

export type DailyTrioLike = Record<DailyDifficulty, Round>;

export const MAX_TRIO_DISPLACEMENT_CATEGORIES = 2;
export const MAX_TRIO_AGRICULTURE_CATEGORIES = 3;
export const MAX_TRIO_TRADE_CATEGORIES = 3;
export const MAX_TRIO_RELIGION_CATEGORIES = 2;
export const MIN_TRIO_PHYSICAL_CATEGORIES = 2;

export function categoryConflictsWithExistingTrio(category: Category, existing: Category[]) {
  if (existing.some((other) => other.id === category.id)) return true;
  if (isDisplacementCategory(category) && existing.filter(isDisplacementCategory).length >= MAX_TRIO_DISPLACEMENT_CATEGORIES) return true;
  if (isAgricultureCategory(category) && existing.filter(isAgricultureCategory).length >= MAX_TRIO_AGRICULTURE_CATEGORIES) return true;
  if (isTradeCategory(category) && existing.filter(isTradeCategory).length >= MAX_TRIO_TRADE_CATEGORIES) return true;
  if (isReligionCategory(category) && existing.filter(isReligionCategory).length >= MAX_TRIO_RELIGION_CATEGORIES) return true;
  return false;
}

export function pairwiseCountryOverlap(first: Round, second: Round) {
  const firstIds = new Set(first.bank.map((country) => country.id));
  return second.bank.filter((country) => firstIds.has(country.id)).length;
}

export function trioCategoryCounts(trio: DailyTrioLike) {
  const categories = DAILY_DIFFICULTIES.flatMap((difficulty) => trio[difficulty].categories.map((dataset) => dataset.category));
  const domains = new Map<string, number>();
  for (const category of categories) {
    const domain = broadDomain(category);
    domains.set(domain, (domains.get(domain) ?? 0) + 1);
  }
  return {
    categories,
    displacement: categories.filter(isDisplacementCategory).length,
    agriculture: categories.filter(isAgricultureCategory).length,
    trade: categories.filter(isTradeCategory).length,
    religion: categories.filter(isReligionCategory).length,
    physical: categories.filter(isPhysicalCategory).length,
    domains,
  };
}

export function validateDailyTrio(trio: DailyTrioLike) {
  const errors: string[] = [];

  for (const difficulty of DAILY_DIFFICULTIES) {
    const round = trio[difficulty];
    const config = ROUND_CONFIGS[difficulty];
    if (round.categories.length !== config.categoryCount || round.bank.length !== config.countryCount) {
      errors.push(`${config.label} must contain ${config.categoryCount} categories and ${config.countryCount} countries.`);
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
          }
        }
      }
    }
  }

  const counts = trioCategoryCounts(trio);
  if (counts.displacement > MAX_TRIO_DISPLACEMENT_CATEGORIES) {
    errors.push(`The Daily trio uses ${counts.displacement} forced-displacement categories; at most ${MAX_TRIO_DISPLACEMENT_CATEGORIES} are allowed across all modes.`);
  }
  if (counts.agriculture > MAX_TRIO_AGRICULTURE_CATEGORIES) {
    errors.push(`The Daily trio uses ${counts.agriculture} agriculture categories; at most ${MAX_TRIO_AGRICULTURE_CATEGORIES} are allowed across all modes.`);
  }
  if (counts.trade > MAX_TRIO_TRADE_CATEGORIES) {
    errors.push(`The Daily trio uses ${counts.trade} trade categories; at most ${MAX_TRIO_TRADE_CATEGORIES} are allowed across all modes.`);
  }
  if (counts.religion > MAX_TRIO_RELIGION_CATEGORIES) {
    errors.push(`The Daily trio uses ${counts.religion} religion categories; at most ${MAX_TRIO_RELIGION_CATEGORIES} are allowed across all modes.`);
  }
  if (counts.physical < MIN_TRIO_PHYSICAL_CATEGORIES) {
    errors.push(`The Daily trio contains only ${counts.physical} physical-geography categories; at least ${MIN_TRIO_PHYSICAL_CATEGORIES} are required.`);
  }

  return [...new Set(errors)];
}
