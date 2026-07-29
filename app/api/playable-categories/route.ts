import { NextResponse } from "next/server";
import { loadServerPlayableCategoryCatalog } from "../../../lib/serverPlayableCatalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tier = url.searchParams.get("tier") === "random" ? "random" : "daily";
    const categories = await loadServerPlayableCategoryCatalog(tier);
    return NextResponse.json({ categories, tier }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The category catalog could not be loaded." }, { status: 500 });
  }
}
