-- GeoStats v16.0: atomic Daily publication, ranking-completeness governance,
-- curated expansion activation, and one authoritative admin/runtime catalog.
-- Safe to rerun after v15.9.2.

begin;

select pg_advisory_xact_lock(hashtext('geostats-v16.0-integrated-release'));

do $$
begin
  if to_regclass('public.category_review_queue_v15') is null then
    raise exception 'GeoStats v15.9.2 is required before v16.0.';
  end if;
  if to_regclass('public.daily_challenges') is null then
    raise exception 'GeoStats daily_challenges table is missing.';
  end if;
end $$;

create table if not exists public.v16_category_backup (
  category_id text primary key,
  title text not null,
  short_title text,
  description text,
  common_year smallint,
  common_year_coverage integer,
  latest_available_year smallint,
  country_coverage integer,
  enabled boolean not null,
  eligible_daily boolean not null,
  review_status text,
  curation_status text,
  curation_reason text,
  content_review_status text,
  player_quality_status text,
  captured_at timestamptz not null default now()
);

create table if not exists public.v16_review_backup (
  category_id text primary key,
  status text not null,
  duplicate_of text,
  recommended_title text,
  semantic_group text,
  notes text,
  confusing boolean not null,
  esoteric boolean not null,
  stale_data boolean not null,
  poor_coverage boolean not null,
  captured_at timestamptz not null default now()
);

insert into public.v16_category_backup(
  category_id,title,short_title,description,common_year,common_year_coverage,
  latest_available_year,country_coverage,enabled,eligible_daily,review_status,
  curation_status,curation_reason,content_review_status,player_quality_status
)
select id,title,short_title,description,common_year,common_year_coverage,
       latest_available_year,country_coverage,enabled,eligible_daily,review_status,
       curation_status,curation_reason,content_review_status,player_quality_status
from public.stat_categories
on conflict(category_id) do nothing;

insert into public.v16_review_backup(
  category_id,status,duplicate_of,recommended_title,semantic_group,notes,
  confusing,esoteric,stale_data,poor_coverage
)
select category_id,status,duplicate_of,recommended_title,semantic_group,notes,
       confusing,esoteric,stale_data,poor_coverage
from public.category_review_state
on conflict(category_id) do nothing;

create table if not exists public.category_ranking_completeness_v16 (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  status text not null check(status in ('comprehensive','top_end_complete','non_comprehensive','unreviewed')),
  reason text not null,
  observation_count integer not null default 0,
  distinct_value_count integer not null default 0,
  top_value_distinct_count integer not null default 0,
  top_value_feasible boolean not null default false,
  assessed_year smallint,
  assessed_at timestamptz not null default now()
);
create index if not exists category_ranking_completeness_v16_status_idx
  on public.category_ranking_completeness_v16(status,top_value_feasible);
alter table public.category_ranking_completeness_v16 enable row level security;
revoke all on public.category_ranking_completeness_v16 from public,anon,authenticated;
grant all on public.category_ranking_completeness_v16 to service_role;

