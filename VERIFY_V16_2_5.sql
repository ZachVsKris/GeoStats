-- GeoStats v16.2.5 verification
-- Run after the v16.2.5 catalog recovery/import/audit/finalize workflow is fully green.

select * from public.assert_v16_2_3_source_recovery();
select * from public.assert_v16_2_4_release();
select * from public.assert_v16_2_5_release();
select * from public.category_release_targets_status_v16_2_5 order by track,target_key;
select * from public.category_review_overview_v16_2;
select * from public.category_catalog_consistency_v16_2;
select * from public.data_integrity_overview_v16_2;
select * from public.data_integrity_by_source_v16_2 order by source;

-- The original 307-row editorial backlog remains explicitly classified.
select disposition,count(*)::bigint as categories
from public.category_release_decisions_v16_2_3
group by disposition order by disposition;

-- Curated historical release state. A source-verified historical category may still
-- remain non-playable when ranking completeness cannot safely support gameplay.
select id,effective_title,source_organization,source_dataset,measurement_type,validation_status,
       ranking_completeness_status,computed_playable_v16_2,primary_blocker_v16_2
from public.category_runtime_review_v16_2
where id in (
  'history:un-admission','history:oldest-current-constitution',
  'history:ipu-recent-independence','history:ipu-universal-womens-suffrage',
  'history:worldbank-majority-urban','history:worldbank-internet-half',
  'history:worldbank-electricity-half','history:worldbank-life-expectancy-70',
  'history:newest-current-constitution'
)
order by id;

-- Any returned row is a release blocker.
select id,effective_title,source_organization,validation_status,validation_reason,
       validation_mismatch_count,validation_ranking_mismatch_count,
       computed_playable_v16_2,primary_blocker_v16_2
from public.category_runtime_review_v16_2
where computed_playable_v16_2
  and (
    validation_status<>'verified'
    or coalesce(validation_mismatch_count,0)<>0
    or coalesce(validation_ranking_mismatch_count,0)<>0
  )
order by source_organization,effective_title;

