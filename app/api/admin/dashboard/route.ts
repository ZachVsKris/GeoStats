import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/supabase/adminAuth";
import { newYorkDate } from "../../../../lib/time";
import { categorySemanticSimilarity, MAX_SAME_BOARD_SEMANTIC_SIMILARITY } from "../../../../lib/categorySemantics";
import type { Category, DataSourceId } from "../../../../lib/categories";
import { MAX_BOARD_WINNER_GLOBAL_RANK } from "../../../../lib/gameRules";

export const dynamic = "force-dynamic";

const CATEGORY_COLUMNS = [
  "id", "title", "short_title", "description", "source_organization", "source_dataset", "source_indicator_code",
  "enabled", "eligible_daily", "quality_score", "country_coverage", "latest_available_year",
  "family", "unit", "measurement_type", "review_status", "evidence_tier", "auto_qualified", "common_year",
  "common_year_coverage", "official_observation_share", "modeled_observation_share",
  "clustering_score", "stability_score", "quality_standard_version", "recognizability_score",
  "specificity_score", "canonical_match_status", "provenance_status", "provenance_class",
  "provenance_reason", "source_url", "methodology_url", "independent_validation", "government_assertion_risk",
  "concept_group", "semantic_family", "semantic_topic", "duplicate_status", "superseded_by", "auto_decision_reason", "curation_status",
  "curation_reason", "curation_version", "credibility_score", "credibility_status",
  "credibility_reason", "evidence_label", "comparability_risk", "corroboration_status",
  "plain_language_description", "technical_definition", "unit_explanation", "source_page_url",
  "exact_query_url", "download_url", "api_url", "dataset_release", "retrieved_at", "license_name",
  "license_url", "derivation_method", "derivation_version", "verifiability_score",
  "verifiability_status", "understandability_score", "fun_score", "objective_status",
  "player_quality_status", "player_quality_reason", "validation_status", "validation_version",
  "validated_at", "validation_reason", "validation_expected_count", "validated_observation_count",
  "validation_mismatch_count", "validation_ranking_mismatch_count",
  "player_source_url", "player_source_status", "player_source_reason", "player_source_checked_at",
  "content_review_status", "content_review_reason", "content_review_version",
  "immediate_comprehension_score", "gameplay_interest_score", "uniqueness_score", "link_quality_score",
  "editorial_status", "hard_gate_ready", "computed_playable_v16", "v16_blockers", "v16_warnings",
  "computed_playable_v16_2", "v16_2_blockers", "v16_2_warnings", "promotion_decision_v16_2",
  "promotion_reason_v16_2", "primary_blocker_v16_2", "blocker_class_v16_2",
  "strict_pass_v16_2", "source_quality_floor_v16_2", "suggested_duplicate_of_v16_2",
  "ranking_completeness_status", "ranking_completeness_reason", "top_value_distinct_count", "top_value_feasible",
].join(",");

