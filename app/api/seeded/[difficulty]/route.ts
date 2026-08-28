import { NextResponse } from "next/server";
import { encodeRound, serializeRound } from "../../../../lib/challengeCodec";
import { generateSeededRoundFromLoadedCatalog, loadPuzzleCatalogSnapshot } from "../../../../lib/puzzleEngine";
import { fetchCountries } from "../../../../lib/worldBank";
import { type DailyDifficulty } from "../../../../lib/gameRules";
import { CATEGORY_SET_VERSION, DATASET_VERSION, RULES_VERSION } from "../../../../lib/version";
import { internalTesterAccess } from "../../../../lib/supabase/internalTester";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DIFFICULTIES = new Set<DailyDifficulty>(["easy", "normal", "expert"]);
const memoryCache = new Map<string, { expires: number; payload: unknown; timings: string }>();
const SEEDED_CACHE = "private, no-store";

function normalizeSeed(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
}

function rounded(value: number) {
  return Math.max(0, Math.round(value));
}

export async function GET(
  request: Request,
  context: { params: Promise<{ difficulty: string }> },
) {
  const startedAt = performance.now();
  const access = await internalTesterAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers: { "Cache-Control": "no-store" } });
  const { difficulty: rawDifficulty } = await context.params;
  if (!DIFFICULTIES.has(rawDifficulty as DailyDifficulty)) {
    return NextResponse.json({ error: "Unsupported difficulty." }, { status: 400 });
  }
  const difficulty = rawDifficulty as DailyDifficulty;
  const url = new URL(request.url);
  const seed = normalizeSeed(url.searchParams.get("seed") ?? "");
  if (!seed) return NextResponse.json({ error: "A seed is required." }, { status: 400 });

  const requestedCatalog = url.searchParams.get("catalog");
  if (requestedCatalog && requestedCatalog !== CATEGORY_SET_VERSION) {
    return NextResponse.json({
      error: "This Random request targets an older category-set version. Reload GeoStats and try the seed again.",
      category_set_version: CATEGORY_SET_VERSION,
    }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }

  const key = `${DATASET_VERSION}:${CATEGORY_SET_VERSION}:${difficulty}:${seed}`;
  const cached = memoryCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: {
        "Cache-Control": SEEDED_CACHE,
        "Server-Timing": `${cached.timings}, memory;dur=0;desc=seed-response-cache`,
        "X-GeoStats-Seed-Cache": "memory-hit",
      },
    });
  }

  try {
    const catalogStartedAt = performance.now();
    const [countries, loaded] = await Promise.all([fetchCountries(), loadPuzzleCatalogSnapshot()]);
    const catalogLoadMs = performance.now() - catalogStartedAt;

    const generationStartedAt = performance.now();
    const generated = generateSeededRoundFromLoadedCatalog(countries, seed, difficulty, loaded);
    const generationMs = performance.now() - generationStartedAt;
    const totalMs = performance.now() - startedAt;
    const timings = `catalog;dur=${rounded(catalogLoadMs)}, generation;dur=${rounded(generationMs)}, total;dur=${rounded(totalMs)}`;

    const payload = {
      seed,
      difficulty,
      encoded_board: encodeRound(generated.round),
      board_payload: serializeRound(generated.round),
      generation_profile: generated.profile,
      rules_version: RULES_VERSION,
      category_set_version: CATEGORY_SET_VERSION,
      performance: {
        catalogLoadMs: rounded(catalogLoadMs),
        generationMs: rounded(generationMs),
        totalMs: rounded(totalMs),
      },
    };
    memoryCache.set(key, { expires: Date.now() + 6 * 60 * 60 * 1000, payload, timings });
    if (memoryCache.size > 250) memoryCache.delete(memoryCache.keys().next().value as string);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": SEEDED_CACHE,
        "Server-Timing": timings,
        "X-GeoStats-Seed-Cache": "generated",
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The Random board could not be generated.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
