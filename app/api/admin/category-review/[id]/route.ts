import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

type ReviewStatus = "pending" | "approved" | "rejected" | "duplicate" | "needs_rewrite" | "needs_discussion";

type ReviewUpdate = {
  status?: ReviewStatus;
  political_self_reported?: boolean;
  confusing?: boolean;
  esoteric?: boolean;
  subjective_or_composite?: boolean;
  stale_data?: boolean;
  poor_coverage?: boolean;
  duplicate_of?: string | null;
  recommended_title?: string | null;
  board_description?: string | null;
  semantic_group?: string | null;
  notes?: string | null;
};

const STATUSES = new Set<ReviewStatus>([
  "pending",
  "approved",
  "rejected",
  "duplicate",
  "needs_rewrite",
  "needs_discussion",
]);

function cleanText(value: unknown, maximum: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().slice(0, maximum);
  return cleaned || null;
}

async function loadDetail(admin: SupabaseClient, id: string) {
  const categoryResult = await admin
    .from("category_review_workbench_v16_2")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (categoryResult.error || !categoryResult.data) return { categoryResult, detail: null };

  const category = categoryResult.data;
  const year = category.common_year ?? category.latest_available_year;
  const winnerAscending = category.ranking_direction === "low";
  const semanticGroup = category.effective_semantic_group;

  const topQuery = year
    ? admin
        .from("stat_observations")
        .select("country_iso3,country_name,value,data_year,metadata")
        .eq("category_id", id)
        .eq("data_year", year)
        .order("value", { ascending: winnerAscending })
        .limit(12)
    : Promise.resolve({ data: [], error: null });
  const bottomQuery = year
    ? admin
        .from("stat_observations")
        .select("country_iso3,country_name,value,data_year,metadata")
        .eq("category_id", id)
        .eq("data_year", year)
        .order("value", { ascending: !winnerAscending })
        .limit(8)
    : Promise.resolve({ data: [], error: null });

  let similarQuery = admin
    .from("category_review_workbench_v16_2")
    .select("id,effective_title,source_organization,source_indicator_code,effective_semantic_group,editorial_status,computed_playable_v16_2,duplicate_of")
    .neq("id", id)
    .limit(16);
  if (semanticGroup) similarQuery = similarQuery.eq("effective_semantic_group", semanticGroup);
  else if (category.source_organization) similarQuery = similarQuery.eq("source_organization", category.source_organization);

  const [top, bottom, similar, history] = await Promise.all([
    topQuery,
    bottomQuery,
    similarQuery,
    admin
      .from("category_review_events_v15")
      .select("id,previous_state,next_state,created_at,reviewer_user_id")
      .eq("category_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const error = top.error ?? bottom.error ?? similar.error ?? history.error;
  return {
    categoryResult,
    detail: error
      ? { error }
      : {
          category,
          year: year ?? null,
          top: top.data ?? [],
          bottom: bottom.data ?? [],
          similar: similar.data ?? [],
          history: history.data ?? [],
        },
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const loaded = await loadDetail(auth.admin, id);
  if (loaded.categoryResult.error) return NextResponse.json({ error: loaded.categoryResult.error.message }, { status: 500 });
  if (!loaded.categoryResult.data) return NextResponse.json({ error: "Category not found." }, { status: 404 });
  const detailError =
    loaded.detail && "error" in loaded.detail && loaded.detail.error
      ? loaded.detail.error
      : null;
  if (detailError) {
    return NextResponse.json({ error: detailError.message }, { status: 500 });
  }
  return NextResponse.json(loaded.detail);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as ReviewUpdate;

  if (body.status !== undefined && !STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Unsupported review status." }, { status: 400 });
  }

  const allowedBooleanKeys = [
    "political_self_reported",
    "confusing",
    "esoteric",
    "subjective_or_composite",
    "stale_data",
    "poor_coverage",
  ] as const;
  for (const key of allowedBooleanKeys) {
    if (body[key] !== undefined && typeof body[key] !== "boolean") {
      return NextResponse.json({ error: `${key} must be true or false.` }, { status: 400 });
    }
  }

  const duplicateOf = cleanText(body.duplicate_of, 160);
  if (duplicateOf === id) return NextResponse.json({ error: "A category cannot duplicate itself." }, { status: 400 });

  const { data: previous, error: previousError } = await auth.admin
    .from("category_review_state")
    .select("*")
    .eq("category_id", id)
    .maybeSingle();
  if (previousError) return NextResponse.json({ error: previousError.message }, { status: 500 });
  if (!previous) return NextResponse.json({ error: "Category review state not found. Run the v16.2 SQL installer." }, { status: 409 });

  const { data: categoryState, error: categoryStateError } = await auth.admin
    .from("stat_categories")
    .select("metadata")
    .eq("id", id)
    .maybeSingle();
  if (categoryStateError) return NextResponse.json({ error: categoryStateError.message }, { status: 500 });

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.status !== undefined) {
    update.status = body.status;
    update.reviewed_at = body.status === "pending" ? null : new Date().toISOString();
    update.reviewed_by = body.status === "pending" ? null : auth.user.id;
  }
  for (const key of allowedBooleanKeys) if (body[key] !== undefined) update[key] = body[key];
  const recommendedTitle = cleanText(body.recommended_title, 80);
  const boardDescription = cleanText(body.board_description, 110);
  const semanticGroup = cleanText(body.semantic_group, 100);
  const notes = cleanText(body.notes, 4000);
  if (body.recommended_title !== undefined) update.recommended_title = recommendedTitle;
  if (body.semantic_group !== undefined) update.semantic_group = semanticGroup;
  if (body.notes !== undefined) update.notes = notes;
  if (body.duplicate_of !== undefined) update.duplicate_of = duplicateOf;

  if (body.status === "duplicate" && !duplicateOf && !previous.duplicate_of) {
    return NextResponse.json({ error: "Choose the preferred category before marking this one duplicate." }, { status: 400 });
  }
  if (body.status === "approved") {
    const merged = { ...previous, ...update } as Record<string, unknown>;
    const blockingFlags = allowedBooleanKeys.filter((key) => Boolean(merged[key]));
    if (blockingFlags.length || merged.duplicate_of) {
      return NextResponse.json({
        error: "Clear all blocking flags and the duplicate link before approving this category.",
        blockers: [...blockingFlags, ...(merged.duplicate_of ? ["duplicate_of"] : [])],
      }, { status: 409 });
    }
  }

  const { data: saved, error: saveError } = await auth.admin
    .from("category_review_state")
    .update(update)
    .eq("category_id", id)
    .select("*")
    .single();
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  const { error: eventError } = await auth.admin.from("category_review_events_v15").insert({
    category_id: id,
    reviewer_user_id: auth.user.id,
    previous_state: previous,
    next_state: saved,
  });
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });

  const { error: refreshError } = await auth.admin.rpc("refresh_v16_2_runtime_catalog");
  if (refreshError) return NextResponse.json({ error: refreshError.message }, { status: 500 });

  const { data: policy, error: policyError } = await auth.admin
    .from("category_review_workbench_v16_2")
    .select("id,editorial_status,computed_playable_v16_2,recommended_title,semantic_group")
    .eq("id", id)
    .single();
  if (policyError) return NextResponse.json({ error: policyError.message }, { status: 500 });

  const legacyStatus = policy.editorial_status === "approved"
    ? "approved"
    : ["rejected", "duplicate"].includes(policy.editorial_status)
      ? "rejected"
      : "needs_review";
  const legacyEditorialStatus = policy.editorial_status === "approved"
    ? "approved"
    : ["rejected", "duplicate"].includes(policy.editorial_status)
      ? "excluded"
      : "pending";
  const categoryUpdate: Record<string, unknown> = {
    review_status: legacyStatus,
    curation_status: legacyEditorialStatus,
    curation_reason: `GeoStats v16.2 authoritative category review state: ${policy.editorial_status}.`,
    curation_version: "geostats-v16.2-review-v1",
    content_review_status: legacyEditorialStatus,
    content_review_reason: `GeoStats v16.2 authoritative category review state: ${policy.editorial_status}.`,
    content_review_version: "geostats-v16.2-review-v1",
    player_quality_status: policy.editorial_status === "approved"
      ? "approved"
      : ["rejected", "duplicate"].includes(policy.editorial_status)
        ? "blocked"
        : "caution",
    player_quality_reason: `GeoStats v16.2 authoritative category review state: ${policy.editorial_status}.`,
    enabled: Boolean(policy.computed_playable_v16_2),
    eligible_daily: Boolean(policy.computed_playable_v16_2),
  };
  if (typeof policy.semantic_group === "string" && policy.semantic_group.trim()) {
    categoryUpdate.semantic_family = policy.semantic_group.trim();
  }
  if (body.board_description !== undefined) {
    const existingMetadata = categoryState?.metadata && typeof categoryState.metadata === "object"
      ? categoryState.metadata as Record<string, unknown>
      : {};
    categoryUpdate.metadata = {
      ...existingMetadata,
      boardDescription: boardDescription,
      boardDescriptionReviewedAt: new Date().toISOString(),
      boardDescriptionReviewedBy: auth.user.id,
    };
  }
  if (policy.computed_playable_v16_2 && typeof policy.recommended_title === "string" && policy.recommended_title.trim()) {
    categoryUpdate.title = policy.recommended_title.trim();
    categoryUpdate.short_title = policy.recommended_title.trim().slice(0, 70);
  }
  const { error: categoryError } = await auth.admin.from("stat_categories").update(categoryUpdate).eq("id", id);
  if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 });

  const loaded = await loadDetail(auth.admin, id);
  const detailError =
    loaded.detail && "error" in loaded.detail && loaded.detail.error
      ? loaded.detail.error
      : null;
  if (detailError) {
    return NextResponse.json({ error: detailError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...(loaded.detail ?? {}) });
}
