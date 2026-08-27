-- GeoStats v16.2.6 conservative rollback to the v16.2.5 catalog/product state.
-- Imported observations are preserved. Additive account/analytics columns are
-- intentionally retained because older application code safely ignores them.

begin;
select pg_advisory_xact_lock(hashtext('geostats-v16.2.6-rollback'));

-- Restore every category field v16.2.6 intentionally mutates from the first-run snapshot.
update public.stat_categories c
set title=b.snapshot->>'title',
    short_title=nullif(b.snapshot->>'short_title',''),
    description=nullif(b.snapshot->>'description',''),
    plain_language_description=nullif(b.snapshot->>'plain_language_description',''),
    measurement_type=nullif(b.snapshot->>'measurement_type',''),
    value_type=coalesce(nullif(b.snapshot->>'value_type',''),c.value_type),
    review_status=coalesce(nullif(b.snapshot->>'review_status',''),c.review_status),
    curation_status=coalesce(nullif(b.snapshot->>'curation_status',''),c.curation_status),
    content_review_status=coalesce(nullif(b.snapshot->>'content_review_status',''),c.content_review_status),
    curation_reason=nullif(b.snapshot->>'curation_reason',''),
    content_review_reason=nullif(b.snapshot->>'content_review_reason',''),
    enabled=coalesce((b.snapshot->>'enabled')::boolean,false),
    eligible_daily=coalesce((b.snapshot->>'eligible_daily')::boolean,false),
    immediate_comprehension_score=(nullif(b.snapshot->>'immediate_comprehension_score',''))::smallint,
    gameplay_interest_score=(nullif(b.snapshot->>'gameplay_interest_score',''))::smallint,
    uniqueness_score=(nullif(b.snapshot->>'uniqueness_score',''))::smallint,
    updated_at=now()
from public.v16_2_6_category_state_backup b
where b.category_id=c.id;

-- Restore v16.2.5 raw-read policies for compatibility with a full application rollback.
drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable" on public.profiles for select using(true);
drop policy if exists "users read own scores" on public.daily_scores;
drop policy if exists "scores are publicly readable" on public.daily_scores;
create policy "scores are publicly readable" on public.daily_scores for select using(true);

-- Restore the v16.2.5 analytics view shape expected by the older Admin UI.
-- Reverse the v16.2.6 analytics column rename before recreating the
-- v16.2.5 view definition. Keep rollback rerunnable.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='analytics_overview_30d' and column_name='average_percent'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='analytics_overview_30d' and column_name='average_score'
  ) then
    alter view public.analytics_overview_30d rename column average_percent to average_score;
  end if;
end $$;

create or replace view public.analytics_overview_30d
with(security_invoker=true)
as
select
  count(distinct session_id) filter(where event_name='page_view')::bigint as visitors,
  count(*) filter(where event_name='page_view')::bigint as page_views,
  count(*) filter(where event_name='game_started')::bigint as games_started,
  count(*) filter(where event_name='game_completed')::bigint as games_completed,
  count(*) filter(where event_name='share_clicked')::bigint as shares,
  round(avg(value) filter(where event_name='game_completed'),1) as average_score,
  count(distinct user_id) filter(where user_id is not null)::bigint as signed_in_users_seen
from public.analytics_events
where created_at>=now()-interval '30 days';

grant select on public.analytics_overview_30d to service_role;

-- Restore the v16.2.5 runtime-view gate (no v16.2.6 helper hard block).
create or replace view public.category_runtime_review_v16_2
with(security_invoker=true) as
select
  v.*,
  a.proposed_status as promotion_decision_v16_2,
  a.reason as promotion_reason_v16_2,
  a.primary_blocker as primary_blocker_v16_2,
  a.blocker_class as blocker_class_v16_2,
  a.strict_pass as strict_pass_v16_2,
  a.source_quality_floor as source_quality_floor_v16_2,
  a.suggested_duplicate_of as suggested_duplicate_of_v16_2,
  (a.proposed_status='playable' and v.editorial_status='approved' and a.strict_pass) as computed_playable_v16_2,
  array_remove(array[case when a.proposed_status<>'playable' then a.primary_blocker end],null) as v16_2_blockers,
  array_remove(array[
    case when v.validation_status<>'verified'
      and not public.category_v15_true_integrity_failure(v.validation_status,v.validation_reason,v.validation_mismatch_count,v.validation_ranking_mismatch_count)
      then 'Official values are usable; non-data source metadata remain incomplete.' end,
    case when v.ranking_completeness_status='top_end_complete' then 'Ranking is top-end complete rather than fully comprehensive.' end,
    case when v.player_source_status='general' then 'Uses a general official source page rather than an exact shareable view.' end
  ],null) as v16_2_warnings,
  c.measurement_type
from public.category_runtime_review_v16 v
join public.category_promotion_assessment_v16_2 a on a.category_id=v.id
join public.stat_categories c on c.id=v.id;
revoke all on public.category_runtime_review_v16_2 from public,anon,authenticated;
grant select on public.category_runtime_review_v16_2 to service_role;

drop view if exists public.category_review_workbench_v16_2;
create view public.category_review_workbench_v16_2
with(security_invoker=true) as
select runtime.*,
 vetting.recommendation as auto_vetting_recommendation,
 vetting.vetting_score as auto_vetting_score,
 vetting.reason as auto_vetting_reason,
 vetting.possible_duplicate_of as auto_possible_duplicate_of,
 vetting.title_similarity as auto_title_similarity,
 vetting.rank_correlation as auto_rank_correlation,
 vetting.tie_share as auto_tie_share,
 vetting.vetting_version as auto_vetting_version,
 vetting.vetted_at as auto_vetted_at
from public.category_runtime_review_v16_2 runtime
left join public.category_auto_vetting_v15_9 vetting on vetting.category_id=runtime.id;
revoke all on public.category_review_workbench_v16_2 from public,anon,authenticated;
grant select on public.category_review_workbench_v16_2 to service_role;

-- Re-run v16.2.5 curation/audits after restoring its category state.
select public.apply_v16_2_5_catalog_curation();
select public.refresh_measurement_types_v16_2_2();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

commit;
