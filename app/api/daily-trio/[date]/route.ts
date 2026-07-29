import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { requireAdmin } from "../../../../lib/supabase/adminAuth";
import {
  decodeRound,
  deserializeRound,
  encodeRound,
  serializeRound,
  type Round,
  type RoundSnapshot,
} from "../../../../lib/challengeCodec";
import { fetchCountries, type CountryInfo } from "../../../../lib/worldBank";
import { DAILY_DIFFICULTIES, type DailyDifficulty } from "../../../../lib/gameRules";
import { CATEGORY_SET_VERSION, DATASET_VERSION, RULES_VERSION } from "../../../../lib/version";
import { loadServerCategoryRegistry } from "../../../../lib/serverPlayableCatalog";
import { dailyTrioPreferenceWarnings, validateDailyTrio, type DailyTrioLike } from "../../../../lib/dailyTrioRules";
import { generateDailyTrio } from "../../../../lib/puzzleEngine";
import type { Category } from "../../../../lib/categories";
import { newYorkDate } from "../../../../lib/time";
import { acquireDailyGenerationLock, releaseDailyGenerationLock } from "../../../../lib/dailyGenerationLock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DAILY_SUCCESS_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";
const PUBLIC_GENERATION_ERROR = "Today’s board is still being prepared. Please try again in a moment.";

type StoredRow = {
  challenge_date: string;
  difficulty: DailyDifficulty;
  seed: string;
  encoded_board: string;
  board_payload?: RoundSnapshot | null;
  rules_version: string;
  category_set_version: string;
};
type Dependencies = { countries: CountryInfo[]; categoryRegistry: Category[] };
type PackedBoard = {
  seed: string;
  encoded_board: string;
  board_payload: RoundSnapshot;
};
type PackedTrio = Partial<Record<DailyDifficulty, PackedBoard>>;

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function packRound(round: Round, difficulty: DailyDifficulty, date: string): PackedBoard {
  return {
    seed: `DAILY-${difficulty.toUpperCase()}-${date}`,
    encoded_board: encodeRound(round),
    board_payload: serializeRound(round),
  };
}

function decodeStored(row: StoredRow, dependencies: Dependencies) {
  if (row.board_payload) return deserializeRound(row.board_payload);
  return decodeRound(row.encoded_board, dependencies.countries, dependencies.categoryRegistry);
}

async function readStored(supabase: any, date: string) {
  const { data, error } = await supabase
    .from("daily_challenges")
    .select("challenge_date,difficulty,seed,encoded_board,board_payload,rules_version,category_set_version")
    .eq("challenge_date", date)
    .in("difficulty", [...DAILY_DIFFICULTIES]);
  return { rows: (data ?? []) as StoredRow[], error };
}

async function scoreCountsByDifficulty(supabase: any, date: string) {
  const counts = { easy: 0, normal: 0, expert: 0 } as Record<DailyDifficulty, number>;
  for (const difficulty of DAILY_DIFFICULTIES) {
    const { count, error } = await supabase
      .from("daily_scores")
      .select("id", { count: "exact", head: true })
      .eq("challenge_date", date)
      .eq("difficulty", difficulty);
    if (error) throw error;
    counts[difficulty] = count ?? 0;
  }
  return counts;
}

function validateStoredRows(
  rows: StoredRow[],
  dependencies: Dependencies,
  trackVersion = true,
) {
  const rounds: Partial<Record<DailyDifficulty, Round>> = {};
  const errors: Partial<Record<DailyDifficulty, string[]>> = {};
  const outdated: Partial<Record<DailyDifficulty, string[]>> = {};
  let trioErrors: string[] = [];
  const byDifficulty = new Map(rows.map((row) => [row.difficulty, row]));
  for (const difficulty of DAILY_DIFFICULTIES) {
    const row = byDifficulty.get(difficulty);
    if (!row) {
      errors[difficulty] = ["Board is missing."];
      continue;
    }
    try {
      rounds[difficulty] = decodeStored(row, dependencies);
      if (trackVersion) {
        const versionWarnings: string[] = [];
        if (row.rules_version !== RULES_VERSION) {
          versionWarnings.push(`Rules ${row.rules_version || "unknown"} are older than ${RULES_VERSION}.`);
        }
        if (row.category_set_version !== CATEGORY_SET_VERSION) {
          versionWarnings.push("Category-set version is older than the current catalog.");
        }
        if (versionWarnings.length) outdated[difficulty] = versionWarnings;
      }
    } catch (error) {
      errors[difficulty] = [error instanceof Error ? error.message : "Board is invalid."];
    }
  }
  if (rounds.easy && rounds.normal && rounds.expert && !Object.keys(errors).length) {
    trioErrors = validateDailyTrio(rounds as DailyTrioLike);
  }
  return { rounds, errors, outdated, trioErrors };
}

