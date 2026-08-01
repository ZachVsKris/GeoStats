import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { requireAdmin } from "../../../../lib/supabase/adminAuth";
import { newYorkDate } from "../../../../lib/time";
import {
  inspectStoredTrio,
  isValidChallengeDate,
  loadLatestCompleteFallback,
  packStoredRows,
  readDailyRows,
  type PackedDailyTrio,
} from "../../../../lib/dailyBoardService";
import { dailyTrioPreferenceWarnings, validateDailyTrio, type DailyTrioLike } from "../../../../lib/dailyTrioRules";
import { DAILY_DIFFICULTIES } from "../../../../lib/gameRules";
import { deserializeRound, encodeRound, serializeRound } from "../../../../lib/challengeCodec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DAILY_SUCCESS_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";
const PUBLIC_UNAVAILABLE = "Today’s Daily trio has not been published yet. Please check again shortly.";

export async function GET(
  _request: Request,
  context: { params: Promise<{ date: string }> },
) {
  const { date } = await context.params;
  if (!isValidChallengeDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  if (date !== newYorkDate()) {
    return NextResponse.json({ error: "Public Daily requests are limited to today’s challenge." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ configured: false }, { status: 503 });

  const stored = await readDailyRows(admin, date);
  if (stored.error) {
    return NextResponse.json({ error: PUBLIC_UNAVAILABLE }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  // Current v16 rows are self-contained. Public reads never load the full country
  // and category catalog, which keeps the normal Daily request fast and predictable.
  const inspected = inspectStoredTrio(stored.rows);
  if (inspected.complete) {
    return NextResponse.json({
      found: true,
      generated: false,
      legacyModes: Object.keys(inspected.outdated),
      warning: Object.keys(inspected.outdated).length
        ? "This valid Daily board is preserved under the rules and category set with which it was generated."
        : undefined,
      preferenceWarnings: dailyTrioPreferenceWarnings(inspected.rounds as DailyTrioLike),
      ...packStoredRows(stored.rows),
    }, { headers: { "Cache-Control": DAILY_SUCCESS_CACHE } });
  }

  const fallback = await loadLatestCompleteFallback(admin, date);
  if (fallback) {
    return NextResponse.json({
      found: true,
      generated: false,
      fallback: true,
      fallback_date: fallback.date,
      warning: "Today’s Daily is unavailable, so this is an unranked practice board from an earlier date.",
      ...fallback.boards,
    }, { status: 200, headers: { "Cache-Control": "no-store", "X-GeoStats-Fallback": "1" } });
  }

  return NextResponse.json({ error: PUBLIC_UNAVAILABLE }, {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Official-board writes remain administrator-only. */
export async function POST(
  request: Request,
  context: { params: Promise<{ date: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { date } = await context.params;
  if (!isValidChallengeDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  const body = await request.json().catch(() => null) as PackedDailyTrio | null;
  if (!body) return NextResponse.json({ error: "Board payload is required." }, { status: 400 });

  const { data: scores, error: scoreError } = await auth.admin
    .from("daily_scores")
    .select("difficulty")
    .eq("challenge_date", date);
  if (scoreError) return NextResponse.json({ error: scoreError.message }, { status: 500 });
  if ((scores ?? []).length) {
    return NextResponse.json({ error: "Daily boards with saved scores are locked against replacement." }, { status: 409 });
  }

  const rows = DAILY_DIFFICULTIES.map((difficulty) => {
    const packed = body[difficulty];
    if (!packed?.board_payload) throw new Error(`Missing ${difficulty} board snapshot.`);
    const round = deserializeRound(packed.board_payload);
    return { difficulty, round };
  });
  const trio = Object.fromEntries(rows.map(({ difficulty, round }) => [difficulty, round])) as DailyTrioLike;
  const trioErrors = validateDailyTrio(trio);
  if (trioErrors.length) {
    return NextResponse.json({ error: "The proposed trio is invalid.", diagnostics: trioErrors }, { status: 400 });
  }

  const publishRows = rows.map(({ difficulty, round }) => {
    const encoded = encodeRound(round);
    return {
      challenge_date: date,
      difficulty,
      seed: `DAILY-${difficulty.toUpperCase()}-${date}`,
      encoded_board: encoded,
      board_payload: serializeRound(round),
    };
  });
  // Keep manual board uploads routed through the same atomic database function.
  const { error } = await auth.admin.rpc("publish_daily_trio_v16", { p_challenge_date: date, p_rows: publishRows });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const stored = await readDailyRows(auth.admin, date);
  return NextResponse.json({ ok: true, ...packStoredRows(stored.rows) });
}
