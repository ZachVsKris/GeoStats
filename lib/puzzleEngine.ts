import type { Category } from "./categories";
import { canonicalizeDataset, poolLeaderboard, validateRound } from "./dataEngine";
import { fetchServerCategory } from "./serverDataSources";
import { scoreCategoryQuality } from "./categoryQuality";
import type { Round, RoundCategory } from "./challengeCodec";
import type { CountryInfo } from "./worldBank";
import {
  DAILY_DIFFICULTIES,
  ROUND_CONFIGS,
  canAddCategory,
  measureKind,
  roundHasCountryDiversity,
  roundHasRequiredDiversity,
  roundType,
  strongestGlobalWinnerRank,
  semanticFamily,
  type DailyDifficulty,
  type RoundConfig,
} from "./gameRules";
import { categoryConflictsWithExistingTrio, validateDailyTrio } from "./dailyTrioRules";
import { loadServerPlayableCategoryCatalog } from "./serverPlayableCatalog";
import { generationProfiles, sourceCapacityForProfile } from "./generationProfiles";

export type DailyTrio = Record<DailyDifficulty, Round>;
export type ScoreBreakdown = {
  overall: number;
  quality: number;
  variety: number;
  geography: number;
  difficultyFit: number;
  competitiveness: number;
  familiarity: number;
};
export type GenerationDiagnostics = {
  eligibleDatasets: number;
  requiredDatasets: number;
  catalogSize: number;
  datasetLoadFailures: number;
  datasetLoadErrorSamples: string[];
  qualityRejections: number;
  attempts: number;
  validCandidates: Record<DailyDifficulty, number>;
  categorySelectionFailures: number;
  winnerSearchFailures: number;
  roundValidationFailures: number;
  trioValidationFailures: number;
  failureStage?: string;
  message?: string;
  lastTrioErrors?: string[];
  generationProfile?: string;
  skippedProfiles?: string[];
};

type Rng = () => number;

type CandidateLoadResult = {
  datasets: RoundCategory[];
  catalogSize: number;
  datasetLoadFailures: number;
  datasetLoadErrorSamples: string[];
  qualityRejections: number;
};

type ComposeResult = {
  round: Round | null;
  validCandidates: number;
  categorySelectionFailures: number;
  winnerSearchFailures: number;
  validationFailures: number;
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string): Rng {
  let value = hashSeed(seed);
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: Rng) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function observationValue(category: RoundCategory, countryId: string) {
  return category.byCountry.get(countryId)?.value;
}

function isBetter(category: RoundCategory, first: number, second: number) {
  return category.category.direction === "high" ? first > second : first < second;
}

function semanticFamilyForGeneration(category: Category) {
  return semanticFamily(category);
}

async function loadCandidateDatasets(seed: string, targetCount = 220): Promise<CandidateLoadResult> {
  const rng = seededRandom(`${seed}:datasets`);
  const catalog = await loadServerPlayableCategoryCatalog();
  const shuffled = shuffle(catalog, rng);
  const loaded: RoundCategory[] = [];
  const loadedIds = new Set<string>();
  const typeCounts = new Map<string, number>();
  let datasetLoadFailures = 0;
  const datasetLoadErrorSamples: string[] = [];
  let qualityRejections = 0;

  for (let offset = 0; offset < shuffled.length && loaded.length < targetCount; offset += 12) {
    const batch = shuffled.slice(offset, offset + 12).filter((category) => !loadedIds.has(category.id));
    const results = await Promise.allSettled(
      batch.map(async (category) =>
        canonicalizeDataset(await fetchServerCategory(category)),
      ),
    );
    for (const [resultIndex, result] of results.entries()) {
      if (result.status !== "fulfilled") {
        datasetLoadFailures += 1;
        if (datasetLoadErrorSamples.length < 8) {
          const category = batch[resultIndex];
          const reason =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          datasetLoadErrorSamples.push(
            `${category?.id ?? "unknown category"}: ${reason}`,
          );
        }
        continue;
      }
      const dataset = result.value;
      const quality = scoreCategoryQuality(dataset);
      if (!quality.eligible) {
        qualityRejections += 1;
        continue;
      }
      const type = roundType(dataset.category);
      // Retain breadth without letting one large source family dominate all fetches.
      if ((typeCounts.get(type) ?? 0) >= 24) continue;
      loaded.push(dataset);
      loadedIds.add(dataset.category.id);
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    }
  }

  return {
    datasets: loaded,
    catalogSize: catalog.length,
    datasetLoadFailures,
    datasetLoadErrorSamples,
    qualityRejections,
  };
}

