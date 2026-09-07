import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ReviewStatus = "pending" | "approved" | "rejected" | "duplicate" | "needs_rewrite" | "needs_data_repair" | "needs_discussion";

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
  "needs_data_repair",
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

  const update: Record<string, unknown> = {};
  if (body.status !== undefined) {
    update.status = body.status;
  }
  for (const key of allowedBooleanKeys) if (body[key] !== undefined) update[key] = body[key];
  const recommendedTitle = cleanText(body.recommended_title, 80);
  const boardDescription = cleanText(body.board_description, 200);
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

  // Decision, copy, audit event, assessments and flags commit together.
  const { error: saveError } = await auth.admin.rpc("save_category_review_v16_3_4", {
    p_category_id: id,
    p_reviewer: auth.user.id,
    p_patch: update,
    p_expected_updated_at: previous.updated_at,
    p_presentation: body.board_description !== undefined ? { board_description: boardDescription } : {},
  });
  if (saveError) {
    const status = saveError.code === "40001" ? 409 : saveError.code === "22023" ? 400 : 500;
    return NextResponse.json({ error: saveError.message }, { status });
  }

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
