import { NextResponse } from "next/server";
import { loadServerPlayableCategoryCatalog } from "../../../lib/serverPlayableCatalog";
import { PLAYABLE_CATALOG_CACHE_VERSION } from "../../../lib/version";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await loadServerPlayableCategoryCatalog();
    return NextResponse.json({ categories, catalog: "approved" }, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
        "X-GeoStats-Catalog-Version": PLAYABLE_CATALOG_CACHE_VERSION,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The category catalog could not be loaded." },
      { status: 500 },
    );
  }
}