type BoardRow = { difficulty: "easy" | "normal" | "expert" };
type CategoryRow = {
  id?: string;
  title?: string;
  short_title?: string | null;
  description?: string | null;
  plain_language_description?: string | null;
  source_organization?: string | null;
  source_indicator_code?: string | null;
  source_url?: string | null;
  methodology_url?: string | null;
  source_page_url?: string | null;
  family?: string | null;
  unit?: string | null;
  measurement_type?: "total" | "share" | "per_capita" | "historical_date" | "other" | null;
  semantic_family?: string | null;
  semantic_topic?: string | null;
  enabled?: boolean;
  quality_score?: number | null;
  credibility_status?: string | null;
  credibility_score?: number | null;
  objective_status?: string | null;
  player_quality_status?: string | null;
  verifiability_score?: number | null;
  understandability_score?: number | null;
  fun_score?: number | null;
  eligible_daily?: boolean;
  review_status?: "candidate" | "needs_review" | "approved" | "rejected";
  curation_status?: "pending" | "approved" | "excluded" | null;
  retrieved_at?: string | null;
  validation_status?: "pending" | "verified" | "failed" | "unable_to_verify";
  player_source_url?: string | null;
  player_source_status?: "pending" | "exact" | "general" | "needs_exact_url" | "invalid" | "unavailable" | null;
  player_source_reason?: string | null;
  player_source_checked_at?: string | null;
  content_review_status?: "pending" | "approved" | "excluded" | null;
  content_review_reason?: string | null;
  content_review_version?: string | null;
  immediate_comprehension_score?: number | null;
  gameplay_interest_score?: number | null;
  uniqueness_score?: number | null;
  link_quality_score?: number | null;
  editorial_status?: "pending" | "approved" | "rejected" | "duplicate" | "needs_rewrite" | "needs_discussion";
  hard_gate_ready?: boolean | null;
  computed_playable_v16?: boolean | null;
  v16_blockers?: string[] | null;
  v16_warnings?: string[] | null;
  computed_playable_v16_2?: boolean | null;
  v16_2_blockers?: string[] | null;
  v16_2_warnings?: string[] | null;
  promotion_decision_v16_2?: string | null;
  promotion_reason_v16_2?: string | null;
  primary_blocker_v16_2?: string | null;
  blocker_class_v16_2?: string | null;
  strict_pass_v16_2?: boolean | null;
  source_quality_floor_v16_2?: number | null;
  suggested_duplicate_of_v16_2?: string | null;
  ranking_completeness_status?: string | null;
  ranking_completeness_reason?: string | null;
  top_value_distinct_count?: number | null;
  top_value_feasible?: boolean | null;
};

type AnalyticsOverview = {
  visitors: number;
  page_views: number;
  games_started: number;
  games_completed: number;
  shares: number;
  average_percent: number | null;
  signed_in_users_seen: number;
};

const emptyAnalytics: AnalyticsOverview = {
  visitors: 0,
  page_views: 0,
  games_started: 0,
  games_completed: 0,
  shares: 0,
  average_percent: null,
  signed_in_users_seen: 0,
};

const SOURCE_ID_BY_ORGANIZATION: Record<string, DataSourceId> = {
  "World Bank": "worldbank",
  FAOSTAT: "faostat",
  WHO: "who",
  "UNESCO UIS": "unesco",
  "UNESCO World Heritage Centre": "unescoheritage",
  "Pew Research Center": "pewreligion",
  "FAOSTAT Food Balances": "faostatfbs",
  "Smithsonian GVP": "smithsoniangvp",
  USGS: "usgs",
  ILOSTAT: "ilostat",
  "Natural Earth": "naturalearth",
  "UN Comtrade": "comtrade",
  "U.S. EIA": "eia",
  UNHCR: "unhcr",
  "UN Tourism": "untourism",
  "United Nations": "unmembership",
  "Constitute Project": "constitute",
  "Inter-Parliamentary Union": "ipu",
  "United Nations Population Division": "unwpp",
  "World Bank Climate Change Knowledge Portal": "worldbankclimate",
  "International Monetary Fund": "imfweo",
  "UNESCO": "unescoich",
  "NOAA National Centers for Environmental Information": "noaatsunami",
  "FAO AQUASTAT": "aquastat",
  "FAO Fisheries": "faofisheries",
  "USGS Minerals": "usgsminerals",
};

