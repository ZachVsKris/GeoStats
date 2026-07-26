import "server-only";
import { CATEGORIES, type Category } from "./categories";
import { buildPlayableCategoryCatalog, type PlayableCategoryRow } from "./playableCatalog";
import { createSupabaseAdminClient } from "./supabase/server";

const MODERN_SELECT = "id,title,short_title,description,icon,unit,value_type,ranking_direction,family,source_organization,source_dataset,source_indicator_code,source_url,methodology_url,minimum_year,common_year_coverage,quality_score,concept_group,metadata,credibility_score,credibility_status,credibility_reason,evidence_label,enabled,eligible_daily,review_status,curation_status";
const LEGACY_SELECT = "id,title,short_title,description,icon,unit,value_type,ranking_direction,family,source_organization,source_dataset,source_indicator_code,source_url,methodology_url,minimum_year,common_year_coverage,quality_score,concept_group,metadata,enabled,eligible_daily,review_status,curation_status";

async function queryRows(select: string, modern: boolean) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { data: null, error: new Error("Supabase is not configured.") };
  let query = admin
    .from("stat_categories")
    .select(select)
    .eq("enabled", true)
    .eq("eligible_daily", true)
    .eq("review_status", "approved")
    .eq("curation_status", "approved")
    .gte("quality_score", 70)
    .order("quality_score", { ascending: false })
    .limit(1000);
  if (modern) query = query.neq("credibility_status", "quarantined").gte("credibility_score", 75);
  const result = await query;
  return { data: result.data as PlayableCategoryRow[] | null, error: result.error };
}

export async function loadServerPlayableCategoryCatalog(): Promise<Category[]> {
  const modern = await queryRows(MODERN_SELECT, true);
  if (!modern.error && modern.data?.length) return buildPlayableCategoryCatalog(modern.data);
  if (modern.error && !/credibility_|evidence_label/i.test(modern.error.message)) {
    throw new Error(modern.error.message);
  }
  const legacy = await queryRows(LEGACY_SELECT, false);
  if (legacy.error) throw new Error(legacy.error.message);
  const built = buildPlayableCategoryCatalog(legacy.data ?? []);
  return built.length ? built : CATEGORIES.filter((category) => category.enabled !== false);
}