-- Expected result: every row PASS.
with consistency as (
  select * from public.category_catalog_consistency_v16_2
), integrity as (
  select * from public.data_integrity_overview_v16_2
), recovery as (
  select * from public.assert_v16_2_3_source_recovery()
), release_1624 as (
  select * from public.assert_v16_2_4_release()
), release_1625 as (
  select * from public.assert_v16_2_5_release()
), runtime as (
  select * from public.category_runtime_review_v16_2
), decisions as (
  select disposition,count(*)::integer as count
  from public.category_release_decisions_v16_2_3 group by disposition
), rpc as (
  select
    to_regprocedure('public.publish_daily_trio_v16(date,jsonb)') is not null as rpc_exists,
    has_function_privilege('service_role','public.publish_daily_trio_v16(date,jsonb)','EXECUTE') as service_role_execute,
    coalesce((select array_to_string(p.proconfig, ', ') from pg_proc p where p.oid=to_regprocedure('public.publish_daily_trio_v16(date,jsonb)')),'') as rpc_config,
    coalesce((select n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto'),'') as pgcrypto_schema
), checks as (
  select 'World Bank usable audits >= 300' as check_name,case when world_bank_audited>=300 then 'PASS' else 'FAIL' end result,world_bank_audited::text observed from recovery
  union all select 'FAOSTAT QCL verified >= 25',case when faostat_qcl_audited>=25 then 'PASS' else 'FAIL' end,faostat_qcl_audited::text from recovery
  union all select 'WHO usable audits >= 15',case when who_audited>=15 then 'PASS' else 'FAIL' end,who_audited::text from recovery
  union all select 'UN Comtrade verified >= 40',case when comtrade_audited>=40 then 'PASS' else 'FAIL' end,comtrade_audited::text from recovery
  union all select 'Original broad historical categories source-verified = 4',case when historical_verified=4 then 'PASS' else 'FAIL' end,historical_verified::text from recovery
  union all select 'Curated historical categories source-verified >= 8',case when historical_verified>=8 then 'PASS' else 'FAIL' end,historical_verified::text from release_1624
  union all select 'World Bank historical milestones source-verified >= 4',case when world_bank_milestones_verified>=4 then 'PASS' else 'FAIL' end,world_bank_milestones_verified::text from release_1624
  union all select 'Shared playable catalog >= 260',case when proposed_playable>=260 then 'PASS' else 'FAIL' end,proposed_playable::text from release_1624
  union all select 'No pending editorial backlog',case when pending_editorial=0 then 'PASS' else 'FAIL' end,pending_editorial::text from release_1624
  union all select 'Targeted share-category rewrites resolved = 4',case when catalog_rewrites_resolved=4 then 'PASS' else 'FAIL' end,catalog_rewrites_resolved::text from release_1624
  union all select 'v16.2.5 catalog targets registered = 63',case when target_rows=63 then 'PASS' else 'FAIL' end,target_rows::text from release_1625
  union all select 'v16.2.5 catalog targets all resolved',case when unresolved_targets=0 then 'PASS' else 'FAIL' end,unresolved_targets::text from release_1625
  union all select 'v16.2.5 promotion concepts editorially approved = 33',case when promotion_editorial_ready=33 then 'PASS' else 'FAIL' end,promotion_editorial_ready::text from release_1625
  union all select 'v16.2.5 repair concepts tracked = 30',case when repair_targets_tracked=30 then 'PASS' else 'FAIL' end,repair_targets_tracked::text from release_1625
  union all select 'Ambiguous protected land-and-sea category disabled',case when protected_land_sea_disabled then 'PASS' else 'FAIL' end,protected_land_sea_disabled::text from release_1625
  union all select '307 backlog rows classified',case when (select sum(count) from decisions)=307 then 'PASS' else 'FAIL' end,(select sum(count)::text from decisions)
  union all select 'Data-repair bucket preserved',case when coalesce((select count from decisions where disposition='data_repair_required'),0)=36 then 'PASS' else 'FAIL' end,coalesce((select count::text from decisions where disposition='data_repair_required'),'0')
  union all select 'Rewrite bucket preserved',case when coalesce((select count from decisions where disposition='needs_rewrite'),0)=90 then 'PASS' else 'FAIL' end,coalesce((select count::text from decisions where disposition='needs_rewrite'),'0')
  union all select 'Manual-review bucket preserved',case when coalesce((select count from decisions where disposition='manual_review_required'),0)=7 then 'PASS' else 'FAIL' end,coalesce((select count::text from decisions where disposition='manual_review_required'),'0')
  union all select 'Duplicate bucket preserved',case when coalesce((select count from decisions where disposition='duplicate'),0)=1 then 'PASS' else 'FAIL' end,coalesce((select count::text from decisions where disposition='duplicate'),'0')
  union all select 'Intentional-rejection bucket preserved',case when coalesce((select count from decisions where disposition='rejected'),0)=168 then 'PASS' else 'FAIL' end,coalesce((select count::text from decisions where disposition='rejected'),'0')
  union all select 'Daily and Random flags match',case when daily_random_mismatches=0 then 'PASS' else 'FAIL' end,daily_random_mismatches::text from consistency
  union all select 'No enabled category outside current gate',case when enabled_without_v16_2_pass=0 then 'PASS' else 'FAIL' end,enabled_without_v16_2_pass::text from consistency
  union all select 'No Daily category outside current gate',case when daily_without_v16_2_pass=0 then 'PASS' else 'FAIL' end,daily_without_v16_2_pass::text from consistency
  union all select 'No unverified playable category',case when unverified_playable=0 then 'PASS' else 'FAIL' end,unverified_playable::text from integrity
  union all select 'Newest-constitution inverse not playable',case when count(*) filter(where id='history:newest-current-constitution' and computed_playable_v16_2)=0 then 'PASS' else 'FAIL' end,(count(*) filter(where id='history:newest-current-constitution' and computed_playable_v16_2))::text from runtime
  union all select 'Sports-equipment exports excluded',case when count(*) filter(where id='comtrade:most-sports-equipment-exported' and not computed_playable_v16_2)=1 then 'PASS' else 'FAIL' end,(count(*) filter(where id='comtrade:most-sports-equipment-exported' and not computed_playable_v16_2))::text from runtime
  union all select 'Daily publication RPC exists',case when rpc_exists then 'PASS' else 'FAIL' end,rpc_exists::text from rpc
  union all select 'service_role can publish Daily',case when service_role_execute then 'PASS' else 'FAIL' end,service_role_execute::text from rpc
  union all select 'Daily RPC can resolve pgcrypto schema',case when pgcrypto_schema<>'' and rpc_config ilike '%'||pgcrypto_schema||'%' then 'PASS' else 'FAIL' end,rpc_config from rpc
  union all select 'Playable categories have measurement types',case when count(*) filter(where computed_playable_v16_2 and measurement_type is null)=0 then 'PASS' else 'FAIL' end,(count(*) filter(where computed_playable_v16_2 and measurement_type is null))::text from runtime
)
select * from checks order by check_name;
