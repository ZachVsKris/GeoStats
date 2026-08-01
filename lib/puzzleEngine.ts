import type { Category } from "./categories";
import { canonicalizeDataset, poolLeaderboard, validateRound } from "./dataEngine";
import { fetchServerWarehouseCategories } from "./serverWarehouseCategories";
import { scoreCategoryQuality } from "./categoryQuality";
import type { Round, RoundCategory } from "./challengeCodec";
import type { CountryInfo } from "./worldBank";
import {
  DAILY_DIFFICULTIES,
  ROUND_CONFIGS,
  broadDomain,
  canAddCategory,
  isPhysicalCategory,
  knowledgeCluster,
  measureKind,
  roundHasCountryDiversity,
  roundHasRequiredDiversity,
  roundType,
  strongestGlobalWinnerRank,
  type DailyDifficulty,
  type RoundConfig,
} from "./gameRules";
import {
  categoryConflictsWithExistingTrio,
  dailyTrioPreferenceWarnings,
  pairwiseCountryOverlap,
  validateDailyTrio,
} from "./dailyTrioRules";
import { loadServerPlayableCategoryCatalog } from "./serverPlayableCatalog";
import { generationProfiles } from "./generationProfiles";
import { candidateKeepsDisplayedValuesDistinct } from "./roundValueRules";

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
  preferenceWarnings?: string[];
  candidateSources?: Record<string, number>;
};

type Rng = () => number;
export type LoadedPuzzleCatalog = {
  datasets: RoundCategory[];
  catalogSize: number;
  datasetLoadFailures: number;
  datasetLoadErrorSamples: string[];
  qualityRejections: number;
  candidateSources: Record<string, number>;
};
type RoundCandidate = { round: Round; score: number };
type CandidateResult = {
  candidates: RoundCandidate[];
  categorySelectionFailures: number;
  winnerSearchFailures: number;
  validationFailures: number;
};

const GENERATION_BUDGET_MS = 60_000;
const PROFILE_MINIMUM_BUDGET_MS = 10_000;
const MAX_CATEGORY_SEARCH_STEPS = 30_000;
const MAX_WINNER_SEARCH_STEPS = 180_000;
const MAX_WINNER_CANDIDATES_PER_CATEGORY = 80;
const ROUND_CANDIDATE_TARGET = 14;
const ROUND_COMPOSITION_ATTEMPTS = 120;
const MAX_TRIO_COMBINATIONS = 18_000;

let loadedDatasetPromise: Promise<LoadedPuzzleCatalog> | undefined;
let loadedDatasetExpiresAt = 0;

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

async function loadCandidateDatasets(): Promise<LoadedPuzzleCatalog> {
  if (loadedDatasetPromise && Date.now() < loadedDatasetExpiresAt) return loadedDatasetPromise;
  loadedDatasetPromise = (async () => {
    const catalog = await loadServerPlayableCategoryCatalog();
    // Load the complete approved catalog. The old 180-row sampling could silently
    // remove every FAOSTAT category and other smaller sources.
    const bulk = await fetchServerWarehouseCategories(catalog);
    const loaded: RoundCategory[] = [];
    let qualityRejections = 0;
    const candidateSources: Record<string, number> = {};

    for (const rawDataset of bulk.datasets) {
      try {
        const dataset = canonicalizeDataset(rawDataset);
        // Database computed_playable_v16 is the single category-quality gate.
        // Runtime loading may reject malformed/no-data datasets, but it must not
        // silently recreate a stricter Daily-only tier in application code.
        loaded.push(dataset);
        candidateSources[dataset.category.source] = (candidateSources[dataset.category.source] ?? 0) + 1;
      } catch {
        qualityRejections += 1;
      }
    }

    return {
      datasets: loaded,
      catalogSize: catalog.length,
      datasetLoadFailures: bulk.errors.length,
      datasetLoadErrorSamples: bulk.errors.slice(0, 20).map((error) => `${error.categoryId}: ${error.message}`),
      qualityRejections,
      candidateSources,
    };
  })().then((loaded) => {
    loadedDatasetExpiresAt = Date.now() + 5 * 60 * 1000;
    return loaded;
  }).catch((error) => {
    loadedDatasetPromise = undefined;
    loadedDatasetExpiresAt = 0;
    throw error;
  });
  return loadedDatasetPromise;
}

