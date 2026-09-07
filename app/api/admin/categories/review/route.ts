import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Decision = "approved" | "rejected" | "reset";

type ReviewBody = {
  categoryId?: string;
  categoryIds?: string[];
  decision?: Decision;
  notes?: string;
};

type ReviewState = {
  category_id: string;
  status: "pending" | "approved" | "rejected" | "duplicate" | "needs_rewrite" | "needs_discussion";
  political_self_reported: boolean;
  confusing: boolean;
  esoteric: boolean;
  subjective_or_composite: boolean;
  stale_data: boolean;
  poor_coverage: boolean;
  duplicate_of: string | null;
  recommended_title: string | null;
  semantic_group: string | null;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
};

type WorkbenchRow = {
  id: string;
  effective_title: string;
  editorial_status: string;
  strict_pass_v16_2: boolean;
  promotion_decision_v16_2: string | null;
  primary_blocker_v16_2: string | null;
};

const BLOCKING_FLAG_KEYS = [
  "political_self_reported",
  "confusing",
  "esoteric",
  "subjective_or_composite",
  "stale_data",
  "poor_coverage",
] as const;

function approvalBlockers(category: WorkbenchRow, state: ReviewState): string[] {
  const blockers: string[] = [];
  // Editorial approval is distinct from publication; technical gates still apply at refresh.
  for (const key of BLOCKING_FLAG_KEYS) if (state[key]) blockers.push(key);
  if (state.duplicate_of) blockers.push("duplicate_of");
  return Array.from(new Set(blockers));
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as ReviewBody;
  const decision = body.decision;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) || null : null;
  const categoryIds = Array.from(new Set([
    ...(typeof body.categoryId === "string" ? [body.categoryId] : []),
    ...(Array.isArray(body.categoryIds) ? body.categoryIds.filter((value): value is string => typeof value === "string") : []),
  ].map((value) => value.trim()).filter(Boolean))).slice(0, 500);

  if (!categoryIds.length || !decision || !["approved", "rejected", "reset"].includes(decision)) {
    return NextResponse.json({ error: "At least one category and a valid review decision are required." }, { status: 400 });
  }

  const [workbenchResult, stateResult] = await Promise.all([
    auth.admin
      .from("category_review_workbench_v16_2")
      .select("id,effective_title,editorial_status,strict_pass_v16_2,promotion_decision_v16_2,primary_blocker_v16_2")
      .in("id", categoryIds),
    auth.admin
      .from("category_review_state")
      .select("category_id,status,political_self_reported,confusing,esoteric,subjective_or_composite,stale_data,poor_coverage,duplicate_of,recommended_title,semantic_group,notes,reviewed_by,reviewed_at,updated_at")
      .in("category_id", categoryIds),
  ]);

  const queryError = workbenchResult.error ?? stateResult.error;
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });

  const workbenchRows = (workbenchResult.data ?? []) as WorkbenchRow[];
  const states = (stateResult.data ?? []) as ReviewState[];
  const workbenchById = new Map(workbenchRows.map((row) => [row.id, row]));
  const stateById = new Map(states.map((row) => [row.category_id, row]));
  const missing = categoryIds.filter((id) => !workbenchById.has(id) || !stateById.has(id));

  if (decision === "approved") {
    const blocked = categoryIds.flatMap((id) => {
      const category = workbenchById.get(id);
      const state = stateById.get(id);
      if (!category || !state) return [];
      const blockers = approvalBlockers(category, state);
      return blockers.length ? [{ id, title: category.effective_title, blockers }] : [];
    });
    if (blocked.length) {
      return NextResponse.json({
        error: `${blocked.length} selected categor${blocked.length === 1 ? "y is" : "ies are"} blocked by editorial flags or duplicate links. Technical playability is assessed separately.`,
        blocked,
        missing,
      }, { status: 409 });
    }
  }

  if (missing.length) {
    return NextResponse.json({ error: "Some categories no longer exist. Reload before reviewing.", missing }, { status: 409 });
  }
  const changes = categoryIds.map((id) => ({
    category_id: id,
    expected_updated_at: stateById.get(id)!.updated_at,
    patch: {
      status: decision === "reset" ? "pending" : decision,
      ...(notes !== null ? { notes } : {}),
      ...(decision === "approved" ? { duplicate_of: null } : {}),
    },
    presentation: {},
  }));
  const { error } = await auth.admin.rpc("save_category_reviews_v16_3_4", {
    p_reviewer: auth.user.id,
    p_changes: changes,
  });
  if (error) {
    return NextResponse.json({
      ok: false, error: error.message, reviewed: [],
    }, { status: error.code === "40001" ? 409 : error.code === "22023" ? 400 : 500 });
  }
  return NextResponse.json({ ok: true, decision, reviewed: categoryIds, missing: [], failures: [] });
}
