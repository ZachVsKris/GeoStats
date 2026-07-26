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
  plain_language_description?: string | null;
  technical_definition?: string | null;
  unit_explanation?: string | null;
  source_url: string | null;
  methodology_url?: string | null;
  source_page_url?: string | null;
  exact_query_url?: string | null;
  download_url?: string | null;
  api_url?: string | null;
  dataset_release?: string | null;
  retrieved_at?: string | null;
  license_name?: string | null;
  license_url?: string | null;
  source_query?: Record<string, unknown> | string | null;
  derivation_method?: string | null;
  derivation_version?: string | null;
  input_datasets?: Array<Record<string, unknown> | string> | null;
  official_observation_share?: number | null;
  modeled_observation_share?: number | null;
  credibility_score?: number | null;
  credibility_status?: string | null;
  credibility_reason?: string | null;
  evidence_label?: string | null;
  verifiability_score?: number | null;
  verifiability_status?: string | null;
  understandability_score?: number | null;
  fun_score?: number | null;
  objective_status?: string | null;
  player_quality_status?: string | null;
  player_quality_reason?: string | null;
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
    plainLanguageDescription: row.plain_language_description ?? null,
    technicalDefinition: row.technical_definition ?? null,
    unitExplanation: row.unit_explanation ?? null,
    sourceUrl: row.source_url,
    methodologyUrl: row.methodology_url ?? null,
    sourcePageUrl: row.source_page_url ?? null,
    exactQueryUrl: row.exact_query_url ?? null,
    downloadUrl: row.download_url ?? null,
    apiUrl: row.api_url ?? null,
    datasetRelease: row.dataset_release ?? null,
    retrievedAt: row.retrieved_at ?? null,
    licenseName: row.license_name ?? null,
    licenseUrl: row.license_url ?? null,
    sourceQuery: row.source_query ?? null,
    derivationMethod: row.derivation_method ?? null,
    derivationVersion: row.derivation_version ?? null,
    inputDatasets: row.input_datasets ?? null,
    officialObservationShare: row.official_observation_share ?? null,
    modeledObservationShare: row.modeled_observation_share ?? null,
    evidenceLabel: evidenceLabel(row),
    credibilityScore: row.credibility_score ?? null,
    trustStatus: row.credibility_status ?? null,
    trustReason: row.credibility_reason ?? null,
    verifiabilityScore: row.verifiability_score ?? null,
    verifiabilityStatus: row.verifiability_status ?? null,
    understandabilityScore: row.understandability_score ?? null,
    funScore: row.fun_score ?? null,
    objectiveStatus: row.objective_status ?? null,
    playerQualityStatus: row.player_quality_status ?? null,
    playerQualityReason: row.player_quality_reason ?? null,
  };
}

const V14_SELECT = "id,plain_language_description,technical_definition,unit_explanation,source_url,methodology_url,source_page_url,exact_query_url,download_url,api_url,dataset_release,retrieved_at,license_name,license_url,source_query,derivation_method,derivation_version,input_datasets,official_observation_share,modeled_observation_share,credibility_score,credibility_status,credibility_reason,evidence_label,verifiability_score,verifiability_status,understandability_score,fun_score,objective_status,player_quality_status,player_quality_reason";
const V13_SELECT = "id,source_url,methodology_url,official_observation_share,modeled_observation_share,credibility_score,credibility_status,credibility_reason,evidence_label";
const LEGACY_SELECT = "id,source_url,methodology_url,official_observation_share,modeled_observation_share";

async function selectRows(admin: AdminClient, configure: (select: string) => any) {
  let result: any = await configure(V14_SELECT);
  if (result.error && /source_page_url|exact_query_url|verifiability_|player_quality_|objective_status|input_datasets|dataset_release/i.test(result.error.message)) {
    result = await configure(V13_SELECT);
  }
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

    // Resolve any misses by the source organization and stable indicator code so old encoded boards keep their source metadata.
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
