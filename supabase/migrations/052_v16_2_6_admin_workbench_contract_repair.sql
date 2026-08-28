-- GeoStats v16.2.6 Admin Workbench contract repair.
-- Restores the v16.2.3 release-disposition columns that were accidentally
-- dropped when v16.2.6 rebuilt category_review_workbench_v16_2.
-- Additive/rerunnable; safe to apply after migrations 047-051.
begin;
select pg_advisory_xact_lock(hashtext('geostats-v16.2.6-admin-workbench-contract-repair'));

-- Recreate instead of CREATE OR REPLACE so the full column layout is explicit
-- and remains compatible whether the deployment currently has the regressed
-- v16.2.6 view or the earlier v16.2.3/v16.2.5 shape.
drop view if exists public.category_review_workbench_v16_2;
create view public.category_review_workbench_v16_2
with(security_invoker=true) as
select
  runtime.*,
  vetting.recommendation as auto_vetting_recommendation,
  vetting.vetting_score as auto_vetting_score,
  vetting.reason as auto_vetting_reason,
  vetting.possible_duplicate_of as auto_possible_duplicate_of,
  vetting.title_similarity as auto_title_similarity,
  vetting.rank_correlation as auto_rank_correlation,
  vetting.tie_share as auto_tie_share,
  vetting.vetting_version as auto_vetting_version,
  vetting.vetted_at as auto_vetted_at,
  decision.disposition as release_disposition_v16_2_3,
  decision.rationale as release_disposition_reason_v16_2_3
from public.category_runtime_review_v16_2 runtime
left join public.category_auto_vetting_v15_9 vetting
  on vetting.category_id=runtime.id
left join public.category_release_decisions_v16_2_3 decision
  on decision.category_id=runtime.id;

revoke all on public.category_review_workbench_v16_2 from public,anon,authenticated;
grant select on public.category_review_workbench_v16_2 to service_role;

-- Fail closed if the API contract is not actually restored.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='category_review_workbench_v16_2'
      and column_name='release_disposition_v16_2_3'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='category_review_workbench_v16_2'
      and column_name='release_disposition_reason_v16_2_3'
  ) then
    raise exception 'v16.2.6 Admin Workbench contract repair failed';
  end if;
end $$;

-- Ask PostgREST to refresh the exposed schema after commit.
notify pgrst, 'reload schema';
commit;
