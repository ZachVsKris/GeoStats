import { NextResponse } from "next/server";
import { loadServerPlayableCategoryCatalog } from "../../../lib/serverPlayableCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await loadServerPlayableCategoryCatalog();
    return NextResponse.json({ categories, count: categories.length }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "The trusted category catalog could not be loaded." }, { status: 500 });
  }
}
