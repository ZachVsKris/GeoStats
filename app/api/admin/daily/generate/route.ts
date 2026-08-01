import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";
import { generateAndPublishDailyTrio, isValidChallengeDate } from "../../../../../lib/dailyBoardService";
import { newYorkDate } from "../../../../../lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({})) as { date?: string };
  const date = typeof body.date === "string" ? body.date : newYorkDate();
  if (!isValidChallengeDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });

  try {
    const result = await generateAndPublishDailyTrio(auth.admin, date, {
      source: "admin-v16.0",
      attempts: 10,
    });
    if (!result.ok && result.generating) {
      return NextResponse.json({ error: "A Daily generation job is already running for this date." }, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Daily generation failed.",
      diagnostics: typeof error === "object" && error && "diagnostics" in error
        ? (error as { diagnostics?: unknown }).diagnostics ?? null
        : null,
    }, { status: 500 });
  }
}
