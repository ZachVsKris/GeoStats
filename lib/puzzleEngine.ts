import type { Category } from "./categories";
import { canonicalizeDataset, poolLeaderboard, validateRound } from "./dataEngine";
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
import { generationProfiles } from "./generationProfiles";
import { candidateKeepsDisplayedValuesDistinct } from "./roundValueRules";
import { loadCachedPuzzleWarehouseSnapshot } from "./puzzleWarehouseSnapshot";
import type { BulkWarehouseLoadError } from "./serverWarehouseCategories";

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
  compatiblePairs?: number;
  indexedCombinationChecks?: number;
  jointConstructionAttempts?: number;
  jointConstructionBacktracks?: number;
  elapsedMs?: number;
};

export type DailyGenerationOptions = {
  budgetMs?: number;
  candidateTarget?: number;
  jointSearch?: boolean;
  jointFirst?: boolean;
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
type RoundCandidate = {
  round: Round;
  score: number;
  categorySignature: string;
  countrySignature: string;
};
type CandidateResult = {
  candidates: RoundCandidate[];
  categorySelectionFailures: number;
  winnerSearchFailures: number;
  validationFailures: number;
};

const GENERATION_BUDGET_MS = 65_000;
const PROFILE_MINIMUM_BUDGET_MS = 7_000;
const MAX_CATEGORY_SEARCH_STEPS = 30_000;
const MAX_WINNER_SEARCH_STEPS = 180_000;
const MAX_WINNER_CANDIDATES_PER_CATEGORY = 80;
const ROUND_CANDIDATE_TARGET = 128;
const RAW_ROUND_CANDIDATE_LIMIT = 420;
const ROUND_COMPOSITION_ATTEMPTS = 360;
const GUIDED_FIRST_CANDIDATE_LIMIT = 12;
const GUIDED_SECOND_CANDIDATE_TARGET = 16;
const GUIDED_THIRD_CANDIDATE_TARGET = 10;

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
    // The full approved warehouse snapshot is expensive to reconstruct. Next's
    // data cache persists it across serverless invocations and catalog versions
    // invalidate it explicitly through the versioned cache key above.
    const bulk = await loadCachedPuzzleWarehouseSnapshot();
    const loaded: RoundCategory[] = [];
    let qualityRejections = 0;
    const candidateSources: Record<string, number> = {};

    for (const rawDataset of bulk.datasets) {
      try {
        const dataset = canonicalizeDataset(rawDataset);
        // Database computed_playable_v16_2 is the single category-quality gate.
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
      catalogSize: bulk.catalogSize,
      datasetLoadFailures: bulk.errors.length,
      datasetLoadErrorSamples: bulk.errors.slice(0, 20).map((error: BulkWarehouseLoadError) => `${error.categoryId}: ${error.message}`),
      qualityRejections,
      candidateSources,
    };
  })().then((loaded) => {
    // Keep the canonicalized Map-heavy representation hot within a long-lived
    // process. The serializable snapshot above is the cross-instance cache.
    loadedDatasetExpiresAt = Date.now() + 60 * 60 * 1000;
    return loaded;
  }).catch((error) => {
    loadedDatasetPromise = undefined;
    loadedDatasetExpiresAt = 0;
    throw error;
  });
  return loadedDatasetPromise;
}

