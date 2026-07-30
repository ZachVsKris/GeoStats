import { NextResponse } from "next/server";
import { encodeRound, serializeRound } from "../../../../lib/challengeCodec";
import { generateSeededRound } from "../../../../lib/puzzleEngine";
import { fetchCountries } from "../../../../lib/worldBank";
import { type DailyDifficulty } from "../../../../lib/gameRules";
import { CATEGORY_SET_VERSION, DATASET_VERSION, RULES_VERSION } from "../../../../lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DIFFICULTIES = new Set<DailyDifficulty>(["easy", "normal", "expert"]);
const memoryCache = new Map<string, { expires: number; payload: unknown }>();

function normalizeSeed(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ difficulty: string }> },
) {
  const { difficulty: rawDifficulty } = await context.params;
  if (!DIFFICULTIES.has(rawDifficulty as DailyDifficulty)) {
    return NextResponse.json({ error: "Unsupported difficulty." }, { status: 400 });
  }
  const difficulty = rawDifficulty as DailyDifficulty;
  const seed = normalizeSeed(new URL(request.url).searchParams.get("seed") ?? "");
  if (!seed) return NextResponse.json({ error: "A seed is required." }, { status: 400 });

  const key = `${DATASET_VERSION}:${CATEGORY_SET_VERSION}:${difficulty}:${seed}`;
  const cached = memoryCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  }

  try {
    const countries = await fetchCountries();
    const generated = await generateSeededRound(countries, seed, difficulty);
    const payload = {
      seed,
      difficulty,
      encoded_board: encodeRound(generated.round),
      board_payload: serializeRound(generated.round),
      generation_profile: generated.profile,
      rules_version: RULES_VERSION,
      category_set_version: CATEGORY_SET_VERSION,
    };
    memoryCache.set(key, { expires: Date.now() + 6 * 60 * 60 * 1000, payload });
    if (memoryCache.size > 100) memoryCache.delete(memoryCache.keys().next().value as string);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The seeded board could not be generated.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
