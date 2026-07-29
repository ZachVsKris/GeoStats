import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { decodeRound, encodeRound, type Round } from "../../../../lib/challengeCodec";
import { fetchCountries, type CountryInfo } from "../../../../lib/worldBank";
import { DAILY_DIFFICULTIES, type DailyDifficulty } from "../../../../lib/gameRules";
import { CATEGORY_SET_VERSION, DATASET_VERSION, RULES_VERSION } from "../../../../lib/version";
import { loadServerPlayableCategoryCatalog } from "../../../../lib/serverPlayableCatalog";
import {
  dailyTrioPreferenceWarnings,
  validateDailyTrio,
  type DailyTrioLike,
} from "../../../../lib/dailyTrioRules";
import { generateDailyTrio } from "../../../../lib/puzzleEngine";
import type { Category } from "../../../../lib/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DAILY_SUCCESS_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";
const PUBLIC_GENERATION_ERROR = "Today’s boards are still being prepared. Please try again in a moment.";

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

type PackedBoard = { seed?: string; encodedBoard?: string };
type TrioBody = Partial<Record<DailyDifficulty, PackedBoard>>;
type StoredRow = {
  challenge_date: string;
  difficulty: DailyDifficulty;
  seed: string;
  encoded_board: string;
  rules_version: string;
  category_set_version: string;
};
type StoredShape = Partial<Record<DailyDifficulty, { seed: string; encoded_board: string }>>;

type Dependencies = {
  countries: CountryInfo[];
  categoryCatalog: Category[];
};

function shape(rows: StoredRow[]) {
  const result: StoredShape = {};
  for (const row of rows) {
    result[row.difficulty] = { seed: row.seed, encoded_board: row.encoded_board };
  }
  return result;
}

function decodeCompleteTrio(
  rows: StoredRow[],
  dependencies: Dependencies,
): { trio: DailyTrioLike | null; errors: string[] } {
  const rowByDifficulty = new Map(rows.map((row) => [row.difficulty, row]));
  const decoded: Partial<Record<DailyDifficulty, Round>> = {};
  const errors: string[] = [];

  for (const difficulty of DAILY_DIFFICULTIES) {
    const row = rowByDifficulty.get(difficulty);
    if (!row) {
      errors.push(`Missing ${difficulty} board.`);
      continue;
    }

    try {
      if (row.rules_version !== RULES_VERSION) {
        errors.push(`${difficulty} board uses rules ${row.rules_version || "unknown"}; ${RULES_VERSION} is required.`);
        continue;
      }
      if (row.category_set_version !== CATEGORY_SET_VERSION) {
        errors.push(`${difficulty} board uses an older category set.`);
        continue;
      }
      decoded[difficulty] = decodeRound(
        row.encoded_board,
        dependencies.countries,
        dependencies.categoryCatalog,
      );
    } catch (error) {
      errors.push(
        `${difficulty} board could not be decoded: ${error instanceof Error ? error.message : "invalid board"}`,
      );
    }
  }

  if (!decoded.easy || !decoded.normal || !decoded.expert) {
    return { trio: null, errors };
  }

  const trio = decoded as DailyTrioLike;
  return { trio, errors: [...errors, ...validateDailyTrio(trio)] };
}

async function readStored(supabase: any, date: string) {
  const { data, error } = await supabase
    .from("daily_challenges")
    .select("challenge_date,difficulty,seed,encoded_board,rules_version,category_set_version")
    .eq("challenge_date", date)
    .in("difficulty", [...DAILY_DIFFICULTIES]);
  return { rows: (data ?? []) as StoredRow[], error };
}

async function scoreCountForDate(supabase: any, date: string) {
  const { count, error } = await supabase
    .from("daily_scores")
    .select("id", { count: "exact", head: true })
    .eq("challenge_date", date);
  if (error) throw error;
  return count ?? 0;
}

async function persistPackedTrio(
  supabase: any,
  date: string,
  packed: Record<DailyDifficulty, { seed: string; encodedBoard: string }>,
) {
  const rows = DAILY_DIFFICULTIES.map((difficulty) => ({
    challenge_date: date,
    difficulty,
    seed: packed[difficulty].seed,
    encoded_board: packed[difficulty].encodedBoard,
    board_hash: createHash("sha256").update(packed[difficulty].encodedBoard).digest("hex"),
    dataset_version: DATASET_VERSION,
    rules_version: RULES_VERSION,
    category_set_version: CATEGORY_SET_VERSION,
  }));

  const { error } = await supabase
    .from("daily_challenges")
    .upsert(rows, { onConflict: "challenge_date,difficulty" });
  if (error) throw error;
}

async function recordGeneration(supabase: any, row: Record<string, unknown>) {
  try {
    await supabase.from("daily_generation_runs").insert(row);
  } catch {
    // The health table is optional.
  }
}