export async function loadPuzzleCatalogSnapshot(): Promise<LoadedPuzzleCatalog> {
  return loadCandidateDatasets();
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
  existingRounds: Round[] = [],
) {
  const rng = seededRandom(seed);
  const eligible = shuffle(
    available.filter((dataset) => datasetHasEnoughDisplayedVariety(dataset, config)),
    rng,
  );
  const selected: RoundCategory[] = [];
  const used = new Set<string>();
  const existingCategories = existingRounds.flatMap((round) => round.categories.map((dataset) => dataset.category));
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
        && !categoryConflictsWithExistingTrio(dataset.category, [...existingCategories, ...selected.map((item) => item.category)])
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
  existingRounds: Round[] = [],
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
  const existingCountrySets = existingRounds.map((round) => new Set(round.bank.map((country) => country.id)));
  const existingOverlapCounts = existingCountrySets.map(() => 0);
  let steps = 0;

  function search(depth: number): boolean {
    steps += 1;
    if (steps > MAX_WINNER_SEARCH_STEPS || ((steps & 255) === 0 && Date.now() > deadline)) return false;
    if (depth === order.length) return true;
    const categoryIndex = order[depth];
    const category = categories[categoryIndex];

    for (const id of candidates[categoryIndex].slice(0, MAX_WINNER_CANDIDATES_PER_CATEGORY)) {
      if (used.has(id)) continue;
      if (existingCountrySets.some((set, index) => set.has(id) && existingOverlapCounts[index] >= 1)) continue;
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
      existingCountrySets.forEach((set, index) => { if (set.has(id)) existingOverlapCounts[index] += 1; });
      continentCounts.set(country.continent, (continentCounts.get(country.continent) ?? 0) + 1);
      if (search(depth + 1)) return true;
      used.delete(id);
      existingCountrySets.forEach((set, index) => { if (set.has(id)) existingOverlapCounts[index] -= 1; });
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
    if (existingCountrySets.some((set, index) => set.has(country.id) && existingOverlapCounts[index] >= 1)) continue;
    if (!candidateKeepsDisplayedValuesDistinct(categories, selectedBankIds, country.id)) continue;
    decoys.push(country.id);
    selectedBankIds.add(country.id);
    existingCountrySets.forEach((set, index) => { if (set.has(country.id)) existingOverlapCounts[index] += 1; });
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

function candidateFromRound(round: Round, score: number): RoundCandidate {
  return {
    round,
    score,
    categorySignature: round.categories.map((dataset) => dataset.category.id).sort().join("|"),
    countrySignature: round.bank.map((country) => country.id).sort().join("|"),
  };
}

function overlapCount(first: string[], second: string[]) {
  const values = new Set(first);
  return second.filter((value) => values.has(value)).length;
}

function candidateDiversityScore(candidate: RoundCandidate, selected: RoundCandidate[]) {
  if (!selected.length) return candidate.score;
  const candidateCategories = candidate.round.categories.map((dataset) => dataset.category.id);
  const candidateCountries = candidate.round.bank.map((country) => country.id);
  let categoryReuse = 0;
  let countryReuse = 0;
  for (const prior of selected) {
    categoryReuse += overlapCount(
      candidateCategories,
      prior.round.categories.map((dataset) => dataset.category.id),
    );
    countryReuse += overlapCount(
      candidateCountries,
      prior.round.bank.map((country) => country.id),
    );
  }
  // Penalize cumulative reuse, not only the single worst overlap. This keeps
  // the retained pool broad enough for cross-mode trio backtracking.
  return candidate.score - categoryReuse * 4.5 - countryReuse * 1.25;
}

function selectDiverseCandidates(candidates: RoundCandidate[], target = ROUND_CANDIDATE_TARGET) {
  const unique = new Map<string, RoundCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.categorySignature}::${candidate.countrySignature}`;
    const prior = unique.get(key);
    if (!prior || candidate.score > prior.score) unique.set(key, candidate);
  }
  const remaining = [...unique.values()].sort((left, right) => right.score - left.score);
  const selected: RoundCandidate[] = [];
  while (remaining.length && selected.length < target) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const score = candidateDiversityScore(remaining[index], selected);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }
  return selected.sort((left, right) => right.score - left.score);
}

function composeRoundCandidates(
  available: RoundCategory[],
  countries: CountryInfo[],
  seed: string,
  config: RoundConfig,
  deadline: number,
  attemptLimit = ROUND_COMPOSITION_ATTEMPTS,
  existingRounds: Round[] = [],
  candidateTarget = ROUND_CANDIDATE_TARGET,
): CandidateResult {
  const attempted = new Set<string>();
  const candidates: RoundCandidate[] = [];
  let categorySelectionFailures = 0;
  let winnerSearchFailures = 0;
  let validationFailures = 0;

  for (let attempt = 0; attempt < attemptLimit && Date.now() < deadline; attempt += 1) {
    const categorySet = chooseCategorySet(available, `${seed}:categories:${attempt}`, config, deadline, existingRounds);
    if (!categorySet) {
      categorySelectionFailures += 1;
      continue;
    }
    const signature = categorySet.map((dataset) => dataset.category.id).sort().join("|");
    if (attempted.has(signature)) continue;
    attempted.add(signature);

    const solution = findDistinctWinners(categorySet, countries, `${seed}:countries:${attempt}`, config, deadline, existingRounds);
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
    const round = { bank, categories: categorySet };
    if (errors.length || !roundHasCountryDiversity(bank, config) || !roundCompatibleWithExisting(round, existingRounds)) {
      validationFailures += 1;
      continue;
    }
    candidates.push(candidateFromRound(round, scoreBoard(round, config).overall));
    if (candidates.length > RAW_ROUND_CANDIDATE_LIMIT) {
      candidates.sort((left, right) => right.score - left.score);
      candidates.length = RAW_ROUND_CANDIDATE_LIMIT;
    }
  }

  return {
    candidates: selectDiverseCandidates(candidates, candidateTarget),
    categorySelectionFailures,
    winnerSearchFailures,
    validationFailures,
  };
}

function roundsCanShareTrio(first: Round, second: Round) {
  return roundCompatibleWithExisting(second, [first]);
}

function roundCompatibleWithExisting(candidate: Round, existingRounds: Round[]) {
  if (existingRounds.some((round) => pairwiseCountryOverlap(round, candidate) > 1)) return false;
  const existingCategories = existingRounds.flatMap((round) => round.categories.map((dataset) => dataset.category));
  for (const dataset of candidate.categories) {
    if (categoryConflictsWithExistingTrio(dataset.category, existingCategories)) return false;
    existingCategories.push(dataset.category);
  }
  return true;
}

function trioCandidateScore(selected: Record<DailyDifficulty, RoundCandidate>) {
  const trio: DailyTrio = {
    easy: selected.easy.round,
    normal: selected.normal.round,
    expert: selected.expert.round,
  };
  const physicalBonus = DAILY_DIFFICULTIES
    .flatMap((difficulty) => trio[difficulty].categories)
    .filter((dataset) => isPhysicalCategory(dataset.category)).length * 3;
  return selected.easy.score + selected.normal.score + selected.expert.score + physicalBonus;
}

/**
 * Builds a compatibility index first, then searches only viable pairs. This
 * avoids spending the entire request walking an enormous cartesian product.
 */
function combineCandidateRoundsIndexed(
  pools: Record<DailyDifficulty, RoundCandidate[]>,
  deadline: number,
  diagnostics: GenerationDiagnostics,
) {
  const orders: DailyDifficulty[][] = [
    ["expert", "normal", "easy"],
    ["normal", "easy", "expert"],
    ["easy", "expert", "normal"],
  ];
  let best: { trio: DailyTrio; score: number } | null = null;
  let checks = 0;
  let compatiblePairs = 0;

  for (const order of orders) {
    const firstPool = pools[order[0]];
    const secondPool = pools[order[1]];
    const thirdPool = pools[order[2]];
    const pairs: Array<{ first: RoundCandidate; second: RoundCandidate; score: number }> = [];

    for (const first of firstPool) {
      for (const second of secondPool) {
        checks += 1;
        if ((checks & 2047) === 0 && Date.now() > deadline) break;
        if (!roundsCanShareTrio(first.round, second.round)) continue;
        compatiblePairs += 1;
        pairs.push({ first, second, score: first.score + second.score });
      }
      if (Date.now() > deadline) break;
    }
    pairs.sort((left, right) => right.score - left.score);

    for (const pair of pairs) {
      if (Date.now() > deadline) break;
      if (best && pair.score + (thirdPool[0]?.score ?? 0) <= best.score) break;
      for (const third of thirdPool) {
        checks += 1;
        if ((checks & 1023) === 0 && Date.now() > deadline) break;
        if (!roundCompatibleWithExisting(third.round, [pair.first.round, pair.second.round])) continue;
        const selected = {
          [order[0]]: pair.first,
          [order[1]]: pair.second,
          [order[2]]: third,
        } as Record<DailyDifficulty, RoundCandidate>;
        const trio: DailyTrio = {
          easy: selected.easy.round,
          normal: selected.normal.round,
          expert: selected.expert.round,
        };
        if (validateDailyTrio(trio).length) continue;
        const score = trioCandidateScore(selected);
        if (!best || score > best.score) best = { trio, score };
        // Pools are score-sorted; once a valid high-quality third candidate is
        // found for this pair, later candidates cannot improve enough to justify
        // an unbounded scan.
        break;
      }
    }
    if (best) break;
  }

  diagnostics.compatiblePairs = (diagnostics.compatiblePairs ?? 0) + compatiblePairs;
  diagnostics.indexedCombinationChecks = (diagnostics.indexedCombinationChecks ?? 0) + checks;
  return best;
}

function fixedCandidate(round: Round, difficulty: DailyDifficulty) {
  return candidateFromRound(round, scoreBoard(round, ROUND_CONFIGS[difficulty]).overall);
}

/**
 * Final fallback: construct later modes against already-selected earlier modes.
 * Cross-mode constraints therefore shape candidate creation rather than being
 * tested only after three unrelated boards have been built.
 */
function constructGuidedTrio(
  loaded: LoadedPuzzleCatalog,
  countries: CountryInfo[],
  seed: string,
  fixed: Partial<DailyTrio>,
  profiles: ReturnType<typeof generationProfiles>,
  deadline: number,
  diagnostics: GenerationDiagnostics,
) {
  const fixedDifficulties = DAILY_DIFFICULTIES.filter((difficulty) => fixed[difficulty]);
  const baseOrders: DailyDifficulty[][] = [
    ["expert", "normal", "easy"],
    ["normal", "easy", "expert"],
    ["easy", "expert", "normal"],
  ];
  const orders = baseOrders.map((order) => [
    ...fixedDifficulties,
    ...order.filter((difficulty) => !fixedDifficulties.includes(difficulty)),
  ] as DailyDifficulty[]);

  for (const profile of profiles) {
    for (const order of orders) {
      if (Date.now() > deadline) return null;
      const selected: Partial<Record<DailyDifficulty, RoundCandidate>> = {};
      const existingRounds: Round[] = [];
      for (const difficulty of fixedDifficulties) {
        const round = fixed[difficulty]!;
        if (!roundCompatibleWithExisting(round, existingRounds)) return null;
        selected[difficulty] = fixedCandidate(round, difficulty);
        existingRounds.push(round);
      }

      const remaining = order.filter((difficulty) => !selected[difficulty]);
      function search(depth: number): { trio: DailyTrio; score: number } | null {
        if (Date.now() > deadline) return null;
        if (depth === remaining.length) {
          const complete = selected as Record<DailyDifficulty, RoundCandidate>;
          const trio: DailyTrio = {
            easy: complete.easy.round,
            normal: complete.normal.round,
            expert: complete.expert.round,
          };
          return validateDailyTrio(trio).length ? null : { trio, score: trioCandidateScore(complete) };
        }
        const difficulty = remaining[depth];
        diagnostics.jointConstructionAttempts = (diagnostics.jointConstructionAttempts ?? 0) + 1;
        const target = depth === 0 ? GUIDED_FIRST_CANDIDATE_LIMIT
          : depth === 1 ? GUIDED_SECOND_CANDIDATE_TARGET
          : GUIDED_THIRD_CANDIDATE_TARGET;
        // Preserve time for later modes and backtracking. A single difficult
        // branch must not consume the entire joint-construction reserve.
        const remainingMs = Math.max(0, deadline - Date.now());
        const stagesLeft = Math.max(1, remaining.length - depth);
        const preferredSlice = depth === 0 ? 6_000 : depth === 1 ? 4_500 : 3_000;
        const nodeBudget = Math.max(1_500, Math.min(preferredSlice, Math.floor(remainingMs / (stagesLeft + 1))));
        const nodeDeadline = Math.min(deadline, Date.now() + nodeBudget);
        const result = composeRoundCandidates(
          loaded.datasets,
          countries,
          `${seed}:guided:${profile.name}:${order.join("-")}:${depth}`,
          profile.configs[difficulty],
          nodeDeadline,
          Math.max(36, target * 5),
          existingRounds,
          target,
        );
        diagnostics.categorySelectionFailures += result.categorySelectionFailures;
        diagnostics.winnerSearchFailures += result.winnerSearchFailures;
        diagnostics.roundValidationFailures += result.validationFailures;
        diagnostics.validCandidates[difficulty] += result.candidates.length;
        for (const candidate of result.candidates.slice(0, target)) {
          selected[difficulty] = candidate;
          existingRounds.push(candidate.round);
          const built = search(depth + 1);
          if (built) return built;
          existingRounds.pop();
          delete selected[difficulty];
          diagnostics.jointConstructionBacktracks = (diagnostics.jointConstructionBacktracks ?? 0) + 1;
        }
        return null;
      }

      const built = search(0);
      if (built) return { ...built, profile: `guided-${profile.name}` };
    }
  }
  return null;
}

export function generateDailyTrioFromLoadedCatalog(
  countries: CountryInfo[],
  date: string,
  loaded: LoadedPuzzleCatalog,
  fixed: Partial<DailyTrio> = {},
  attemptSalt = "",
  options: DailyGenerationOptions = {},
): { trio: DailyTrio; diagnostics: GenerationDiagnostics; scores: Record<DailyDifficulty, ScoreBreakdown> } {
  const startedAt = Date.now();
  const seed = `DAILY-TRIO-${date}${attemptSalt ? `:${attemptSalt}` : ""}`;
  const requiredDatasets = DAILY_DIFFICULTIES.reduce(
    (sum, difficulty) => sum + ROUND_CONFIGS[difficulty].categoryCount,
    0,
  );
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

  const budgetMs = Math.max(10_000, options.budgetMs ?? GENERATION_BUDGET_MS);
  const overallDeadline = Date.now() + budgetMs;
  // Reserve a meaningful final window for constraint-aware construction. The
  // earlier v16.1/v16.2 pool combiner could use the whole request before the
  // joint fallback ever ran, reproducing the same cross-mode failure.
  const jointReserveMs = options.jointSearch === false
    ? 0
    : Math.min(40_000, Math.max(8_000, Math.floor(budgetMs * 0.35)), Math.max(0, budgetMs - 12_000));
  const runJointFirst = options.jointSearch !== false && options.jointFirst === true;
  const poolSearchDeadline = runJointFirst ? overallDeadline : overallDeadline - jointReserveMs;
  const candidateTarget = Math.max(32, options.candidateTarget ?? ROUND_CANDIDATE_TARGET);
  const profiles = generationProfiles();
  const accumulatedPools: Record<DailyDifficulty, RoundCandidate[]> = {
    easy: [],
    normal: [],
    expert: [],
  };
  let lastErrors: string[] = [];
  let successfulProfile = "cross-profile";

  // Admin and cron generation use joint construction as the primary strategy.
  // This makes cross-mode constraints part of board creation instead of hoping
  // three independently optimized pools happen to contain a compatible trio.
  if (runJointFirst && jointReserveMs > 0) {
    const guidedDeadline = Math.min(overallDeadline, Date.now() + jointReserveMs);
    const guided = constructGuidedTrio(loaded, countries, seed, fixed, profiles, guidedDeadline, diagnostics);
    if (guided) {
      diagnostics.generationProfile = guided.profile;
      diagnostics.preferenceWarnings = dailyTrioPreferenceWarnings(guided.trio);
      diagnostics.elapsedMs = Date.now() - startedAt;
      return {
        trio: guided.trio,
        diagnostics,
        scores: {
          easy: scoreBoard(guided.trio.easy, ROUND_CONFIGS.easy),
          normal: scoreBoard(guided.trio.normal, ROUND_CONFIGS.normal),
          expert: scoreBoard(guided.trio.expert, ROUND_CONFIGS.expert),
        },
      };
    }
  }

  for (const [profileIndex, profile] of profiles.entries()) {
    if (Date.now() > poolSearchDeadline) break;
    diagnostics.attempts += 1;
    const remainingProfiles = profiles.length - profileIndex;
    const profileDeadline = Math.min(
      poolSearchDeadline,
      Date.now()
        + Math.max(
          PROFILE_MINIMUM_BUDGET_MS,
          Math.floor((poolSearchDeadline - Date.now()) / Math.max(1, remainingProfiles)),
        ),
    );

    for (const [difficultyIndex, difficulty] of DAILY_DIFFICULTIES.entries()) {
      let candidates: RoundCandidate[];
      const remainingModes = DAILY_DIFFICULTIES.length - difficultyIndex;
      const modeDeadline = Math.min(
        profileDeadline,
        Date.now() + Math.max(3_000, Math.floor((profileDeadline - Date.now()) / Math.max(1, remainingModes))),
      );
      if (fixed[difficulty]) {
        candidates = [
          candidateFromRound(
            fixed[difficulty]!,
            scoreBoard(fixed[difficulty]!, profile.configs[difficulty]).overall,
          ),
        ];
      } else {
        const result = composeRoundCandidates(
          loaded.datasets,
          countries,
          `${seed}:${profile.name}:${difficulty}`,
          profile.configs[difficulty],
          modeDeadline,
          ROUND_COMPOSITION_ATTEMPTS,
          [],
          candidateTarget,
        );
        candidates = result.candidates;
        diagnostics.categorySelectionFailures += result.categorySelectionFailures;
        diagnostics.winnerSearchFailures += result.winnerSearchFailures;
        diagnostics.roundValidationFailures += result.validationFailures;
      }

      diagnostics.validCandidates[difficulty] += candidates.length;
      accumulatedPools[difficulty] = selectDiverseCandidates(
        [...accumulatedPools[difficulty], ...candidates],
        fixed[difficulty] ? 1 : candidateTarget,
      );
    }

    if (DAILY_DIFFICULTIES.some((difficulty) => !accumulatedPools[difficulty].length)) continue;

    const combined = combineCandidateRoundsIndexed(accumulatedPools, profileDeadline, diagnostics);
    if (!combined) {
      diagnostics.trioValidationFailures += 1;
      const sample: DailyTrio = {
        easy: accumulatedPools.easy[0].round,
        normal: accumulatedPools.normal[0].round,
        expert: accumulatedPools.expert[0].round,
      };
      lastErrors = validateDailyTrio(sample).slice(0, 12);
      continue;
    }

    successfulProfile = profile.name;
    diagnostics.generationProfile = successfulProfile;
    diagnostics.preferenceWarnings = dailyTrioPreferenceWarnings(combined.trio);
    diagnostics.elapsedMs = Date.now() - startedAt;
    return {
      trio: combined.trio,
      diagnostics,
      scores: {
        easy: scoreBoard(combined.trio.easy, ROUND_CONFIGS.easy),
        normal: scoreBoard(combined.trio.normal, ROUND_CONFIGS.normal),
        expert: scoreBoard(combined.trio.expert, ROUND_CONFIGS.expert),
      },
    };
  }

  if (DAILY_DIFFICULTIES.every((difficulty) => accumulatedPools[difficulty].length)) {
    const combined = combineCandidateRoundsIndexed(accumulatedPools, poolSearchDeadline, diagnostics);
    if (combined) {
      diagnostics.generationProfile = successfulProfile;
      diagnostics.preferenceWarnings = dailyTrioPreferenceWarnings(combined.trio);
      diagnostics.elapsedMs = Date.now() - startedAt;
      return {
        trio: combined.trio,
        diagnostics,
        scores: {
          easy: scoreBoard(combined.trio.easy, ROUND_CONFIGS.easy),
          normal: scoreBoard(combined.trio.normal, ROUND_CONFIGS.normal),
          expert: scoreBoard(combined.trio.expert, ROUND_CONFIGS.expert),
        },
      };
    }
  }

  if (!runJointFirst && options.jointSearch !== false && Date.now() < overallDeadline) {
    const guided = constructGuidedTrio(loaded, countries, seed, fixed, profiles, overallDeadline, diagnostics);
    if (guided) {
      diagnostics.generationProfile = guided.profile;
      diagnostics.preferenceWarnings = dailyTrioPreferenceWarnings(guided.trio);
      diagnostics.elapsedMs = Date.now() - startedAt;
      return {
        trio: guided.trio,
        diagnostics,
        scores: {
          easy: scoreBoard(guided.trio.easy, ROUND_CONFIGS.easy),
          normal: scoreBoard(guided.trio.normal, ROUND_CONFIGS.normal),
          expert: scoreBoard(guided.trio.expert, ROUND_CONFIGS.expert),
        },
      };
    }
  }

  diagnostics.elapsedMs = Date.now() - startedAt;
  diagnostics.failureStage = "candidate-combination";
  diagnostics.lastTrioErrors = lastErrors;
  diagnostics.message = "The generator built valid mode candidates but could not find a cross-mode-compatible Daily trio.";
  throw Object.assign(new Error(diagnostics.message), { diagnostics });
}

export async function generateDailyTrio(
  countries: CountryInfo[],
  date: string,
  fixed: Partial<DailyTrio> = {},
  attemptSalt = "",
  options: DailyGenerationOptions = {},
): Promise<{ trio: DailyTrio; diagnostics: GenerationDiagnostics; scores: Record<DailyDifficulty, ScoreBreakdown> }> {
  return generateDailyTrioFromLoadedCatalog(countries, date, await loadCandidateDatasets(), fixed, attemptSalt, options);
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
