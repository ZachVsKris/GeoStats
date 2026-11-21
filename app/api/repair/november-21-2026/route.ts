import { createHash, timingSafeEqual } from "crypto";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/server";
import { generateAndPublishDailyTrio } from "../../../../../lib/dailyBoardService";
import { loadPublicDailyPayload } from "../../../../../lib/publicDaily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOKEN_HASH = "9cc33a54e2a47fd375f6b297e6b27cfbfac4f5ff50835f6c370739b5d4570e4e";
const DATE = "2026-11-21";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("key") ?? "";
  const actual = createHash("sha256").update(token).digest();
  const expected = Buffer.from(TOKEN_HASH, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: "Supabase is not configured." }, { status: 503 });

  try {
    const result = await generateAndPublishDailyTrio(admin, DATE, {
      source: "repair-2026-11-21",
      attempts: 2,
      budgetMs: 125_000,
      candidateTarget: 160,
      jointSearch: true,
      jointFirst: true,
    });
    if (result.ok) await loadPublicDailyPayload(DATE);
    return Response.json(result, {
      status: result.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Daily generation failed.",
      diagnostics: typeof error === "object" && error && "diagnostics" in error
        ? (error as { diagnostics?: unknown }).diagnostics ?? null
        : null,
    }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
