begin;

select pg_advisory_xact_lock(hashtext('geostats-v16.3.4-catalog-release-guard'));

-- The review view is the source of truth for data/editorial integrity; a
-- category becomes player-visible only after a successful proof in each Daily
-- mode. Keeping this test in one function prevents a later importer or admin
-- write from making enabled/eligible_daily drift from that release contract.
create or replace function public.category_v16_3_4_should_publish(p_category_id text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select v.computed_playable_v16_2
      and exists (
        select 1
        from public.generator_reachability_v16_2_7 g
        where g.category_id=v.id
        group by g.category_id
        having count(*)=3 and bool_and(g.reachable)
      )
    from public.category_runtime_review_v16_2 v
    where v.id=p_category_id
  ),false)
$$;

revoke all on function public.category_v16_3_4_should_publish(text) from public,anon,authenticated;
grant execute on function public.category_v16_3_4_should_publish(text) to service_role;

-- Preserve a before/after release snapshot. It makes the next audit concrete:
-- a category can be held only with a current machine-readable reason, never
-- merely because an old import happened to switch a legacy flag.
create table if not exists public.category_catalog_release_audit_v16_3_4 (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  was_release_ready boolean not null,
  is_release_ready boolean,
  assessed_at timestamptz not null default now()
);
alter table public.category_catalog_release_audit_v16_3_4 enable row level security;
revoke all on public.category_catalog_release_audit_v16_3_4 from public,anon,authenticated;
grant select on public.category_catalog_release_audit_v16_3_4 to service_role;

insert into public.category_catalog_release_audit_v16_3_4(category_id,was_release_ready,is_release_ready,assessed_at)
select v.id,public.category_v16_3_4_should_publish(v.id),null,now()
from public.category_runtime_review_v16_2 v
on conflict(category_id) do update set
  was_release_ready=excluded.was_release_ready,
  is_release_ready=null,
  assessed_at=excluded.assessed_at;

create or replace function public.enforce_category_runtime_flags_v16_3_4()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare should_publish boolean;
begin
  -- Only normalize explicit publication-flag writes. Data and editorial writes
  -- still flow through refresh_v16_2_runtime_catalog(), where their full
  -- validation, ranking, semantic, and reachability assessment is recomputed.
  if tg_op='UPDATE'
    and new.enabled is not distinct from old.enabled
    and new.eligible_daily is not distinct from old.eligible_daily then
    return new;
  end if;

  select public.category_v16_3_4_should_publish(new.id) into should_publish;
  new.enabled:=should_publish;
  new.eligible_daily:=should_publish;
  return new;
end;
$$;

revoke all on function public.enforce_category_runtime_flags_v16_3_4() from public,anon,authenticated;

drop trigger if exists trg_enforce_category_runtime_flags_v16_3_4 on public.stat_categories;
create trigger trg_enforce_category_runtime_flags_v16_3_4
before insert or update of enabled,eligible_daily on public.stat_categories
for each row execute function public.enforce_category_runtime_flags_v16_3_4();

create or replace function public.assert_v16_3_4_runtime_catalog()
returns table(
  release_ready_categories integer,
  enabled_categories integer,
  safe_but_hidden_categories integer,
  unsafe_published_categories integer
)
language plpgsql
security definer
set search_path=public
as $$
declare release_ready integer;
declare enabled_count integer;
declare hidden_count integer;
declare unsafe_count integer;
begin
  with reachability as (
    select category_id
    from public.generator_reachability_v16_2_7
    group by category_id
    having count(*)=3 and bool_and(reachable)
  )
  select
    count(*) filter(where v.computed_playable_v16_2 and r.category_id is not null)::integer,
    count(*) filter(where v.enabled and v.eligible_daily)::integer,
    count(*) filter(where v.computed_playable_v16_2 and r.category_id is not null and not (v.enabled and v.eligible_daily))::integer,
    count(*) filter(where (v.enabled or v.eligible_daily) and not (v.computed_playable_v16_2 and r.category_id is not null))::integer
  into release_ready,enabled_count,hidden_count,unsafe_count
  from public.category_runtime_review_v16_2 v
  left join reachability r on r.category_id=v.id;

  if hidden_count<>0 then
    raise exception 'v16.3.4 catalog guard found % safe but hidden categories',hidden_count;
  end if;
  if unsafe_count<>0 then
    raise exception 'v16.3.4 catalog guard found % unsafe published categories',unsafe_count;
  end if;
  if enabled_count<>release_ready then
    raise exception 'v16.3.4 release-ready and enabled catalogs differ: ready %, enabled %',release_ready,enabled_count;
  end if;

  return query select release_ready,enabled_count,hidden_count,unsafe_count;
