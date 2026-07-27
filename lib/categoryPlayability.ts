import type { Category, DataSourceId } from "./categories";
import { generalOfficialSourcePage, hasUsablePlayerSourceStatus, isHumanReadableExternalUrl, worldBankPlayerSourceUrl } from "./playerSourceLinks";

export type PlayabilityInput = {
  id?: string | null;
  source?: DataSourceId | null;
  indicator?: string | null;
  sourceUrl?: string | null;
  methodologyUrl?: string | null;
  sourcePageUrl?: string | null;
  playerSourceUrl?: string | null;
  playerSourceStatus?: string | null;
  reviewStatus?: string | null;
  curationStatus?: string | null;
  validationStatus?: string | null;
  contentReviewStatus?: string | null;
  qualityScore?: number | null;
  credibilityStatus?: string | null;
  credibilityScore?: number | null;
  objectiveStatus?: string | null;
  playerQualityStatus?: string | null;
  verifiabilityScore?: number | null;
  understandabilityScore?: number | null;
  funScore?: number | null;
  immediateComprehensionScore?: number | null;
  gameplayInterestScore?: number | null;
  enabled?: boolean | null;
  eligibleDaily?: boolean | null;
};

export type PlayabilityResult = {
  playable: boolean;
  blockers: string[];
  warnings: string[];
  playerSourceUrl: string | null;
  playerSourceStatus: "exact" | "general" | null;
};

function below(value: number | null | undefined, floor: number) {
  return value != null && Number(value) < floor;
}

function resolvePlayerSource(input: PlayabilityInput): Pick<PlayabilityResult, "playerSourceUrl" | "playerSourceStatus"> {
  if (hasUsablePlayerSourceStatus(input.playerSourceStatus) && isHumanReadableExternalUrl(input.playerSourceUrl)) {
    return {
      playerSourceUrl: input.playerSourceUrl!,
      playerSourceStatus: input.playerSourceStatus === "exact" ? "exact" : "general",
    };
  }

  if (input.source === "worldbank" && input.indicator) {
    return { playerSourceUrl: worldBankPlayerSourceUrl(input.indicator), playerSourceStatus: "exact" };
  }

  for (const candidate of [input.sourcePageUrl, input.sourceUrl, input.methodologyUrl, input.source ? generalOfficialSourcePage(input.source) : null]) {
    if (isHumanReadableExternalUrl(candidate)) {
      return { playerSourceUrl: candidate!, playerSourceStatus: "general" };
    }
  }

  return { playerSourceUrl: null, playerSourceStatus: null };
}

/**
 * v14.4 canonical playability policy.
 *
 * Editorial, integrity, clarity, and gameplay decisions are hard gates. Link
 * quality is separate: an exact official data page is preferred, while a safe
 * human-readable general official source page is allowed with a warning.
 * Legacy enabled/eligible_daily booleans are diagnostic only so a stale trigger
 * cannot silently erase an otherwise approved category from Daily.
 */
export function evaluateCategoryPlayability(input: PlayabilityInput): PlayabilityResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const source = resolvePlayerSource(input);

  if (input.reviewStatus !== "approved") blockers.push("Editorial review is not approved.");
  if (input.curationStatus != null && input.curationStatus !== "approved") blockers.push("Curation is not approved.");
  if (input.validationStatus !== "verified") blockers.push("Official-source validation is not verified.");
  if (input.contentReviewStatus !== "approved") blockers.push("Content review is not approved.");
  if (below(input.qualityScore, 70)) blockers.push("Quality score is below 70.");
  if (input.credibilityStatus === "quarantined" || below(input.credibilityScore, 75)) blockers.push("Credibility review did not pass.");
  if (input.objectiveStatus != null && input.objectiveStatus !== "objective") blockers.push("The metric is not classified as objective.");
  if (input.playerQualityStatus === "blocked") blockers.push("Player-quality review blocked this category.");
  if (below(input.verifiabilityScore, 80)) blockers.push("Verifiability score is below 80.");
  if (below(input.understandabilityScore, 70)) blockers.push("Understandability score is below 70.");
  if (below(input.funScore, 55)) blockers.push("Gameplay-interest score is below 55.");
  if (below(input.immediateComprehensionScore, 80)) blockers.push("Immediate-comprehension score is below 80.");
  if (below(input.gameplayInterestScore, 65)) blockers.push("Editorial gameplay-interest score is below 65.");
  if (!source.playerSourceUrl) blockers.push("No safe human-readable official source page is available.");

  if (source.playerSourceStatus === "general") {
    warnings.push("Uses a general official source page because an exact shareable data view is unavailable.");
  }
  if (input.enabled === false || input.eligibleDaily === false) {
    warnings.push("Legacy enabled/eligible_daily flags disagree with the v14.4 computed policy.");
  }
  if (!hasUsablePlayerSourceStatus(input.playerSourceStatus) && source.playerSourceUrl) {
    warnings.push("A safe official fallback page replaces a stale or overly strict player-source status.");
  }

  return {
    playable: blockers.length === 0,
    blockers,
    warnings,
    ...source,
  };
}

export function evaluateCategory(category: Category, legacy: { reviewStatus?: string | null; curationStatus?: string | null; validationStatus?: string | null; qualityScore?: number | null; eligibleDaily?: boolean | null } = {}) {
  return evaluateCategoryPlayability({
    id: category.id,
    source: category.source,
    indicator: category.indicator,
    sourceUrl: category.sourceUrl,
    methodologyUrl: category.methodologyUrl,
    sourcePageUrl: category.sourcePageUrl,
    playerSourceUrl: category.playerSourceUrl,
    playerSourceStatus: category.playerSourceStatus,
    reviewStatus: legacy.reviewStatus ?? "approved",
    curationStatus: legacy.curationStatus ?? "approved",
    validationStatus: legacy.validationStatus ?? "verified",
    contentReviewStatus: category.contentReviewStatus,
    qualityScore: legacy.qualityScore,
    credibilityStatus: category.trustStatus,
    credibilityScore: category.credibilityScore,
    objectiveStatus: category.objectiveStatus,
    playerQualityStatus: category.playerQualityStatus,
    verifiabilityScore: category.verifiabilityScore,
    understandabilityScore: category.understandabilityScore,
    funScore: category.funScore,
    immediateComprehensionScore: category.immediateComprehensionScore,
    gameplayInterestScore: category.gameplayInterestScore,
    enabled: category.enabled,
    eligibleDaily: legacy.eligibleDaily,
  });
}
