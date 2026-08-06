-- GeoStats v16.2.1 verification
-- Run only after Recover v16.2.1 audited catalog is completely green.

select * from public.catalog_recovery_status_v16_2_1;
select * from public.category_review_overview_v16_2;
select * from public.category_catalog_consistency_v16_2;
select * from public.data_integrity_overview_v16_2;
select * from public.data_integrity_by_source_v16_2 order by source;

-- Any returned row requires review before Daily generation.
select
  id,title,source_organization,validation_status,validation_reason,
  validation_mismatch_count,validation_ranking_mismatch_count,
  computed_playable_v16_2,primary_blocker_v16_2
from public.category_runtime_review_v16_2
where computed_playable_v16_2
  and (
    validation_status<>'verified'
    or coalesce(validation_mismatch_count,0)<>0
    or coalesce(validation_ranking_mismatch_count,0)<>0
  )
order by source_organization,title;

-- Known semantic corrections and high-value recovered categories.
select
  title,description,unit,source_organization,source_indicator_code,
  validation_status,computed_playable_v16_2,primary_blocker_v16_2
from public.category_runtime_review_v16_2
where source_indicator_code in (
  'PHE_HHAIR_PROP_POP_CLEAN_FUELS',
  'ER.LND.PTLD.ZS',
  'AG.LND.FRST.K2',
  'IT.NET.BBND.P2'
)
   or title in (
     'Most stateless people residing in the country',
     'Most wheat produced','Most rice produced','Most potatoes produced',
     'Largest cattle population','Largest horse population',
     'Highest Jewish share','Largest Jewish population','Most religiously diverse'
   )
order by source_organization,title;

-- Final machine-readable pass/fail report. The expected result is all PASS.
with status as (
  select * from public.catalog_recovery_status_v16_2_1
), consistency as (
  select * from public.category_catalog_consistency_v16_2
), integrity as (
  select * from public.data_integrity_overview_v16_2
), checks as (
  select 'World Bank usable audits >= 300' as check_name,
         case when world_bank_verified+world_bank_warnings>=300 then 'PASS' else 'FAIL' end as result,
         (world_bank_verified+world_bank_warnings)::text as observed
  from status
  union all
  select 'FAOSTAT QCL verified >= 25',case when faostat_qcl_verified>=25 then 'PASS' else 'FAIL' end,faostat_qcl_verified::text from status
  union all
  select 'WHO usable audits >= 15',case when who_verified+who_warnings>=15 then 'PASS' else 'FAIL' end,(who_verified+who_warnings)::text from status
  union all
  select 'UN Comtrade verified >= 40',case when comtrade_verified>=40 then 'PASS' else 'FAIL' end,comtrade_verified::text from status
  union all
  select 'Shared playable catalog >= 180',case when proposed_playable>=180 then 'PASS' else 'FAIL' end,proposed_playable::text from status
  union all
  select 'Daily and Random flags match',case when daily_random_mismatches=0 then 'PASS' else 'FAIL' end,daily_random_mismatches::text from consistency
  union all
  select 'No enabled category outside v16.2 gate',case when enabled_without_v16_2_pass=0 then 'PASS' else 'FAIL' end,enabled_without_v16_2_pass::text from consistency
  union all
  select 'No Daily category outside v16.2 gate',case when daily_without_v16_2_pass=0 then 'PASS' else 'FAIL' end,daily_without_v16_2_pass::text from consistency
  union all
  select 'No unverified playable category',case when unverified_playable=0 then 'PASS' else 'FAIL' end,unverified_playable::text from integrity
)
select * from checks order by check_name;