function chooseDiverseCategories(
  available: RoundCategory[],
  rng: Rng,
  config: RoundConfig,
  existingTrioCategories: Category[] = [],
) {
  const ordered = shuffle(
    available.filter((dataset) => !categoryConflictsWithExistingTrio(dataset.category, existingTrioCategories)),
    rng,
  );
  const existingSemanticFamilies = new Set(existingTrioCategories.map((category) => semanticFamilyForGeneration(category)));
  const selected: RoundCategory[] = [];

  while (selected.length < config.categoryCount) {
    const options = ordered.filter((dataset) =>
      !selected.includes(dataset)
      && canAddCategory(selected.map((item) => item.category), dataset.category, config)
      && !categoryConflictsWithExistingTrio(dataset.category, existingTrioCategories),
    );
    if (!options.length) return null;

    const selectedTypes = new Set(selected.map((item) => roundType(item.category)));
    const selectedMeasures = new Set(selected.map((item) => measureKind(item.category)));
    const scored = options.map((dataset) => ({
      dataset,
      score:
        (selectedTypes.has(roundType(dataset.category)) ? 0 : 14)
        + (selectedMeasures.has(measureKind(dataset.category)) ? 0 : 4)
        + (existingSemanticFamilies.has(semanticFamilyForGeneration(dataset.category)) ? 0 : 7)
        + scoreCategoryQuality(dataset).score / 25
        + rng(),
    })).sort((left, right) => right.score - left.score);
    selected.push(scored[0].dataset);
  }

  return roundHasRequiredDiversity(selected.map((dataset) => dataset.category), config) ? selected : null;
}

