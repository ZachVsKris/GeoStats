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
  unsdg: "United Nations Statistics Division",
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
  "ranking_direction",
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
  ranking_direction: "high" | "low";
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

type BulkObservationRow = ObservationRow & {
  category_id: string;
};

type WarehouseIdentityRow = {
  id: string;
  source_organization: string;
  source_indicator_code: string;
  ranking_direction: "high" | "low";
  common_year: number | null;
};

type ResolvedCategory = {
  category: Category;
  warehouseId: string;
};

export class WarehouseCategoryError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "WarehouseCategoryError";
    this.status = status;
  }
}

function published(row: CategoryRow) {
  return row.computed_playable_v16_2 === true
    && row.enabled === true
    && row.eligible_daily === true;
}

function identityKey(sourceOrganization: string, indicator: string, direction: string) {
  return `${sourceOrganization}\u0000${indicator}\u0000${direction}`;
}

function sourceOrganizationFor(category: Category) {
  return SOURCE_ORGANIZATIONS[category.source];
}

function normalizeObservation(row: ObservationRow) {
  return {
    country_iso3: String(row.country_iso3),
    country_name: String(row.country_name || row.country_iso3),
    data_year: Number(row.data_year),
    value: Number(row.value),
  };
}

function validObservation(row: ReturnType<typeof normalizeObservation>) {
  return /^[A-Z]{3}$/.test(row.country_iso3)
    && Number.isInteger(row.data_year)
    && Number.isFinite(row.value);
}

