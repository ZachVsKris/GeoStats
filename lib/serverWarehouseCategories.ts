import "server-only";

import type { Category } from "./categories";
import { createSupabaseAdminClient } from "./supabase/server";
import {
  warehousePayloadToDataset,
  type WarehousePayload,
} from "./warehouseCategories";
import type { CategoryDataset } from "./worldBank";

const SOURCE_ORGANIZATIONS: Record<string, string> = {
  worldbank: "World Bank",
  faostat: "FAOSTAT",
  who: "WHO",
  unesco: "UNESCO UIS",
  ilostat: "ILOSTAT",
  naturalearth: "Natural Earth",
  comtrade: "UN Comtrade",
  eia: "U.S. EIA",
  unhcr: "UNHCR",
};

const CATEGORY_SELECT = [
  "id",
  "title",
  "computed_playable_v15",
  "source_organization",
  "source_indicator_code",
  "common_year",
  "common_year_coverage",
  "unit",
  "source_url",
  "methodology_url",
  "source_page_url",
  "player_source_url",
  "player_source_status",
  "player_source_reason",
  "player_source_checked_at",
  "content_review_status",
  "content_review_reason",
  "content_review_version",
  "immediate_comprehension_score",
  "gameplay_interest_score",
  "uniqueness_score",
  "link_quality_score",
  "exact_query_url",
  "download_url",
  "api_url",
  "dataset_release",
  "retrieved_at",
  "license_name",
  "license_url",
  "source_query",
  "derivation_method",
  "derivation_version",
  "input_datasets",
  "evidence_label",
  "credibility_score",
  "credibility_status",
  "credibility_reason",
  "verifiability_score",
  "verifiability_status",
  "understandability_score",
  "fun_score",
  "objective_status",
  "player_quality_status",
  "player_quality_reason",
  "validation_status",
  "validation_version",
  "validated_at",
].join(",");

type WarehouseLookup = {
  categoryId?: string;
  source?: string;
  indicator?: string;
};

type CategoryRow = {
  id: string;
  title: string;
  computed_playable_v15: boolean | null;
  source_organization: string;
  source_indicator_code: string;
  common_year: number | null;
  common_year_coverage: number | null;
  unit: string | null;
  source_url?: string | null;
  methodology_url?: string | null;
  source_page_url?: string | null;
  player_source_url?: string | null;
  player_source_status?: string | null;
  player_source_reason?: string | null;
  player_source_checked_at?: string | null;
  content_review_status?: string | null;
  content_review_reason?: string | null;
  content_review_version?: string | null;
  immediate_comprehension_score?: number | null;
  gameplay_interest_score?: number | null;
  uniqueness_score?: number | null;
  link_quality_score?: number | null;
  exact_query_url?: string | null;
  download_url?: string | null;
  api_url?: string | null;
  dataset_release?: string | null;
  retrieved_at?: string | null;
  license_name?: string | null;
  license_url?: string | null;
  source_query?: Record<string, unknown> | string | null;
  derivation_method?: string | null;
  derivation_version?: string | null;
  input_datasets?: Array<Record<string, unknown> | string> | null;
  evidence_label?: string | null;
  credibility_score?: number | null;
  credibility_status?: string | null;
  credibility_reason?: string | null;
  verifiability_score?: number | null;
  verifiability_status?: string | null;
  understandability_score?: number | null;
  fun_score?: number | null;
  objective_status?: string | null;
  player_quality_status?: string | null;
  player_quality_reason?: string | null;
  validation_status?: string | null;
  validation_version?: string | null;
  validated_at?: string | null;
};

type ObservationRow = {
  country_iso3: string;
  country_name: string;
  data_year: number;
  value: number;
};

export class WarehouseCategoryError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "WarehouseCategoryError";
    this.status = status;
  }
}