function findDistinctWinners(
  categories: RoundCategory[],
  countries: CountryInfo[],
  rng: Rng,
  config: RoundConfig,
  overlapBanks: Set<string>[] = [],
  maxOverlap = Number.POSITIVE_INFINITY,
) {
  const countryIds = new Set(countries.map((country) => country.id));
  const countryById = new Map(countries.map((country) => [country.id, country]));
  const completeCountries = countries.filter((country) => categories.every((category) => observationValue(category, country.id) !== undefined));
  const completeIds = new Set(completeCountries.map((country) => country.id));
  const candidates = categories.map((category) => {
    const limit = strongestGlobalWinnerRank(category.ranked.length);
    return shuffle(
      category.ranked
        .filter((row) => row.globalRank <= limit)
        .map((row) => row.countryId)
        .filter((id) => countryIds.has(id) && completeIds.has(id)),
      rng,
    );
  });
  if (candidates.some((items) => !items.length)) return null;

  const order = categories.map((_, index) => index).sort((left, right) => candidates[left].length - candidates[right].length);
  const winners = new Array<string>(categories.length);
  const used = new Set<string>();
  const continentCounts = new Map<string, number>();
  let steps = 0;
  const overlapCount = (bank: Set<string>) => [...used].filter((id) => bank.has(id)).length;

  function search(depth: number): boolean {
    if (++steps > 300_000) return false;
    if (depth === order.length) return true;
    const categoryIndex = order[depth];
    const category = categories[categoryIndex];

    for (const id of candidates[categoryIndex].slice(0, 100)) {
      if (used.has(id)) continue;
      if (overlapBanks.some((bank) => bank.has(id) && overlapCount(bank) >= maxOverlap)) continue;
      const country = countryById.get(id);
      if (!country) continue;
      if ((continentCounts.get(country.continent) ?? 0) >= config.maxCountriesPerContinent) continue;
      const ownValue = observationValue(category, id);
      if (ownValue === undefined) continue;

      let valid = true;
      for (let priorDepth = 0; priorDepth < depth; priorDepth += 1) {
        const priorIndex = order[priorDepth];
        const priorCategory = categories[priorIndex];
        const priorWinner = winners[priorIndex];
        const priorOwnValue = observationValue(priorCategory, priorWinner);
        const candidateInPrior = observationValue(priorCategory, id);
        const priorInCurrent = observationValue(category, priorWinner);
        if (
          priorOwnValue === undefined
          || candidateInPrior === undefined
          || priorInCurrent === undefined
          || !isBetter(priorCategory, priorOwnValue, candidateInPrior)
          || !isBetter(category, ownValue, priorInCurrent)
        ) {
          valid = false;
          break;
        }
      }
      if (!valid) continue;

      winners[categoryIndex] = id;
      used.add(id);
      continentCounts.set(country.continent, (continentCounts.get(country.continent) ?? 0) + 1);
      if (search(depth + 1)) return true;
      used.delete(id);
      continentCounts.set(country.continent, (continentCounts.get(country.continent) ?? 1) - 1);
      winners[categoryIndex] = "";
    }
    return false;
  }

  if (!search(0)) return null;

  const decoyCandidates = shuffle(completeCountries, rng)
    .filter((country) => !used.has(country.id) && categories.every((category, index) => {
      const winnerValue = observationValue(category, winners[index]);
      const candidateValue = observationValue(category, country.id);
      return winnerValue !== undefined && candidateValue !== undefined && isBetter(category, winnerValue, candidateValue);
    }))
    .sort((left, right) =>
      overlapBanks.filter((bank) => bank.has(left.id)).length - overlapBanks.filter((bank) => bank.has(right.id)).length,
    );

  const decoys: string[] = [];
  const overlapTotals = overlapBanks.map((bank) => overlapCount(bank));
  for (const country of decoyCandidates) {
    if (overlapBanks.some((bank, index) => bank.has(country.id) && overlapTotals[index] >= maxOverlap)) continue;
    if ((continentCounts.get(country.continent) ?? 0) >= config.maxCountriesPerContinent) continue;
    decoys.push(country.id);
    continentCounts.set(country.continent, (continentCounts.get(country.continent) ?? 0) + 1);
    overlapBanks.forEach((bank, index) => { if (bank.has(country.id)) overlapTotals[index] += 1; });
    if (decoys.length === config.decoyCount) break;
  }

  return decoys.length === config.decoyCount ? { winners, decoys } : null;
}

