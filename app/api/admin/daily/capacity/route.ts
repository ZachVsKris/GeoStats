import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";
import { ROUND_CONFIGS } from "../../../../../lib/gameRules";
import { loadPuzzleCatalogSnapshot } from "../../../../../lib/puzzleEngine";
import { estimatePlayableBoardCapacity } from "../../../../../lib/seedCapacity";
import { fetchCountries } from "../../../../../lib/worldBank";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [catalog, countries] = await Promise.all([loadPuzzleCatalogSnapshot(), fetchCountries()]);
    const startedAt = Date.now();
    const estimate = (config: (typeof ROUND_CONFIGS)[keyof typeof ROUND_CONFIGS]) => estimatePlayableBoardCapacity(
      catalog.datasets,
      countries,
      config,
      { samples: 3_000, budgetMs: 80_000, perSetBudgetMs: 20 },
    );
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      definition: "Deterministic bounded estimates of unordered category sets that can form at least one actual country bank under every production board rule, including the global Top-20 winner requirement.",
      countingBoundary: "The estimate counts feasible category sets, not display order or every possible country-bank permutation. Exact full enumeration is intentionally skipped when it cannot finish within five minutes.",
      catalogLoad: {
        playableRows: catalog.catalogSize,
        usableDatasets: catalog.datasets.length,
        loadFailures: catalog.datasetLoadFailures,
        qualityRejections: catalog.qualityRejections,
      },
      modes: {
        scout: estimate(ROUND_CONFIGS.easy),
        adventurer: estimate(ROUND_CONFIGS.normal),
        expert: estimate(ROUND_CONFIGS.expert),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Capacity count failed." }, { status: 500 });
  }
}