create or replace function public.refresh_category_ranking_completeness_v16()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  delete from public.category_ranking_completeness_v16
  where category_id is not null;

  insert into public.category_ranking_completeness_v16(
    category_id,status,reason,observation_count,distinct_value_count,
    top_value_distinct_count,top_value_feasible,assessed_year,assessed_at
  )
  with selected_year as (
    select q.id,q.source_organization,q.ranking_direction,
           coalesce(q.common_year,q.latest_available_year)::smallint as assessed_year
    from public.category_review_queue_v15 q
  ), ranked as (
    select y.id,y.source_organization,y.ranking_direction,y.assessed_year,o.value,
           row_number() over(
             partition by y.id
             order by
               case when y.ranking_direction='high' then o.value end desc nulls last,
               case when y.ranking_direction='low' then o.value end asc nulls last,
               o.country_iso3
           ) as ranking_position
    from selected_year y
    join public.stat_observations o
      on o.category_id=y.id and o.data_year=y.assessed_year
  ), metrics as (
    select y.id,y.source_organization,y.ranking_direction,y.assessed_year,
           count(r.value)::integer as observation_count,
           count(distinct r.value)::integer as distinct_value_count,
           count(distinct r.value) filter(where r.ranking_position<=50)::integer as top_value_distinct_count
    from selected_year y
    left join ranked r on r.id=y.id
    group by y.id,y.source_organization,y.ranking_direction,y.assessed_year
  )
  select id,
    case
      when assessed_year is null or observation_count<30 then 'non_comprehensive'
      when observation_count>=185 then 'comprehensive'
      when ranking_direction='low' then 'non_comprehensive'
      when source_organization in (
        'FAOSTAT','FAOSTAT Food Balances','Natural Earth','Pew Research Center',
        'Smithsonian GVP','USGS','UN Comtrade','UNHCR'
      ) and top_value_distinct_count>=10 then 'top_end_complete'
      else 'non_comprehensive'
    end,
    case
      when assessed_year is null then 'No common comparison year is available.'
      when observation_count<30 then 'Fewer than 30 countries have comparable observations.'
      when observation_count>=185 then 'The common-year ranking covers nearly the full supported country universe.'
      when ranking_direction='low' then 'Incomplete coverage cannot safely support a lowest-wins ranking.'
      when source_organization in (
        'FAOSTAT','FAOSTAT Food Balances','Natural Earth','Pew Research Center',
        'Smithsonian GVP','USGS','UN Comtrade','UNHCR'
      ) and top_value_distinct_count>=10
        then 'The source is structurally sparse, but the meaningful high end contains enough distinct ranked values.'
      else 'One or more omitted countries could plausibly alter the meaningful top ranking.'
    end,
    observation_count,distinct_value_count,top_value_distinct_count,
    (top_value_distinct_count>=10),assessed_year,now()
  from metrics;
end;
$$;
revoke all on function public.refresh_category_ranking_completeness_v16() from public,anon,authenticated;
grant execute on function public.refresh_category_ranking_completeness_v16() to service_role;

-- Atomic Daily publication. A supplied mode may be replaced only when no score
-- references it; the transaction must leave a complete three-mode trio.
create or replace function public.publish_daily_trio_v16(p_challenge_date date,p_rows jsonb)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  supplied_count integer;
  published_count integer;
begin
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then
    raise exception 'p_rows must be a JSON array.';
  end if;
  select count(*) into supplied_count from jsonb_array_elements(p_rows);
  if supplied_count<1 or supplied_count>3 then
    raise exception 'Daily publication must supply between one and three modes.';
  end if;
  if exists(
    select 1
    from jsonb_to_recordset(p_rows) as x(difficulty text)
    group by x.difficulty having count(*)>1
  ) then raise exception 'A Daily difficulty was supplied more than once.'; end if;
  if exists(
    select 1 from jsonb_to_recordset(p_rows) as x(difficulty text)
    where x.difficulty not in ('easy','normal','expert')
  ) then raise exception 'Unsupported Daily difficulty.'; end if;
  if exists(
    select 1
    from public.daily_scores s
    join jsonb_to_recordset(p_rows) as x(difficulty text) on x.difficulty=s.difficulty
    where s.challenge_date=p_challenge_date
  ) then raise exception 'A scored Daily mode cannot be replaced.'; end if;

  insert into public.daily_challenges(
    challenge_date,difficulty,seed,encoded_board,board_payload,board_hash,
    dataset_version,rules_version,category_set_version,created_at
  )
  select p_challenge_date,x.difficulty,x.seed,x.encoded_board,x.board_payload,
         coalesce(nullif(x.board_hash,''),encode(digest(x.encoded_board,'sha256'),'hex')),
         coalesce(nullif(x.dataset_version,''),'2026-07-31-ranking-completeness-catalog-v16'),
         coalesce(nullif(x.rules_version,''),'16.0'),
         coalesce(nullif(x.category_set_version,''),'SCOUT-ADVENTURER-EXPERT-V16-ATOMIC-TRIO-RANKING-COMPLETE'),
         now()
  from jsonb_to_recordset(p_rows) as x(
    difficulty text,seed text,encoded_board text,board_payload jsonb,board_hash text,
    dataset_version text,rules_version text,category_set_version text
  )
  where x.seed is not null and x.encoded_board is not null and x.board_payload is not null
  on conflict(challenge_date,difficulty) do update set
    seed=excluded.seed,encoded_board=excluded.encoded_board,board_payload=excluded.board_payload,
    board_hash=excluded.board_hash,dataset_version=excluded.dataset_version,
    rules_version=excluded.rules_version,category_set_version=excluded.category_set_version,
    created_at=now();

  select count(*) into published_count
  from public.daily_challenges
  where challenge_date=p_challenge_date
    and difficulty in ('easy','normal','expert')
    and board_payload is not null;
  if published_count<>3 then
    raise exception 'Atomic publication would leave only % of 3 Daily modes.',published_count;
  end if;
