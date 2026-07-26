import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CATEGORY_ID = /^(worldbank-catalog|faostat|who|unesco|ilostat|naturalearth|comtrade|eia|unhcr):[a-z0-9:._-]+$/;
const ALLOWED_INDICATOR = /^[A-Za-z0-9:'._+-]{1,180}$/;
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
};

type CategoryRow = {
  id: string;
  title: string;
  review_status: string;
  enabled: boolean;
  eligible_daily: boolean;
  curation_status?: string | null;
  common_year: number | null;
  common_year_coverage: number | null;
  unit: string | null;
  source_url?: string | null;
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

type ObservationRow = {
  country_iso3: string;
  country_name: string;
  data_year: number;
  value: number;
};

const V14_SELECT = "id,title,review_status,enabled,eligible_daily,curation_status,common_year,common_year_coverage,unit,source_url,methodology_url,source_page_url,exact_query_url,download_url,api_url,dataset_release,retrieved_at,license_name,license_url,source_query,derivation_method,derivation_version,input_datasets,official_observation_share,modeled_observation_share,credibility_score,credibility_status,credibility_reason,evidence_label,verifiability_score,verifiability_status,understandability_score,fun_score,objective_status,player_quality_status,player_quality_reason";
const V13_SELECT = "id,title,review_status,enabled,eligible_daily,curation_status,common_year,common_year_coverage,unit,source_url,methodology_url,official_observation_share,modeled_observation_share,credibility_score,credibility_status,credibility_reason,evidence_label";
const LEGACY_SELECT = "id,title,review_status,enabled,eligible_daily,curation_status,common_year,common_year_coverage,unit,source_url,methodology_url,official_observation_share,modeled_observation_share";

export async function GET(request: NextRequest) {
  const categoryId = request.nextUrl.searchParams.get("category") ?? "";
  const source = request.nextUrl.searchParams.get("source") ?? "";
  const indicator = request.nextUrl.searchParams.get("indicator") ?? "";
  const sourceOrganization = SOURCE_ORGANIZATIONS[source];
  const bySourceIndicator = Boolean(sourceOrganization && ALLOWED_INDICATOR.test(indicator));
  const byCategoryId = ALLOWED_CATEGORY_ID.test(categoryId);
  if (!bySourceIndicator && !byCategoryId) {
    return NextResponse.json({ error: "Invalid warehouse category." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const runCategoryQuery = async (select: string) => {
    let query = admin.from("stat_categories").select(select);
    query = bySourceIndicator
      ? query.eq("source_organization", sourceOrganization!).eq("source_indicator_code", indicator)
      : query.eq("id", categoryId);
    return query.maybeSingle();
  };

  let categoryResult: any = await runCategoryQuery(V14_SELECT);
  if (categoryResult.error && /source_page_url|exact_query_url|verifiability_|player_quality_|objective_status|input_datasets|dataset_release/i.test(categoryResult.error.message)) {
    categoryResult = await runCategoryQuery(V13_SELECT);
  }
  if (categoryResult.error && /credibility_|evidence_label/i.test(categoryResult.error.message)) {
    categoryResult = await runCategoryQuery(LEGACY_SELECT);
  }
  if (categoryResult.error) return NextResponse.json({ error: categoryResult.error.message }, { status: 500 });

  const category = categoryResult.data as CategoryRow | null;
  const trustFailed = category?.credibility_status === "quarantined" || (category?.credibility_score != null && category.credibility_score < 75);
  const playerFailed = (category?.objective_status != null && category.objective_status !== "objective") || category?.player_quality_status === "blocked"
    || (category?.verifiability_score != null && category.verifiability_score < 80)
    || (category?.understandability_score != null && category.understandability_score < 70)
    || (category?.fun_score != null && category.fun_score < 55);
  if (!category || category.review_status !== "approved" || !category.enabled || !category.eligible_daily || trustFailed || playerFailed || (category.curation_status && category.curation_status !== "approved")) {
    return NextResponse.json({ error: "This category has not passed GeoStats quality, provenance, credibility, objectivity, clarity, fun, curation, and duplicate review." }, { status: 404 });
  }
  if (!category.common_year) {
    return NextResponse.json({ error: "This category has no verified common comparison year." }, { status: 409 });
  }

  const { data, error } = await admin
    .from("stat_observations")
    .select("country_iso3,country_name,data_year,value")
    .eq("category_id", category.id)
    .eq("data_year", category.common_year)
    .order("country_iso3", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const observations = ((data ?? []) as ObservationRow[]).filter((row) =>
    /^[A-Z]{3}$/.test(row.country_iso3) && Number.isFinite(Number(row.value)),
  );
  if (!observations.length) {
    return NextResponse.json({ error: "No approved common-year observations are available." }, { status: 404 });
  }

  return NextResponse.json({
    categoryId: category.id,
    title: category.title,
    commonYear: category.common_year,
    commonYearCoverage: category.common_year_coverage,
    unit: category.unit,
    sourceUrl: category.source_url ?? null,
    methodologyUrl: category.methodology_url ?? null,
    sourcePageUrl: category.source_page_url ?? null,
    exactQueryUrl: category.exact_query_url ?? null,
    downloadUrl: category.download_url ?? null,
    apiUrl: category.api_url ?? null,
    datasetRelease: category.dataset_release ?? null,
    retrievedAt: category.retrieved_at ?? null,
    licenseName: category.license_name ?? null,
    licenseUrl: category.license_url ?? null,
    sourceQuery: category.source_query ?? null,
    derivationMethod: category.derivation_method ?? null,
    derivationVersion: category.derivation_version ?? null,
    inputDatasets: category.input_datasets ?? null,
    officialObservationShare: category.official_observation_share ?? null,
    modeledObservationShare: category.modeled_observation_share ?? null,
    credibilityScore: category.credibility_score ?? null,
    trustStatus: category.credibility_status ?? null,
    trustReason: category.credibility_reason ?? null,
    evidenceLabel: category.evidence_label ?? (Number(category.modeled_observation_share ?? 0) >= .8 ? "Modeled estimate" : Number(category.modeled_observation_share ?? 0) >= .2 ? "Mixed observed and modeled" : "Internationally harmonized"),
    verifiabilityScore: category.verifiability_score ?? null,
    verifiabilityStatus: category.verifiability_status ?? null,
    understandabilityScore: category.understandability_score ?? null,
    funScore: category.fun_score ?? null,
    objectiveStatus: category.objective_status ?? null,
    playerQualityStatus: category.player_quality_status ?? null,
    playerQualityReason: category.player_quality_reason ?? null,
    observations,
  }, {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
  });
}
