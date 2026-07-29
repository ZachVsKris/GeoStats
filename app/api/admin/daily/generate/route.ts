import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";
import { fetchCountries } from "../../../../../lib/worldBank";
import { generateDailyTrio } from "../../../../../lib/puzzleEngine";
import {
  decodeRound,
  deserializeRound,
  encodeRound,
  serializeRound,
  type Round,
  type RoundSnapshot,
} from "../../../../../lib/challengeCodec";
import { DAILY_DIFFICULTIES, type DailyDifficulty } from "../../../../../lib/gameRules";
import { DATASET_VERSION, RULES_VERSION, CATEGORY_SET_VERSION } from "../../../../../lib/version";
import { newYorkDate } from "../../../../../lib/time";
import { loadServerCategoryRegistry } from "../../../../../lib/serverPlayableCatalog";
import { acquireDailyGenerationLock, releaseDailyGenerationLock } from "../../../../../lib/dailyGenerationLock";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type StoredRow = {
  challenge_date: string;
  difficulty: DailyDifficulty;
  seed: string;
  encoded_board: string;
  board_payload: RoundSnapshot | null;
};

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function recordGeneration(admin: any, row: Record<string, unknown>) {
  try {
    await admin.from("daily_generation_runs").insert(row);
  } catch {
    // Generation health logging is nonblocking.
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({})) as { date?: string };
  const date = typeof body.date === "string" ? body.date : newYorkDate();
  if (!validDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });

  const lockToken = await acquireDailyGenerationLock(auth.admin, date);
  if (!lockToken) {
    return NextResponse.json({ error: "A board generation job is already running for this date." }, { status: 409 });
  }

  try {
    const [countries, categoryRegistry, boardResult, scoreResult] = await Promise.all([
      fetchCountries(),
      loadServerCategoryRegistry(),
      auth.admin
        .from("daily_challenges")
        .select("challenge_date,difficulty,seed,encoded_board,board_payload")
        .eq("challenge_date", date)
        .in("difficulty", [...DAILY_DIFFICULTIES]),
      auth.admin
        .from("daily_scores")
        .select("difficulty")
        .eq("challenge_date", date),
    ]);
    if (boardResult.error) throw boardResult.error;
    if (scoreResult.error) throw scoreResult.error;

    const scoreCounts: Record<DailyDifficulty, number> = { easy: 0, normal: 0, expert: 0 };
    for (const row of scoreResult.data ?? []) {
      const difficulty = row.difficulty as DailyDifficulty;
      if (DAILY_DIFFICULTIES.includes(difficulty)) scoreCounts[difficulty] += 1;
    }

    const rows = (boardResult.data ?? []) as StoredRow[];
    const rowByDifficulty = new Map(rows.map((row) => [row.difficulty, row]));
    const fixed: Partial<Record<DailyDifficulty, Round>> = {};
    for (const difficulty of DAILY_DIFFICULTIES) {
      if (scoreCounts[difficulty] === 0) continue;
      const row = rowByDifficulty.get(difficulty);
      if (!row) {
        return NextResponse.json({
          error: `${difficulty} has saved scores but no stored board. Repair it from an archive before regenerating.`,
        }, { status: 409 });
      }
      try {
        fixed[difficulty] = row.board_payload
          ? deserializeRound(row.board_payload)
          : decodeRound(row.encoded_board, countries, categoryRegistry);
      } catch (error) {
        return NextResponse.json({
          error: `${difficulty} has saved scores but its board cannot be decoded. Repair it from an archive before regenerating.`,
          detail: error instanceof Error ? error.message : "Invalid saved board.",
        }, { status: 409 });
      }
    }

    const generated = await generateDailyTrio(countries, date, fixed);
    const replaceable = DAILY_DIFFICULTIES.filter((difficulty) => scoreCounts[difficulty] === 0);
    const replacementRows = replaceable.map((difficulty) => {
      const round = generated.trio[difficulty];
      const encoded = encodeRound(round);
      return {
        challenge_date: date,
        difficulty,
        seed: `DAILY-${difficulty.toUpperCase()}-${date}`,
        encoded_board: encoded,
        board_payload: serializeRound(round),
        board_hash: createHash("sha256").update(encoded).digest("hex"),
        dataset_version: DATASET_VERSION,
        rules_version: RULES_VERSION,
        category_set_version: CATEGORY_SET_VERSION,
      };
    });

    if (replacementRows.length) {
      const { error } = await auth.admin
        .from("daily_challenges")
        .upsert(replacementRows, { onConflict: "challenge_date,difficulty" });
      if (error) throw error;
    }

    await recordGeneration(auth.admin, {
      challenge_date: date,
      status: rows.length ? "repaired" : "completed",
      source: "admin-v15.7.0",
      diagnostics: {
        ...generated.diagnostics,
        preservedScoredModes: DAILY_DIFFICULTIES.filter((difficulty) => scoreCounts[difficulty] > 0),
        replacedModes: replaceable,
      },
      scores: generated.scores,
    });

    return NextResponse.json({
      ok: true,
      date,
      replacedModes: replaceable,
      preservedScoredModes: DAILY_DIFFICULTIES.filter((difficulty) => scoreCounts[difficulty] > 0),
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
      source: "admin-v15.7.0",
      diagnostics,
      error_message: message,
    });
    return NextResponse.json({ error: message, diagnostics }, { status: 500 });
  } finally {
    await releaseDailyGenerationLock(auth.admin, date, lockToken);
  }
}
