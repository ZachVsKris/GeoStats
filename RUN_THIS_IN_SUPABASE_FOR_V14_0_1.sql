-- GeoStats v14.0.1 import-repair migration
-- Run after RUN_THIS_IN_SUPABASE_FOR_V14.sql.
-- Adds auditable import-health views and repairs any newly imported category
-- that was written before the v14 governance RPC completed.

begin;

create or replace view public.v14_import_health as
with category_summary as (
  select
    source_organization,
    count(*)::integer as category_count,
    count(*) filter (where enabled and eligible_daily)::integer as playable_count,
    count(*) filter (where curation_status='pending')::integer as pending_review_count,
    count(*) filter (where curation_status='excluded')::integer as excluded_count,
    count(*) filter (where review_status='rejected')::integer as rejected_count,
    count(*) filter (where coalesce(metadata->>'import_framework','') in ('v14.0','v14.0.1'))::integer as v14_imported_count,
    max(updated_at) as latest_category_update
  from public.stat_categories
  group by source_organization
), latest_run as (
  select distinct on (source_organization)
    source_organization,
    id as import_run_id,
    source_dataset,
    status as import_status,
    started_at as import_started_at,
    completed_at as import_completed_at,
    categories_processed,
    observations_inserted,
    error_message,
    details
  from public.stat_import_runs
  order by source_organization, started_at desc, id desc
)
select
  coalesce(summary.source_organization, run.source_organization) as source_organization,
  coalesce(summary.category_count,0) as category_count,
  coalesce(summary.playable_count,0) as playable_count,
  coalesce(summary.pending_review_count,0) as pending_review_count,
  coalesce(summary.excluded_count,0) as excluded_count,
  coalesce(summary.rejected_count,0) as rejected_count,
  coalesce(summary.v14_imported_count,0) as v14_imported_count,
  summary.latest_category_update,
  run.import_run_id,
  run.source_dataset,
  run.import_status,
  run.import_started_at,
  run.import_completed_at,
  coalesce(run.categories_processed,0) as latest_run_categories_processed,
  coalesce(run.observations_inserted,0) as latest_run_observations_inserted,
  run.error_message as latest_run_error,
  coalesce((run.details->>'attempted_count')::integer,0) as latest_run_attempted,
  coalesce((run.details->>'successful_count')::integer,run.categories_processed,0) as latest_run_successful,
  coalesce(jsonb_array_length(coalesce(run.details->'failures','[]'::jsonb)),0) as latest_run_failures,
  coalesce((run.details->>'target_reached')::boolean,true) as latest_run_target_reached,
  coalesce(run.details,'{}'::jsonb) as latest_run_details
from category_summary summary
full join latest_run run using (source_organization);

revoke all on public.v14_import_health from public, anon, authenticated;
grant select on public.v14_import_health to service_role;

-- If an importer wrote a v14 category but was interrupted before applying the
-- governance RPC, re-run the full fail-closed governance chain now.
do $$
declare row record;
begin
  for row in
    select id
    from public.stat_categories
    where coalesce(metadata->>'import_framework','') in ('v14.0','v14.0.1')
      and (
        curation_status is null
        or player_quality_status is null
        or verifiability_status is null
      )
  loop
    perform public.apply_category_governance(row.id);
  end loop;
end $$;

commit;
