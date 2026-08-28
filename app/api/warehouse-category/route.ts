import { NextRequest, NextResponse } from "next/server";
import {
  loadServerWarehousePayload,
  WarehouseCategoryError,
} from "../../../lib/serverWarehouseCategories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CATEGORY_ID =
  /^[a-z0-9][a-z0-9-]{1,80}:[a-z0-9:._-]+$/;
const ALLOWED_INDICATOR = /^[A-Za-z0-9:'._+-]{1,180}$/;
const ALLOWED_SOURCE = new Set([
  "worldbank", "faostat", "who", "unesco", "untourism", "ilostat", "naturalearth", "comtrade", "eia", "unhcr",
  "pewreligion", "faostatfbs", "unescoheritage", "smithsoniangvp", "usgs", "worldcover", "hydrosheds", "elevation",
  "aquastat", "usgsminerals", "faofisheries", "unmembership", "constitute", "ipu", "unwpp", "worldbankclimate",
  "imfweo", "unescoich", "noaatsunami", "whoghed", "undesamigrant", "wtoservices", "untourismdirect", "fifa", "ioc",
  "worldbankhistory", "globalfindex2025", "faofra2025", "unicefdata", "undphdr", "vdemv16", "faostatfoodsecurity",
  "koppengeiger", "worldbankinfra", "faostatlanduse", "faostatworldcover", "worldbankwbl", "jmpwash", "unwup2025", "unwupcities2025",
]);

export async function GET(request: NextRequest) {
  const categoryId = request.nextUrl.searchParams.get("category") ?? "";
  const source = request.nextUrl.searchParams.get("source") ?? "";
  const indicator = request.nextUrl.searchParams.get("indicator") ?? "";

  const byCategoryId = ALLOWED_CATEGORY_ID.test(categoryId);
  const bySourceIndicator =
    ALLOWED_SOURCE.has(source) && ALLOWED_INDICATOR.test(indicator);

  if (!byCategoryId && !bySourceIndicator) {
    return NextResponse.json(
      { error: "Invalid warehouse category." },
      { status: 400 },
    );
  }

  try {
    const payload = byCategoryId
      ? await loadServerWarehousePayload({ categoryId })
      : await loadServerWarehousePayload({ source, indicator });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    if (error instanceof WarehouseCategoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Warehouse category data could not be loaded.",
      },
      { status: 500 },
    );
  }
}
