-- GeoStats v16.2.2 verification
-- Run only after "Import v16.2.2 historical categories and finalize" is fully green.

select * from public.assert_v16_2_2_source_recovery();
select * from public.category_review_overview_v16_2;
select * from public.category_catalog_consistency_v16_2;
select * from public.data_integrity_overview_v16_2;
select * from public.data_integrity_by_source_v16_2 order by source;

-- Release curation and measurement-type summary.
select measurement_type,count(*)::bigint as categories,
       count(*) filter(where computed_playable_v16_2)::bigint as playable
from public.category_runtime_review_v16_2
group by measurement_type
order by measurement_type;

-- These rows should confirm the historical launch categories are verified/playable.
select id,effective_title,source_organization,measurement_type,validation_status,
       ranking_completeness_status,computed_playable_v16_2,primary_blocker_v16_2
from public.category_runtime_review_v16_2
where id in ('history:un-admission','history:newest-current-constitution')
order by id;

-- These product decisions should be reflected exactly.
select id,effective_title,editorial_status,computed_playable_v16_2,primary_blocker_v16_2
from public.category_runtime_review_v16_2
where id in (
  'comtrade:most-sports-equipment-exported',
  'worldbank-catalog:er-ptd-totl-zs'
)
order by id;

-- Any returned row requires review before relying on the expanded catalog.
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

-- Final machine-readable pass/fail report. Expected result: all PASS.
with consistency as (
  select * from public.category_catalog_consistency_v16_2
), integrity as (
  select * from public.data_integrity_overview_v16_2
), recovery as (
  select * from public.assert_v16_2_2_source_recovery()
), runtime as (
  select * from public.category_runtime_review_v16_2
), rpc as (
  select
    to_regprocedure('public.publish_daily_trio_v16(date,jsonb)') is not null as rpc_exists,
    has_function_privilege('service_role','public.publish_daily_trio_v16(date,jsonb)','EXECUTE') as service_role_execute,
    coalesce((
      select array_to_string(p.proconfig, ', ')
      from pg_proc p
      where p.oid=to_regprocedure('public.publish_daily_trio_v16(date,jsonb)')
    ),'') as rpc_config,
    coalesce((
      select n.nspname
      from pg_extension e join pg_namespace n on n.oid=e.extnamespace
      where e.extname='pgcrypto'
    ),'') as pgcrypto_schema
), checks as (
  select 'World Bank usable audits >= 300' as check_name,
         case when world_bank_audited>=300 then 'PASS' else 'FAIL' end as result,
         world_bank_audited::text as observed from recovery
  union all select 'FAOSTAT QCL verified >= 25',case when faostat_qcl_audited>=25 then 'PASS' else 'FAIL' end,faostat_qcl_audited::text from recovery
  union all select 'WHO usable audits >= 15',case when who_audited>=15 then 'PASS' else 'FAIL' end,who_audited::text from recovery
  union all select 'UN Comtrade verified >= 40',case when comtrade_audited>=40 then 'PASS' else 'FAIL' end,comtrade_audited::text from recovery
  union all select 'Historical launch categories verified = 2',case when historical_verified=2 then 'PASS' else 'FAIL' end,historical_verified::text from recovery
  union all select 'Shared playable catalog >= 260',case when proposed_playable>=260 then 'PASS' else 'FAIL' end,proposed_playable::text from recovery
  union all select 'No pending editorial backlog',case when pending_editorial=0 then 'PASS' else 'FAIL' end,pending_editorial::text from recovery
  union all select 'Daily and Random flags match',case when daily_random_mismatches=0 then 'PASS' else 'FAIL' end,daily_random_mismatches::text from consistency
  union all select 'No enabled category outside current gate',case when enabled_without_v16_2_pass=0 then 'PASS' else 'FAIL' end,enabled_without_v16_2_pass::text from consistency
  union all select 'No Daily category outside current gate',case when daily_without_v16_2_pass=0 then 'PASS' else 'FAIL' end,daily_without_v16_2_pass::text from consistency
  union all select 'No unverified playable category',case when unverified_playable=0 then 'PASS' else 'FAIL' end,unverified_playable::text from integrity
  union all select 'All Pew categories playable',case when count(*) filter(where source_organization='Pew Research Center' and computed_playable_v16_2)=15 then 'PASS' else 'FAIL' end,(count(*) filter(where source_organization='Pew Research Center' and computed_playable_v16_2))::text from runtime
  union all select 'Sports-equipment exports excluded',case when count(*) filter(where id='comtrade:most-sports-equipment-exported' and not computed_playable_v16_2 and editorial_status='rejected')=1 then 'PASS' else 'FAIL' end,(count(*) filter(where id='comtrade:most-sports-equipment-exported' and not computed_playable_v16_2 and editorial_status='rejected'))::text from runtime
  union all select 'Protected land-and-sea title updated',case when count(*) filter(where id='worldbank-catalog:er-ptd-totl-zs' and effective_title='Largest protected share of land and sea')=1 then 'PASS' else 'FAIL' end,(count(*) filter(where id='worldbank-catalog:er-ptd-totl-zs' and effective_title='Largest protected share of land and sea'))::text from runtime
  union all select 'Daily publication RPC exists',case when rpc_exists then 'PASS' else 'FAIL' end,rpc_exists::text from rpc
  union all select 'service_role can publish Daily',case when service_role_execute then 'PASS' else 'FAIL' end,service_role_execute::text from rpc
  union all select 'Daily RPC can resolve pgcrypto schema',case when pgcrypto_schema<>'' and rpc_config ilike '%'||pgcrypto_schema||'%' then 'PASS' else 'FAIL' end,rpc_config from rpc
  union all select 'Playable categories have measurement types',case when count(*) filter(where computed_playable_v16_2 and measurement_type is null)=0 then 'PASS' else 'FAIL' end,(count(*) filter(where computed_playable_v16_2 and measurement_type is null))::text from runtime
)
select * from checks order by check_name;
