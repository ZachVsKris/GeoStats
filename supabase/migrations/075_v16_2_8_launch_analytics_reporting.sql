-- GeoStats v16.2.8 launch analytics reporting
-- First-party, aggregate product analytics for Admin. No public read policies.

begin;

alter table public.analytics_events
  drop constraint if exists analytics_events_name_check;
alter table public.analytics_events
  add constraint analytics_events_name_check check (event_name in (
    'page_view','game_started','game_completed','share_clicked','source_opened',
    'account_username_saved','account_signin_requested','account_gate_opened',
    'account_authenticated'
  ));

create or replace view public.analytics_overview_30d
with(security_invoker=true)
as
select
  count(distinct session_id) filter(where event_name='page_view')::bigint as visitors,
  count(*) filter(where event_name='page_view')::bigint as page_views,
  count(*) filter(where event_name='game_started')::bigint as games_started,
  count(*) filter(where event_name='game_completed')::bigint as games_completed,
  count(*) filter(where event_name='share_clicked')::bigint as shares,
  round(avg(
    case when event_name='game_completed' and value is not null then
      100.0*value/case when difficulty='expert' then 600.0 else 400.0 end
    end
  ),1) as average_percent,
  count(distinct user_id) filter(where user_id is not null)::bigint as signed_in_users_seen,
  count(distinct session_id) filter(where event_name='page_view' and visitor_state='new')::bigint as new_visitors,
  count(distinct session_id) filter(where event_name='page_view' and visitor_state='returning')::bigint as returning_visitors,
  round(100.0*count(distinct session_id) filter(where event_name='page_view' and visitor_state='returning')
    /nullif(count(distinct session_id) filter(where event_name='page_view'),0),1) as returning_rate,
  count(*) filter(where event_name='account_gate_opened')::bigint as account_gate_opens,
  count(*) filter(where event_name='account_signin_requested')::bigint as signin_requests,
  count(distinct session_id) filter(where event_name='account_authenticated')::bigint as authenticated_sessions,
  count(*) filter(where event_name='account_username_saved')::bigint as usernames_saved,
  round(100.0*count(*) filter(where event_name='game_completed')
    /nullif(count(*) filter(where event_name='game_started'),0),1) as completion_rate
from public.analytics_events
where created_at>=now()-interval '30 days';

create or replace view public.analytics_acquisition_30d
with(security_invoker=true)
as
select
  coalesce(visitor_state,'unknown') as visitor_state,
  coalesce(nullif(utm_source,''),'(direct/unknown)') as utm_source,
  coalesce(nullif(utm_medium,''),'(none)') as utm_medium,
  coalesce(nullif(utm_campaign,''),'(none)') as utm_campaign,
  coalesce(nullif(referrer,''),'(direct/unknown)') as referrer,
  count(*) filter(where event_name='page_view')::bigint as page_views,
  count(distinct session_id)::bigint as sessions,
  count(*) filter(where event_name='game_completed')::bigint as games_completed,
  count(distinct session_id) filter(where event_name='account_authenticated')::bigint as authenticated_sessions
from public.analytics_events
where created_at>=now()-interval '30 days'
group by 1,2,3,4,5;

create or replace view public.analytics_difficulty_30d
with(security_invoker=true)
as
select
  difficulty,
  count(*) filter(where event_name='game_started')::bigint as games_started,
  count(*) filter(where event_name='game_completed')::bigint as games_completed,
  count(distinct session_id)::bigint as sessions,
  round(100.0*count(*) filter(where event_name='game_completed')
    /nullif(count(*) filter(where event_name='game_started'),0),1) as completion_rate,
  round(avg(
    case when event_name='game_completed' and value is not null then
      100.0*value/case when difficulty='expert' then 600.0 else 400.0 end
    end
  ),1) as average_percent
from public.analytics_events
where created_at>=now()-interval '30 days'
  and difficulty is not null
  and event_name in ('game_started','game_completed')
group by difficulty;

create or replace view public.analytics_category_engagement_30d
with(security_invoker=true)
as
select
  category.value as category_id,
  count(*) filter(where event_name='game_started')::bigint as games_started,
  count(*) filter(where event_name='game_completed')::bigint as games_completed,
  count(distinct session_id)::bigint as sessions
from public.analytics_events
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(metadata->'categoryIds')='array' then metadata->'categoryIds' else '[]'::jsonb end
) as category(value)
where created_at>=now()-interval '30 days'
  and event_name in ('game_started','game_completed')
group by category.value;

create or replace view public.analytics_country_engagement_30d
with(security_invoker=true)
as
select
  country.value as country_id,
  count(*) filter(where event_name='game_started')::bigint as games_started,
  count(*) filter(where event_name='game_completed')::bigint as games_completed,
  count(distinct session_id)::bigint as sessions
from public.analytics_events
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(metadata->'countryIds')='array' then metadata->'countryIds' else '[]'::jsonb end
) as country(value)
where created_at>=now()-interval '30 days'
  and event_name in ('game_started','game_completed')
group by country.value;

grant select on public.analytics_overview_30d to service_role;
grant select on public.analytics_acquisition_30d to service_role;
grant select on public.analytics_difficulty_30d to service_role;
grant select on public.analytics_category_engagement_30d to service_role;
grant select on public.analytics_country_engagement_30d to service_role;

commit;
