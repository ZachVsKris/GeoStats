import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";
import { ROUND_CONFIGS } from "../../../../../lib/gameRules";
import { loadServerPlayableCategoryCatalog } from "../../../../../lib/serverPlayableCatalog";
import { estimateValidCategorySets } from "../../../../../lib/seedCapacity";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const catalog = await loadServerPlayableCategoryCatalog();
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      definition: "Exact raw n-choose-k category combinations plus deterministic estimates after GeoStats diversity rules; display order is not counted.",
      fullBoardCapacity: "Country-bank capacity is not enumerated exactly because country eligibility depends on each category set.",
      modes: {
        scout: estimateValidCategorySets(catalog, ROUND_CONFIGS.easy),
        adventurer: estimateValidCategorySets(catalog, ROUND_CONFIGS.normal),
        expert: estimateValidCategorySets(catalog, ROUND_CONFIGS.expert),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Capacity count failed." }, { status: 500 });
  }
}
