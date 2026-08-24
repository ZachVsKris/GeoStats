-- GeoStats v16.2 verification (read only)
-- Run after the v16.2 recovery workflow has completed.

select
  to_regprocedure('public.replace_stat_category_observations_v16_2(text,jsonb)') is not null as atomic_observation_replace_installed,
  to_regprocedure('public.refresh_category_promotion_assessment_v16_2()') is not null as promotion_assessment_installed,
  to_regprocedure('public.apply_conservative_promotions_v16_2()') is not null as conservative_promotion_installed,
  to_regprocedure('public.refresh_v16_2_runtime_catalog()') is not null as runtime_refresh_installed,
  to_regprocedure('public.finalize_v16_2_catalog()') is not null as finalizer_installed,
  to_regclass('public.category_runtime_review_v16_2') is not null as runtime_view_installed,
  to_regclass('public.category_review_workbench_v16_2') is not null as workbench_view_installed,
  to_regclass('public.category_promotion_dry_run_v16_2') is not null as promotion_dry_run_installed,
  to_regclass('public.category_catalog_consistency_v16_2') is not null as catalog_consistency_installed;

select * from public.category_review_overview_v16_2;

-- Every value in the first three columns must be zero. Daily and Random use
-- exactly the same approved playable catalog; there is no lower-quality tier.
select * from public.category_catalog_consistency_v16_2;

select
  (select count(*) from public.stat_categories) as categories,
  (select count(*) from public.category_promotion_assessment_v16_2) as assessed_categories,
  (select count(*)
     from public.stat_categories c
     left join public.category_promotion_assessment_v16_2 a on a.category_id=c.id
    where a.category_id is null) as categories_missing_assessment,
  (select count(*)
     from public.category_runtime_review_v16_2
    where computed_playable_v16_2 and semantic_audit_status<>'pass') as playable_without_semantic_pass,
  (select count(*)
     from public.category_runtime_review_v16_2
    where computed_playable_v16_2
      and public.category_v15_true_integrity_failure(
        validation_status,validation_reason,
        validation_mismatch_count,validation_ranking_mismatch_count
      )) as playable_with_substantive_integrity_failure,
  (select count(*)
     from public.category_runtime_review_v16_2
    where computed_playable_v16_2
      and (promotion_decision_v16_2<>'playable' or not coalesce(top_value_feasible,false))) as playable_without_v16_2_pass;

select proposed_status,blocker_class,count(*) as categories
from public.category_promotion_assessment_v16_2
group by proposed_status,blocker_class
order by proposed_status,blocker_class;

select source_organization,
       count(*) as categories,
       count(*) filter(where computed_playable_v16_2) as playable,
       count(*) filter(where promotion_decision_v16_2='manual_review') as manual_review,
       count(*) filter(where promotion_decision_v16_2='rewrite_required') as rewrite_required,
       count(*) filter(where promotion_decision_v16_2='data_repair_required') as data_repair_required
from public.category_runtime_review_v16_2
group by source_organization
order by categories desc,source_organization;

-- Percentage bounds and the known WHO sibling-series regression.
select
  count(*) filter(where v.computed_playable_v16_2 and (
    lower(coalesce(v.value_type,'')) like '%percent%'
    or position('%' in lower(coalesce(v.unit,'')))>0
    or lower(coalesce(v.unit,'')) like '%percent%'
  ) and (a.minimum_value<0 or a.maximum_value>100)) as playable_percent_out_of_bounds,
  count(*) filter(where v.computed_playable_v16_2 and v.source_indicator_code='PHE_HHAIR_POP_CLEAN_FUELS') as wrong_clean_cooking_series_playable,
  count(*) filter(where v.source_indicator_code='PHE_HHAIR_PROP_POP_CLEAN_FUELS' and v.semantic_audit_status='pass') as correct_clean_cooking_series_audited
from public.category_runtime_review_v16_2 v
join public.category_semantic_audit_v16_1 a on a.category_id=v.id;

-- Known player-copy corrections and interpretation-sensitive categories.
select id,effective_title,description,icon,unit,semantic_audit_status,
       promotion_decision_v16_2,computed_playable_v16_2,primary_blocker_v16_2
from public.category_runtime_review_v16_2
where id like 'faostat-fbs:%'
   or id='unhcr:most-stateless-people'
   or source_indicator_code in (
     'PHE_HHAIR_POP_CLEAN_FUELS','PHE_HHAIR_PROP_POP_CLEAN_FUELS',
     'ER.LND.PTLD.ZS','AG.LND.ARBL.ZS','AG.LND.ARBL.K2',
     'IT.NET.BBND.P2','IT.NET.SECR.P6','IT.NET.SECR.P6.WDI'
   )
   or effective_title in (
     'Largest poultry meat exports','Largest spice exports','Largest forest area',
     'Highest share of land and sea protected','Largest stateless population residing in the country'
   )
order by source_organization,effective_title;

-- Categories that are still blocked should have a precise primary reason.
select id,effective_title,source_organization,source_indicator_code,
       promotion_decision_v16_2,blocker_class_v16_2,primary_blocker_v16_2,
       semantic_audit_status,validation_status,validation_reason,
       semantic_top_values,semantic_bottom_values
from public.category_runtime_review_v16_2
where not computed_playable_v16_2
  and promotion_decision_v16_2 in ('manual_review','rewrite_required','data_repair_required')
order by
  case promotion_decision_v16_2
    when 'data_repair_required' then 1
    when 'rewrite_required' then 2
    else 3
  end,
  source_organization,effective_title
limit 150;

-- No category proposed for gameplay should have zero stored observations.
select v.id,v.effective_title,v.source_organization,v.source_indicator_code,
       v.promotion_decision_v16_2,count(o.*) as stored_observations
from public.category_runtime_review_v16_2 v
left join public.stat_observations o on o.category_id=v.id
where v.promotion_decision_v16_2='playable'
group by v.id,v.effective_title,v.source_organization,v.source_indicator_code,v.promotion_decision_v16_2
having count(o.*)=0
order by v.source_organization,v.effective_title;

-- Recent source refresh and Daily-generation results.
select source_organization,status,started_at,completed_at,
       categories_processed,observations_inserted,error_message
from public.stat_import_runs
order by started_at desc
limit 30;

select created_at,challenge_date,source,status,error_message,
       diagnostics->>'failureStage' as failure_stage,
       diagnostics->'validCandidates' as valid_candidates,
       diagnostics->>'compatiblePairs' as compatible_pairs,
       diagnostics->>'jointConstructionAttempts' as joint_attempts,
       diagnostics->>'jointConstructionBacktracks' as joint_backtracks,
       diagnostics->>'elapsedMs' as elapsed_ms,
       diagnostics->'lastTrioErrors' as last_trio_errors
from public.daily_generation_runs
order by created_at desc
limit 10;
