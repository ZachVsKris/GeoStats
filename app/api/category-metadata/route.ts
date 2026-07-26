import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/server";
import { CATEGORIES } from "../../../lib/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_ORGANIZATIONS: Record<string, string> = {
  worldbank: "World Bank",
  faostat: "FAOSTAT",
  who: "WHO",
  unesco: "UNESCO UIS",
  ilostat: "ILOSTAT",
  naturalearth: "Natural Earth",
  comtrade: "UN Comtrade",
  eia: "U.S. EIA",
  unhcr: "UNHCR",
  untourism: "UN Tourism",
};

const SAFE_ID = /^[A-Za-z0-9:'._-]{1,180}$/;

type CategoryRow = {
  id: string;
  source_url: string | null;
  methodology_url?: string | null;
  official_observation_share?: number | null;
  modeled_observation_share?: number | null;
  credibility_score?: number | null;
  credibility_status?: string | null;
  credibility_reason?: string | null;
  evidence_label?: string | null;
};

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

function evidenceLabel(row: CategoryRow) {
  if (row.evidence_label) return row.evidence_label;
  const modeled = Number(row.modeled_observation_share ?? 0);
  const official = Number(row.official_observation_share ?? 0);
  if (modeled >= .8) return "Modeled estimate";
  if (modeled >= .2 && official >= .2) return "Mixed observed and modeled";
  if (official >= .8) return "Observed/administrative";
  return "Internationally harmonized";
}

function serialize(row: CategoryRow, requestedId?: string) {
  return {
    requestedId,
    categoryId: row.id,
    sourceUrl: row.source_url,
    methodologyUrl: row.methodology_url ?? null,
    officialObservationShare: row.official_observation_share ?? null,
    modeledObservationShare: row.modeled_observation_share ?? null,
    evidenceLabel: evidenceLabel(row),
    credibilityScore: row.credibility_score ?? null,
    trustStatus: row.credibility_status ?? null,
    trustReason: row.credibility_reason ?? null,
  };
}

const MODERN_SELECT = "id,source_url,methodology_url,official_observation_share,modeled_observation_share,credibility_score,credibility_status,credibility_reason,evidence_label";
const LEGACY_SELECT = "id,source_url,methodology_url,official_observation_share,modeled_observation_share";

async function selectRows(admin: AdminClient, configure: (select: string) => any) {
  let result: any = await configure(MODERN_SELECT);
  if (result.error && /credibility_|evidence_label/i.test(result.error.message)) {
    result = await configure(LEGACY_SELECT);
  }
  return result as { data: CategoryRow[] | CategoryRow | null; error: { message: string } | null };
}

async function selectByIds(admin: AdminClient, ids: string[]) {
  return selectRows(admin, (select) => admin.from("stat_categories").select(select).in("id", ids));
}

async function selectBySourceIndicator(admin: AdminClient, organization: string, indicator: string) {
  return selectRows(admin, (select) => admin
    .from("stat_categories")
    .select(select)
    .eq("source_organization", organization)
    .eq("source_indicator_code", indicator)
    .maybeSingle());
}

export async function GET(request: NextRequest) {
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const idsParam = request.nextUrl.searchParams.get("ids");
  if (idsParam) {
    const ids = [...new Set(idsParam.split(",").map((value) => value.trim()).filter((value) => SAFE_ID.test(value)))].slice(0, 30);
    if (!ids.length) return NextResponse.json({ categories: [] });

    const direct = await selectByIds(admin, ids);
    if (direct.error) return NextResponse.json({ error: direct.error.message }, { status: 500 });
    const directRows = (Array.isArray(direct.data) ? direct.data : []) as CategoryRow[];
    const byRequestedId = new Map<string, CategoryRow>(directRows.map((row) => [row.id, row]));

    // Encoded Daily boards use stable application IDs, while some warehouse rows
    // use importer IDs. Resolve any misses by the source organization + indicator
    // pair so exact links survive persisted-board decoding as well as live imports.
    for (const requestedId of ids.filter((id) => !byRequestedId.has(id))) {
      const staticCategory = CATEGORIES.find((category) => category.id === requestedId);
      if (!staticCategory) continue;
      const organization = SOURCE_ORGANIZATIONS[staticCategory.source];
      const indicator = staticCategory.warehouseSourceIndicatorCode ?? staticCategory.indicator;
      if (!organization || !SAFE_ID.test(indicator)) continue;
      const resolved = await selectBySourceIndicator(admin, organization, indicator);
      if (!resolved.error && resolved.data && !Array.isArray(resolved.data)) byRequestedId.set(requestedId, resolved.data);
    }

    return NextResponse.json({
      categories: ids.flatMap((id) => byRequestedId.has(id) ? [serialize(byRequestedId.get(id)!, id)] : []),
    }, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
    });
  }

  const source = request.nextUrl.searchParams.get("source") ?? "";
  const indicator = request.nextUrl.searchParams.get("indicator") ?? "";
  const organization = SOURCE_ORGANIZATIONS[source];
  if (!organization || !SAFE_ID.test(indicator)) return NextResponse.json({ error: "Invalid category metadata request." }, { status: 400 });

  const result = await selectBySourceIndicator(admin, organization, indicator);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  if (!result.data || Array.isArray(result.data)) return NextResponse.json({ error: "Category metadata not found." }, { status: 404 });
  return NextResponse.json(serialize(result.data), {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
  });
}
