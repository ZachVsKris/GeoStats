-- GeoStats v16.2.6 verification.
-- Run after the v16.2.6 installer, expansion imports/audits, and finalizer.

select * from public.assert_v16_2_6_release();
select * from public.category_catalog_consistency_v16_2;
select * from public.data_integrity_overview_v16_2;
select * from public.data_integrity_by_source_v16_2 order by source;

-- These queries must return zero rows.
select r.id,r.effective_title,c.source_organization,c.source_indicator_code,r.v16_2_blockers
from public.category_runtime_review_v16_2 r
join public.stat_categories c on c.id=r.id
where r.computed_playable_v16_2
  and public.category_v16_2_6_hard_block_reason(c.id,c.source_organization,c.source_indicator_code,r.effective_title,c.metadata) is not null;

select r.id,r.effective_title,c.source_indicator_code
from public.category_runtime_review_v16_2 r
join public.stat_categories c on c.id=r.id
where r.computed_playable_v16_2
  and c.source_organization='World Bank'
  and coalesce(c.source_indicator_code,'') ~ '\.(CN|KN)$';

select r.id,r.effective_title,c.immediate_comprehension_score,c.gameplay_interest_score,c.uniqueness_score
from public.category_runtime_review_v16_2 r
join public.stat_categories c on c.id=r.id
where r.computed_playable_v16_2
  and (c.immediate_comprehension_score is null or c.gameplay_interest_score is null or c.uniqueness_score is null);


-- Legacy rejections are reason-aware and fail closed. This must return zero rows.
select id,effective_title,legacy_rejection_blockers_v16_2_6
from public.category_runtime_review_v16_2
where computed_playable_v16_2
  and cardinality(legacy_rejection_blockers_v16_2_6)>0;

-- Legacy-rejection resolution visibility: all 791 durable rows now have a current v16.2.6 decision.
select rejection_strength,count(*)::bigint as collisions
from public.tracker_legacy_rejection_collisions_v16_2_6
group by rejection_strength order by rejection_strength;

-- Must return zero rows after the complete 791-row re-audit.
select legacy_key,category_title,legacy_source,required_action
from public.legacy_category_rejections_v16_2_6
where default_decision='requires_reaudit';

select id,effective_title,validation_status,validation_reason,
       validation_mismatch_count,validation_ranking_mismatch_count
from public.category_runtime_review_v16_2
where computed_playable_v16_2
  and (validation_status<>'verified'
       or coalesce(validation_mismatch_count,0)<>0
       or coalesce(validation_ranking_mismatch_count,0)<>0);

-- Known semantic/copy corrections.
select source_indicator_code,title,short_title,measurement_type,value_type,unit
from public.stat_categories
where source_indicator_code in ('EN.URB.LCTY','EN.URB.LCTY.UR.ZS','AG.LND.ARBL.HA.PC','FB.ATM.TOTL.P5','FB.CBK.BRCH.P5')
order by source_indicator_code;

-- New source families: presence is reported rather than forced. A source with no
-- imported categories remains explicitly unshipped/fail-closed rather than being
-- synthesized or manually filled.
select ds.id,ds.name,
       count(c.id)::bigint as categories,
       count(c.id) filter(where r.computed_playable_v16_2)::bigint as playable
from public.data_sources ds
left join public.stat_categories c on c.source_organization=ds.name
left join public.category_runtime_review_v16_2 r on r.id=c.id
where ds.id in ('unwpp','worldbankclimate','imfweo','unescoich','noaatsunami','aquastat','faofisheries','usgsminerals')
group by ds.id,ds.name order by ds.id;

-- Privacy/public-product state.
select tablename,policyname,cmd,qual
from pg_policies
where schemaname='public' and tablename in ('profiles','daily_scores','internal_testers')
order by tablename,policyname;

select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='analytics_events'
  and column_name in ('referrer','utm_source','utm_medium','utm_campaign','visitor_state')
order by column_name;

-- Final release checklist: every row should PASS.
with release as (
  select * from public.assert_v16_2_6_release()
), runtime as (
  select * from public.category_runtime_review_v16_2
), checks as (
  select 'Shared playable catalog remains broad' check_name,case when proposed_playable>=240 then 'PASS' else 'FAIL' end result,proposed_playable::text observed from release
  union all select 'No hard-blocked playable category',case when hard_blocked_playable=0 then 'PASS' else 'FAIL' end,hard_blocked_playable::text from release
  union all select 'No World Bank local-currency comparison playable',case when local_currency_playable=0 then 'PASS' else 'FAIL' end,local_currency_playable::text from release
  union all select 'Every playable category has player-quality scores',case when missing_player_quality=0 then 'PASS' else 'FAIL' end,missing_player_quality::text from release
  union all select 'Catalog flags reconcile',case when daily_random_mismatches=0 then 'PASS' else 'FAIL' end,daily_random_mismatches::text from release
  union all select 'Profiles no longer unrestricted-public',case when private_profile_policy then 'PASS' else 'FAIL' end,private_profile_policy::text from release
  union all select 'Raw scores no longer unrestricted-public',case when private_score_policy then 'PASS' else 'FAIL' end,private_score_policy::text from release
  union all select 'Internal tester table installed',case when to_regclass('public.internal_testers') is not null then 'PASS' else 'FAIL' end,coalesce(to_regclass('public.internal_testers')::text,'missing')
  union all select 'Analytics acquisition view installed',case when to_regclass('public.analytics_acquisition_30d') is not null then 'PASS' else 'FAIL' end,coalesce(to_regclass('public.analytics_acquisition_30d')::text,'missing')
  union all select 'Largest-city absolute measure corrected',case when count(*) filter(where id in (select id from public.stat_categories where source_indicator_code='EN.URB.LCTY') and effective_title='Largest population in the largest city' and measurement_type='total')>=1 then 'PASS' else 'FAIL' end,count(*) filter(where id in (select id from public.stat_categories where source_indicator_code='EN.URB.LCTY') and effective_title='Largest population in the largest city' and measurement_type='total')::text from runtime
  union all select 'Northernmost country no longer editorially hard-retired',case when count(*) filter(where id='natural-earth:northernmost-country')>=1 then 'PASS' else 'FAIL' end,count(*) filter(where id='natural-earth:northernmost-country')::text from runtime
  union all select 'Southernmost country no longer editorially hard-retired',case when count(*) filter(where id='natural-earth:southernmost-country')>=1 then 'PASS' else 'FAIL' end,count(*) filter(where id='natural-earth:southernmost-country')::text from runtime
)
select * from checks order by check_name;

-- Complete 791-row legacy re-audit summary (informational).
select editorial_disposition,legacy_guard_action,count(*)::bigint as categories
from public.legacy_rejection_first_principles_reaudit_v16_2_6
group by editorial_disposition,legacy_guard_action
order by editorial_disposition,legacy_guard_action;