export function scoreBoard(round: Round, config: RoundConfig): ScoreBreakdown {
  const qualities = round.categories.map((dataset) => scoreCategoryQuality(dataset).score);
  const quality = qualities.reduce((sum, value) => sum + value, 0) / Math.max(1, qualities.length);
  const familyCount = new Set(round.categories.map((dataset) => roundType(dataset.category))).size;
  const measureCount = new Set(round.categories.map((dataset) => measureKind(dataset.category))).size;
  const variety = Math.min(100, (familyCount / config.minRoundTypes) * 65 + (measureCount / Math.min(config.categoryCount, 4)) * 35);
  const continents = new Set(round.bank.map((country) => country.continent)).size;
  const geography = Math.min(100, continents * 19);
  const populationSignals = round.bank
    .map((country) => country.population)
    .filter((value): value is number => typeof value === "number" && value > 0)
    .map((value) => Math.max(0, Math.min(100, (Math.log10(value) - 5.5) / 3 * 100)));
  const familiarity = populationSignals.length
    ? populationSignals.reduce((sum, value) => sum + value, 0) / populationSignals.length
    : 50;

  const ranks: number[] = [];
  const gaps: number[] = [];
  for (const dataset of round.categories) {
    const leaderboard = poolLeaderboard(dataset, round.bank);
    if (!leaderboard.length) continue;
    ranks.push(leaderboard[0].observation.globalRank);
    if (leaderboard.length > 1) {
      const first = leaderboard[0].observation.value;
      const second = leaderboard[1].observation.value;
      gaps.push(Math.abs(first - second) / (Math.abs(first) + Math.abs(second) + 1e-9));
    }
  }
  const averageRank = ranks.reduce((sum, value) => sum + value, 0) / Math.max(1, ranks.length);
  const averageGap = gaps.reduce((sum, value) => sum + value, 0) / Math.max(1, gaps.length);
  const rankTarget = config.difficulty === "easy" ? 8 : config.difficulty === "normal" ? 16 : 24;
  const gapTarget = config.difficulty === "easy" ? 0.30 : config.difficulty === "normal" ? 0.15 : 0.07;
  const difficultyFit = Math.max(0, 100 - Math.abs(averageRank - rankTarget) * 1.8);
  const competitiveness = Math.max(0, 100 - Math.abs(averageGap - gapTarget) * 260);
  const overall = 0.28 * quality + 0.19 * variety + 0.15 * geography + 0.19 * difficultyFit + 0.14 * competitiveness + 0.05 * familiarity;

  return {
    overall: Number(overall.toFixed(1)),
    quality: Number(quality.toFixed(1)),
    variety: Number(variety.toFixed(1)),
    geography: Number(geography.toFixed(1)),
    difficultyFit: Number(difficultyFit.toFixed(1)),
    competitiveness: Number(competitiveness.toFixed(1)),
    familiarity: Number(familiarity.toFixed(1)),
  };
}

function composeRound(
  available: RoundCategory[],
  countries: CountryInfo[],
  seed: string,
  config: RoundConfig,
  existingTrioCategories: Category[] = [],
  overlapBanks: Set<string>[] = [],
  maxOverlap = Number.POSITIVE_INFINITY,
): ComposeResult {
  const rng = seededRandom(seed);
  const attempted = new Set<string>();
  let bestRound: Round | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let validCandidates = 0;
  let categorySelectionFailures = 0;
  let winnerSearchFailures = 0;
  let validationFailures = 0;

  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    const categories = chooseDiverseCategories(available, rng, config, existingTrioCategories);
    if (!categories) {
      categorySelectionFailures += 1;
      continue;
    }
    const signature = categories.map((dataset) => dataset.category.id).sort().join("|");
    if (attempted.has(signature)) continue;
    attempted.add(signature);

    const solution = findDistinctWinners(categories, countries, rng, config, overlapBanks, maxOverlap);
    if (!solution) {
      winnerSearchFailures += 1;
      continue;
    }
    const countryById = new Map(countries.map((country) => [country.id, country]));
    const bank = shuffle(
      [...solution.winners, ...solution.decoys].map((id) => countryById.get(id)).filter((country): country is CountryInfo => Boolean(country)),
      rng,
    );
    if (bank.length !== config.countryCount || !roundHasCountryDiversity(bank, config) || validateRound(categories, bank).length) {
      validationFailures += 1;
      continue;
    }

    const round = { bank, categories };
    const score = scoreBoard(round, config).overall + rng() * 0.001;
    validCandidates += 1;
    if (score > bestScore) {
      bestScore = score;
      bestRound = round;
    }
    if (validCandidates >= 80) break;
  }

  return {
    round: bestRound,
    validCandidates,
    categorySelectionFailures,
    winnerSearchFailures,
    validationFailures,
  };
}

