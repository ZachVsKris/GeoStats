-- Make unique browsers the primary gameplay-engagement measure while retaining
-- total board events as secondary context. visitor_id is a stable first-party
-- browser identifier; session_id is the fallback for older events.

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
  round(100.0*count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_completed')
    /nullif(count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_started'),0),1) as completion_rate,
  count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_started')::bigint as players_started,
  count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_completed')::bigint as players_completed
from public.analytics_events
where created_at>=now()-interval '30 days'
  and is_internal=false;

create or replace view public.analytics_difficulty_30d
with(security_invoker=true)
as
select
  difficulty,
  count(*) filter(where event_name='game_started')::bigint as games_started,
  count(*) filter(where event_name='game_completed')::bigint as games_completed,
  count(distinct session_id)::bigint as sessions,
  round(100.0*count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_completed')
    /nullif(count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_started'),0),1) as completion_rate,
  round(avg(
    case when event_name='game_completed' and value is not null then
      100.0*value/case when difficulty='expert' then 600.0 else 400.0 end
    end
  ),1) as average_percent,
  count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_started')::bigint as players_started,
  count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_completed')::bigint as players_completed
from public.analytics_events
where created_at>=now()-interval '30 days'
  and is_internal=false
  and difficulty is not null
  and event_name in ('game_started','game_completed')
group by difficulty;

create or replace view public.analytics_daily_summary_30d
with(security_invoker=true)
as
with days as (
  select generate_series(
    (now() at time zone 'America/New_York')::date-29,
    (now() at time zone 'America/New_York')::date,
    interval '1 day'
  )::date as activity_date
), external_activity as (
  select
    (created_at at time zone 'America/New_York')::date as activity_date,
    count(distinct session_id) filter(where event_name='page_view')::bigint as visitors,
    count(*) filter(where event_name='page_view')::bigint as page_views,
    count(*) filter(where event_name='game_started')::bigint as games_started,
    count(*) filter(where event_name='game_completed')::bigint as games_completed,
    count(*) filter(where event_name='account_signin_requested')::bigint as signin_requests,
    count(distinct session_id) filter(where event_name='account_authenticated')::bigint as authenticated_sessions,
    count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_started')::bigint as players_started,
    count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_completed')::bigint as players_completed,
    count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_started' and difficulty='easy')::bigint as scout_players_started,
    count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_completed' and difficulty='easy')::bigint as scout_players_completed,
    count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_started' and difficulty='normal')::bigint as adventurer_players_started,
    count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_completed' and difficulty='normal')::bigint as adventurer_players_completed,
    count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_started' and difficulty='expert')::bigint as expert_players_started,
    count(distinct coalesce(visitor_id::text,session_id)) filter(where event_name='game_completed' and difficulty='expert')::bigint as expert_players_completed
  from public.analytics_events
  where created_at>=now()-interval '30 days' and is_internal=false
  group by 1
), account_activity as (
  select
    (profiles.created_at at time zone 'America/New_York')::date as activity_date,
    count(*)::bigint as accounts_created
  from public.profiles profiles
  where profiles.created_at>=now()-interval '30 days'
    and not exists(select 1 from public.app_admins admins where admins.user_id=profiles.id)
    and not exists(select 1 from public.internal_testers testers where testers.user_id=profiles.id)
  group by 1
), internal_activity as (
  select
    (created_at at time zone 'America/New_York')::date as activity_date,
    count(distinct session_id) filter(where event_name='page_view')::bigint as internal_qa_sessions,
    count(*) filter(where event_name='page_view')::bigint as internal_qa_page_views,
    count(*) filter(where event_name='game_started')::bigint as internal_qa_games_started,
    count(*) filter(where event_name='game_completed')::bigint as internal_qa_games_completed
  from public.analytics_events
  where created_at>=now()-interval '30 days' and is_internal=true
  group by 1
)
select
  days.activity_date,
  coalesce(external_activity.visitors,0)::bigint as visitors,
  coalesce(external_activity.page_views,0)::bigint as page_views,
  coalesce(external_activity.games_started,0)::bigint as games_started,
  coalesce(external_activity.games_completed,0)::bigint as games_completed,
  coalesce(external_activity.signin_requests,0)::bigint as signin_requests,
  coalesce(external_activity.authenticated_sessions,0)::bigint as authenticated_sessions,
  coalesce(account_activity.accounts_created,0)::bigint as accounts_created,
  coalesce(internal_activity.internal_qa_sessions,0)::bigint as internal_qa_sessions,
  coalesce(internal_activity.internal_qa_page_views,0)::bigint as internal_qa_page_views,
  coalesce(internal_activity.internal_qa_games_started,0)::bigint as internal_qa_games_started,
  coalesce(internal_activity.internal_qa_games_completed,0)::bigint as internal_qa_games_completed,
  coalesce(external_activity.players_started,0)::bigint as players_started,
  coalesce(external_activity.players_completed,0)::bigint as players_completed,
  coalesce(external_activity.scout_players_started,0)::bigint as scout_players_started,
  coalesce(external_activity.scout_players_completed,0)::bigint as scout_players_completed,
  coalesce(external_activity.adventurer_players_started,0)::bigint as adventurer_players_started,
  coalesce(external_activity.adventurer_players_completed,0)::bigint as adventurer_players_completed,
  coalesce(external_activity.expert_players_started,0)::bigint as expert_players_started,
  coalesce(external_activity.expert_players_completed,0)::bigint as expert_players_completed
from days
left join external_activity using(activity_date)
left join account_activity using(activity_date)
left join internal_activity using(activity_date)
order by days.activity_date desc;

revoke all on public.analytics_overview_30d from public,anon,authenticated;
revoke all on public.analytics_difficulty_30d from public,anon,authenticated;
revoke all on public.analytics_daily_summary_30d from public,anon,authenticated;
grant select on public.analytics_overview_30d to service_role;
grant select on public.analytics_difficulty_30d to service_role;
grant select on public.analytics_daily_summary_30d to service_role;

notify pgrst,'reload schema';
