import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/supabase/adminAuth";
import { newYorkDate } from "../../../../lib/time";

export const dynamic = "force-dynamic";

const CATEGORY_COLUMNS = [
  "id", "title", "source_organization", "source_dataset", "source_indicator_code",
  "enabled", "eligible_daily", "quality_score", "country_coverage", "latest_available_year",
  "family", "unit", "review_status", "evidence_tier", "auto_qualified", "common_year",
  "common_year_coverage", "official_observation_share", "modeled_observation_share",
  "clustering_score", "stability_score", "quality_standard_version", "recognizability_score",
  "specificity_score", "canonical_match_status", "provenance_status", "provenance_class",
  "provenance_reason", "methodology_url", "independent_validation", "government_assertion_risk",
  "concept_group", "duplicate_status", "superseded_by", "auto_decision_reason", "curation_status",
  "curation_reason", "curation_version", "credibility_score", "credibility_status",
  "credibility_reason", "evidence_label", "comparability_risk", "corroboration_status",
  "plain_language_description", "technical_definition", "unit_explanation", "source_page_url",
  "exact_query_url", "download_url", "api_url", "dataset_release", "retrieved_at", "license_name",
  "license_url", "derivation_method", "derivation_version", "verifiability_score",
  "verifiability_status", "understandability_score", "fun_score", "objective_status",
  "player_quality_status", "player_quality_reason", "validation_status", "validation_version",
  "validated_at", "validation_reason", "validation_expected_count", "validated_observation_count",
  "validation_mismatch_count", "validation_ranking_mismatch_count",
].join(",");

type BoardRow = { difficulty: "easy" | "normal" | "expert" };
type CategoryRow = {
  source_organization?: string | null;
  enabled?: boolean;
  eligible_daily?: boolean;
  review_status?: "candidate" | "needs_review" | "approved" | "rejected";
  curation_status?: "pending" | "approved" | "excluded" | null;
  retrieved_at?: string | null;
  validation_status?: "pending" | "verified" | "failed" | "unable_to_verify";
};

type AnalyticsOverview = {
  visitors: number;
  page_views: number;
  games_started: number;
  games_completed: number;
  shares: number;
  average_score: number | null;
  signed_in_users_seen: number;
};

const emptyAnalytics: AnalyticsOverview = {
  visitors: 0,
  page_views: 0,
  games_started: 0,
  games_completed: 0,
  shares: 0,
  average_score: null,
  signed_in_users_seen: 0,
};

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
      .from("stat_categories")
      .select(CATEGORY_COLUMNS)
      .order("title")
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    categoryRows.push(...((page ?? []) as CategoryRow[]));
    if ((page ?? []).length < 1000) break;
  }

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
      average_score: row.average_score == null ? null : Number(row.average_score),
      signed_in_users_seen: Number(row.signed_in_users_seen ?? 0),
    };
  }

  const generationResult = await admin
    .from("daily_generation_runs")
    .select("id,created_at,challenge_date,status,source,error_message")
    .order("created_at", { ascending: false })
    .limit(10);
  const generationRuns = generationResult.error ? [] : generationResult.data ?? [];

  const [integrityOverviewResult, integrityBySourceResult, integrityIssuesResult, validationRunsResult] = await Promise.all([
    admin.from("data_integrity_overview").select("*").maybeSingle(),
    admin.from("data_integrity_by_source").select("*").order("source"),
    admin.from("data_integrity_issues").select("*").limit(50),
    admin.from("stat_validation_runs").select("*").order("started_at", { ascending: false }).limit(20),
  ]);
  const integrity = {
    overview: integrityOverviewResult.error ? { enforcement_enabled: false, categories: 0, playable: 0, verified: 0, failed: 0, unable_to_verify: 0, pending: 0, unverified_playable: 0 } : integrityOverviewResult.data,
    bySource: integrityBySourceResult.error ? [] : integrityBySourceResult.data ?? [],
    issues: integrityIssuesResult.error ? [] : integrityIssuesResult.data ?? [],
    runs: validationRunsResult.error ? [] : validationRunsResult.data ?? [],
    migrationApplied: !integrityOverviewResult.error,
  };

  const boardMap: Record<"easy" | "normal" | "expert", boolean> = { easy: false, normal: false, expert: false };
  for (const board of (boards.data ?? []) as BoardRow[]) {
    if (board.difficulty in boardMap) boardMap[board.difficulty] = true;
  }

  const reviewCounts = { candidate: 0, needs_review: 0, approved: 0, rejected: 0, pending_editorial: 0 };
  const sourceHealthMap = new Map<string, { source: string; categories: number; playable: number; pending: number; latestRetrieved: string | null }>();
  for (const category of categoryRows) {
    if (category.review_status && category.review_status in reviewCounts) reviewCounts[category.review_status] += 1;
    if (category.curation_status === "pending") reviewCounts.pending_editorial += 1;

    const source = category.source_organization?.trim() || "Unknown source";
    const current = sourceHealthMap.get(source) ?? { source, categories: 0, playable: 0, pending: 0, latestRetrieved: null };
    current.categories += 1;
    if (category.enabled && category.eligible_daily) current.playable += 1;
    if (category.curation_status === "pending" || category.review_status === "needs_review" || category.review_status === "candidate") current.pending += 1;
    if (category.retrieved_at && (!current.latestRetrieved || category.retrieved_at > current.latestRetrieved)) current.latestRetrieved = category.retrieved_at;
    sourceHealthMap.set(source, current);
  }

  return NextResponse.json({
    stats: {
      categories: categoryRows.length,
      observations: obsCount.count ?? 0,
      countries: countryCount.count ?? 0,
      usernames: usernameCount.error ? 0 : usernameCount.count ?? 0,
    },
    analytics,
    generationRuns,
    integrity,
    sourceHealth: [...sourceHealthMap.values()].sort((left, right) => right.categories - left.categories),
    reviewCounts,
    sources: sources.data ?? [],
    imports: imports.data ?? [],
    categories: categoryRows,
    boards: boardMap,
    todayScoreCount: scoreCount.count ?? 0,
  });
}
