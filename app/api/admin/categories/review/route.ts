import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

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
  if (!category.strict_pass_v16_2) {
    blockers.push(category.primary_blocker_v16_2 || "The category has not passed the v16.2 source, semantic, ranking, clarity, and board-feasibility gates.");
  }
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
      .select("category_id,status,political_self_reported,confusing,esoteric,subjective_or_composite,stale_data,poor_coverage,duplicate_of,recommended_title,semantic_group,notes,reviewed_by,reviewed_at")
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
        error: `${blocked.length} selected categor${blocked.length === 1 ? "y is" : "ies are"} not ready for approval under the v16.2 source, semantic, ranking, clarity, board-feasibility, and editorial gates.`,
        blocked,
        missing,
      }, { status: 409 });
    }
  }

  const reviewed: string[] = [];
  const failures: { id: string; error: string }[] = [];
  const now = new Date().toISOString();

  for (const id of categoryIds) {
    const category = workbenchById.get(id);
    const previous = stateById.get(id);
    if (!category || !previous) continue;

    const update: Record<string, unknown> = {
      status: decision === "reset" ? "pending" : decision,
      reviewed_by: decision === "reset" ? null : auth.user.id,
      reviewed_at: decision === "reset" ? null : now,
      updated_at: now,
    };
    if (notes !== null) update.notes = notes;
    if (decision === "approved") update.duplicate_of = null;

    const { data: saved, error: saveError } = await auth.admin
      .from("category_review_state")
      .update(update)
      .eq("category_id", id)
      .select("*")
      .single();
    if (saveError) {
      failures.push({ id, error: saveError.message });
      continue;
    }

    const { error: eventError } = await auth.admin.from("category_review_events_v15").insert({
      category_id: id,
      reviewer_user_id: auth.user.id,
      previous_state: previous,
      next_state: saved,
    });
    if (eventError) {
      failures.push({ id, error: eventError.message });
      continue;
    }

    reviewed.push(id);
  }

  if (reviewed.length) {
    const { error: refreshError } = await auth.admin.rpc("refresh_v16_2_runtime_catalog");
    if (refreshError) {
      failures.push({ id: "catalog-refresh", error: refreshError.message });
    }
  }

  return NextResponse.json({
    ok: failures.length === 0,
    decision,
    reviewed,
    missing,
    failures,
  }, { status: failures.length ? 207 : 200 });
}