end;
$$;
revoke all on function public.publish_daily_trio_v16(date,jsonb) from public,anon,authenticated;
grant execute on function public.publish_daily_trio_v16(date,jsonb) to service_role;

create or replace function public.apply_v16_curated_decisions()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  -- World Heritage and retired UIS remain outside the active catalog.
  update public.category_review_state r set status='rejected',notes='Removed from the v16 active catalog.',updated_at=now()
  from public.stat_categories c where c.id=r.category_id and c.source_organization in ('UNESCO World Heritage Centre','UNESCO UIS') and r.reviewed_by is null;

  -- Food Balance Sheets measure supply available for human consumption, not
  -- directly observed individual eating.
  update public.stat_categories
  set title=regexp_replace(regexp_replace(title,' consumed per person$',' available per person','i'),' supplied per person$',' available per person','i'),
      short_title=regexp_replace(regexp_replace(coalesce(short_title,title),' consumed per person$',' available per person','i'),' supplied per person$',' available per person','i'),
      updated_at=now()
  where source_organization='FAOSTAT Food Balances';

  update public.category_review_state r
  set status=case when c.id='faostat-fbs:dairy-products' then 'duplicate' else 'approved' end,
      duplicate_of=case when c.id='faostat-fbs:dairy-products' then 'faostat-fbs:milk' else null end,
      recommended_title=regexp_replace(regexp_replace(c.title,' consumed per person$',' available per person','i'),' supplied per person$',' available per person','i'),
      semantic_group='food-consumption',
      notes=case when c.id='faostat-fbs:dairy-products' then 'Broader duplicate of the clearer milk category.' else 'Approved v16 apparent-consumption category; board copy says available rather than eaten.' end,
      updated_at=now(),reviewed_at=coalesce(r.reviewed_at,now())
  from public.stat_categories c
  where c.id=r.category_id and c.source_organization='FAOSTAT Food Balances'
    and greatest(c.common_year_coverage,c.country_coverage)>=30 and r.reviewed_by is null;

  -- Current migration-stock measures are clear and current. Older tourism
  -- measures remain stale and disabled for Daily.
  update public.category_review_state r
  set status='approved',stale_data=false,semantic_group='migration-stock',notes='Approved v16 current migration-stock category.',updated_at=now()
  from public.stat_categories c
  where c.id=r.category_id and c.id like 'worldbank-expansion:%'
    and c.title in ('Largest international migrant population','Highest international migrant share') and r.reviewed_by is null;
  update public.category_review_state r
  set status='rejected',stale_data=true,notes='Comparable global tourism year is too old for Daily gameplay.',updated_at=now()
  from public.stat_categories c
  where c.id=r.category_id and c.id like 'worldbank-expansion:%'
    and c.title not in ('Largest international migrant population','Highest international migrant share') and r.reviewed_by is null;

  -- Pew uses a fixed 2020 comparison year. Approve only metrics with actual
  -- observations; empty category shells remain pending until the repaired importer runs.
  update public.stat_categories c set common_year=2020,latest_available_year=2020,
      common_year_coverage=x.coverage,country_coverage=x.coverage,updated_at=now()
  from (select category_id,count(distinct country_iso3)::integer coverage from public.stat_observations where data_year=2020 group by category_id) x
  where c.id=x.category_id and c.id like 'pew-religion:%';
  update public.category_review_state r
  set status='approved',stale_data=false,poor_coverage=false,semantic_group='religious-composition',
      notes='Approved v16 fixed-year Pew religious-composition category.',updated_at=now()
  from public.stat_categories c
  where c.id=r.category_id and c.id like 'pew-religion:%' and greatest(c.common_year_coverage,c.country_coverage)>=30 and r.reviewed_by is null;

  -- Current Natural Earth importer intentionally owns sixteen categories. The
  -- older geometry-extreme rows are retained for history but removed from play.
  update public.category_review_state
  set status='rejected',notes='Retired v16 legacy Natural Earth geometry category.',updated_at=now()
  where reviewed_by is null and category_id in (
    'natural-earth:largest-geographic-span','natural-earth:largest-north-south-span',
    'natural-earth:largest-east-west-span','natural-earth:northernmost-country',
    'natural-earth:southernmost-country','natural-earth:farthest-from-equator',
    'natural-earth:most-separate-land-areas','natural-earth:most-large-land-areas'
  );
  update public.category_review_state r set recommended_title='Longest border with one neighboring country',updated_at=now()
  from public.stat_categories c where c.id=r.category_id and c.id='natural-earth:longest-single-land-border' and r.reviewed_by is null;
  update public.stat_categories set title='Longest border with one neighboring country',short_title='Longest neighboring-country border',
      description='Total length of the country''s longest shared land border with one neighboring country.',updated_at=now()
  where id='natural-earth:longest-single-land-border';

  -- Approve sparse physical categories only when the top-ranked values are
  -- feasible; global zero ties are not an automatic veto.
  update public.category_review_state r
  set status='approved',poor_coverage=false,notes='Approved v16 using top-ranked distinct-value feasibility.',updated_at=now()
  from public.stat_categories c join public.category_ranking_completeness_v16 k on k.category_id=c.id
  where c.id=r.category_id and c.source_organization in ('Smithsonian GVP','USGS') and k.top_value_feasible and r.reviewed_by is null;

  -- Technical emissions variants are not player-facing categories.
  update public.category_review_state r
  set status='rejected',confusing=true,notes='Removed v16 technical LULUCF or sector-specific emissions variant.',updated_at=now()
  from public.stat_categories c
  where c.id=r.category_id and c.source_organization='World Bank'
    and (c.title ilike '%LULUCF%' or c.title ilike '%Fugitive Emissions%' or c.title ilike '%net fluxes%')
    and c.source_indicator_code not in ('EN.GHG.CO2.MT.CE.AR5','EN.GHG.CH4.MT.CE.AR5') and r.reviewed_by is null;

  -- Prevent the queue from rewarding accounting-system variants over clear game concepts.
  update public.category_review_state r
  set status='rejected',confusing=true,notes='Removed v16 technical or duplicate national-accounting variant.',updated_at=now()
  from public.stat_categories c
  where c.id=r.category_id and c.source_organization='World Bank'
    and (
      c.title ilike '%NPISH%' or c.title ilike '%linked series%'
      or c.title ilike '%gross fixed capital formation%'
      or c.title ilike '%gross capital formation%'
      or c.title ilike '%gross national expenditure%'
      or c.title ilike '%final consumption expenditure%'
    ) and r.reviewed_by is null;

  -- FAOSTAT production language is element-aware. Yield, harvested area,
  -- slaughter, carcass, and producing-animal elements remain rejected.
  update public.category_review_state r
  set status='rejected',recommended_title=null,notes='Rejected v16 non-production FAOSTAT element; production wording cleared.',updated_at=now()
  from public.stat_categories c
  where c.id=r.category_id and c.source_organization='FAOSTAT'
    and replace(c.source_indicator_code,'''','') ~ ':(5312|5320|5412|5417)$' and r.reviewed_by is null;

  -- EIA stays disabled until a successful importer run and direct audit exists.
  update public.category_review_state r
  set status='needs_discussion',notes='Disabled until the EIA importer and source audit complete successfully.',updated_at=now()
  from public.stat_categories c where c.id=r.category_id and c.source_organization='U.S. EIA'
    and coalesce(c.validation_status,'pending')<>'verified' and r.reviewed_by is null;

  update public.data_sources set status='planned',metadata=coalesce(metadata,'{}'::jsonb)||'{"retired":true,"retiredVersion":"16.0"}'::jsonb,updated_at=now()
  where id in ('unescoheritage','unesco');
end;
$$;
revoke all on function public.apply_v16_curated_decisions() from public,anon,authenticated;
grant execute on function public.apply_v16_curated_decisions() to service_role;

select public.refresh_category_ranking_completeness_v16();
select public.apply_v16_curated_decisions();
select public.reconcile_category_playability_v15();
select public.refresh_category_ranking_completeness_v16();

create or replace view public.category_runtime_review_v16
with(security_invoker=true) as
select q.*,
       coalesce(k.status,'unreviewed') as ranking_completeness_status,
       coalesce(k.reason,'Ranking completeness has not been assessed.') as ranking_completeness_reason,
       coalesce(k.top_value_distinct_count,0) as top_value_distinct_count,
       coalesce(k.top_value_feasible,false) as top_value_feasible,
       (
         q.computed_playable_v15
         and coalesce(k.status,'unreviewed') in ('comprehensive','top_end_complete')
         and coalesce(k.top_value_feasible,false)
       ) as computed_playable_v16,
       q.v15_blockers || array_remove(array[
         case when coalesce(k.status,'unreviewed') not in ('comprehensive','top_end_complete') then coalesce(k.reason,'Ranking completeness has not been assessed.') end,
         case when not coalesce(k.top_value_feasible,false) then 'Fewer than ten distinct values exist among the meaningful top rankings.' end
       ],null) as v16_blockers,
       array_remove(array[
         case when k.status='top_end_complete' then 'Ranking is top-end complete rather than fully comprehensive.' end,
         case when q.validation_status<>'verified' and not public.category_v15_true_integrity_failure(q.validation_status,q.validation_reason,q.validation_mismatch_count,q.validation_ranking_mismatch_count)
           then 'Official values are usable, but non-data audit metadata remain incomplete.' end
       ],null) as v16_warnings
from public.category_review_queue_v15 q
left join public.category_ranking_completeness_v16 k on k.category_id=q.id;
revoke all on public.category_runtime_review_v16 from public,anon,authenticated;
grant select on public.category_runtime_review_v16 to service_role;

create or replace view public.category_review_workbench_v16
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
from public.category_runtime_review_v16 runtime
left join public.category_auto_vetting_v15_9 vetting on vetting.category_id=runtime.id;
revoke all on public.category_review_workbench_v16 from public,anon,authenticated;
grant select on public.category_review_workbench_v16 to service_role;

create or replace view public.category_review_overview_v16
with(security_invoker=true) as
select count(*)::bigint categories,
 count(*) filter(where editorial_status='pending')::bigint pending,
 count(*) filter(where editorial_status='approved')::bigint approved,
 count(*) filter(where editorial_status='rejected')::bigint rejected,
 count(*) filter(where editorial_status='duplicate')::bigint duplicates,
 count(*) filter(where editorial_status='needs_rewrite')::bigint needs_rewrite,
 count(*) filter(where editorial_status='needs_discussion')::bigint needs_discussion,
 count(*) filter(where hard_gate_ready)::bigint hard_gate_ready,
 count(*) filter(where computed_playable_v16)::bigint playable,
 count(*) filter(where editorial_status='approved' and not computed_playable_v16)::bigint approved_but_blocked,
 count(*) filter(where political_self_reported)::bigint political_self_reported,
 count(*) filter(where confusing or esoteric)::bigint confusing_or_esoteric,
 count(*) filter(where subjective_or_composite)::bigint subjective_or_composite
from public.category_runtime_review_v16;
revoke all on public.category_review_overview_v16 from public,anon,authenticated;
grant select on public.category_review_overview_v16 to service_role;

create or replace view public.data_integrity_by_source_v16
with(security_invoker=true) as
select source_organization as source,count(*)::bigint categories,
 count(*) filter(where computed_playable_v16)::bigint playable,
 count(*) filter(where validation_status='verified')::bigint verified,
 count(*) filter(where validation_status<>'verified' and not public.category_v15_true_integrity_failure(validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count))::bigint verified_with_warnings,
 count(*) filter(where public.category_v15_true_integrity_failure(validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count))::bigint blocked,
 count(*) filter(where validation_status in ('pending','unable_to_verify'))::bigint audit_pending,
 max(validated_at) last_validated_at
from public.category_runtime_review_v16 group by source_organization;

create or replace view public.data_integrity_overview_v16
with(security_invoker=true) as
select false as enforcement_enabled,count(*)::bigint categories,
 count(*) filter(where computed_playable_v16)::bigint playable,
 count(*) filter(where validation_status='verified')::bigint verified,
 count(*) filter(where validation_status<>'verified' and not public.category_v15_true_integrity_failure(validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count))::bigint verified_with_warnings,
 count(*) filter(where public.category_v15_true_integrity_failure(validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count))::bigint blocked,
 count(*) filter(where validation_status in ('pending','unable_to_verify'))::bigint audit_pending,
 0::bigint as unverified_playable
from public.category_runtime_review_v16;

create or replace view public.data_integrity_issues_v16
with(security_invoker=true) as
select id,effective_title as title,source_organization,source_dataset,source_indicator_code,
 case when public.category_v15_true_integrity_failure(validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count)
   then 'blocked' when validation_status='verified' then 'verified' else 'verified_with_warnings' end as integrity_state,
 validation_status,validation_reason,validated_at,common_year,common_year_coverage,
 validation_expected_count,validated_observation_count,validation_mismatch_count,
 validation_ranking_mismatch_count,computed_playable_v16,v16_blockers,v16_warnings
from public.category_runtime_review_v16
where public.category_v15_true_integrity_failure(validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count)
   or (computed_playable_v16 and validation_status<>'verified')
order by computed_playable_v16 desc,source_organization,effective_title;

grant select on public.data_integrity_by_source_v16,public.data_integrity_overview_v16,public.data_integrity_issues_v16 to service_role;

-- Runtime booleans mirror the single authoritative v16 decision.
update public.stat_categories c
set enabled=v.computed_playable_v16,eligible_daily=v.computed_playable_v16,updated_at=now()
from public.category_runtime_review_v16 v where v.id=c.id;

-- Refresh runtime playability after an administrator changes an editorial
-- decision. This deliberately does not reapply the release's one-time curated
-- decisions, so a later manual review is never silently overwritten.
create or replace function public.refresh_v16_runtime_catalog()
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.refresh_category_ranking_completeness_v16();
  perform public.reconcile_category_playability_v15();
  perform public.refresh_category_ranking_completeness_v16();
  update public.stat_categories c
  set enabled=v.computed_playable_v16,
      eligible_daily=v.computed_playable_v16,
      updated_at=now()
  from public.category_runtime_review_v16 v
  where v.id=c.id;
end;
$$;
revoke all on function public.refresh_v16_runtime_catalog() from public,anon,authenticated;
grant execute on function public.refresh_v16_runtime_catalog() to service_role;

create or replace function public.finalize_v16_catalog()
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.apply_v16_curated_decisions();
  perform public.refresh_v16_runtime_catalog();
end;
$$;
revoke all on function public.finalize_v16_catalog() from public,anon,authenticated;
grant execute on function public.finalize_v16_catalog() to service_role;

commit;

select * from public.category_review_overview_v16;