export async function generateDailyTrio(
  countries: CountryInfo[],
  date: string,
  fixed: Partial<DailyTrio> = {},
): Promise<{ trio: DailyTrio; diagnostics: GenerationDiagnostics; scores: Record<DailyDifficulty, ScoreBreakdown> }> {
  const seed = `DAILY-TRIO-${date}`;
  const requiredDatasets = DAILY_DIFFICULTIES.reduce((sum, difficulty) => sum + ROUND_CONFIGS[difficulty].categoryCount, 0);
  const loaded = await loadCandidateDatasets(seed);
  const diagnostics: GenerationDiagnostics = {
    eligibleDatasets: loaded.datasets.length,
    requiredDatasets,
    catalogSize: loaded.catalogSize,
    datasetLoadFailures: loaded.datasetLoadFailures,
    datasetLoadErrorSamples: loaded.datasetLoadErrorSamples,
    qualityRejections: loaded.qualityRejections,
    attempts: 0,
    validCandidates: { easy: 0, normal: 0, expert: 0 },
    categorySelectionFailures: 0,
    winnerSearchFailures: 0,
    roundValidationFailures: 0,
    trioValidationFailures: 0,
  };

  if (loaded.datasets.length < requiredDatasets) {
    diagnostics.failureStage = "dataset-pool";
    diagnostics.message = `Only ${loaded.datasets.length} playable datasets loaded; ${requiredDatasets} semantically distinct datasets are required.`;
    throw Object.assign(new Error(diagnostics.message), { diagnostics });
  }

  const profiles = generationProfiles();
  diagnostics.skippedProfiles = [];

  for (const profile of profiles) {
    const sourceCapacity = sourceCapacityForProfile(loaded.datasets.map((dataset) => dataset.category), profile);
    if (sourceCapacity < requiredDatasets) {
      diagnostics.skippedProfiles.push(`${profile.name}: source capacity ${sourceCapacity}/${requiredDatasets}`);
      continue;
    }

    for (let attempt = 0; attempt < 120; attempt += 1) {
      diagnostics.attempts += 1;
      const rounds: Partial<DailyTrio> = { ...fixed };

      for (const difficulty of ["expert", "normal", "easy"] as DailyDifficulty[]) {
        if (rounds[difficulty]) continue;
        const existingRounds = DAILY_DIFFICULTIES
          .map((key) => rounds[key])
          .filter((round): round is Round => Boolean(round));
        const existingCategories = existingRounds.flatMap((round) => round.categories.map((dataset) => dataset.category));
        const overlapBanks = existingRounds.map((round) => new Set(round.bank.map((country) => country.id)));
        const result = composeRound(
          loaded.datasets,
          countries,
          `${seed}:${profile.name}:${difficulty}:${attempt}`,
          profile.configs[difficulty],
          existingCategories,
          overlapBanks,
          1,
        );
        diagnostics.validCandidates[difficulty] += result.validCandidates;
        diagnostics.categorySelectionFailures += result.categorySelectionFailures;
        diagnostics.winnerSearchFailures += result.winnerSearchFailures;
        diagnostics.roundValidationFailures += result.validationFailures;
        if (!result.round) break;
        rounds[difficulty] = result.round;
      }

      if (!rounds.easy || !rounds.normal || !rounds.expert) continue;
      const trio = rounds as DailyTrio;
      const trioErrors = validateDailyTrio(trio);
      if (trioErrors.length) {
        diagnostics.trioValidationFailures += 1;
        diagnostics.lastTrioErrors = trioErrors.slice(0, 12);
        continue;
      }

      diagnostics.generationProfile = profile.name;
      return {
        trio,
        diagnostics,
        scores: {
          easy: scoreBoard(trio.easy, profile.configs.easy),
          normal: scoreBoard(trio.normal, profile.configs.normal),
          expert: scoreBoard(trio.expert, profile.configs.expert),
        },
      };
    }
  }

  diagnostics.failureStage = "trio-constraints";
  diagnostics.message = "No Daily trio satisfied within-board semantic diversity, top-30 winner, distinct-winner, complete-data, source-balance fallback, and one-country-overlap rules.";
  throw Object.assign(new Error(diagnostics.message), { diagnostics });
}
