import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

type ReviewStatus = "pending" | "approved" | "rejected" | "duplicate" | "needs_rewrite" | "needs_discussion";

const STATUSES = new Set<ReviewStatus>([
  "pending",
  "approved",
  "rejected",
  "duplicate",
  "needs_rewrite",
  "needs_discussion",
]);

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(parsed)));
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const source = (url.searchParams.get("source") ?? "all").trim();
  const statusValue = (url.searchParams.get("status") ?? "pending").trim() as ReviewStatus | "all";
  const readiness = (url.searchParams.get("readiness") ?? "all").trim();
  const audit = (url.searchParams.get("audit") ?? "all").trim();
  const promotion = (url.searchParams.get("promotion") ?? "all").trim();
  const sort = (url.searchParams.get("sort") ?? "priority").trim();
  const page = boundedInteger(url.searchParams.get("page"), 1, 1, 10_000);
  const limit = boundedInteger(url.searchParams.get("limit"), 60, 10, 150);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  if (statusValue !== "all" && !STATUSES.has(statusValue)) {
    return NextResponse.json({ error: "Unsupported review status." }, { status: 400 });
  }
  if (!new Set(["all", "ready", "blocked"]).has(readiness)) {
    return NextResponse.json({ error: "Unsupported readiness filter." }, { status: 400 });
  }
  if (!new Set(["all", "pass", "rewrite_required", "data_repair_required", "review_required", "excluded"]).has(audit)) {
    return NextResponse.json({ error: "Unsupported semantic-audit filter." }, { status: 400 });
  }
  if (!new Set(["all", "playable", "auto_promote", "manual_review", "rewrite_required", "data_repair_required", "duplicate", "excluded"]).has(promotion)) {
    return NextResponse.json({ error: "Unsupported catalog-outcome filter." }, { status: 400 });
  }

  let categoriesQuery = auth.admin
    .from("category_review_workbench_v16_2")
    .select(
      "id,title,effective_title,short_title,description,plain_language_description,unit,value_type,measurement_type,release_disposition_v16_2_3,release_disposition_reason_v16_2_3,ranking_direction,family,source_organization,source_dataset,source_indicator_code,source_url,source_page_url,methodology_url,player_source_url,player_source_status,quality_score,country_coverage,latest_available_year,common_year,common_year_coverage,minimum_year,semantic_family,semantic_topic,concept_group,editorial_status,political_self_reported,confusing,esoteric,subjective_or_composite,stale_data,poor_coverage,duplicate_of,recommended_title,semantic_group,editorial_notes,reviewed_at,editorial_updated_at,effective_semantic_group,hard_gate_ready,editorial_ready,computed_playable_v16_2,v16_2_blockers,v16_2_warnings,promotion_decision_v16_2,promotion_reason_v16_2,primary_blocker_v16_2,blocker_class_v16_2,strict_pass_v16_2,source_quality_floor_v16_2,suggested_duplicate_of_v16_2,computed_playable_v16,v16_blockers,v16_warnings,semantic_audit_status,semantic_source_identity_status,semantic_title_unit_status,semantic_result_logic_status,semantic_audit_issues,semantic_audit_warnings,validation_status,validation_reason,credibility_status,credibility_score,objective_status,player_quality_status,content_review_status,curation_status,metadata,auto_vetting_recommendation,auto_vetting_score,auto_vetting_reason,auto_possible_duplicate_of,auto_title_similarity,auto_rank_correlation,auto_tie_share,auto_vetting_version,auto_vetted_at",
      { count: "exact" },
    );

  if (statusValue !== "all") categoriesQuery = categoriesQuery.eq("editorial_status", statusValue);
  if (source !== "all") categoriesQuery = categoriesQuery.eq("source_organization", source);
  if (readiness === "ready") categoriesQuery = categoriesQuery.eq("hard_gate_ready", true);
  if (readiness === "blocked") categoriesQuery = categoriesQuery.eq("hard_gate_ready", false);
  if (audit !== "all") categoriesQuery = categoriesQuery.eq("semantic_audit_status", audit);
  if (promotion !== "all") categoriesQuery = categoriesQuery.eq("promotion_decision_v16_2", promotion);
  if (query) {
    const safeQuery = query.replace(/[,%()]/g, " ").trim();
    if (safeQuery) {
      categoriesQuery = categoriesQuery.or(
        `effective_title.ilike.%${safeQuery}%,source_indicator_code.ilike.%${safeQuery}%,source_organization.ilike.%${safeQuery}%,effective_semantic_group.ilike.%${safeQuery}%`,
      );
    }
  }

  if (sort === "title") categoriesQuery = categoriesQuery.order("effective_title", { ascending: true });
  else if (sort === "quality") categoriesQuery = categoriesQuery.order("quality_score", { ascending: false, nullsFirst: false });
  else if (sort === "coverage") categoriesQuery = categoriesQuery.order("common_year_coverage", { ascending: false, nullsFirst: false });
  else if (sort === "source") categoriesQuery = categoriesQuery.order("source_organization", { ascending: true }).order("effective_title", { ascending: true });
  else {
    categoriesQuery = categoriesQuery
      .order("hard_gate_ready", { ascending: false })
      .order("quality_score", { ascending: false, nullsFirst: false })
      .order("common_year_coverage", { ascending: false, nullsFirst: false })
      .order("effective_title", { ascending: true });
  }

  const [categoriesResult, overviewResult, sourceResult] = await Promise.all([
    categoriesQuery.range(from, to),
    auth.admin.from("category_review_overview_v16_2").select("*").maybeSingle(),
    auth.admin
      .from("category_review_workbench_v16_2")
      .select("source_organization,editorial_status,hard_gate_ready,computed_playable_v16_2,promotion_decision_v16_2,metadata")
      .limit(10000),
  ]);

  const error = categoriesResult.error ?? overviewResult.error ?? sourceResult.error;
  if (error) {
    const migrationMissing = /category_review_(queue|overview)_v15|does not exist|schema cache/i.test(error.message);
    return NextResponse.json(
      {
        error: migrationMissing
          ? "Run RUN_THIS_IN_SUPABASE_FOR_V16_2_4.sql before using the Category Review Workbench."
          : error.message,
        migrationApplied: !migrationMissing,
      },
      { status: migrationMissing ? 409 : 500 },
    );
  }

  const sourceMap = new Map<string, { total: number; pending: number; approved: number; ready: number; playable: number; approvedBlocked: number; rejected: number }>();
  let playable = 0;
  let approvedBlocked = 0;
  let integrityReady = 0;
  for (const row of sourceResult.data ?? []) {
    const name = String(row.source_organization ?? "Unknown");
    const summary = sourceMap.get(name) ?? {
      total: 0,
      pending: 0,
      approved: 0,
      ready: 0,
      playable: 0,
      approvedBlocked: 0,
      rejected: 0,
    };
    summary.total += 1;
    if (row.editorial_status === "pending") summary.pending += 1;
    if (row.editorial_status === "approved") summary.approved += 1;
    if (["rejected", "duplicate"].includes(String(row.editorial_status))) summary.rejected += 1;
    if (row.hard_gate_ready) {
      summary.ready += 1;
      integrityReady += 1;
    }
    if (row.computed_playable_v16_2) {
      summary.playable += 1;
      playable += 1;
    } else if (row.editorial_status === "approved") {
      summary.approvedBlocked += 1;
      approvedBlocked += 1;
    }
    sourceMap.set(name, summary);
  }

  return NextResponse.json({
    migrationApplied: true,
    overview: overviewResult.data ?? {},
    sources: [...sourceMap.entries()]
      .map(([name, summary]) => ({ name, ...summary }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    categories: categoriesResult.data ?? [],
    pagination: {
      page,
      limit,
      total: categoriesResult.count ?? 0,
      pages: Math.max(1, Math.ceil((categoriesResult.count ?? 0) / limit)),
    },
  });
}
