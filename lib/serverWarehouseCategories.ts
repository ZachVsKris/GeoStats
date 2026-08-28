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
  faostatfbs: "FAOSTAT Food Balances",
  who: "WHO",
  unesco: "UNESCO UIS",
  ilostat: "ILOSTAT",
  naturalearth: "Natural Earth",
  comtrade: "UN Comtrade",
  eia: "U.S. EIA",
  unhcr: "UNHCR",
  ipu: "Inter-Parliamentary Union",
  untourism: "UN Tourism",
  pewreligion: "Pew Research Center",
  smithsoniangvp: "Smithsonian GVP",
  usgs: "USGS",
  worldcover: "ESA WorldCover",
  hydrosheds: "HydroSHEDS",
  elevation: "Global Elevation",
  unescoheritage: "UNESCO World Heritage Centre",
  aquastat: "FAO AQUASTAT",
  usgsminerals: "USGS Minerals",
  faofisheries: "FAO Fisheries",
  unmembership: "United Nations",
  constitute: "Constitute Project",
  unwpp: "United Nations Population Division",
  worldbankclimate: "World Bank Climate Change Knowledge Portal",
  imfweo: "International Monetary Fund",
  unescoich: "UNESCO",
  noaatsunami: "NOAA National Centers for Environmental Information",
  whoghed: "World Health Organization",
  undesamigrant: "United Nations Population Division",
  wtoservices: "World Trade Organization",
  untourismdirect: "UN Tourism",
  fifa: "FIFA",
  ioc: "International Olympic Committee",
  worldbankhistory: "World Bank",
  globalfindex2025: "World Bank",
  faofra2025: "FAO",
  unicefdata: "UNICEF",
  undphdr: "UNDP",
  vdemv16: "V-Dem Institute",
  faostatfoodsecurity: "FAO",
  koppengeiger: "Beck et al.",
  worldbankinfra: "World Bank WDI Infrastructure & Connectivity",
  faostatlanduse: "FAOSTAT Land Use",
  faostatworldcover: "FAOSTAT / ESA WorldCover 2021",
  worldbankwbl: "World Bank Women, Business and the Law 2026",
  jmpwash: "WHO/UNICEF Joint Monitoring Programme",
  unwup2025: "United Nations Department of Economic and Social Affairs, Population Division",
  unwupcities2025: "United Nations Department of Economic and Social Affairs, Population Division",
};