function payloadFromCategory(category: CategoryRow, observations: ReturnType<typeof normalizeObservation>[]): WarehousePayload {
  return {
    categoryId: category.id,
    computedPlayableV15: true,
    commonYear: category.common_year ?? undefined,
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
    immediateComprehensionScore: category.immediate_comprehension_score ?? null,
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

async function loadPublishedCategoryRows(lookup: WarehouseLookup): Promise<CategoryRow[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new WarehouseCategoryError("Supabase is not configured.", 503);

  let query = admin
    .from("category_runtime_review_v16_2")
    .select(CATEGORY_SELECT)
    .eq("computed_playable_v16_2", true)
    .eq("enabled", true)
    .eq("eligible_daily", true);

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

  const result = await query
    .order("quality_score", { ascending: false })
    .limit(8);

  if (result.error) {
    const missingMigration = /category_runtime_review_v16_2|does not exist|schema cache/i.test(result.error.message);
    throw new WarehouseCategoryError(
      missingMigration
        ? "The v16.2.7 catalog rebuild is not installed."
        : result.error.message,
      500,
    );
  }
  return (result.data ?? []) as unknown as CategoryRow[];
}

export async function loadServerWarehousePayload(
  lookup: WarehouseLookup,
): Promise<WarehousePayload> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new WarehouseCategoryError("Supabase is not configured.", 503);

  const candidates = await loadPublishedCategoryRows(lookup);
  if (!candidates.length) throw new WarehouseCategoryError("Category not found.", 404);

  // Shared-indicator high/low pairs intentionally point at the same underlying
  // observation series. Any published row for that series is therefore a valid
  // warehouse identity for the payload; the caller's Category retains the
  // player-facing title and ranking direction.
  const category = candidates.find((row) => published(row) && Number.isInteger(row.common_year));
  if (!category) {
    throw new WarehouseCategoryError("This category has no approved common comparison year.", 409);
  }

  const observationResult = await admin
    .from("stat_observations")
    .select("country_iso3,country_name,data_year,value")
    .eq("category_id", category.id)
    .eq("data_year", category.common_year as number)
    .order("country_iso3", { ascending: true })
    .limit(500);

  if (observationResult.error) {
    throw new WarehouseCategoryError(observationResult.error.message, 500);
  }

  const observations = ((observationResult.data ?? []) as ObservationRow[])
    .map(normalizeObservation)
    .filter(validObservation);

  if (!observations.length) {
    throw new WarehouseCategoryError("No approved common-year observations are available.", 404);
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

  return payloadFromCategory(category, observations);
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
  const supabase = admin;
  const errors: BulkWarehouseLoadError[] = [];

  const eligible = categories.filter((category) => {
    if (!category.warehouseBacked) {
      errors.push({ categoryId: category.id, message: "Category is not backed by the curated warehouse." });
      return false;
    }
    if (!Number.isInteger(category.commonYear)) {
      errors.push({ categoryId: category.id, message: "Category has no approved common comparison year." });
      return false;
    }
    return true;
  });

  // The player catalog may deliberately retain a legacy/stable game ID even
  // when the warehouse row was re-imported under a newer descriptive ID.
  // Resolve that identity explicitly before querying stat_observations.
  const identityResult = await supabase
    .from("category_runtime_review_v16_2")
    .select("id,source_organization,source_indicator_code,ranking_direction,common_year")
    .eq("computed_playable_v16_2", true)
    .eq("enabled", true)
    .eq("eligible_daily", true)
    .limit(1000);

  if (identityResult.error) {
    return {
      datasets: [],
      errors: eligible.map((category) => ({ categoryId: category.id, message: identityResult.error!.message })),
    };
  }

  const identityRows = (identityResult.data ?? []) as WarehouseIdentityRow[];
  const byWarehouseId = new Map(identityRows.map((row) => [row.id, row]));
  const byIdentity = new Map<string, WarehouseIdentityRow>();
  for (const row of identityRows) {
    byIdentity.set(identityKey(row.source_organization, row.source_indicator_code, row.ranking_direction), row);
  }

  const resolved: ResolvedCategory[] = [];
  for (const category of eligible) {
    const direct = byWarehouseId.get(category.id);
    const sourceOrganization = sourceOrganizationFor(category);
    const indicator = category.warehouseSourceIndicatorCode ?? category.indicator;
    const mapped = direct ?? (
      sourceOrganization
        ? byIdentity.get(identityKey(sourceOrganization, indicator, category.direction))
        : undefined
    );
    if (!mapped) {
      errors.push({
        categoryId: category.id,
        message: `No published warehouse row resolves stable gameplay category ${category.id}.`,
      });
      continue;
    }
    if (Number(mapped.common_year) !== Number(category.commonYear)) {
      errors.push({
        categoryId: category.id,
        message: `Warehouse identity year mismatch (${mapped.common_year ?? "none"} stored; ${category.commonYear} expected).`,
      });
      continue;
    }
    resolved.push({ category, warehouseId: mapped.id });
  }

  const grouped = new Map<number, ResolvedCategory[]>();
  for (const entry of resolved) {
    const year = entry.category.commonYear as number;
    const group = grouped.get(year) ?? [];
    group.push(entry);
    grouped.set(year, group);
  }

  const rowsByWarehouseId = new Map<string, BulkObservationRow[]>();

  async function loadChunk(year: number, warehouseIds: string[]) {
    let offset = 0;
    const stagedRows = new Map<string, BulkObservationRow[]>();
    while (true) {
      const result = await supabase
        .from("stat_observations")
        .select("category_id,country_iso3,country_name,data_year,value")
        .in("category_id", warehouseIds)
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
    for (const [warehouseId, rows] of stagedRows) {
      const existing = rowsByWarehouseId.get(warehouseId) ?? [];
      existing.push(...rows);
      rowsByWarehouseId.set(warehouseId, existing);
    }
  }

  const failedWarehouseIds = new Set<string>();
  async function loadChunkResilient(year: number, entries: ResolvedCategory[]): Promise<void> {
    const ids = entries.map((entry) => entry.warehouseId);
    try {
      await loadChunk(year, ids);
      return;
    } catch (caught) {
      if (entries.length > 1) {
        const midpoint = Math.ceil(entries.length / 2);
        await Promise.all([
          loadChunkResilient(year, entries.slice(0, midpoint)),
          loadChunkResilient(year, entries.slice(midpoint)),
        ]);
        return;
      }
      const entry = entries[0];
      const message = caught instanceof Error ? caught.message : "Bulk observation loading failed.";
      failedWarehouseIds.add(entry.warehouseId);
      errors.push({ categoryId: entry.category.id, message });
    }
  }

  const tasks: Array<() => Promise<void>> = [];
  for (const [year, entries] of grouped) {
    for (const chunk of chunks(entries, CATEGORY_CHUNK_SIZE)) {
      tasks.push(() => loadChunkResilient(year, chunk));
    }
  }

  let nextTask = 0;
  async function worker() {
    while (true) {
      const index = nextTask++;
      if (index >= tasks.length) return;
      await tasks[index]();
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(MAX_PARALLEL_OBSERVATION_LOADS, tasks.length) },
    () => worker(),
  ));

  const datasets: CategoryDataset[] = [];
  for (const entry of resolved) {
    if (failedWarehouseIds.has(entry.warehouseId)) continue;
    const rows = rowsByWarehouseId.get(entry.warehouseId) ?? [];
    try {
      datasets.push(warehousePayloadToDataset(entry.category, {
        categoryId: entry.warehouseId,
        computedPlayableV15: true,
        commonYear: entry.category.commonYear,
        commonYearCoverage: rows.length,
        rankingComplete: rows.length >= entry.category.coverageFloor,
        observations: rows.map(normalizeObservation).filter(validObservation),
      }));
    } catch (caught) {
      errors.push({
        categoryId: entry.category.id,
        message: caught instanceof Error ? caught.message : "Dataset could not be loaded.",
      });
    }
  }

  return { datasets, errors };
}