async function persistRounds(
  supabase: any,
  date: string,
  rounds: Partial<Record<DailyDifficulty, Round>>,
  replaceable: Set<DailyDifficulty>,
) {
  const rows = DAILY_DIFFICULTIES
    .filter((difficulty) => rounds[difficulty] && replaceable.has(difficulty))
    .map((difficulty) => {
      const packed = packRound(rounds[difficulty]!, difficulty, date);
      return {
        challenge_date: date,
        difficulty,
        seed: packed.seed,
        encoded_board: packed.encoded_board,
        board_payload: packed.board_payload,
        board_hash: createHash("sha256").update(packed.encoded_board).digest("hex"),
        dataset_version: DATASET_VERSION,
        rules_version: RULES_VERSION,
        category_set_version: CATEGORY_SET_VERSION,
      };
    });
  if (!rows.length) return;
  const { error } = await supabase.from("daily_challenges").upsert(rows, {
    onConflict: "challenge_date,difficulty",
  });
  if (error) throw error;
}

function shape(rows: StoredRow[], dependencies: Dependencies): PackedTrio {
  const result: PackedTrio = {};
  for (const row of rows) {
    try {
      const round = decodeStored(row, dependencies);
      result[row.difficulty] = {
        seed: row.seed,
        encoded_board: row.encoded_board,
        board_payload: row.board_payload ?? serializeRound(round),
      };
    } catch {
      // Invalid rows are omitted; callers may still use other modes.
    }
  }
  return result;
}

async function recordGeneration(supabase: any, row: Record<string, unknown>) {
  try {
    await supabase.from("daily_generation_runs").insert(row);
  } catch {
    // Diagnostics are helpful but never part of board availability.
  }
}

async function loadDependencies(): Promise<Dependencies> {
  const [countries, categoryRegistry] = await Promise.all([
    fetchCountries(),
    loadServerCategoryRegistry(),
  ]);
  return { countries, categoryRegistry };
}

