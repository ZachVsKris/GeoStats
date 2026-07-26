import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CATEGORY_ID = /^(comtrade|eia|unhcr):[a-z0-9-]+$/;
const ALLOWED_INDICATOR = /^[A-Za-z0-9:'._-]{1,140}$/;
const SOURCE_ORGANIZATIONS: Record<string, string> = {
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
};

type ObservationRow = {
  country_iso3: string;
  country_name: string;
  data_year: number;
  value: number;
};

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

  let query = admin
    .from("stat_categories")
    .select("id,title,review_status,enabled,eligible_daily,curation_status,common_year,common_year_coverage,unit");
  query = bySourceIndicator
    ? query.eq("source_organization", sourceOrganization).eq("source_indicator_code", indicator)
    : query.eq("id", categoryId);
  const { data: categoryData, error: categoryError } = await query.maybeSingle();
  if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 });

  const category = categoryData as CategoryRow | null;
  if (!category || category.review_status !== "approved" || !category.enabled || !category.eligible_daily || (category.curation_status && category.curation_status !== "approved")) {
    return NextResponse.json({ error: "This category has not passed GeoStats quality, provenance, curation, and duplicate review." }, { status: 404 });
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
    observations,
  }, {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
  });
}
