begin;
alter table public.analytics_events add column if not exists visitor_id uuid;
create index if not exists analytics_events_visitor_created_idx on public.analytics_events(visitor_id, created_at) where visitor_id is not null;

create table if not exists public.player_reports (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 status text not null default 'new' check (status in ('new','resolved')),
 kind text not null check (kind in ('data','bug','other')),
 message text not null check (length(message) between 10 and 1500),
 category_id text check (length(category_id) <= 200),
 challenge_date date,
 difficulty text check (difficulty in ('easy','normal','expert')),
 page_path text not null check (length(page_path) <= 240),
 user_id uuid references auth.users(id) on delete set null,
 rate_key text not null check (length(rate_key)=64)
);
alter table public.player_reports enable row level security;
revoke all on public.player_reports from anon, authenticated;
grant select, insert, update on public.player_reports to service_role;
create index if not exists player_reports_rate_idx on public.player_reports(rate_key,created_at);

-- Service-only invoker: the server authenticates administrators separately.
-- Transaction lock makes the per-network rate limit atomic across instances.
create or replace function public.submit_player_report_v1(p_kind text,p_message text,p_category_id text,p_challenge_date date,p_difficulty text,p_page_path text,p_user_id uuid,p_rate_key text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare report_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_rate_key, 193));
 if (select count(*) from public.player_reports where rate_key=p_rate_key and created_at>now()-interval '1 hour') >= 5 then
   raise exception 'report_rate_limit' using errcode='P0001';
 end if;
 insert into public.player_reports(kind,message,category_id,challenge_date,difficulty,page_path,user_id,rate_key)
 values(p_kind,p_message,p_category_id,p_challenge_date,p_difficulty,p_page_path,p_user_id,p_rate_key) returning id into report_id;
 return report_id;
end;
$$;
revoke all on function public.submit_player_report_v1(text,text,text,date,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.submit_player_report_v1(text,text,text,date,text,text,uuid,text) to service_role;

create or replace view public.launch_funnel_v1 with (security_invoker=true) as
with eligible as (
 select e.*, (e.created_at at time zone 'America/New_York')::date as activity_date
 from public.analytics_events e
 where e.visitor_id is not null and not coalesce(e.is_internal,false)
 and not exists (select 1 from public.analytics_events q where q.visitor_id=e.visitor_id and q.is_internal=true)
 and not exists (select 1 from public.app_admins a where a.user_id=e.user_id)
 and not exists (select 1 from public.internal_testers t where t.user_id=e.user_id)
), first_seen as (
 select visitor_id,min(created_at) first_at,min(activity_date) first_date from eligible group by visitor_id
), recent as (
 select * from eligible where created_at>=now()-interval '30 days'
), visitors as (
 select visitor_id,min(created_at) first_at,max(created_at) last_at,
 bool_or(event_name='game_started') started,
 bool_or(event_name='game_completed') completed
 from recent group by visitor_id
), totals as (
 select count(*) as visitors,count(*) filter(where started) as starters,count(*) filter(where completed) as finishers from visitors
), second_game as (
 select count(distinct s.visitor_id) as second_game_players from recent s
 where s.event_name='game_started' and exists (
 select 1 from recent c where c.visitor_id=s.visitor_id and c.event_name='game_completed'
 and c.created_at<s.created_at and (c.challenge_date,c.difficulty) is distinct from (s.challenge_date,s.difficulty))
), accounts as (
 select count(distinct e.visitor_id) as account_creators from recent e
 join auth.users u on u.id=e.user_id join first_seen f on f.visitor_id=e.visitor_id
 where u.created_at>=f.first_at-interval '5 minutes' and u.created_at>=now()-interval '30 days'
), cohorts as (
 select f.visitor_id,f.first_date,exists(select 1 from eligible e where e.visitor_id=f.visitor_id and e.activity_date=f.first_date+1) returned
 from first_seen f where f.first_date >= (now() at time zone 'America/New_York')::date-30
 and f.first_date < (now() at time zone 'America/New_York')::date-1
), retention as (
 select count(*) as retention_eligible,count(*) filter(where returned) as next_day_returners from cohorts
)
select totals.*,second_game.*,accounts.*,retention.*,
 round(100.0*starters/nullif(visitors,0),1) as start_rate,
 round(100.0*finishers/nullif(starters,0),1) as completion_rate,
 round(100.0*second_game_players/nullif(finishers,0),1) as second_game_rate,
 round(100.0*next_day_returners/nullif(retention_eligible,0),1) as next_day_retention_rate,
 round(100.0*account_creators/nullif(visitors,0),1) as account_creation_rate
from totals cross join second_game cross join accounts cross join retention;
revoke all on public.launch_funnel_v1 from anon,authenticated;
grant select on public.launch_funnel_v1 to service_role;
commit;