export async function loadServerWarehousePayload(
  lookup: WarehouseLookup,
): Promise<WarehousePayload> {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new WarehouseCategoryError("Supabase is not configured.", 503);
  }

  let query = admin
    .from("category_review_queue_v15")
    .select(CATEGORY_SELECT);

  if (lookup.categoryId) {
    query = query.eq("id", lookup.categoryId);
  } else {
    const sourceOrganization = lookup.source
      ? SOURCE_ORGANIZATIONS[lookup.source]
      : undefined;

    if (!sourceOrganization || !lookup.indicator) {
      throw new WarehouseCategoryError("Unsupported warehouse source.", 400);
    }

    query = query
      .eq("source_organization", sourceOrganization)
      .eq("source_indicator_code", lookup.indicator);
  }

  const categoryResult = await query.maybeSingle();

  if (categoryResult.error) {
    const missingMigration =
      /category_review_queue_v15|does not exist|schema cache/i.test(
        categoryResult.error.message,
      );

    throw new WarehouseCategoryError(
      missingMigration
        ? "The v15 category catalog is not installed. Run RUN_THIS_IN_SUPABASE_FOR_V15.sql and RUN_THIS_IN_SUPABASE_FOR_V15_1.sql."
        : categoryResult.error.message,
      500,
    );
  }

  const category = categoryResult.data as CategoryRow | null;

  if (!category) {
    throw new WarehouseCategoryError("Category not found.", 404);
  }

  if (category.computed_playable_v15 !== true) {
    throw new WarehouseCategoryError(
      "This category is not currently playable under the authoritative v15 policy.",
      404,
    );
  }

  if (!category.common_year) {
    throw new WarehouseCategoryError(
      "This category has no approved common comparison year.",
      409,
    );
  }

  const observationResult = await admin
    .from("stat_observations")
    .select("country_iso3,country_name,data_year,value")
    .eq("category_id", category.id)
    .eq("data_year", category.common_year)
    .order("country_iso3", { ascending: true })
    .limit(500);

  if (observationResult.error) {
    throw new WarehouseCategoryError(observationResult.error.message, 500);
  }

  const observations = ((observationResult.data ?? []) as ObservationRow[])
    .map((row) => ({
      country_iso3: String(row.country_iso3),
      country_name: String(row.country_name || row.country_iso3),
      data_year: Number(row.data_year),
      value: Number(row.value),
    }))
    .filter(
      (row) =>
        /^[A-Z]{3}$/.test(row.country_iso3) &&
        Number.isInteger(row.data_year) &&
        Number.isFinite(row.value),
    );

  if (!observations.length) {
    throw new WarehouseCategoryError(
      "No approved common-year observations are available.",
      404,
    );
  }

  const declaredCoverage = Number(category.common_year_coverage ?? 0);

  if (declaredCoverage && observations.length !== declaredCoverage) {
    throw new WarehouseCategoryError(
      `The common-year ranking is incomplete (${observations.length} stored; ${declaredCoverage} expected).`,
      409,
    );
  }

  return {
    categoryId: category.id,
    computedPlayableV15: true,
    commonYear: category.common_year,
    commonYearCoverage: declaredCoverage || observations.length,
    unit: category.unit,
    sourceUrl: category.source_url ?? null,
    methodologyUrl: category.methodology_url ?? null,
    sourcePageUrl: category.source_page_url ?? null,
    playerSourceUrl: category.player_source_url ?? null,
    playerSourceStatus: category.player_source_status ?? null,
    playerSourceReason: category.player_source_reason ?? null,
    playerSourceCheckedAt: category.player_source_checked_at ?? null,
    contentReviewStatus: category.content_review_status ?? null,
    contentReviewReason: category.content_review_reason ?? null,
    contentReviewVersion: category.content_review_version ?? null,
    immediateComprehensionScore:
      category.immediate_comprehension_score ?? null,
    gameplayInterestScore: category.gameplay_interest_score ?? null,
    uniquenessScore: category.uniqueness_score ?? null,
    linkQualityScore: category.link_quality_score ?? null,
    exactQueryUrl: category.exact_query_url ?? null,
    downloadUrl: category.download_url ?? null,
    apiUrl: category.api_url ?? null,
    datasetRelease: category.dataset_release ?? null,
    retrievedAt: category.retrieved_at ?? null,
    licenseName: category.license_name ?? null,
    licenseUrl: category.license_url ?? null,
    sourceQuery: category.source_query ?? null,
    derivationMethod: category.derivation_method ?? null,
    derivationVersion: category.derivation_version ?? null,
    inputDatasets: category.input_datasets ?? null,
    evidenceLabel: category.evidence_label ?? null,
    credibilityScore: category.credibility_score ?? null,
    trustStatus: category.credibility_status ?? null,
    trustReason: category.credibility_reason ?? null,
    verifiabilityScore: category.verifiability_score ?? null,
    verifiabilityStatus: category.verifiability_status ?? null,
    understandabilityScore: category.understandability_score ?? null,
    funScore: category.fun_score ?? null,
    objectiveStatus: category.objective_status ?? null,
    playerQualityStatus: category.player_quality_status ?? null,
    playerQualityReason: category.player_quality_reason ?? null,
    validationStatus: category.validation_status ?? null,
    validationVersion: category.validation_version ?? null,
    validatedAt: category.validated_at ?? null,
    rankingComplete: true,
    observations,
  };
}

export async function fetchServerWarehouseCategory(
  category: Category,
): Promise<CategoryDataset> {
  const payload = category.warehouseSourceIndicatorCode
    ? await loadServerWarehousePayload({
        source: category.source,
        indicator: category.warehouseSourceIndicatorCode,
      })
    : await loadServerWarehousePayload({ categoryId: category.id });

  return warehousePayloadToDataset(category, payload);
}