async function latestFallback(supabase: any, beforeDate: string, dependencies: Dependencies) {
  const { data, error } = await supabase
    .from("daily_challenges")
    .select("challenge_date,difficulty,seed,encoded_board,board_payload,rules_version,category_set_version")
    .lt("challenge_date", beforeDate)
    .order("challenge_date", { ascending: false })
    .limit(30);
  if (error) return null;
  const rows = (data ?? []) as StoredRow[];
  for (const date of [...new Set(rows.map((row) => row.challenge_date))]) {
    const sameDate = rows.filter((row) => row.challenge_date === date);
    const validated = validateStoredRows(sameDate, dependencies, false);
    if (validated.rounds.easy && validated.rounds.normal && validated.rounds.expert
      && !Object.keys(validated.errors).length) {
      return { date, boards: shape(sameDate, dependencies) };
    }
  }
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ date: string }> },
) {
  const { date } = await context.params;
  if (!validDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  if (date !== newYorkDate()) {
    return NextResponse.json({ error: "Public Daily requests are limited to today’s challenge." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ configured: false }, { status: 503 });

  let dependencies: Dependencies;
  let initial: Awaited<ReturnType<typeof readStored>>;
  try {
    dependencies = await loadDependencies();
    initial = await readStored(supabase, date);
    if (initial.error) throw initial.error;
  } catch (error) {
    await recordGeneration(supabase, {
      challenge_date: date,
      status: "failed",
      source: "daily-bootstrap-v15.7.0",
      error_message: error instanceof Error ? error.message : "Daily dependencies could not be loaded.",
    });
    return NextResponse.json({ error: PUBLIC_GENERATION_ERROR }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const validated = validateStoredRows(initial.rows, dependencies);
  if (validated.rounds.easy && validated.rounds.normal && validated.rounds.expert
    && !Object.keys(validated.errors).length
    && !validated.trioErrors.length
    && !Object.keys(validated.outdated).length) {
    return NextResponse.json({
      found: true,
      generated: false,
      preferenceWarnings: dailyTrioPreferenceWarnings(validated.rounds as DailyTrioLike),
      ...shape(initial.rows, dependencies),
    }, { headers: { "Cache-Control": DAILY_SUCCESS_CACHE } });
  }

  let lockToken: string | null;
  try {
    lockToken = await acquireDailyGenerationLock(supabase, date);
  } catch (error) {
    await recordGeneration(supabase, {
      challenge_date: date,
      status: "failed",
      source: "daily-lock-v15.7.0",
      error_message: error instanceof Error ? error.message : "Generation lock failed.",
    });
    return NextResponse.json({ error: PUBLIC_GENERATION_ERROR }, { status: 503 });
  }
  if (!lockToken) {
    return NextResponse.json(
      { error: PUBLIC_GENERATION_ERROR, generating: true, retryAfter: 3, ...shape(initial.rows, dependencies) },
      { status: 202, headers: { "Cache-Control": "no-store", "Retry-After": "3" } },
    );
  }

  try {
    // Re-read after acquiring the lock because another request may have finished.
    const latestBefore = await readStored(supabase, date);
    if (latestBefore.error) throw latestBefore.error;
    const latestValidated = validateStoredRows(latestBefore.rows, dependencies);
    if (latestValidated.rounds.easy && latestValidated.rounds.normal && latestValidated.rounds.expert
      && !Object.keys(latestValidated.errors).length
      && !latestValidated.trioErrors.length
      && !Object.keys(latestValidated.outdated).length) {
      return NextResponse.json({ found: true, generated: false, ...shape(latestBefore.rows, dependencies) }, {
        headers: { "Cache-Control": DAILY_SUCCESS_CACHE },
      });
    }

    const scores = await scoreCountsByDifficulty(supabase, date);
    let fixed: Partial<Record<DailyDifficulty, Round>> = {};
    let replaceable = new Set<DailyDifficulty>();
    const legacyModes: DailyDifficulty[] = [];
    const hasTrioConflict = latestValidated.trioErrors.length > 0;

    for (const difficulty of DAILY_DIFFICULTIES) {
      const round = latestValidated.rounds[difficulty];
      const hardErrors = latestValidated.errors[difficulty] ?? [];
      const isOutdated = (latestValidated.outdated[difficulty]?.length ?? 0) > 0;
      if (round && !hardErrors.length && scores[difficulty] > 0) {
        fixed[difficulty] = round;
        if (isOutdated) legacyModes.push(difficulty);
      } else if (round && !hardErrors.length && !isOutdated && !hasTrioConflict) {
        // Preserve a valid unscored mode on the first attempt, but allow a
        // broader second attempt if it strands the missing modes.
        fixed[difficulty] = round;
      } else if (scores[difficulty] === 0) {
        replaceable.add(difficulty);
      }
    }

    const lockedInvalid = DAILY_DIFFICULTIES.filter((difficulty) =>
      (latestValidated.errors[difficulty]?.length ?? 0) > 0 && scores[difficulty] > 0,
    );
    if (lockedInvalid.length) {
      return NextResponse.json({
        error: "A saved Daily board needs administrator repair.",
        lockedModes: lockedInvalid,
        legacyModes,
        trioDiagnostics: latestValidated.trioErrors,
        ...shape(latestBefore.rows, dependencies),
      }, { status: 409 });
    }

    // A fully scored trio remains playable exactly as it was saved, even when
    // it predates a later cross-mode diversity policy.
    if (DAILY_DIFFICULTIES.every((difficulty) => scores[difficulty] > 0)
      && fixed.easy && fixed.normal && fixed.expert) {
      return NextResponse.json({
        found: true,
        generated: false,
        legacyModes,
        warning: (legacyModes.length || hasTrioConflict)
          ? "This scored Daily uses the rules under which it was originally played."
          : undefined,
        ...shape(latestBefore.rows, dependencies),
      }, { headers: { "Cache-Control": DAILY_SUCCESS_CACHE } });
    }

    let generated;
    try {
      generated = await generateDailyTrio(dependencies.countries, date, fixed);
    } catch (firstError) {
      // A valid but unscored stored mode may still make the complete trio
      // impossible. Retry once while preserving only modes that have scores.
      const scoredFixed = Object.fromEntries(
        DAILY_DIFFICULTIES
          .filter((difficulty) => scores[difficulty] > 0 && latestValidated.rounds[difficulty])
          .map((difficulty) => [difficulty, latestValidated.rounds[difficulty]!]),
      ) as Partial<Record<DailyDifficulty, Round>>;
      const broaderReplaceable = new Set(
        DAILY_DIFFICULTIES.filter((difficulty) => scores[difficulty] === 0),
      );
      const broadened = broaderReplaceable.size > replaceable.size
        || Object.keys(scoredFixed).length < Object.keys(fixed).length;
      if (!broadened) throw firstError;
      fixed = scoredFixed;
      replaceable = broaderReplaceable;
      generated = await generateDailyTrio(dependencies.countries, date, fixed);
    }
    await persistRounds(supabase, date, generated.trio, replaceable);

    const latestAfter = await readStored(supabase, date);
    if (latestAfter.error) throw latestAfter.error;
    const finalValidated = validateStoredRows(latestAfter.rows, dependencies);
    if (!finalValidated.rounds.easy || !finalValidated.rounds.normal || !finalValidated.rounds.expert
      || Object.keys(finalValidated.errors).length || finalValidated.trioErrors.length) {
      throw new Error(`Saved Daily trio failed verification: ${JSON.stringify({
        modes: finalValidated.errors,
        trio: finalValidated.trioErrors,
      })}`);
    }

    await recordGeneration(supabase, {
      challenge_date: date,
      status: latestBefore.rows.length ? "repaired" : "completed",
      source: "daily-get-v15.7.0",
      diagnostics: generated.diagnostics,
      scores: generated.scores,
    });

    return NextResponse.json({
      found: true,
      generated: true,
      repairedModes: [...replaceable],
      legacyModes,
      preferenceWarnings: dailyTrioPreferenceWarnings(finalValidated.rounds as DailyTrioLike),
      ...shape(latestAfter.rows, dependencies),
    }, { headers: { "Cache-Control": DAILY_SUCCESS_CACHE } });
  } catch (error) {
    const internalMessage = error instanceof Error ? error.message : "Daily boards could not be generated.";
    const diagnostics = typeof error === "object" && error && "diagnostics" in error
      ? (error as { diagnostics?: unknown }).diagnostics ?? null
      : null;
    await recordGeneration(supabase, {
      challenge_date: date,
      status: "failed",
      source: "daily-get-v15.7.0",
      diagnostics,
      error_message: internalMessage,
    });
    const fallback = await latestFallback(supabase, date, dependencies);
    if (fallback) {
      return NextResponse.json({
        found: true,
        generated: false,
        fallback: true,
        fallback_date: fallback.date,
        warning: "Today’s board is still being prepared, so this is an unranked practice board.",
        ...fallback.boards,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: PUBLIC_GENERATION_ERROR }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  } finally {
    await releaseDailyGenerationLock(supabase, date, lockToken);
  }
}

/** Official-board writes are administrator-only. */
export async function POST(
  request: Request,
  context: { params: Promise<{ date: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { date } = await context.params;
  if (!validDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  const body = await request.json().catch(() => null) as PackedTrio | null;
  if (!body) return NextResponse.json({ error: "Board payload is required." }, { status: 400 });

  const dependencies = await loadDependencies();
  const scoreCounts = await scoreCountsByDifficulty(auth.admin, date);
  const scoredModes = DAILY_DIFFICULTIES.filter((difficulty) => scoreCounts[difficulty] > 0);
  if (scoredModes.length) {
    return NextResponse.json({
      error: "Daily boards with saved scores are locked against replacement.",
      lockedModes: scoredModes,
    }, { status: 409 });
  }

  const rounds: Partial<Record<DailyDifficulty, Round>> = {};
  for (const difficulty of DAILY_DIFFICULTIES) {
    const packed = body[difficulty];
    if (!packed?.board_payload) return NextResponse.json({ error: `Missing ${difficulty} board snapshot.` }, { status: 400 });
    rounds[difficulty] = deserializeRound(packed.board_payload);
  }
  const errors = validateDailyTrio(rounds as DailyTrioLike);
  if (errors.length) return NextResponse.json({ error: "The proposed trio is invalid.", diagnostics: errors }, { status: 400 });
  await persistRounds(auth.admin, date, rounds, new Set(DAILY_DIFFICULTIES));
  const stored = await readStored(auth.admin, date);
  if (stored.error) return NextResponse.json({ error: stored.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...shape(stored.rows, dependencies) });
}
