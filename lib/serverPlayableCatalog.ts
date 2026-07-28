import "server-only";
import type { Category } from "./categories";
import { buildPlayableCategoryCatalog, type PlayableCategoryRow } from "./playableCatalog";
import { createSupabaseAdminClient } from "./supabase/server";
import { unstable_cache } from "next/cache";

const V15_SELECT = "computed_playable_v15,editorial_status,hard_gate_ready,political_self_reported,confusing,esoteric,subjective_or_composite,stale_data,poor_coverage,duplicate_of,effective_semantic_group,id,title,short_title,description,plain_language_description,technical_definition,unit_explanation,icon,unit,value_type,ranking_direction,family,source_organization,source_dataset,source_indicator_code,source_url,methodology_url,source_page_url,player_source_url,player_source_status,player_source_reason,player_source_checked_at,content_review_status,content_review_reason,content_review_version,immediate_comprehension_score,gameplay_interest_score,uniqueness_score,link_quality_score,exact_query_url,download_url,api_url,dataset_release,retrieved_at,license_name,license_url,source_query,derivation_method,derivation_version,input_datasets,minimum_year,common_year,common_year_coverage,quality_score,concept_group,semantic_family,semantic_topic,metadata,credibility_score,credibility_status,credibility_reason,evidence_label,verifiability_score,verifiability_status,understandability_score,fun_score,objective_status,player_quality_status,player_quality_reason,validation_status,validation_version,validated_at,enabled,eligible_daily,review_status,curation_status";

const loadCachedPlayableCategoryCatalog = unstable_cache(
  async (): Promise<Category[]> => {
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase is not configured.");

    const result = await admin
      .from("category_review_queue_v15")
      .select(V15_SELECT)
      .eq("computed_playable_v15", true)
      .order("quality_score", { ascending: false })
      .limit(5000);

    if (result.error) {
      const missingMigration = /category_review_queue_v15|does not exist|schema cache/i.test(result.error.message);
      throw new Error(missingMigration
        ? "The v15 category catalog is not installed. Run RUN_THIS_IN_SUPABASE_FOR_V15.sql."
        : `The verified v15 category catalog is unavailable: ${result.error.message}`);
    }
    return buildPlayableCategoryCatalog((result.data ?? []) as PlayableCategoryRow[]);
  },
  ["geostats-playable-category-catalog-v15.3.0"],
  { revalidate: 300, tags: ["geostats-playable-category-catalog"] },
);

export async function loadServerPlayableCategoryCatalog(): Promise<Category[]> {
  return loadCachedPlayableCategoryCatalog();
}
