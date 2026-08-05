import "server-only";
import type { Category } from "./categories";
import {
  buildCategoryRegistry,
  buildPlayableCategoryCatalog,
  type PlayableCategoryRow,
} from "./playableCatalog";
import { createSupabaseAdminClient } from "./supabase/server";
import { unstable_cache } from "next/cache";

const V16_SELECT = "computed_playable_v16_2,promotion_decision_v16_2,promotion_reason_v16_2,primary_blocker_v16_2,blocker_class_v16_2,semantic_audit_status,semantic_audit_issues,semantic_audit_warnings,computed_playable_v16,ranking_completeness_status,ranking_completeness_reason,top_value_distinct_count,top_value_feasible,computed_playable_v15,editorial_status,hard_gate_ready,political_self_reported,confusing,esoteric,subjective_or_composite,stale_data,poor_coverage,duplicate_of,effective_semantic_group,id,title,short_title,description,plain_language_description,technical_definition,unit_explanation,icon,unit,value_type,ranking_direction,family,source_organization,source_dataset,source_indicator_code,source_url,methodology_url,source_page_url,player_source_url,player_source_status,player_source_reason,player_source_checked_at,content_review_status,content_review_reason,content_review_version,immediate_comprehension_score,gameplay_interest_score,uniqueness_score,link_quality_score,exact_query_url,download_url,api_url,dataset_release,retrieved_at,license_name,license_url,source_query,derivation_method,derivation_version,input_datasets,minimum_year,common_year,common_year_coverage,quality_score,concept_group,semantic_family,semantic_topic,metadata,credibility_score,credibility_status,credibility_reason,evidence_label,verifiability_score,verifiability_status,understandability_score,fun_score,objective_status,player_quality_status,player_quality_reason,validation_status,validation_version,validated_at,enabled,eligible_daily,review_status,curation_status";

async function loadRows() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase is not configured.");

  const result = await admin
    .from("category_runtime_review_v16_2")
    .select(V16_SELECT)
    .order("quality_score", { ascending: false })
    .limit(5000);

  if (result.error) {
    const message = result.error.message ?? "Unknown Supabase error";
    if (/schema cache/i.test(message)) {
      throw new Error("Supabase has not refreshed its REST schema cache for the v16.2 catalog. Run NOTIFY pgrst, 'reload schema'; and retry after 30 seconds.");
    }
    if (/category_runtime_review_v16_2|does not exist|relation .* not found/i.test(message)) {
      throw new Error("The GeoStats v16.2 catalog migration is not installed. Run RUN_THIS_IN_SUPABASE_FOR_V16_2.sql.");
    }
    throw new Error(`The verified category catalog is unavailable: ${message}`);
  }

  return (result.data ?? []) as PlayableCategoryRow[];
}

const loadCachedRows = unstable_cache(
  loadRows,
  ["geostats-category-catalog-rows-v16.2"],
  { revalidate: 300, tags: ["geostats-playable-category-catalog"] },
);

const loadCachedApprovedCatalog = unstable_cache(
  async (): Promise<Category[]> => buildPlayableCategoryCatalog(await loadCachedRows()),
  ["geostats-approved-category-catalog-v16.2"],
  { revalidate: 300, tags: ["geostats-playable-category-catalog"] },
);

const loadCachedRegistry = unstable_cache(
  async (): Promise<Category[]> => buildCategoryRegistry(await loadCachedRows()),
  ["geostats-all-category-registry-v16.2"],
  { revalidate: 300, tags: ["geostats-playable-category-catalog"] },
);

/** GeoStats has one authoritative approved gameplay catalog. */
export async function loadServerPlayableCategoryCatalog(): Promise<Category[]> {
  return loadCachedApprovedCatalog();
}

/**
 * Historical saved boards decode against the complete category registry, not
 * only the categories that are playable today.
 */
export async function loadServerCategoryRegistry(): Promise<Category[]> {
  return loadCachedRegistry();
}
