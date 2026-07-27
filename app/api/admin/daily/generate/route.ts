import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";
import { fetchCountries } from "../../../../../lib/worldBank";
import { generateDailyTrio } from "../../../../../lib/puzzleEngine";
import { encodeRound } from "../../../../../lib/challengeCodec";
import { DAILY_DIFFICULTIES } from "../../../../../lib/gameRules";
import { DATASET_VERSION, RULES_VERSION, CATEGORY_SET_VERSION } from "../../../../../lib/version";
import { newYorkDate } from "../../../../../lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function recordGeneration(
  admin: any,
  row: Record<string, unknown>,
) {
  // This log becomes available after migration 021. Generation must still work before it is applied.
  try { await admin.from("daily_generation_runs").insert(row); } catch { /* optional pre-migration log */ }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({})) as { date?: string };
  const date = typeof body.date === "string" ? body.date : newYorkDate();
  if (!validDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });

  try {
    const [{ count: scoreCount, error: scoreError }, { count: boardCount, error: boardError }] = await Promise.all([
      auth.admin.from("daily_scores").select("id", { count: "exact", head: true }).eq("challenge_date", date),
      auth.admin.from("daily_challenges").select("difficulty", { count: "exact", head: true }).eq("challenge_date", date),
    ]);
    if (scoreError) throw scoreError;
    if (boardError) throw boardError;
    if ((scoreCount ?? 0) > 0 && (boardCount ?? 0) > 0) {
      return NextResponse.json({ error: "Today’s boards already have saved player scores and are locked against regeneration." }, { status: 409 });
    }

    const countries = await fetchCountries();
    const generated = await generateDailyTrio(countries, date);
    const rows = DAILY_DIFFICULTIES.map((difficulty) => {
      const encoded = encodeRound(generated.trio[difficulty]);
      return {
        challenge_date: date,
        difficulty,
        seed: `DAILY-${difficulty.toUpperCase()}-${date}`,
        encoded_board: encoded,
        board_hash: createHash("sha256").update(encoded).digest("hex"),
        dataset_version: DATASET_VERSION,
        rules_version: RULES_VERSION,
        category_set_version: CATEGORY_SET_VERSION,
      };
    });

    const { error } = await auth.admin.from("daily_challenges").upsert(rows, { onConflict: "challenge_date,difficulty" });
    if (error) throw error;

    await recordGeneration(auth.admin, {
      challenge_date: date,
      status: "completed",
      source: "admin",
      diagnostics: generated.diagnostics,
      scores: generated.scores,
    });

    return NextResponse.json({
      ok: true,
      date,
      diagnostics: generated.diagnostics,
      scores: generated.scores,
      boards: Object.fromEntries(DAILY_DIFFICULTIES.map((difficulty) => [difficulty, {
        countries: generated.trio[difficulty].bank.map((country) => country.name),
        categories: generated.trio[difficulty].categories.map((category) => category.category.name),
      }])),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Daily generation failed.";
    const diagnostics = typeof error === "object" && error && "diagnostics" in error
      ? (error as { diagnostics?: unknown }).diagnostics ?? null
      : null;
    await recordGeneration(auth.admin, {
      challenge_date: date,
      status: "failed",
      source: "admin",
      diagnostics,
      error_message: message,
    });
    return NextResponse.json({ error: message, diagnostics }, { status: 500 });
  }
}
