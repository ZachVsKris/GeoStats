import type { Category } from "./categories";
import type { Round } from "./challengeCodec";
import { validateRound } from "./dataEngine";
import { semanticConflict } from "./categorySemantics";
import { DAILY_DIFFICULTIES, ROUND_CONFIGS, type DailyDifficulty } from "./gameRules";

export type DailyTrioLike = Record<DailyDifficulty, Round>;

export function categoryConflictsWithExistingTrio(category: Category, existing: Category[]) {
  return existing.some((other) => other.id === category.id || semanticConflict(other, category));
}

export function pairwiseCountryOverlap(first: Round, second: Round) {
  const firstIds = new Set(first.bank.map((country) => country.id));
  return second.bank.filter((country) => firstIds.has(country.id)).length;
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
          } else if (semanticConflict(firstDataset.category, secondDataset.category)) {
            errors.push(`${firstDataset.category.name} and ${secondDataset.category.name} are too similar to appear in the same Daily trio.`);
          }
        }
      }
    }
  }

  return [...new Set(errors)];
}
