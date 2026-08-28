import { DAILY_DIFFICULTIES, ROUND_CONFIGS, type DailyDifficulty, type RoundConfig } from "./gameRules";

export type GenerationProfile = {
  name: string;
  configs: Record<DailyDifficulty, RoundConfig>;
};

type RelaxableRoundFields =
  | "minRoundTypes"
  | "maxSameSource"
  | "maxAgricultureCategories"
  | "maxFaostatCategories"
  | "maxBroadDomain";

function withGenerationCaps(
  base: RoundConfig,
  overrides: Partial<Pick<RoundConfig, RelaxableRoundFields>>,
): RoundConfig {
  return { ...base, ...overrides };
}

/**
 * Profiles are attempted from most varied to most available.
 *
 * The last profile relaxes source/domain/type preferences only. It does not
 * relax data validity, displayed-value ties, top-20 winners, distinct winners,
 * board dimensions, semantic conflicts, duplicate categories, or country
 * overlap across Daily modes.
 */
export function generationProfiles(): GenerationProfile[] {
  return [
    { name: "strict", configs: ROUND_CONFIGS },
    {
      name: "catalog-balanced",
      configs: {
        easy: withGenerationCaps(ROUND_CONFIGS.easy, {
          maxSameSource: 3,
          maxAgricultureCategories: 2,
          maxFaostatCategories: 2,
          maxBroadDomain: 2,
        }),
        normal: withGenerationCaps(ROUND_CONFIGS.normal, {
          maxSameSource: 4,
          maxAgricultureCategories: 3,
          maxFaostatCategories: 3,
          maxBroadDomain: 3,
        }),
        expert: withGenerationCaps(ROUND_CONFIGS.expert, {
          maxSameSource: 5,
          maxAgricultureCategories: 4,
          maxFaostatCategories: 4,
          maxBroadDomain: 3,
        }),
      },
    },
    {
      name: "catalog-recovery",
      configs: {
        easy: withGenerationCaps(ROUND_CONFIGS.easy, {
          minRoundTypes: 2,
          maxSameSource: 4,
          maxAgricultureCategories: 3,
          maxFaostatCategories: 3,
          maxBroadDomain: 3,
        }),
        normal: withGenerationCaps(ROUND_CONFIGS.normal, {
          minRoundTypes: 3,
          maxSameSource: 5,
          maxAgricultureCategories: 4,
          maxFaostatCategories: 4,
          maxBroadDomain: 4,
        }),
        expert: withGenerationCaps(ROUND_CONFIGS.expert, {
          minRoundTypes: 4,
          maxSameSource: 6,
          maxAgricultureCategories: 5,
          maxFaostatCategories: 5,
          maxBroadDomain: 4,
        }),
      },
    },
    {
      name: "availability-first",
      configs: {
        easy: withGenerationCaps(ROUND_CONFIGS.easy, {
          minRoundTypes: 2,
          maxSameSource: 4,
          maxAgricultureCategories: 3,
          maxFaostatCategories: 3,
          maxBroadDomain: 4,
        }),
        normal: withGenerationCaps(ROUND_CONFIGS.normal, {
          minRoundTypes: 3,
          maxSameSource: 6,
          maxAgricultureCategories: 4,
          maxFaostatCategories: 4,
          maxBroadDomain: 6,
        }),
        expert: withGenerationCaps(ROUND_CONFIGS.expert, {
          minRoundTypes: 4,
          maxSameSource: 8,
          maxAgricultureCategories: 5,
          maxFaostatCategories: 5,
          maxBroadDomain: 8,
        }),
      },
    },
  ];
}

export function sourceCapacityForProfile(
  categories: Array<{ source: string }>,
  profile: GenerationProfile,
) {
  const sourceCounts = new Map<string, number>();
  for (const category of categories) {
    sourceCounts.set(category.source, (sourceCounts.get(category.source) ?? 0) + 1);
  }

  let total = 0;
  for (const [source, count] of sourceCounts) {
    const cap = DAILY_DIFFICULTIES.reduce((sum, difficulty) => {
      const config = profile.configs[difficulty];
      const sourceCap = source === "faostat"
        ? Math.min(config.maxSameSource, config.maxFaostatCategories, config.maxAgricultureCategories)
        : config.maxSameSource;
      return sum + sourceCap;
    }, 0);
    total += Math.min(count, cap);
  }
  return total;
}
