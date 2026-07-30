import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "../../../lib/supabase/server";
import {
  decodeRound,
  deserializeRound,
  type Round,
  type RoundSnapshot,
} from "../../../lib/challengeCodec";
import { fetchCountries } from "../../../lib/worldBank";
import { scorePlacements, validateRound } from "../../../lib/dataEngine";
import { ROUND_CONFIGS, type DailyDifficulty } from "../../../lib/gameRules";
import { loadServerCategoryRegistry } from "../../../lib/serverPlayableCatalog";

function parseDifficulty(value: unknown): DailyDifficulty | null {
  if (value === undefined || value === null || value === "" || value === "easy") return "easy";
  if (value === "normal" || value === "expert") return value;
  return null;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const scoreColumns = "score,average_placement,firsts,top_fives,difficulty,assignments,completed_at";

type StoredChallenge = {
  encoded_board: string;
  board_payload?: RoundSnapshot | null;
};

async function loadStoredRound(challenge: StoredChallenge): Promise<Round> {
  if (challenge.board_payload) {
    return deserializeRound(challenge.board_payload);
  }

  // Legacy boards decode against the complete category registry, not only the
  // categories that happen to be playable today. This keeps a saved board
  // scoreable after later catalog renames, quarantine decisions, or duplicate
  // cleanup.
  const [countries, categoryRegistry] = await Promise.all([
    fetchCountries(),
    loadServerCategoryRegistry(),
  ]);
  return decodeRound(challenge.encoded_board, countries, categoryRegistry);
}

export async function GET(request: Request) {
  const authClient = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!authClient || !admin) return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ signedIn: false, completed: false, result: null }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const url = new URL(request.url);
  const challengeDate = url.searchParams.get("challengeDate");
  const difficulty = parseDifficulty(url.searchParams.get("difficulty"));
  if (!difficulty || !challengeDate || !validDate(challengeDate)) {
    return NextResponse.json({ error: "Invalid challenge date." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("daily_scores")
    .select(scoreColumns)
    .eq("user_id", user.id)
    .eq("challenge_date", challengeDate)
    .eq("difficulty", difficulty)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signedIn: true, completed: Boolean(data), result: data ?? null }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const authClient = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!authClient || !admin) return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save your score." }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    challengeDate?: string;
    difficulty?: DailyDifficulty;
    assignments?: Record<string, string>;
  } | null;
  const difficulty = parseDifficulty(body?.difficulty);
  if (!difficulty || !body?.challengeDate || !validDate(body.challengeDate) || !body.assignments || Object.keys(body.assignments).length === 0) {
    return NextResponse.json({ error: "Invalid score submission." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await admin
    .from("daily_scores")
    .select(scoreColumns)
    .eq("user_id", user.id)
    .eq("challenge_date", body.challengeDate)
    .eq("difficulty", difficulty)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing) {
    return NextResponse.json({ saved: true, alreadyCompleted: true, result: existing }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { data: challenge, error: challengeError } = await admin
    .from("daily_challenges")
    .select("encoded_board,board_payload")
    .eq("challenge_date", body.challengeDate)
    .eq("difficulty", difficulty)
    .single();
  if (challengeError || !challenge) return NextResponse.json({ error: "Daily challenge not found." }, { status: 404 });

  try {
    const round = await loadStoredRound(challenge as StoredChallenge);
    const config = ROUND_CONFIGS[difficulty];
    if (round.categories.length !== config.categoryCount || round.bank.length !== config.countryCount) {
      return NextResponse.json({ error: "This Daily board has the wrong dimensions and must be reloaded before scoring." }, { status: 409 });
    }

    const ruleErrors = validateRound(round.categories, round.bank);
    if (ruleErrors.length) {
      return NextResponse.json({ error: "This Daily board does not contain a valid scoreable round." }, { status: 409 });
    }

    const categoryIds = new Set(round.categories.map((dataset) => dataset.category.id));
    const submittedCategoryIds = Object.keys(body.assignments);
    if (submittedCategoryIds.length !== round.categories.length
      || submittedCategoryIds.some((categoryId) => !categoryIds.has(categoryId))) {
      return NextResponse.json({ error: "Invalid score submission." }, { status: 400 });
    }

    const bankIds = new Set(round.bank.map((country) => country.id));
    const assignedCountryIds = Object.values(body.assignments);
    if (assignedCountryIds.some((countryId) => !bankIds.has(countryId))
      || new Set(assignedCountryIds).size !== assignedCountryIds.length) {
      return NextResponse.json({ error: "Invalid score submission." }, { status: 400 });
    }

    const rows = scorePlacements(round.categories, round.bank, body.assignments);
    const score = rows.reduce((sum, row) => sum + row.selected.points, 0);
    const averagePlacement = rows.reduce((sum, row) => sum + row.selected.poolRank, 0) / rows.length;
    const firsts = rows.filter((row) => row.selected.poolRank === 1).length;
    const topFinishes = rows.filter((row) => row.selected.poolRank <= config.topFinishRank).length;
    const { data, error } = await admin.from("daily_scores").insert({
      user_id: user.id,
      challenge_date: body.challengeDate,
      difficulty,
      score,
      average_placement: averagePlacement,
      firsts,
      top_fives: topFinishes,
      assignments: body.assignments,
    })
      .select(scoreColumns)
      .single();

    if (error?.code === "23505") {
      const { data: saved } = await admin
        .from("daily_scores")
        .select(scoreColumns)
        .eq("user_id", user.id)
        .eq("challenge_date", body.challengeDate)
        .eq("difficulty", difficulty)
        .single();
      return NextResponse.json({ saved: true, alreadyCompleted: true, result: saved }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ saved: true, alreadyCompleted: false, result: data }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Score verification failed." }, { status: 400 });
  }
}