function semanticCategory(row: CategoryRow): Category | null {
  if (!row.id || !row.title || !row.source_indicator_code) return null;
  return {
    id: row.id,
    name: row.title,
    shortName: row.short_title?.trim() || row.title,
    description: row.plain_language_description?.trim() || row.description?.trim() || row.title,
    indicator: row.source_indicator_code,
    icon: "📊",
    unit: row.unit || "value",
    family: row.family || "Other",
    direction: "high",
    source: SOURCE_ID_BY_ORGANIZATION[row.source_organization || ""] || "worldbank",
    dataset: "Admin semantic review",
    measurementType: row.measurement_type || undefined,
    certified: true,
    certificationGrade: "B",
    coverageFloor: 1,
    semanticFamily: row.semantic_family || undefined,
    semanticTopic: row.semantic_topic || undefined,
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { admin } = auth;
  const today = newYorkDate();
  const [obsCount, countryCount, imports, sources, boards, scoreCount, usernameCount] = await Promise.all([
    admin.from("stat_observations").select("country_iso3", { count: "exact", head: true }),
    admin.from("countries").select("iso3", { count: "exact", head: true }).eq("playable", true),
    admin.from("stat_import_runs").select("*").order("started_at", { ascending: false }).limit(20),
    admin.from("data_sources").select("*").order("display_order"),
    admin.from("daily_challenges").select("difficulty").eq("challenge_date", today),
    admin.from("daily_scores").select("id", { count: "exact", head: true }).eq("challenge_date", today),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("username_customized", true),
  ]);

  const requiredErrors = [obsCount.error, countryCount.error, imports.error, sources.error, boards.error, scoreCount.error].filter(Boolean);
  if (requiredErrors.length) {
    return NextResponse.json({ error: requiredErrors[0]?.message || "Warehouse query failed." }, { status: 500 });
  }

  // Supabase commonly caps a single response at 1,000 rows, so page through the catalog.
  const categoryRows: CategoryRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await admin
      .from("category_runtime_review_v16_2")
      .select(CATEGORY_COLUMNS)
      .order("title")
      .range(from, from + 999);
    if (error) {
      const message = error.message ?? "Warehouse query failed.";
      const guidance = /schema cache/i.test(message)
        ? "Supabase has not refreshed the v16.2.7 REST schema cache. Run NOTIFY pgrst, 'reload schema'; and retry after 30 seconds."
        : /category_runtime_review_v16_2|does not exist/i.test(message)
          ? "Run RUN_THIS_IN_SUPABASE_FOR_V16_2_7.sql after the v16.2.6 baseline before loading the v16.2.7 Admin dashboard."
          : message;
      return NextResponse.json({ error: guidance }, { status: 500 });
    }
    categoryRows.push(...((page ?? []) as CategoryRow[]));
    if ((page ?? []).length < 1000) break;
  }

  const computedCategoryRows = categoryRows.map((row) => ({
    ...row,
    computed_playable: row.computed_playable_v16_2 === true,
    playability_blockers: row.v16_2_blockers ?? row.v16_blockers ?? [],
    playability_warnings: row.v16_2_warnings ?? row.v16_warnings ?? [],
    effective_player_source_url: row.player_source_url ?? null,
    effective_player_source_status: row.player_source_status ?? null,
  }));

  // Analytics is optional until the v14.1 migration is applied. Missing views must not break Admin.
  let analytics = emptyAnalytics;
  const analyticsResult = await admin.from("analytics_overview_30d").select("*").maybeSingle();
  if (!analyticsResult.error && analyticsResult.data) {
    const row = analyticsResult.data as Partial<AnalyticsOverview>;
    analytics = {
      visitors: Number(row.visitors ?? 0),
      page_views: Number(row.page_views ?? 0),
      games_started: Number(row.games_started ?? 0),
      games_completed: Number(row.games_completed ?? 0),
      shares: Number(row.shares ?? 0),
      average_percent: row.average_percent == null ? null : Number(row.average_percent),
      signed_in_users_seen: Number(row.signed_in_users_seen ?? 0),
    };
  }

  const generationResult = await admin
    .from("daily_generation_runs")
    .select("id,created_at,challenge_date,status,source,error_message")
    .order("created_at", { ascending: false })
    .limit(10);
  const generationRuns = generationResult.error ? [] : generationResult.data ?? [];

  const [catalogBalanceResult, reachabilityResult] = await Promise.all([
    admin.from("catalog_macro_domain_summary_v16_2_7").select("*").order("playable", { ascending: false }),
    admin.from("generator_reachability_summary_v16_2_7").select("*").maybeSingle(),
  ]);
  const catalogBalance = {
    migrationApplied: !catalogBalanceResult.error,
    rows: catalogBalanceResult.error ? [] : catalogBalanceResult.data ?? [],
  };
  const generatorReachability = {
    migrationApplied: !reachabilityResult.error,
    summary: reachabilityResult.error || !reachabilityResult.data ? {
      playable: computedCategoryRows.filter((row) => row.computed_playable).length,
      categories_with_reachability_proof: 0,
      failed_difficulty_checks: 0,
      last_checked_at: null,
    } : reachabilityResult.data,
  };

  const [categoryExposureSummaryResult, categoryExposureTopResult, countryExposureSummaryResult] = await Promise.all([
    admin.from("daily_category_exposure_summary_v16_2_6").select("*").maybeSingle(),
    admin.from("daily_category_exposure_top_v16_2_6").select("*").order("appearances", { ascending: false }).limit(10),
    admin.from("daily_country_exposure_summary_v16_2_6").select("*").maybeSingle(),
  ]);
  const diversity = {
    migrationApplied: !categoryExposureSummaryResult.error && !countryExposureSummaryResult.error,
    categories: categoryExposureSummaryResult.error ? {
      daily_dates: 0,
      category_slots: 0,
      distinct_categories: 0,
      playable_catalog_size: 0,
      catalog_utilization_percent: null,
      categories_three_plus: 0,
      max_category_appearances: null,
      median_repeat_interval_days: null,
    } : categoryExposureSummaryResult.data,
    topCategories: categoryExposureTopResult.error ? [] : categoryExposureTopResult.data ?? [],
    countries: countryExposureSummaryResult.error ? {
      daily_dates: 0,
      country_slots: 0,
      distinct_countries: 0,
      max_country_appearances: null,
      median_repeat_interval_days: null,
    } : countryExposureSummaryResult.data,
  };

  const [integrityOverviewResult, integrityBySourceResult, integrityIssuesResult, validationRunsResult, semanticConflictsResult, contentLinkOverviewResult, contentLinkIssuesResult] = await Promise.all([
    admin.from("data_integrity_overview_v16_2").select("*").maybeSingle(),
    admin.from("data_integrity_by_source_v16_2").select("*").order("source"),
    admin.from("data_integrity_issues_v16_2").select("*").limit(50),
    admin.from("stat_validation_runs").select("*").order("started_at", { ascending: false }).limit(20),
    admin.from("board_semantic_conflicts").select("*").limit(100),
    admin.from("category_content_link_overview").select("*").maybeSingle(),
    admin.from("category_content_link_issues").select("*").limit(100),
  ]);
  const integrity = {
    overview: integrityOverviewResult.error ? { enforcement_enabled: false, categories: 0, playable: 0, verified: 0, verified_with_warnings: 0, blocked: 0, audit_pending: 0, unverified_playable: 0 } : integrityOverviewResult.data,
    bySource: integrityBySourceResult.error ? [] : integrityBySourceResult.data ?? [],
    issues: integrityIssuesResult.error ? [] : integrityIssuesResult.data ?? [],
    runs: validationRunsResult.error ? [] : validationRunsResult.data ?? [],
    migrationApplied: !integrityOverviewResult.error,
  };
  const contentLinks = {
    overview: contentLinkOverviewResult.error ? { categories: 0, content_approved: 0, content_excluded: 0, content_pending: 0, exact_player_links: 0, general_player_links: 0, links_pending: 0, links_blocked: 0, playable: 0 } : contentLinkOverviewResult.data,
    issues: contentLinkIssuesResult.error ? [] : contentLinkIssuesResult.data ?? [],
    migrationApplied: !contentLinkOverviewResult.error,
  };
  const playableSemanticCategories = computedCategoryRows
    .filter((row) => row.computed_playable)
    .map(semanticCategory)
    .filter((category): category is Category => Boolean(category));
  const similarityConflicts: Array<{ first_category_id: string; first_title: string; second_category_id: string; second_title: string; score: number }> = [];
  for (let first = 0; first < playableSemanticCategories.length; first += 1) {
    for (let second = first + 1; second < playableSemanticCategories.length; second += 1) {
      const left = playableSemanticCategories[first];
      const right = playableSemanticCategories[second];
      if (left.semanticFamily && right.semanticFamily && left.semanticFamily === right.semanticFamily) continue;
      const score = categorySemanticSimilarity(left, right);
      if (score < MAX_SAME_BOARD_SEMANTIC_SIMILARITY) continue;
      similarityConflicts.push({
        first_category_id: left.id,
        first_title: left.name,
        second_category_id: right.id,
        second_title: right.name,
        score: Number(score.toFixed(3)),
      });
    }
  }
  similarityConflicts.sort((left, right) => right.score - left.score || left.first_title.localeCompare(right.first_title));
  const boardQuality = {
    migrationApplied: !semanticConflictsResult.error,
    semanticConflicts: semanticConflictsResult.error ? [] : semanticConflictsResult.data ?? [],
    similarityConflicts: similarityConflicts.slice(0, 100),
    semanticSimilarityThreshold: MAX_SAME_BOARD_SEMANTIC_SIMILARITY,
    winnerGlobalRankLimit: MAX_BOARD_WINNER_GLOBAL_RANK,
  };

  const boardMap: Record<"easy" | "normal" | "expert", boolean> = { easy: false, normal: false, expert: false };
  for (const board of (boards.data ?? []) as BoardRow[]) {
    if (board.difficulty in boardMap) boardMap[board.difficulty] = true;
  }

  const reviewCounts = { candidate: 0, needs_review: 0, approved: 0, rejected: 0, pending_editorial: 0 };
  const sourceHealthMap = new Map<string, { source: string; categories: number; playable: number; pending: number; latestRetrieved: string | null }>();
  for (const category of computedCategoryRows) {
    const editorial = category.editorial_status;
    if (editorial === "approved") reviewCounts.approved += 1;
    else if (editorial === "rejected" || editorial === "duplicate") reviewCounts.rejected += 1;
    else {
      reviewCounts.pending_editorial += 1;
      reviewCounts.needs_review += 1;
    }

    const source = category.source_organization?.trim() || "Unknown source";
    const current = sourceHealthMap.get(source) ?? { source, categories: 0, playable: 0, pending: 0, latestRetrieved: null };
    current.categories += 1;
    if (category.computed_playable) current.playable += 1;
    if (!["approved", "rejected", "duplicate"].includes(String(category.editorial_status ?? "pending"))) current.pending += 1;
    if (category.retrieved_at && (!current.latestRetrieved || category.retrieved_at > current.latestRetrieved)) current.latestRetrieved = category.retrieved_at;
    sourceHealthMap.set(source, current);
  }

  return NextResponse.json({
    stats: {
      categories: computedCategoryRows.length,
      observations: obsCount.count ?? 0,
      countries: countryCount.count ?? 0,
      usernames: usernameCount.error ? 0 : usernameCount.count ?? 0,
    },
    analytics,
    generationRuns,
    diversity,
    integrity,
    contentLinks,
    catalogBalance,
    generatorReachability,
    boardQuality,
    sourceHealth: [...sourceHealthMap.values()].sort((left, right) => right.categories - left.categories),
    reviewCounts,
    sources: sources.data ?? [],
    imports: imports.data ?? [],
    categories: computedCategoryRows,
    boards: boardMap,
    todayScoreCount: scoreCount.count ?? 0,
  });
}