function datasetHasEnoughDisplayedVariety(dataset: RoundCategory, config: RoundConfig) {
  const quality = scoreCategoryQuality(dataset);
  const minimumDistinct = Math.max(config.countryCount + 4, config.categoryCount + 6);
  const category = dataset.category;
  if (category.rankingCompletenessStatus === "non_comprehensive") return false;
  if (category.topValueFeasible === false) return false;
  if (category.topValueDistinctCount != null && category.topValueDistinctCount < config.countryCount) return false;
  return quality.distinctDisplayValues >= minimumDistinct;
}

function optionScore(selected: RoundCategory[], dataset: RoundCategory, rng: Rng) {
  const category = dataset.category;
  const selectedTypes = new Set(selected.map((item) => roundType(item.category)));
  const selectedMeasures = new Set(selected.map((item) => measureKind(item.category)));
  const selectedDomains = new Set(selected.map((item) => broadDomain(item.category)));
  const selectedClusters = new Set(selected.map((item) => knowledgeCluster(item.category)));
  const selectedSources = new Set(selected.map((item) => item.category.source));
  return (
    (selectedTypes.has(roundType(category)) ? 0 : 15)
    + (selectedMeasures.has(measureKind(category)) ? 0 : 4)
    + (selectedDomains.has(broadDomain(category)) ? 0 : 10)
    + (selectedClusters.has(knowledgeCluster(category)) ? 0 : 5)
    + (selectedSources.has(category.source) ? 0 : 7)
    + (isPhysicalCategory(category) ? 4 : 0)
    + scoreCategoryQuality(dataset).score / 18
    + rng() * 2
  );
}

/** Bounded backtracking over the complete category set. */
function chooseCategorySet(
  available: RoundCategory[],
  seed: string,
  config: RoundConfig,
  deadline: number,
) {
  const rng = seededRandom(seed);
  const eligible = shuffle(
    available.filter((dataset) => datasetHasEnoughDisplayedVariety(dataset, config)),
    rng,
  );
  const selected: RoundCategory[] = [];
  const used = new Set<string>();
  let steps = 0;

  function search(depth: number): RoundCategory[] | null {
    steps += 1;
    if (steps > MAX_CATEGORY_SEARCH_STEPS || Date.now() > deadline) return null;
    if (depth === config.categoryCount) {
      return roundHasRequiredDiversity(selected.map((dataset) => dataset.category), config)
        ? [...selected]
        : null;
    }

    const options = eligible
      .filter((dataset) => !used.has(dataset.category.id)
        && canAddCategory(selected.map((item) => item.category), dataset.category, config))
      .map((dataset) => ({ dataset, score: optionScore(selected, dataset, rng) }))
      .sort((left, right) => right.score - left.score);

    const remaining = config.categoryCount - depth;
    if (options.length < remaining) return null;
    const branchWidth = depth < 2 ? 14 : depth < 4 ? 9 : 6;
    for (const { dataset } of options.slice(0, branchWidth)) {
      selected.push(dataset);
      used.add(dataset.category.id);
      const result = search(depth + 1);
      if (result) return result;
      used.delete(dataset.category.id);
      selected.pop();
    }
    return null;
  }

  return search(0);
}

function findDistinctWinners(
  categories: RoundCategory[],
  countries: CountryInfo[],
  seed: string,
  config: RoundConfig,
  deadline: number,
) {
  const rng = seededRandom(seed);
  const countryById = new Map(countries.map((country) => [country.id, country]));
  const completeCountries = countries.filter((country) =>
    categories.every((category) => observationValue(category, country.id) !== undefined),
  );
  const completeIds = new Set(completeCountries.map((country) => country.id));
  const candidates = categories.map((category) => {
    const limit = strongestGlobalWinnerRank(category.ranked.length);
    return shuffle(
      category.ranked
        .filter((row) => row.globalRank <= limit && completeIds.has(row.countryId))
        .map((row) => row.countryId),
      rng,
    );
  });
  if (candidates.some((items) => !items.length)) return null;

  const order = categories.map((_, index) => index)
    .sort((left, right) => candidates[left].length - candidates[right].length);
  const winners = new Array<string>(categories.length);
  const used = new Set<string>();
  const continentCounts = new Map<string, number>();
  let steps = 0;

  function search(depth: number): boolean {
    steps += 1;
    if (steps > MAX_WINNER_SEARCH_STEPS || ((steps & 255) === 0 && Date.now() > deadline)) return false;
    if (depth === order.length) return true;
    const categoryIndex = order[depth];
    const category = categories[categoryIndex];

    for (const id of candidates[categoryIndex].slice(0, MAX_WINNER_CANDIDATES_PER_CATEGORY)) {
      if (used.has(id)) continue;
      const country = countryById.get(id);
      if (!country || (continentCounts.get(country.continent) ?? 0) >= config.maxCountriesPerContinent) continue;
      const ownValue = observationValue(category, id);
      if (ownValue === undefined || !candidateKeepsDisplayedValuesDistinct(categories, used, id)) continue;

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
    }));

  const decoys: string[] = [];
  const selectedBankIds = new Set(used);
  for (const country of decoyCandidates) {
    if ((continentCounts.get(country.continent) ?? 0) >= config.maxCountriesPerContinent) continue;
    if (!candidateKeepsDisplayedValuesDistinct(categories, selectedBankIds, country.id)) continue;
    decoys.push(country.id);
    selectedBankIds.add(country.id);
    continentCounts.set(country.continent, (continentCounts.get(country.continent) ?? 0) + 1);
    if (decoys.length === config.decoyCount) break;
  }

  return decoys.length === config.decoyCount ? { winners, decoys } : null;
}

