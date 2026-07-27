-- GeoStats v14.2 verification
-- Run after RUN_THIS_IN_SUPABASE_FOR_V14_2.sql and the "Audit all source integrity" workflow.

select * from public.data_integrity_overview;

select *
from public.data_integrity_by_source
order by source;

select *
from public.data_integrity_issues
order by validated_at desc nulls last,source_organization,title;

select
  id,title,source_organization,source_dataset,source_indicator_code,
  validation_status,validation_version,validated_at,validation_reason,
  common_year,common_year_coverage,validation_expected_count,
  validated_observation_count,validation_mismatch_count,
  validation_ranking_mismatch_count,source_snapshot_checksum,
  stored_snapshot_checksum,enabled,eligible_daily
from public.stat_categories
where enabled or eligible_daily or validation_status<>'pending'
order by validation_status,source_organization,title;

select
  id,source_organization,status,validation_version,started_at,completed_at,
  categories_selected,categories_verified,categories_failed,categories_unable,
  error_message,details
from public.stat_validation_runs
order by started_at desc
limit 50;

-- This should return zero after enforcement is active.
select count(*) as unverified_playable_categories
from public.stat_categories
where (enabled or eligible_daily)
  and validation_status<>'verified';

-- This should return zero for every verified category.
select id,title,source_organization,validation_expected_count,validated_observation_count
from public.stat_categories
where validation_status='verified'
  and validation_expected_count is distinct from validated_observation_count;

-- These should also return zero rows after a complete audit.
select id,title,source_organization,validation_status,enabled,eligible_daily
from public.stat_categories
where validation_status in ('failed','unable_to_verify')
  and (enabled or eligible_daily);

select id,title,source_organization,source_snapshot_checksum,stored_snapshot_checksum
from public.stat_categories
where validation_status='verified'
  and source_snapshot_checksum is distinct from stored_snapshot_checksum;

select
  category.id,
  category.title,
  category.source_organization,
  category.validation_expected_count,
  count(observation.category_id)::integer as stored_common_year_rows
from public.stat_categories category
left join public.stat_observations observation
  on observation.category_id=category.id
 and observation.data_year=category.common_year
where category.validation_status='verified'
group by category.id,category.title,category.source_organization,category.validation_expected_count
having count(observation.category_id)::integer is distinct from category.validation_expected_count
order by category.source_organization,category.title;