async function loadDependencies(): Promise<Dependencies> {
  const [countries, categoryCatalog] = await Promise.all([
    fetchCountries(),
    loadServerPlayableCategoryCatalog(),
  ]);
  return { countries, categoryCatalog };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ date: string }> },
) {
  const { date } = await context.params;
  if (!validDate(date)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  try {
    const [dependencies, stored] = await Promise.all([
      loadDependencies(),
      readStored(supabase, date),
    ]);
    if (stored.error) throw stored.error;

    const validated = decodeCompleteTrio(stored.rows, dependencies);
    if (validated.trio && !validated.errors.length) {
      return NextResponse.json(
        {
          found: true,
          generated: false,
          preferenceWarnings: dailyTrioPreferenceWarnings(validated.trio),
          ...shape(stored.rows),
        },
        { headers: { "Cache-Control": DAILY_SUCCESS_CACHE } },
      );
    }

    const scoreCount = await scoreCountForDate(supabase, date);
    if (scoreCount > 0) {
      return NextResponse.json(
        {
          error: "Today’s saved boards need an administrator repair before they can reopen.",
          diagnostics: { storedErrors: validated.errors, scoreCount },
        },
        { status: 409 },
      );
    }

    const generated = await generateDailyTrio(dependencies.countries, date);
    const packed = Object.fromEntries(
      DAILY_DIFFICULTIES.map((difficulty) => [
        difficulty,
        {
          seed: `DAILY-${difficulty.toUpperCase()}-${date}`,
          encodedBoard: encodeRound(generated.trio[difficulty]),
        },
      ]),
    ) as Record<DailyDifficulty, { seed: string; encodedBoard: string }>;

    await persistPackedTrio(supabase, date, packed);

    const latest = await readStored(supabase, date);
    if (latest.error) throw latest.error;
    const verified = decodeCompleteTrio(latest.rows, dependencies);
    if (!verified.trio || verified.errors.length) {
      throw new Error(`Saved Daily trio failed verification: ${verified.errors.join(" ")}`);
    }

    const preferenceWarnings = dailyTrioPreferenceWarnings(verified.trio);
    await recordGeneration(supabase, {
      challenge_date: date,
      status: stored.rows.length ? "repaired" : "completed",
      source: "daily-get-v15.6.2",
      diagnostics: {
        ...generated.diagnostics,
        preferenceWarnings,
        replacedStoredRows: stored.rows.length,
        storedErrors: validated.errors,
      },
      scores: generated.scores,
    });

    return NextResponse.json(
      {
        found: true,
        generated: true,
        repaired: stored.rows.length > 0,
        preferenceWarnings,
        ...shape(latest.rows),
      },
      { headers: { "Cache-Control": DAILY_SUCCESS_CACHE } },
    );
  } catch (error) {
    const internalMessage =
      error instanceof Error ? error.message : "Daily boards could not be generated.";
    const diagnostics =
      typeof error === "object" && error && "diagnostics" in error
        ? (error as { diagnostics?: unknown }).diagnostics ?? null
        : null;

    await recordGeneration(supabase, {
      challenge_date: date,
      status: "failed",
      source: "daily-get-v15.6.2",
      diagnostics,
      error_message: internalMessage,
    });

    return NextResponse.json(
      { error: PUBLIC_GENERATION_ERROR },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ date: string }> },
) {
  const { date } = await context.params;
  if (!validDate(date)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as TrioBody | null;
  if (
    !body
    || DAILY_DIFFICULTIES.some(
      (difficulty) => !body[difficulty]?.seed || !body[difficulty]?.encodedBoard,
    )
  ) {
    return NextResponse.json(
      { error: "All three Daily boards are required." },
      { status: 400 },
    );
  }

  if (
    DAILY_DIFFICULTIES.some(
      (difficulty) => body[difficulty]!.encodedBoard!.length > 30_000,
    )
  ) {
    return NextResponse.json({ error: "Invalid board." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  try {
    const dependencies = await loadDependencies();
    const stored = await readStored(supabase, date);
    if (stored.error) throw stored.error;

    const existing = decodeCompleteTrio(stored.rows, dependencies);
    if (existing.trio && !existing.errors.length) {
      return NextResponse.json({
        created: false,
        repaired: false,
        ...shape(stored.rows),
      });
    }

    const scoreCount = await scoreCountForDate(supabase, date);
    if (scoreCount > 0) {
      return NextResponse.json(
        { error: "Daily boards with saved scores are locked against replacement." },
        { status: 409 },
      );
    }

    const packed = Object.fromEntries(
      DAILY_DIFFICULTIES.map((difficulty) => [
        difficulty,
        {
          seed: body[difficulty]!.seed!,
          encodedBoard: body[difficulty]!.encodedBoard!,
        },
      ]),
    ) as Record<DailyDifficulty, { seed: string; encodedBoard: string }>;

    const proposedRows = DAILY_DIFFICULTIES.map((difficulty) => ({
      challenge_date: date,
      difficulty,
      seed: packed[difficulty].seed,
      encoded_board: packed[difficulty].encodedBoard,
      rules_version: RULES_VERSION,
      category_set_version: CATEGORY_SET_VERSION,
    })) as StoredRow[];

    const proposed = decodeCompleteTrio(proposedRows, dependencies);
    if (!proposed.trio || proposed.errors.length) {
      return NextResponse.json(
        {
          error: "The proposed Daily trio failed v15.6.2 validation.",
          diagnostics: proposed.errors,
        },
        { status: 400 },
      );
    }

    await persistPackedTrio(supabase, date, packed);

    const latest = await readStored(supabase, date);
    if (latest.error) throw latest.error;
    const verified = decodeCompleteTrio(latest.rows, dependencies);
    if (!verified.trio || verified.errors.length) {
      throw new Error(`Saved Daily trio failed verification: ${verified.errors.join(" ")}`);
    }

    await recordGeneration(supabase, {
      challenge_date: date,
      status: stored.rows.length ? "repaired" : "completed",
      source: "daily-post-v15.6.2",
      diagnostics: {
        replacedStoredRows: stored.rows.length,
        previousErrors: existing.errors,
        preferenceWarnings: dailyTrioPreferenceWarnings(verified.trio),
      },
    });

    return NextResponse.json({
      created: true,
      repaired: stored.rows.length > 0,
      ...shape(latest.rows),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Daily trio validation failed.",
      },
      { status: 500 },
    );
  }
}
