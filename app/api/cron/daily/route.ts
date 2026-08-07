import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { generateAndPublishDailyTrio } from "../../../../lib/dailyBoardService";
import { newYorkDate } from "../../../../lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Runs around New York midnight. The two-hour look-ahead lets the earlier UTC
 * run publish tomorrow's trio before it becomes public, while later runs repair
 * the current day if the first attempt failed.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: "Supabase is not configured." }, { status: 503 });

  const now = new Date();
  const currentDate = newYorkDate(now);
  const advanceDate = newYorkDate(new Date(now.getTime() + 2 * 60 * 60 * 1000));
  const dates = [...new Set([advanceDate, currentDate])];
  const results: unknown[] = [];
  let failed = false;

  for (const date of dates) {
    try {
      const result = await generateAndPublishDailyTrio(admin, date, {
        source: "cron-v16.2",
        attempts: 1,
        budgetMs: 105_000,
        candidateTarget: 160,
        jointSearch: true,
        jointFirst: true,
      });
      results.push(result);
      if (!result.ok) failed = true;
    } catch (error) {
      failed = true;
      results.push({ date, ok: false, error: error instanceof Error ? error.message : "Daily generation failed." });
    }
  }

  return Response.json({ ok: !failed, dates, results }, {
    status: failed ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