export function scoreBoard(round: Round, config: RoundConfig): ScoreBreakdown {
  const qualityScores = round.categories.map((dataset) => scoreCategoryQuality(dataset).score);
  const quality = qualityScores.reduce((sum, value) => sum + value, 0) / Math.max(1, qualityScores.length);
  const typeCount = new Set(round.categories.map((dataset) => roundType(dataset.category))).size;
  const measureCount = new Set(round.categories.map((dataset) => measureKind(dataset.category))).size;
  const domainCount = new Set(round.categories.map((dataset) => broadDomain(dataset.category))).size;
  const clusterCount = new Set(round.categories.map((dataset) => knowledgeCluster(dataset.category))).size;
  const variety = Math.min(100, typeCount * 11 + measureCount * 6 + domainCount * 9 + clusterCount * 4);
  const geography = Math.min(100, new Set(round.bank.map((country) => country.continent)).size * 18);
  const populations = round.bank
    .map((country) => country.population)
    .filter((value): value is number => typeof value === "number" && value > 0)
    .map((value) => Math.max(0, Math.min(100, (Math.log10(value) - 5.5) / 3 * 100)));
  const familiarity = populations.length
    ? populations.reduce((sum, value) => sum + value, 0) / populations.length
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

function composeRoundCandidates(
  available: RoundCategory[],
  countries: CountryInfo[],
  seed: string,
  config: RoundConfig,
  deadline: number,
  attemptLimit = ROUND_COMPOSITION_ATTEMPTS,
): CandidateResult {
  const attempted = new Set<string>();
  const candidates: RoundCandidate[] = [];
  let categorySelectionFailures = 0;
  let winnerSearchFailures = 0;
  let validationFailures = 0;

  for (let attempt = 0; attempt < attemptLimit && Date.now() < deadline; attempt += 1) {
    const categorySet = chooseCategorySet(available, `${seed}:categories:${attempt}`, config, deadline);
    if (!categorySet) {
      categorySelectionFailures += 1;
      continue;
    }
    const signature = categorySet.map((dataset) => dataset.category.id).sort().join("|");
    if (attempted.has(signature)) continue;
    attempted.add(signature);

    const solution = findDistinctWinners(categorySet, countries, `${seed}:countries:${attempt}`, config, deadline);
    if (!solution) {
      winnerSearchFailures += 1;
      continue;
    }
    const countryById = new Map(countries.map((country) => [country.id, country]));
    const rng = seededRandom(`${seed}:bank:${attempt}`);
    const bank = shuffle(
      [...solution.winners, ...solution.decoys]
        .map((id) => countryById.get(id))
        .filter((country): country is CountryInfo => Boolean(country)),
      rng,
    );
    const errors = bank.length === config.countryCount ? validateRound(categorySet, bank) : ["wrong dimensions"];
    if (errors.length || !roundHasCountryDiversity(bank, config)) {
      validationFailures += 1;
      continue;
    }
    const round = { bank, categories: categorySet };
    candidates.push({ round, score: scoreBoard(round, config).overall });
    candidates.sort((left, right) => right.score - left.score);
    if (candidates.length > ROUND_CANDIDATE_TARGET) candidates.length = ROUND_CANDIDATE_TARGET;
    if (candidates.length >= ROUND_CANDIDATE_TARGET) break;
  }

  return { candidates, categorySelectionFailures, winnerSearchFailures, validationFailures };
}

function roundsCanShareTrio(first: Round, second: Round) {
  if (pairwiseCountryOverlap(first, second) > 1) return false;
  const firstCategories = first.categories.map((dataset) => dataset.category);
  for (const dataset of second.categories) {
    if (categoryConflictsWithExistingTrio(dataset.category, firstCategories)) return false;
  }
  return true;
}

function combineCandidateRounds(
  pools: Record<DailyDifficulty, RoundCandidate[]>,
  deadline: number,
) {
  let best: { trio: DailyTrio; score: number } | null = null;
  let combinations = 0;
  for (const easy of pools.easy) {
    for (const normal of pools.normal) {
      if (!roundsCanShareTrio(easy.round, normal.round)) continue;
      for (const expert of pools.expert) {
        combinations += 1;
        if (combinations > MAX_TRIO_COMBINATIONS || Date.now() > deadline) return best;
        if (!roundsCanShareTrio(easy.round, expert.round) || !roundsCanShareTrio(normal.round, expert.round)) continue;
        const trio: DailyTrio = { easy: easy.round, normal: normal.round, expert: expert.round };
        const errors = validateDailyTrio(trio);
        if (errors.length) continue;
        const physicalBonus = DAILY_DIFFICULTIES
          .flatMap((difficulty) => trio[difficulty].categories)
          .filter((dataset) => isPhysicalCategory(dataset.category)).length * 3;
        const score = easy.score + normal.score + expert.score + physicalBonus;
        if (!best || score > best.score) best = { trio, score };
      }
    }
  }
  return best;
}

function combineCandidateRoundsGreedy(
  pools: Record<DailyDifficulty, RoundCandidate[]>,
) {
  const limits: Record<DailyDifficulty, RoundCandidate[]> = {
    easy: pools.easy.slice(0, 24),
    normal: pools.normal.slice(0, 24),
    expert: pools.expert.slice(0, 24),
  };
  const orders: DailyDifficulty[][] = [
    ["easy", "normal", "expert"],
    ["normal", "expert", "easy"],
    ["expert", "easy", "normal"],
  ];
  let best: { trio: DailyTrio; score: number } | null = null;
  for (const order of orders) {
    for (const first of limits[order[0]]) {
      for (const second of limits[order[1]]) {
        if (!roundsCanShareTrio(first.round, second.round)) continue;
        const existing = [first.round, second.round];
        const third = limits[order[2]].find((candidate) =>
          existing.every((round) => roundsCanShareTrio(round, candidate.round)),
        );
        if (!third) continue;
        const selected = { [order[0]]: first, [order[1]]: second, [order[2]]: third } as Record<DailyDifficulty, RoundCandidate>;
        const trio: DailyTrio = {
          easy: selected.easy.round,
          normal: selected.normal.round,
          expert: selected.expert.round,
        };
        if (validateDailyTrio(trio).length) continue;
        const score = selected.easy.score + selected.normal.score + selected.expert.score;
        if (!best || score > best.score) best = { trio, score };
      }
    }
  }
  return best;
}

export function generateDailyTrioFromLoadedCatalog(
  countries: CountryInfo[],
  date: string,
  loaded: LoadedPuzzleCatalog,
  fixed: Partial<DailyTrio> = {},
  attemptSalt = "",
): { trio: DailyTrio; diagnostics: GenerationDiagnostics; scores: Record<DailyDifficulty, ScoreBreakdown> } {
  const seed = `DAILY-TRIO-${date}${attemptSalt ? `:${attemptSalt}` : ""}`;
  const requiredDatasets = DAILY_DIFFICULTIES.reduce((sum, difficulty) => sum + ROUND_CONFIGS[difficulty].categoryCount, 0);
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
    candidateSources: loaded.candidateSources,
  };

  if (loaded.datasets.length < requiredDatasets) {
    diagnostics.failureStage = "dataset-pool";
    diagnostics.message = `Only ${loaded.datasets.length} approved datasets loaded; ${requiredDatasets} are required.`;
    throw Object.assign(new Error(diagnostics.message), { diagnostics });
  }

  const overallDeadline = Date.now() + GENERATION_BUDGET_MS;
  const profiles = generationProfiles();
  let lastErrors: string[] = [];

  for (const [profileIndex, profile] of profiles.entries()) {
    if (Date.now() > overallDeadline) break;
    diagnostics.attempts += 1;
    const remainingProfiles = profiles.length - profileIndex;
    const profileDeadline = Math.min(
      overallDeadline,
      Date.now() + Math.max(PROFILE_MINIMUM_BUDGET_MS, Math.floor((overallDeadline - Date.now()) / remainingProfiles)),
    );
    const pools = {} as Record<DailyDifficulty, RoundCandidate[]>;

    for (const difficulty of DAILY_DIFFICULTIES) {
      if (fixed[difficulty]) {
        pools[difficulty] = [{ round: fixed[difficulty]!, score: scoreBoard(fixed[difficulty]!, profile.configs[difficulty]).overall }];
        diagnostics.validCandidates[difficulty] += 1;
        continue;
      }
      const result = composeRoundCandidates(
        loaded.datasets,
        countries,
        `${seed}:${profile.name}:${difficulty}`,
        profile.configs[difficulty],
        profileDeadline,
      );
      pools[difficulty] = result.candidates;
      diagnostics.validCandidates[difficulty] += result.candidates.length;
      diagnostics.categorySelectionFailures += result.categorySelectionFailures;
      diagnostics.winnerSearchFailures += result.winnerSearchFailures;
      diagnostics.roundValidationFailures += result.validationFailures;
    }

    if (DAILY_DIFFICULTIES.some((difficulty) => !pools[difficulty].length)) continue;
    const combined = combineCandidateRounds(pools, profileDeadline) ?? combineCandidateRoundsGreedy(pools);
    if (!combined) {
      diagnostics.trioValidationFailures += 1;
      const sample: DailyTrio = {
        easy: pools.easy[0].round,
        normal: pools.normal[0].round,
        expert: pools.expert[0].round,
      };
      lastErrors = validateDailyTrio(sample).slice(0, 12);
      continue;
    }

    diagnostics.generationProfile = profile.name;
    diagnostics.preferenceWarnings = dailyTrioPreferenceWarnings(combined.trio);
    return {
      trio: combined.trio,
      diagnostics,
      scores: {
        easy: scoreBoard(combined.trio.easy, profile.configs.easy),
        normal: scoreBoard(combined.trio.normal, profile.configs.normal),
        expert: scoreBoard(combined.trio.expert, profile.configs.expert),
      },
    };
  }

  diagnostics.failureStage = "candidate-combination";
  diagnostics.lastTrioErrors = lastErrors;
  diagnostics.message = "The generator could not assemble the remaining Daily modes while preserving already valid modes and cross-mode diversity.";
  throw Object.assign(new Error(diagnostics.message), { diagnostics });
}

