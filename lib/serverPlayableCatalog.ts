import "server-only";
import type { Category } from "./categories";
import { buildPlayableCategoryCatalog, type PlayableCategoryRow } from "./playableCatalog";
import { createSupabaseAdminClient } from "./supabase/server";

const V14_SELECT = "id,title,short_title,description,plain_language_description,technical_definition,unit_explanation,icon,unit,value_type,ranking_direction,family,source_organization,source_dataset,source_indicator_code,source_url,methodology_url,source_page_url,player_source_url,player_source_status,player_source_reason,player_source_checked_at,content_review_status,content_review_reason,content_review_version,immediate_comprehension_score,gameplay_interest_score,uniqueness_score,link_quality_score,exact_query_url,download_url,api_url,dataset_release,retrieved_at,license_name,license_url,source_query,derivation_method,derivation_version,input_datasets,minimum_year,common_year_coverage,quality_score,concept_group,semantic_family,semantic_topic,metadata,credibility_score,credibility_status,credibility_reason,evidence_label,verifiability_score,verifiability_status,understandability_score,fun_score,objective_status,player_quality_status,player_quality_reason,validation_status,validation_version,validated_at,enabled,eligible_daily,review_status,curation_status";
const V13_SELECT = "id,title,short_title,description,icon,unit,value_type,ranking_direction,family,source_organization,source_dataset,source_indicator_code,source_url,methodology_url,minimum_year,common_year_coverage,quality_score,concept_group,metadata,credibility_score,credibility_status,credibility_reason,evidence_label,enabled,eligible_daily,review_status,curation_status";
const LEGACY_SELECT = "id,title,short_title,description,icon,unit,value_type,ranking_direction,family,source_organization,source_dataset,source_indicator_code,source_url,methodology_url,minimum_year,common_year_coverage,quality_score,concept_group,metadata,enabled,eligible_daily,review_status,curation_status";

async function queryRows(select: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { data: null, error: new Error("Supabase is not configured.") };
  const result = await admin
    .from("stat_categories")
    .select(select)
    .order("quality_score", { ascending: false })
    .limit(5000);
  return { data: result.data as PlayableCategoryRow[] | null, error: result.error };
}

export async function loadServerPlayableCategoryCatalog(): Promise<Category[]> {
  const v14 = await queryRows(V14_SELECT);
  if (v14.error) {
    throw new Error(`The verified v14.4 category catalog is unavailable: ${v14.error.message}`);
  }
  return buildPlayableCategoryCatalog(v14.data ?? []);
}
