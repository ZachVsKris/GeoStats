begin;

-- The compaction cutover recreated these views without their prior security
-- options. Public gameplay may read enabled latest values, while the warehouse
-- integrity aggregate remains service-only.
alter view public.stat_latest_values set (security_invoker = true);
revoke all on public.stat_latest_values from public, anon, authenticated;
grant select on public.stat_latest_values to anon, authenticated, service_role;

alter view public.stat_observation_integrity_v144 set (security_invoker = true);
revoke all on public.stat_observation_integrity_v144 from public, anon, authenticated;
grant select on public.stat_observation_integrity_v144 to service_role;

revoke all on function public.category_recovery_ready_v16_3_4(text) from public, anon, authenticated;
grant execute on function public.category_recovery_ready_v16_3_4(text) to service_role;

-- Bounded, service-only counters protect analytics storage without putting a
-- rate-limit lookup or write in the gameplay path itself.
create table if not exists public.analytics_rate_limits (
  scope text not null check (scope in ('network', 'session')),
  key_hash text not null check (length(key_hash) = 64),
  bucket_start timestamptz not null,
  event_count integer not null default 1 check (event_count between 1 and 10000),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash, bucket_start)
);
alter table public.analytics_rate_limits enable row level security;
revoke all on public.analytics_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.analytics_rate_limits to service_role;

create or replace function public.consume_analytics_rate_limit_v1(
  p_network_key text,
  p_session_key text,
  p_network_limit integer default 600,
  p_session_limit integer default 100
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bucket timestamptz := date_trunc('hour', now());
  v_allowed boolean;
begin
  if length(p_network_key) <> 64 or length(p_session_key) <> 64 then
    return false;
  end if;

  insert into public.analytics_rate_limits(scope, key_hash, bucket_start, event_count)
  values ('network', p_network_key, v_bucket, 1)
  on conflict (scope, key_hash, bucket_start) do update
    set event_count = public.analytics_rate_limits.event_count + 1,
        updated_at = now()
    where public.analytics_rate_limits.event_count < p_network_limit
  returning true into v_allowed;
  if not coalesce(v_allowed, false) then return false; end if;

  v_allowed := false;
  insert into public.analytics_rate_limits(scope, key_hash, bucket_start, event_count)
  values ('session', p_session_key, v_bucket, 1)
  on conflict (scope, key_hash, bucket_start) do update
    set event_count = public.analytics_rate_limits.event_count + 1,
        updated_at = now()
    where public.analytics_rate_limits.event_count < p_session_limit
  returning true into v_allowed;
  return coalesce(v_allowed, false);
end;
$$;
revoke all on function public.consume_analytics_rate_limit_v1(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_analytics_rate_limit_v1(text,text,integer,integer) to service_role;

create or replace function public.database_storage_status_v1()
returns table(database_bytes bigint, limit_bytes bigint, used_percent numeric, status text)
language sql
security invoker
set search_path = ''
stable
as $$
  select size_bytes,
         524288000::bigint,
         round(100.0 * size_bytes / 524288000::numeric, 1),
         case when size_bytes >= 503316480 then 'critical'
              when size_bytes >= 492830720 then 'warning'
              else 'ok' end
  from (select pg_database_size(current_database())::bigint size_bytes) sizes;
$$;
revoke all on function public.database_storage_status_v1() from public, anon, authenticated;
grant execute on function public.database_storage_status_v1() to service_role;

commit;
