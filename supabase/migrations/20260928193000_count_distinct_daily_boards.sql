-- A Daily board is one browser, challenge date, and mode. Replays should not
-- inflate board finishes, and a recorded finish is evidence of a start even
-- when the earlier, best-effort start beacon was lost.
create or replace view public.analytics_daily_summary_30d
with (security_invoker=true)
as
with days as (
  select generate_series(
    (now() at time zone 'America/New_York')::date - 29,
    (now() at time zone 'America/New_York')::date,
    interval '1 day'
  )::date as activity_date
), external_activity as (
  select
    (created_at at time zone 'America/New_York')::date as activity_date,
    count(distinct session_id) filter (where event_name='page_view')::bigint as visitors,
    count(*) filter (where event_name='page_view')::bigint as page_views,
    count(*) filter (where event_name='account_signin_requested')::bigint as signin_requests,
    count(distinct session_id) filter (where event_name='account_authenticated')::bigint as authenticated_sessions
  from public.analytics_events
  where created_at >= now() - interval '30 days' and is_internal=false
  group by 1
), browser_boards as (
  select
    coalesce(challenge_date, (created_at at time zone 'America/New_York')::date) as activity_date,
    coalesce(visitor_id::text, session_id) as player_key,
    difficulty,
    bool_or(event_name='game_completed') as completed
  from public.analytics_events
  where created_at >= now() - interval '30 days'
    and is_internal=false
    and event_name in ('game_started','game_completed')
    and difficulty in ('easy','normal','expert')
  group by 1,2,3
), gameplay_activity as (
  select
    activity_date,
    count(distinct player_key)::bigint as players_started,
    count(distinct player_key) filter (where completed)::bigint as players_completed,
    count(*)::bigint as games_started,
    count(*) filter (where completed)::bigint as games_completed,
    count(*) filter (where difficulty='easy')::bigint as scout_players_started,
    count(*) filter (where difficulty='easy' and completed)::bigint as scout_players_completed,
    count(*) filter (where difficulty='normal')::bigint as adventurer_players_started,
    count(*) filter (where difficulty='normal' and completed)::bigint as adventurer_players_completed,
    count(*) filter (where difficulty='expert')::bigint as expert_players_started,
    count(*) filter (where difficulty='expert' and completed)::bigint as expert_players_completed
  from browser_boards
  group by 1
), account_activity as (
  select
    (profiles.created_at at time zone 'America/New_York')::date as activity_date,
    count(*)::bigint as accounts_created
  from public.profiles profiles
  where profiles.created_at >= now() - interval '30 days'
    and not exists (select 1 from public.app_admins admins where admins.user_id=profiles.id)
    and not exists (select 1 from public.internal_testers testers where testers.user_id=profiles.id)
  group by 1
), internal_activity as (
  select
    (created_at at time zone 'America/New_York')::date as activity_date,
    count(distinct session_id) filter (where event_name='page_view')::bigint as internal_qa_sessions,
    count(*) filter (where event_name='page_view')::bigint as internal_qa_page_views,
    count(*) filter (where event_name='game_started')::bigint as internal_qa_games_started,
    count(*) filter (where event_name='game_completed')::bigint as internal_qa_games_completed
  from public.analytics_events
  where created_at >= now() - interval '30 days' and is_internal=true
  group by 1
)
select
  days.activity_date,
  coalesce(external_activity.visitors,0)::bigint as visitors,
  coalesce(external_activity.page_views,0)::bigint as page_views,
  coalesce(gameplay_activity.games_started,0)::bigint as games_started,
  coalesce(gameplay_activity.games_completed,0)::bigint as games_completed,
  coalesce(external_activity.signin_requests,0)::bigint as signin_requests,
  coalesce(external_activity.authenticated_sessions,0)::bigint as authenticated_sessions,
  coalesce(account_activity.accounts_created,0)::bigint as accounts_created,
  coalesce(internal_activity.internal_qa_sessions,0)::bigint as internal_qa_sessions,
  coalesce(internal_activity.internal_qa_page_views,0)::bigint as internal_qa_page_views,
  coalesce(internal_activity.internal_qa_games_started,0)::bigint as internal_qa_games_started,
  coalesce(internal_activity.internal_qa_games_completed,0)::bigint as internal_qa_games_completed,
  coalesce(gameplay_activity.players_started,0)::bigint as players_started,
  coalesce(gameplay_activity.players_completed,0)::bigint as players_completed,
  coalesce(gameplay_activity.scout_players_started,0)::bigint as scout_players_started,
  coalesce(gameplay_activity.scout_players_completed,0)::bigint as scout_players_completed,
  coalesce(gameplay_activity.adventurer_players_started,0)::bigint as adventurer_players_started,
  coalesce(gameplay_activity.adventurer_players_completed,0)::bigint as adventurer_players_completed,
  coalesce(gameplay_activity.expert_players_started,0)::bigint as expert_players_started,
  coalesce(gameplay_activity.expert_players_completed,0)::bigint as expert_players_completed
from days
left join external_activity using (activity_date)
left join gameplay_activity using (activity_date)
left join account_activity using (activity_date)
left join internal_activity using (activity_date)
order by days.activity_date desc;

revoke all on public.analytics_daily_summary_30d from public, anon, authenticated;
grant select on public.analytics_daily_summary_30d to service_role;
notify pgrst, 'reload schema';
