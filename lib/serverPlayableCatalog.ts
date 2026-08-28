import "server-only";
import type { Category } from "./categories";
import {
  buildCategoryRegistry,
  buildPlayableCategoryCatalog,
  type PlayableCategoryRow,
} from "./playableCatalog";
import { createSupabaseAdminClient } from "./supabase/server";
import { unstable_cache } from "next/cache";

const V16_SELECT = "eligible_universe_type,eligible_universe_rule,eligible_country_count,eligible_country_iso3,coverage_within_eligible_universe,excluded_country_reason,measurement_type,computed_playable_v16_2,promotion_decision_v16_2,promotion_reason_v16_2,primary_blocker_v16_2,blocker_class_v16_2,semantic_audit_status,semantic_audit_issues,semantic_audit_warnings,computed_playable_v16,ranking_completeness_status,ranking_completeness_reason,top_value_distinct_count,top_value_feasible,computed_playable_v15,editorial_status,hard_gate_ready,political_self_reported,confusing,esoteric,subjective_or_composite,stale_data,poor_coverage,duplicate_of,effective_semantic_group,id,title,short_title,description,plain_language_description,technical_definition,unit_explanation,icon,unit,value_type,ranking_direction,family,source_organization,source_dataset,source_indicator_code,source_url,methodology_url,source_page_url,player_source_url,player_source_status,player_source_reason,player_source_checked_at,content_review_status,content_review_reason,content_review_version,immediate_comprehension_score,gameplay_interest_score,uniqueness_score,link_quality_score,exact_query_url,download_url,api_url,dataset_release,retrieved_at,license_name,license_url,source_query,derivation_method,derivation_version,input_datasets,minimum_year,common_year,common_year_coverage,quality_score,concept_group,semantic_family,semantic_topic,metadata,credibility_score,credibility_status,credibility_reason,evidence_label,verifiability_score,verifiability_status,understandability_score,fun_score,objective_status,player_quality_status,player_quality_reason,validation_status,validation_version,validated_at,enabled,eligible_daily,review_status,curation_status";

function catalogError(message: string) {
  if (/schema cache/i.test(message)) {
    return new Error("Supabase has not refreshed its REST schema cache for the v16.2.7 catalog. Run NOTIFY pgrst, 'reload schema'; and retry after 30 seconds.");
  }
  if (/category_runtime_review_v16_2|does not exist|relation .* not found/i.test(message)) {
    return new Error("The GeoStats v16.2.7 catalog migration is not installed. Run RUN_THIS_IN_SUPABASE_FOR_V16_2_7.sql.");
  }
  return new Error(`The verified category catalog is unavailable: ${message}`);
}

async function loadRows(options: { playableOnly?: boolean } = {}) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase is not configured.");

  let query = admin
    .from("category_runtime_review_v16_2")
    .select(V16_SELECT);

  // Random/Daily generation only needs the strict-pass rows. Filtering in SQL
  // keeps cold cache rebuilds from materializing and transferring the entire
  // 1,300+ row review workbench on every fresh serverless instance. Historical
  // saved-board decoding still uses the complete registry path below.
  if (options.playableOnly) query = query
    .eq("computed_playable_v16_2", true)
    .eq("enabled", true)
    .eq("eligible_daily", true);

  const result = await query
    .order("quality_score", { ascending: false })
    .limit(options.playableOnly ? 1000 : 5000);

  if (result.error) throw catalogError(result.error.message ?? "Unknown Supabase error");
  return (result.data ?? []) as PlayableCategoryRow[];
}

const loadCachedPlayableRows = unstable_cache(
  () => loadRows({ playableOnly: true }),
  ["geostats-playable-category-rows-v16.2.7-random-hotfix1"],
  { revalidate: 300, tags: ["geostats-playable-category-catalog"] },
);

const loadCachedRegistryRows = unstable_cache(
  () => loadRows(),
  ["geostats-category-registry-rows-v16.2.7-random-hotfix1"],
  { revalidate: 300, tags: ["geostats-playable-category-catalog"] },
);

const loadCachedApprovedCatalog = unstable_cache(
  async (): Promise<Category[]> => buildPlayableCategoryCatalog(await loadCachedPlayableRows()),
  ["geostats-approved-category-catalog-v16.2.7-random-hotfix1"],
  { revalidate: 300, tags: ["geostats-playable-category-catalog"] },
);

const loadCachedRegistry = unstable_cache(
  async (): Promise<Category[]> => buildCategoryRegistry(await loadCachedRegistryRows()),
  ["geostats-all-category-registry-v16.2.7-random-hotfix1"],
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