export async function generateDailyTrio(
  countries: CountryInfo[],
  date: string,
  fixed: Partial<DailyTrio> = {},
  attemptSalt = "",
): Promise<{ trio: DailyTrio; diagnostics: GenerationDiagnostics; scores: Record<DailyDifficulty, ScoreBreakdown> }> {
  return generateDailyTrioFromLoadedCatalog(countries, date, await loadCandidateDatasets(), fixed, attemptSalt);
}

export function generateSeededRoundFromLoadedCatalog(
  countries: CountryInfo[],
  seed: string,
  difficulty: DailyDifficulty,
  loaded: LoadedPuzzleCatalog,
): { round: Round; profile: string; score: ScoreBreakdown } {
  // Seeded output must not depend on machine speed. Each profile receives the
  // same fixed number of deterministic attempts rather than a wall-clock race.
  const seededAttemptLimit = 60;
  for (const profile of generationProfiles()) {
    const result = composeRoundCandidates(
      loaded.datasets,
      countries,
      `SEEDED-${difficulty}-${seed}:${profile.name}`,
      profile.configs[difficulty],
      Number.POSITIVE_INFINITY,
      seededAttemptLimit,
    );
    if (result.candidates.length) {
      const candidate = result.candidates[0];
      return {
        round: candidate.round,
        profile: profile.name,
        score: scoreBoard(candidate.round, profile.configs[difficulty]),
      };
    }
  }
  throw new Error("That seed could not produce a valid board from the current approved catalog.");
}

export async function generateSeededRound(
  countries: CountryInfo[],
  seed: string,
  difficulty: DailyDifficulty,
): Promise<{ round: Round; profile: string; score: ScoreBreakdown }> {
  return generateSeededRoundFromLoadedCatalog(
    countries,
    seed,
    difficulty,
    await loadCandidateDatasets(),
  );
}
