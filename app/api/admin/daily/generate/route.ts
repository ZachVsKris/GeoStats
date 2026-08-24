import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";
import { generateAndPublishDailyTrio, isValidChallengeDate } from "../../../../../lib/dailyBoardService";
import { newYorkDate } from "../../../../../lib/time";
import { loadPublicDailyPayload } from "../../../../../lib/publicDaily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({})) as { date?: string };
  const date = typeof body.date === "string" ? body.date : newYorkDate();
  if (!isValidChallengeDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });

  try {
    const result = await generateAndPublishDailyTrio(auth.admin, date, {
      source: "admin-v16.2.4",
      attempts: 1,
      budgetMs: 58_000,
      candidateTarget: 128,
      jointSearch: true,
      jointFirst: true,
    });
    if (!result.ok && result.generating) {
      return NextResponse.json({ error: "A Daily generation job is already running for this date." }, { status: 409 });
    }
    if (result.ok && date === newYorkDate()) await loadPublicDailyPayload(date);
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
