import { DAILY_DIFFICULTIES, ROUND_CONFIGS, type DailyDifficulty, type RoundConfig } from "./gameRules";

export type GenerationProfile = {
  name: string;
  configs: Record<DailyDifficulty, RoundConfig>;
};

function withGenerationCaps(
  base: RoundConfig,
  overrides: Partial<Pick<RoundConfig, "maxSameSource" | "maxAgricultureCategories" | "maxFaostatCategories" | "maxBroadDomain">>,
): RoundConfig {
  return { ...base, ...overrides };
}

export function generationProfiles(): GenerationProfile[] {
  return [
    { name: "strict", configs: ROUND_CONFIGS },
    {
      name: "catalog-balanced",
      configs: {
        easy: withGenerationCaps(ROUND_CONFIGS.easy, { maxSameSource: 3, maxAgricultureCategories: 2, maxFaostatCategories: 2, maxBroadDomain: 2 }),
        normal: withGenerationCaps(ROUND_CONFIGS.normal, { maxSameSource: 4, maxAgricultureCategories: 3, maxFaostatCategories: 3, maxBroadDomain: 2 }),
        expert: withGenerationCaps(ROUND_CONFIGS.expert, { maxSameSource: 5, maxAgricultureCategories: 4, maxFaostatCategories: 4, maxBroadDomain: 3 }),
      },
    },
    {
      name: "catalog-recovery",
      configs: {
        easy: withGenerationCaps(ROUND_CONFIGS.easy, { maxSameSource: 3, maxAgricultureCategories: 3, maxFaostatCategories: 3, maxBroadDomain: 2 }),
        normal: withGenerationCaps(ROUND_CONFIGS.normal, { maxSameSource: 4, maxAgricultureCategories: 4, maxFaostatCategories: 4, maxBroadDomain: 3 }),
        expert: withGenerationCaps(ROUND_CONFIGS.expert, { maxSameSource: 5, maxAgricultureCategories: 5, maxFaostatCategories: 5, maxBroadDomain: 3 }),
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
