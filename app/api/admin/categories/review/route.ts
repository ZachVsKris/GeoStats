import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

type Decision = "approved" | "rejected" | "reset";

type CategorySnapshot = {
  id: string;
  title: string;
  auto_qualified: boolean;
  quality_score: number;
  review_status: string;
  evidence_tier: string | null;
  common_year: number | null;
  common_year_coverage: number;
  official_observation_share: number | null;
  modeled_observation_share: number | null;
  clustering_score: number | null;
  stability_score: number | null;
  quality_details: unknown;
  canonical_category_id: string | null;
  provenance_status: string | null;
  independent_validation: boolean;
  concept_group: string | null;
  duplicate_status: string | null;
  curation_status: string | null;
  curation_reason: string | null;
  credibility_status: string | null;
  credibility_score: number | null;
  objective_status: string | null;
  player_quality_status: string | null;
  verifiability_score: number | null;
  understandability_score: number | null;
  fun_score: number | null;
  validation_status: string | null;
  validation_reason: string | null;
  validated_at: string | null;
};

type ReviewBody = {
  categoryId?: string;
  categoryIds?: string[];
  decision?: Decision;
  notes?: string;
};

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as ReviewBody;
  const decision = body.decision;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
  const categoryIds = Array.from(new Set([
    ...(typeof body.categoryId === "string" ? [body.categoryId] : []),
    ...(Array.isArray(body.categoryIds) ? body.categoryIds.filter((value): value is string => typeof value === "string") : []),
  ].map((value) => value.trim()).filter(Boolean))).slice(0, 500);

  if (!categoryIds.length || !decision || !["approved", "rejected", "reset"].includes(decision)) {
    return NextResponse.json({ error: "At least one category and a valid review decision are required." }, { status: 400 });
  }

  const { data: categories, error } = await auth.admin
    .from("stat_categories")
    .select("id,title,auto_qualified,quality_score,review_status,evidence_tier,common_year,common_year_coverage,official_observation_share,modeled_observation_share,clustering_score,stability_score,quality_details,canonical_category_id,provenance_status,independent_validation,concept_group,duplicate_status,curation_status,curation_reason,credibility_status,credibility_score,objective_status,player_quality_status,verifiability_score,understandability_score,fun_score,validation_status,validation_reason,validated_at")
    .in("id", categoryIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (categories ?? []) as CategorySnapshot[];
  const found = new Set(rows.map((category) => category.id));
  const missing = categoryIds.filter((id) => !found.has(id));
  const blocked = decision === "approved" ? rows.filter((category) => category.validation_status !== "verified"
    || !category.auto_qualified
    || category.provenance_status !== "approved"
    || !category.independent_validation
    || category.curation_status === "excluded"
    || category.credibility_status === "quarantined"
    || (category.credibility_score ?? 0) < 75
    || category.objective_status !== "objective"
    || category.player_quality_status === "blocked"
    || (category.verifiability_score ?? 0) < 80
    || (category.understandability_score ?? 0) < 70
    || (category.fun_score ?? 0) < 55) : [];

  if (blocked.length) {
    return NextResponse.json({
      error: `${blocked.length} selected categor${blocked.length === 1 ? "y has" : "ies have"} not passed the source-integrity, quality, provenance, credibility, objectivity, verifiability, clarity, and fun gate.`,
      blocked: blocked.map((category) => ({ id: category.id, title: category.title })),
    }, { status: 409 });
  }

  const update = decision === "approved"
    ? {
        review_status: "approved",
        curation_status: "approved",
        curation_reason: "Approved through the v14.2 editorial review queue after source-integrity verification.",
        curation_version: "geostats-v14.2-candidate-review-v1",
        enabled: true,
        eligible_daily: true,
      }
    : decision === "rejected"
      ? { review_status: "rejected", curation_status: "excluded", curation_reason: "Rejected through the v14.2 editorial review queue.", enabled: false, eligible_daily: false }
      : null;

  const failures: { id: string; error: string }[] = [];
  const reviewed: string[] = [];
  for (const category of rows) {
    const categoryUpdate = update ?? {
      review_status: category.auto_qualified ? "needs_review" : "candidate",
      enabled: false,
      eligible_daily: false,
    };

    const { error: updateError } = await auth.admin
      .from("stat_categories")
      .update(categoryUpdate)
      .eq("id", category.id);
    if (updateError) {
      failures.push({ id: category.id, error: updateError.message });
      continue;
    }

    const { error: governanceError } = await auth.admin.rpc("apply_category_governance", { p_category_id: category.id });
    if (governanceError) {
      failures.push({ id: category.id, error: governanceError.message });
      continue;
    }

    const { error: auditError } = await auth.admin.from("stat_category_reviews").insert({
      category_id: category.id,
      reviewer_user_id: auth.user.id,
      decision,
      notes,
      quality_snapshot: {
        qualityScore: category.quality_score,
        previousReviewStatus: category.review_status,
        autoQualified: category.auto_qualified,
        evidenceTier: category.evidence_tier,
        commonYear: category.common_year,
        commonYearCoverage: category.common_year_coverage,
        officialObservationShare: category.official_observation_share,
        modeledObservationShare: category.modeled_observation_share,
        clusteringScore: category.clustering_score,
        stabilityScore: category.stability_score,
        details: category.quality_details,
        canonicalCategoryId: category.canonical_category_id,
        provenanceStatus: category.provenance_status,
        independentValidation: category.independent_validation,
        conceptGroup: category.concept_group,
        duplicateStatus: category.duplicate_status,
        curationStatus: category.curation_status,
        curationReason: category.curation_reason,
        credibilityStatus: category.credibility_status,
        credibilityScore: category.credibility_score,
        objectiveStatus: category.objective_status,
        playerQualityStatus: category.player_quality_status,
        verifiabilityScore: category.verifiability_score,
        understandabilityScore: category.understandability_score,
        funScore: category.fun_score,
        validationStatus: category.validation_status,
        validationReason: category.validation_reason,
        validatedAt: category.validated_at,
        bulkActionSize: categoryIds.length,
      },
    });
    if (auditError) failures.push({ id: category.id, error: auditError.message });
    else reviewed.push(category.id);
  }

  const status = failures.length ? 207 : 200;
  return NextResponse.json({
    ok: failures.length === 0,
    decision,
    reviewed,
    missing,
    failures,
  }, { status });
}