end;
$$;

revoke all on function public.assert_v16_3_4_runtime_catalog() from public,anon,authenticated;
grant execute on function public.assert_v16_3_4_runtime_catalog() to service_role;

-- Rebuild all dependent assessments, then reconcile *both* directions. The
-- earlier refresh only corrected drift when it happened inside the function;
-- this guarded final sync also recovers categories that were accidentally
-- hidden by a later bulk update and disables categories whose prior flags no
-- longer meet the current evidence threshold.
create or replace function public.refresh_v16_2_runtime_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='300s'
as $$
begin
  perform pg_advisory_xact_lock(hashtext('geostats-v16.3.4-runtime-catalog'));
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_6_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  update public.stat_categories set measurement_type='total',updated_at=now() where source_organization='World Bank' and source_indicator_code='EN.URB.LCTY';
  update public.stat_categories set measurement_type='per_capita',updated_at=now() where source_organization='World Bank' and source_indicator_code in ('AG.LND.ARBL.HA.PC','FB.ATM.TOTL.P5','FB.CBK.BRCH.P5');
  perform public.apply_v16_2_7_legacy_reaudit();
  perform public.apply_v16_2_7_exact_title_deduplication();
  perform public.apply_v16_3_runtime_corrections();
  perform public.apply_v16_3_1_catalog_integrity();
  perform public.apply_v16_3_2_catalog_reconciliation();
  perform public.refresh_category_decision_provenance_v16_2_7();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();

  update public.stat_categories c
  set enabled=public.category_v16_3_4_should_publish(c.id),
      eligible_daily=public.category_v16_3_4_should_publish(c.id),
      updated_at=now()
  where c.enabled is distinct from public.category_v16_3_4_should_publish(c.id)
     or c.eligible_daily is distinct from public.category_v16_3_4_should_publish(c.id);

  perform public.apply_v16_3_runtime_corrections();
  perform public.apply_v16_3_1_catalog_integrity();

  -- Those corrections can change a release predicate (for example an explicit
  -- owner retirement), so synchronize and assert once more at the boundary.
  update public.stat_categories c
  set enabled=public.category_v16_3_4_should_publish(c.id),
      eligible_daily=public.category_v16_3_4_should_publish(c.id),
      updated_at=now()
  where c.enabled is distinct from public.category_v16_3_4_should_publish(c.id)
     or c.eligible_daily is distinct from public.category_v16_3_4_should_publish(c.id);

  perform public.assert_v16_3_4_runtime_catalog();
end;
$$;

revoke all on function public.refresh_v16_2_runtime_catalog() from public,anon,authenticated;
grant execute on function public.refresh_v16_2_runtime_catalog() to service_role;

select public.refresh_v16_2_runtime_catalog();

update public.category_catalog_release_audit_v16_3_4 a
set is_release_ready=public.category_v16_3_4_should_publish(a.category_id),
    assessed_at=now();

do $$
declare release_ready integer;
begin
  select release_ready_categories into release_ready from public.assert_v16_3_4_runtime_catalog();
  if release_ready<317 then
    raise exception 'v16.3.4 expected at least 317 release-ready categories, found %',release_ready;
  end if;

  if not exists (
    select 1 from public.category_runtime_review_v16_2
    where id='natural-earth:largest-mapped-lake-area'
      and computed_playable_v16_2 and enabled and eligible_daily
  ) then raise exception 'v16.3.4 did not restore the verified mapped-lake category'; end if;

  if not exists (
    select 1 from public.category_runtime_review_v16_2
    where id='pew-religion:jewish-population'
      and computed_playable_v16_2 and enabled and eligible_daily
  ) then raise exception 'v16.3.4 did not restore the verified Jewish-population category'; end if;

  if exists (
    select 1 from public.category_runtime_review_v16_2
    where id in ('koppen-geiger:tropical-savanna-share','worldbank-catalog:bx-gsr-tran-zs','natural-earth:largest-geographic-span')
      and (enabled or eligible_daily)
  ) then raise exception 'v16.3.4 regressed a durable owner-directed exclusion'; end if;
end $$;

notify pgrst, 'reload schema';

commit;