const CATEGORY_SELECT = [
  "id",
  "title",
  "computed_playable_v16_2",
  "enabled",
  "eligible_daily",
  "promotion_decision_v16_2",
  "semantic_audit_status",
  "semantic_audit_issues",
  "editorial_status",
  "hard_gate_ready",
  "metadata",
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
  computed_playable_v16_2: boolean | null;
  enabled?: boolean | null;
  eligible_daily?: boolean | null;
  promotion_decision_v16_2?: string | null;
  semantic_audit_status?: string | null;
  semantic_audit_issues?: string[] | null;
  editorial_status?: string | null;
  hard_gate_ready?: boolean | null;
  metadata?: Record<string, unknown> | null;
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
    .from("category_runtime_review_v16_2")
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
      /category_runtime_review_v16_2|does not exist|schema cache/i.test(
        categoryResult.error.message,
      );

    throw new WarehouseCategoryError(
      missingMigration
        ? "The v16.2.7 catalog rebuild is not installed. Run RUN_THIS_IN_SUPABASE_FOR_V16_2_7.sql after the v16.2.6 baseline."
        : categoryResult.error.message,
      500,
    );
  }

  const category = categoryResult.data as CategoryRow | null;

  if (!category) {
    throw new WarehouseCategoryError("Category not found.", 404);
  }

  if (
    category.computed_playable_v16_2 !== true
    || category.enabled !== true
    || category.eligible_daily !== true
  ) {
    throw new WarehouseCategoryError(
      "This category is not currently published in the approved gameplay catalog.",
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
  const toleratedShortfall = declaredCoverage
    ? Math.max(3, Math.ceil(declaredCoverage * 0.05))
    : 0;
  if (declaredCoverage && observations.length < declaredCoverage - toleratedShortfall) {
    throw new WarehouseCategoryError(
      `The common-year ranking lost too many observations (${observations.length} stored; ${declaredCoverage} expected; ${toleratedShortfall} maximum tolerated shortfall).`,
      409,
    );
  }

  return {
    categoryId: category.id,
    computedPlayableV15: true,
    commonYear: category.common_year,
    commonYearCoverage: observations.length,
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

export type BulkWarehouseLoadError = {
  categoryId: string;
  message: string;
};

export type BulkWarehouseLoadResult = {
  datasets: CategoryDataset[];
  errors: BulkWarehouseLoadError[];
};

type BulkObservationRow = ObservationRow & {
  category_id: string;
};

const OBSERVATION_PAGE_SIZE = 750;
const CATEGORY_CHUNK_SIZE = 32;
const MAX_PARALLEL_OBSERVATION_LOADS = 4;

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

/**
 * Loads many playable common-year datasets with a small, bounded number of
 * Supabase requests. Daily generation must never issue two database requests
 * per category.
 */
export async function fetchServerWarehouseCategories(
  categories: Category[],
): Promise<BulkWarehouseLoadResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      datasets: [],
      errors: categories.map((category) => ({
        categoryId: category.id,
        message: "Supabase is not configured.",
      })),
    };
  }
  // Preserve the non-null narrowing inside nested async loaders.
  const supabase = admin;

  const errors: BulkWarehouseLoadError[] = [];
  const eligible = categories.filter((category) => {
    if (!category.warehouseBacked) {
      errors.push({
        categoryId: category.id,
        message: "Category is not backed by the curated warehouse.",
      });
      return false;
    }
    if (!Number.isInteger(category.commonYear)) {
      errors.push({
        categoryId: category.id,
        message: "Category has no approved common comparison year.",
      });
      return false;
    }
    return true;
  });

  const grouped = new Map<number, Category[]>();
  for (const category of eligible) {
    const year = category.commonYear as number;
    const group = grouped.get(year) ?? [];
    group.push(category);
    grouped.set(year, group);
  }

  const rowsByCategory = new Map<string, BulkObservationRow[]>();

  async function loadChunk(year: number, categoryIds: string[]) {
    let offset = 0;
    const stagedRows = new Map<string, BulkObservationRow[]>();
    while (true) {
      const result = await supabase
        .from("stat_observations")
        .select("category_id,country_iso3,country_name,data_year,value")
        .in("category_id", categoryIds)
        .eq("data_year", year)
        .order("category_id", { ascending: true })
        .order("country_iso3", { ascending: true })
        .range(offset, offset + OBSERVATION_PAGE_SIZE - 1);

      if (result.error) throw result.error;
      const rows = (result.data ?? []) as BulkObservationRow[];
      for (const row of rows) {
        const categoryRows = stagedRows.get(row.category_id) ?? [];
        categoryRows.push(row);
        stagedRows.set(row.category_id, categoryRows);
      }
      if (rows.length < OBSERVATION_PAGE_SIZE) break;
      offset += OBSERVATION_PAGE_SIZE;
    }

    // Merge only after the complete chunk succeeds. If a later page times out,
    // the resilient split retries the chunk without duplicating earlier pages.
    for (const [categoryId, rows] of stagedRows) {
      const existing = rowsByCategory.get(categoryId) ?? [];
      existing.push(...rows);
      rowsByCategory.set(categoryId, existing);
    }
  }

  const failedCategoryIds = new Set<string>();

  async function loadChunkResilient(year: number, categoryIds: string[]): Promise<void> {
    try {
      await loadChunk(year, categoryIds);
      return;
    } catch (caught) {
      // A single malformed or oversized category must not make an entire
      // 80-category batch disappear from the generator. Split failed batches
      // until the exact category-level failure is isolated.
      if (categoryIds.length > 1) {
        const midpoint = Math.ceil(categoryIds.length / 2);
        await Promise.all([
          loadChunkResilient(year, categoryIds.slice(0, midpoint)),
          loadChunkResilient(year, categoryIds.slice(midpoint)),
        ]);
        return;
      }
      const categoryId = categoryIds[0];
      const message = caught instanceof Error
        ? caught.message
        : "Bulk observation loading failed.";
      failedCategoryIds.add(categoryId);
      errors.push({ categoryId, message });
    }
  }

  const tasks: Array<() => Promise<void>> = [];
  for (const [year, yearCategories] of grouped) {
    for (const categoryChunk of chunks(yearCategories, CATEGORY_CHUNK_SIZE)) {
      tasks.push(() => loadChunkResilient(year, categoryChunk.map((category) => category.id)));
    }
  }

  // A cold Random cache used to launch every year/chunk query simultaneously.
  // On the hosted database that can exhaust the statement budget and cause the
  // very cache rebuild that should make later Random requests fast to fail.
  // Keep a small bounded pool instead; the per-query work is also smaller now.
  let nextTask = 0;
  async function worker() {
    while (true) {
      const index = nextTask;
      nextTask += 1;
      if (index >= tasks.length) return;
      await tasks[index]();
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(MAX_PARALLEL_OBSERVATION_LOADS, tasks.length) },
    () => worker(),
  ));

  const datasets: CategoryDataset[] = [];
  for (const category of eligible) {
    if (failedCategoryIds.has(category.id)) continue;
    const rows = rowsByCategory.get(category.id) ?? [];
    try {
      const dataset = warehousePayloadToDataset(category, {
        computedPlayableV15: true,
        commonYear: category.commonYear,
        commonYearCoverage: rows.length,
        rankingComplete: rows.length >= category.coverageFloor,
        observations: rows.map((row) => ({
          country_iso3: String(row.country_iso3),
          country_name: String(row.country_name || row.country_iso3),
          data_year: Number(row.data_year),
          value: Number(row.value),
        })),
      });
      datasets.push(dataset);
    } catch (caught) {
      errors.push({
        categoryId: category.id,
        message: caught instanceof Error ? caught.message : "Dataset could not be loaded.",
      });
    }
  }

  return { datasets, errors };
}

