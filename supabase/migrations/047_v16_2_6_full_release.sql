-- GeoStats v16.2.6: validated expansion, generator exposure governance,
-- public-launch hardening, comparability safeguards, and release reconciliation.
--
-- This migration is additive and rerunnable. It intentionally does not force new
-- source candidates playable: importers must first supply validated observations,
-- provenance, common-year/ranking metadata, and pass the shared runtime gates.

begin;

select pg_advisory_xact_lock(hashtext('geostats-v16.2.6-full-release'));

do $$
begin
  if to_regprocedure('public.apply_v16_2_5_catalog_curation()') is null
     or to_regclass('public.category_promotion_assessment_v16_2') is null then
    raise exception 'GeoStats v16.2.5 must be installed before v16.2.6.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Recovery / rollback snapshot. The first run wins so reruns do not overwrite
-- the original v16.2.5 state that rollback depends on.
-- ---------------------------------------------------------------------------
create table if not exists public.v16_2_6_category_state_backup (
  category_id text primary key,
  snapshot jsonb not null,
  backed_up_at timestamptz not null default now()
);

insert into public.v16_2_6_category_state_backup(category_id,snapshot)
select c.id,to_jsonb(c)
from public.stat_categories c
on conflict(category_id) do nothing;

revoke all on public.v16_2_6_category_state_backup from public,anon,authenticated;
grant all on public.v16_2_6_category_state_backup to service_role;

-- ---------------------------------------------------------------------------
-- Public-product / account scaffolding. Random is an internal QA tool. Account
-- entitlement exists only as lightweight future-proofing; no billing is added.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists entitlement text not null default 'free';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='profiles_entitlement_v16_2_6_check'
      and conrelid='public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_entitlement_v16_2_6_check
      check(entitlement in ('free','supporter','premium'));
  end if;
end $$;

create table if not exists public.internal_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  notes text
);
alter table public.internal_testers enable row level security;
revoke all on public.internal_testers from public,anon,authenticated;
grant all on public.internal_testers to service_role;

-- Public leaderboard/profile data are exposed only through validated server
-- routes. Clients retain access to their own row for account/score workflows.
drop policy if exists "profiles are publicly readable" on public.profiles;
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select using(auth.uid()=id);

drop policy if exists "scores are publicly readable" on public.daily_scores;
drop policy if exists "users read own scores" on public.daily_scores;
create policy "users read own scores" on public.daily_scores
  for select using(auth.uid()=user_id);

-- ---------------------------------------------------------------------------
-- Analytics: acquisition/returning fields are first-party only. Average Score
-- becomes Average % so Scout/Adventurer/Expert are comparable despite 400/400/600
-- maximums. Random/QA events are already rejected in the server route.
-- ---------------------------------------------------------------------------
alter table public.analytics_events
  add column if not exists referrer text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists visitor_state text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='analytics_events_visitor_state_v16_2_6_check'
      and conrelid='public.analytics_events'::regclass
  ) then
    alter table public.analytics_events
      add constraint analytics_events_visitor_state_v16_2_6_check
      check(visitor_state is null or visitor_state in ('new','returning'));
  end if;
end $$;

create index if not exists analytics_events_acquisition_v16_2_6_idx
  on public.analytics_events(created_at desc,visitor_state,utm_source,utm_medium,utm_campaign);

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
  count(distinct user_id) filter(where user_id is not null)::bigint as signed_in_users_seen
from public.analytics_events
where created_at>=now()-interval '30 days';

grant select on public.analytics_overview_30d to service_role;

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
  count(*) filter(where event_name='game_completed')::bigint as games_completed
from public.analytics_events
where created_at>=now()-interval '30 days'
group by 1,2,3,4,5;
grant select on public.analytics_acquisition_30d to service_role;

-- ---------------------------------------------------------------------------
-- Generator utilization: last 30 Daily dates, derived from immutable saved
-- board payloads. This measures actual exposure, separate from eligibility or
-- editorial priority.
-- ---------------------------------------------------------------------------
create or replace view public.daily_category_occurrences_30d_v16_2_6
with(security_invoker=true)
as
with recent_dates as (
  select distinct challenge_date
  from public.daily_challenges
  where challenge_date<=current_date and board_payload is not null
  order by challenge_date desc
  limit 30
)
select d.challenge_date,d.difficulty,
       item->'category'->>'id' as category_id,
       coalesce(item->'category'->>'name',item->'category'->>'title',item->'category'->>'id') as category_title
from public.daily_challenges d
join recent_dates x using(challenge_date)
cross join lateral jsonb_array_elements(coalesce(d.board_payload->'categories','[]'::jsonb)) item
where nullif(item->'category'->>'id','') is not null;
revoke all on public.daily_category_occurrences_30d_v16_2_6 from public,anon,authenticated;
grant select on public.daily_category_occurrences_30d_v16_2_6 to service_role;

create or replace view public.daily_category_exposure_summary_v16_2_6
with(security_invoker=true)
as
with occ as (
  select * from public.daily_category_occurrences_30d_v16_2_6
), per_category as (
  select category_id,max(category_title) as category_title,count(*)::integer as appearances,
         min(challenge_date) as first_date,max(challenge_date) as last_date
  from occ group by category_id
), dated as (
  select distinct category_id,challenge_date from occ
), gaps as (
  select category_id,(challenge_date-lag(challenge_date) over(partition by category_id order by challenge_date))::integer as gap_days
  from dated
), catalog as (
  select count(*)::integer as playable_catalog_size from public.category_runtime_review_v16_2 where computed_playable_v16_2
)
select
  (select count(distinct challenge_date)::integer from occ) as daily_dates,
  (select count(*)::integer from occ) as category_slots,
  (select count(*)::integer from per_category) as distinct_categories,
  catalog.playable_catalog_size,
  round(100.0*(select count(*) from per_category)/nullif(catalog.playable_catalog_size,0),1) as catalog_utilization_percent,
  (select count(*)::integer from per_category where appearances>=3) as categories_three_plus,
  (select max(appearances)::integer from per_category) as max_category_appearances,
  (select percentile_cont(0.5) within group(order by gap_days) from gaps where gap_days is not null) as median_repeat_interval_days
from catalog;
revoke all on public.daily_category_exposure_summary_v16_2_6 from public,anon,authenticated;
grant select on public.daily_category_exposure_summary_v16_2_6 to service_role;

create or replace view public.daily_category_exposure_top_v16_2_6
with(security_invoker=true)
as
select category_id,max(category_title) as category_title,count(*)::integer as appearances,
       min(challenge_date) as first_date,max(challenge_date) as last_date
from public.daily_category_occurrences_30d_v16_2_6
group by category_id
order by appearances desc,category_title
limit 30;
revoke all on public.daily_category_exposure_top_v16_2_6 from public,anon,authenticated;
grant select on public.daily_category_exposure_top_v16_2_6 to service_role;

create or replace view public.daily_country_occurrences_30d_v16_2_6
with(security_invoker=true)
as
with recent_dates as (
  select distinct challenge_date
  from public.daily_challenges
  where challenge_date<=current_date and board_payload is not null
  order by challenge_date desc
  limit 30
)
select d.challenge_date,d.difficulty,
       country->>'id' as country_id,
       coalesce(country->>'name',country->>'id') as country_name
from public.daily_challenges d
join recent_dates x using(challenge_date)
cross join lateral jsonb_array_elements(coalesce(d.board_payload->'bank','[]'::jsonb)) country
where nullif(country->>'id','') is not null;
revoke all on public.daily_country_occurrences_30d_v16_2_6 from public,anon,authenticated;
grant select on public.daily_country_occurrences_30d_v16_2_6 to service_role;

create or replace view public.daily_country_exposure_summary_v16_2_6
with(security_invoker=true)
as
with occ as (select * from public.daily_country_occurrences_30d_v16_2_6),
per_country as (
  select country_id,max(country_name) country_name,count(*)::integer appearances
  from occ group by country_id
), dated as (
  select distinct country_id,challenge_date from occ
), gaps as (
  select country_id,(challenge_date-lag(challenge_date) over(partition by country_id order by challenge_date))::integer gap_days
  from dated
)
select
  (select count(distinct challenge_date)::integer from occ) as daily_dates,
  (select count(*)::integer from occ) as country_slots,
  (select count(*)::integer from per_country) as distinct_countries,
  (select max(appearances)::integer from per_country) as max_country_appearances,
  (select percentile_cont(0.5) within group(order by gap_days) from gaps where gap_days is not null) as median_repeat_interval_days;
revoke all on public.daily_country_exposure_summary_v16_2_6 from public,anon,authenticated;
grant select on public.daily_country_exposure_summary_v16_2_6 to service_role;

-- ---------------------------------------------------------------------------
-- New source registry. These records authorize provenance names only; they do
-- not bypass source validation, country coverage, common-year, or ranking gates.
-- ---------------------------------------------------------------------------
insert into public.data_sources(id,name,description,status,display_order,metadata) values
  ('unwpp','United Nations Population Division','UN World Population Prospects 2024 demographic estimates.','active',90,'{"v16_2_6":"validated-expansion","validation_path":"statistical","manual_fill":false}'::jsonb),
  ('worldbankclimate','World Bank Climate Change Knowledge Portal','World Bank CCKP historical CRU climatology used for globally comparable climate rankings.','active',91,'{"v16_2_6":"validated-expansion","validation_path":"geospatial-derived","manual_fill":false}'::jsonb),
  ('imfweo','International Monetary Fund','IMF World Economic Outlook historical observations; projections are excluded from gameplay.','active',92,'{"v16_2_6":"validated-expansion","validation_path":"statistical","projections_playable":false}'::jsonb),
  ('unescoich','UNESCO','UNESCO Intangible Cultural Heritage lists and country participation.','active',93,'{"v16_2_6":"validated-expansion","validation_path":"statistical","manual_fill":false}'::jsonb),
  ('noaatsunami','NOAA National Centers for Environmental Information','NOAA/NCEI Global Historical Tsunami Database country event records.','active',94,'{"v16_2_6":"validated-expansion","validation_path":"historical","manual_fill":false}'::jsonb),
  ('aquastat','FAO AQUASTAT','FAO AQUASTAT water resources and withdrawal indicators.','active',95,'{"v16_2_6":"new-source-repair","validation_path":"statistical","manual_fill":false}'::jsonb),
  ('faofisheries','FAO Fisheries','FAO fisheries and aquaculture production statistics.','active',96,'{"v16_2_6":"new-source-repair","validation_path":"statistical","manual_fill":false}'::jsonb),
  ('usgsminerals','USGS Minerals','U.S. Geological Survey mineral commodity production statistics.','active',97,'{"v16_2_6":"validated-expansion","validation_path":"statistical","manual_fill":false}'::jsonb),
  ('whoghed','World Health Organization','WHO Global Health Expenditure Database official health-expenditure observations.','active',98,'{"v16_2_6":"new-source-repair","validation_path":"statistical","manual_fill":false}'::jsonb),
  ('undesamigrant','United Nations Population Division','UN DESA International Migrant Stock 2024 destination-country observations.','active',99,'{"v16_2_6":"new-source-repair","validation_path":"statistical","manual_fill":false}'::jsonb),
  ('wtoservices','World Trade Organization','WTO Trade in Commercial Services official country trade observations.','active',100,'{"v16_2_6":"new-source-repair","validation_path":"statistical","manual_fill":false}'::jsonb),
  ('untourismdirect','UN Tourism','Direct UN Tourism country tourism indicators used instead of the failed distributed World Bank path.','active',101,'{"v16_2_6":"new-source-repair","validation_path":"statistical","manual_fill":false}'::jsonb)
on conflict(id) do update set
  name=excluded.name,description=excluded.description,status=excluded.status,
  display_order=excluded.display_order,metadata=coalesce(public.data_sources.metadata,'{}'::jsonb)||excluded.metadata;

-- ---------------------------------------------------------------------------
-- Auditable curation decisions. This makes spreadsheet/editorial decisions part
-- of the release, rather than leaving them only in a local workbook.
-- ---------------------------------------------------------------------------
create table if not exists public.category_decisions_v16_2_6 (
  decision_key text primary key,
  source_indicator_code text,
  action text not null check(action in ('remove','rewrite','correct','retain','new_source_repair')),
  player_title text,
  reason text not null,
  updated_at timestamptz not null default now()
);
revoke all on public.category_decisions_v16_2_6 from public,anon,authenticated;
grant all on public.category_decisions_v16_2_6 to service_role;

insert into public.category_decisions_v16_2_6(decision_key,source_indicator_code,action,player_title,reason) values
  ('remove:industrial-co2-energy','EN.GHG.CO2.IC.MT.CE.AR5','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:industrial-co2-process','EN.GHG.CO2.IP.MT.CE.AR5','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:industrial-fgas','EN.GHG.FGAS.IP.MT.CE.AR5','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:fdi-in','BX.KLT.DINV.CD.WD','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:fdi-out','BM.KLT.DINV.CD.WD','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:ibrd-ida','DT.DOD.MWBG.CD','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:imf-repurchases','DT.TDS.DIMF.CD','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:other-financial-flows','DT.NFL.MOTH.CD','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:n2o-ag','EN.GHG.N2O.AG.MT.CE.AR5','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:n2o-industrial','EN.GHG.N2O.IP.MT.CE.AR5','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:n2o-waste','EN.GHG.N2O.WA.MT.CE.AR5','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:remittances-paid','BM.TRF.PWKR.CD.DT','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:remittances-received','BX.TRF.PWKR.CD.DT','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:personal-transfers','BX.TRF.PWKR.CD','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:secondary-income-receipts','BX.TRF.CURR.CD','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:secondary-income-payments','BM.TRF.PRVT.CD','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:short-term-debt-share','DT.DOD.DSTC.ZS','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:technical-cooperation','BX.GRT.TECH.CD.WD','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:reserves-minus-gold','FI.RES.XGLD.CD','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:imports-goods-services-primary-income','BM.GSR.TOTL.CD','remove',null,'Explicit v16.2.6 workbook removal.'),
  ('remove:changes-in-inventories','NE.GDI.STKB.CD','remove',null,'Requires specialist accounting interpretation; fails clarify-or-remove rule.'),
  ('remove:grants-ex-tech','BX.GRT.EXTA.CD.WD','remove',null,'Requires specialist balance-of-payments interpretation; fails clarify-or-remove rule.'),
  ('remove:net-capital-account','BN.TRF.KOGT.CD','remove',null,'Requires specialist balance-of-payments interpretation; fails clarify-or-remove rule.'),
  ('remove:errors-omissions','BN.KAC.EOMS.CD','remove',null,'Requires specialist balance-of-payments interpretation; fails clarify-or-remove rule.'),
  ('remove:net-financial-account','BN.FIN.TOTL.CD','remove',null,'Requires specialist balance-of-payments interpretation; fails clarify-or-remove rule.'),
  ('remove:bilateral-financial-flows','DT.NFL.BLAT.CD','remove',null,'Requires specialist financial-flow interpretation; fails clarify-or-remove rule.'),
  ('remove:portfolio-equity','BX.PEF.TOTL.CD.WD','remove',null,'Requires specialist portfolio-flow interpretation; fails clarify-or-remove rule.'),
  ('remove:portfolio-investment','BN.KLT.PTXL.CD','remove',null,'Requires specialist portfolio-flow interpretation; fails clarify-or-remove rule.'),
  ('remove:pv-external-debt','DT.DOD.PVLX.CD','remove',null,'Requires specialist debt-valuation interpretation; fails clarify-or-remove rule.'),
  ('remove:primary-income-payments','BM.GSR.FCTY.CD','remove',null,'Requires specialist balance-of-payments interpretation; fails clarify-or-remove rule.'),
  ('remove:primary-income-receipts','BX.GSR.FCTY.CD','remove',null,'Requires specialist balance-of-payments interpretation; fails clarify-or-remove rule.'),
  ('remove:reserves-related-items','BN.RES.INCL.CD','remove',null,'Requires specialist balance-of-payments interpretation; fails clarify-or-remove rule.'),
  ('correct:largest-city','EN.URB.LCTY','correct','Largest population in the largest city','EN.URB.LCTY is an absolute population measure, not a share.'),
  ('correct:arable-person','AG.LND.ARBL.HA.PC','correct','Most arable land per person','Indicator is hectares of arable land per person.'),
  ('correct:atm-adults','FB.ATM.TOTL.P5','correct','Most ATMs per 100,000 adults','Indicator denominator is 100,000 adults.'),
  ('correct:bank-branches-adults','FB.CBK.BRCH.P5','correct','Most bank branches per 100,000 adults','Indicator denominator is 100,000 adults.'),
  ('rewrite:new-businesses','IC.BUS.NREG','rewrite','Most newly registered businesses','Clarifies that new means newly registered during the reference year.'),
  ('rewrite:new-business-density','IC.BUS.NDNS.ZS','rewrite','Highest new-business density','New registrations per 1,000 working-age people.'),
  ('rewrite:total-reserves','FI.RES.TOTL.CD','rewrite','Largest total reserves including gold','Clarifies what total reserves include.'),
  ('rewrite:transport-export-share','BX.GSR.TRAN.ZS','rewrite','Highest transport share of service exports','Plain-language service-export composition.'),
  ('rewrite:transport-import-share','BM.GSR.TRAN.ZS','rewrite','Highest transport share of service imports','Plain-language service-import composition.'),
  ('rewrite:travel-export-share','BX.GSR.TRVL.ZS','rewrite','Highest travel share of service exports','Plain-language service-export composition.'),
  ('rewrite:travel-import-share','BM.GSR.TRVL.ZS','rewrite','Highest travel share of service imports','Plain-language service-import composition.'),
  ('rewrite:ict-service-exports','BX.GSR.CCIS.CD','rewrite','Largest information and communications technology service exports','Expands ICT for immediate comprehension.'),
  ('rewrite:ict-service-share','BX.GSR.CCIS.ZS','rewrite','Highest information and communications technology share of service exports','Expands ICT for immediate comprehension.'),
  ('rewrite:industry-water','ER.H2O.FWIN.ZS','rewrite','Largest industrial share of freshwater withdrawals','States the denominator explicitly.'),
  ('rewrite:urban-million','EN.URB.MCTY','rewrite','Largest population in urban areas over 1 million','Plain-language definition of the World Bank urban-agglomeration measure.'),
  ('rewrite:natural-gas-export-dash','2711','rewrite','Largest natural gas exports','Workbook note meant remove the dash, not remove the category.'),
  ('rewrite:natural-gas-electricity-dash','EG.ELC.NGAS.ZS','rewrite','Largest natural gas share of electricity generation','Workbook note meant remove the dash, not remove the category.'),
  ('rewrite:olive-oil-dash','1509','rewrite','Largest olive oil exports','Workbook note meant remove the dash, not remove the category.'),
  ('repair:gross-capital-formation','NE.GDI.TOTL.CN','new_source_repair','Highest gross capital formation','Concept is retained, but current-local-currency values are not cross-country comparable; requires a comparable source/series.')
on conflict(decision_key) do update set
  source_indicator_code=excluded.source_indicator_code,action=excluded.action,
  player_title=excluded.player_title,reason=excluded.reason,updated_at=now();

-- ---------------------------------------------------------------------------
-- Hard correctness gate. This remains authoritative even if an importer or
-- editorial status accidentally attempts to re-enable a blocked row later.
-- ---------------------------------------------------------------------------
create or replace function public.category_v16_2_6_hard_block_reason(
  p_category_id text,
  p_source_organization text,
  p_source_indicator_code text,
  p_effective_title text,
  p_metadata jsonb
)
returns text
language sql
stable
set search_path=public
as $$
  select case
    when p_source_organization='World Bank'
      and coalesce(p_source_indicator_code,'') ~ '\\.(CN|KN)$'
      then 'Cross-country absolute values in local currency are not comparable.'
    when coalesce(p_source_indicator_code,'') in (
      'EN.GHG.CO2.IC.MT.CE.AR5','EN.GHG.CO2.IP.MT.CE.AR5','EN.GHG.FGAS.IP.MT.CE.AR5',
      'BX.KLT.DINV.CD.WD','BM.KLT.DINV.CD.WD','DT.DOD.MWBG.CD','DT.TDS.DIMF.CD','DT.NFL.MOTH.CD',
      'EN.GHG.N2O.AG.MT.CE.AR5','EN.GHG.N2O.IP.MT.CE.AR5','EN.GHG.N2O.WA.MT.CE.AR5',
      'BM.TRF.PWKR.CD.DT','BX.TRF.PWKR.CD.DT','BX.TRF.PWKR.CD','BX.TRF.CURR.CD','BM.TRF.PRVT.CD',
      'DT.DOD.DSTC.ZS','BX.GRT.TECH.CD.WD','FI.RES.XGLD.CD','BM.GSR.TOTL.CD',
      'NE.GDI.STKB.CD','BX.GRT.EXTA.CD.WD','BN.TRF.KOGT.CD','BN.KAC.EOMS.CD','BN.FIN.TOTL.CD',
      'DT.NFL.BLAT.CD','BX.PEF.TOTL.CD.WD','BN.KLT.PTXL.CD','DT.DOD.PVLX.CD','BM.GSR.FCTY.CD',
      'BX.GSR.FCTY.CD','BN.RES.INCL.CD'
    ) then 'v16.2.6 editorial decision: removed from future generation.'
    when coalesce((p_metadata->>'v16_2_6_same_source_retry')::boolean,false)
      and nullif(trim(coalesce(p_metadata->>'v16_2_6_repair_evidence','')),'') is null
      then 'Previously rejected source/method retry has no documented changed blocker or methodology.'
    when p_category_id='history:newest-current-constitution'
      then 'Known historical integrity issue remains fail-closed pending a validated chronology.'
    else null
  end
$$;
revoke all on function public.category_v16_2_6_hard_block_reason(text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.category_v16_2_6_hard_block_reason(text,text,text,text,jsonb) to service_role;

create or replace function public.apply_v16_2_6_catalog_curation()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.apply_v16_2_5_catalog_curation();

  -- Explicit removals and clarity failures are future-generation exclusions.
  update public.stat_categories c
  set review_status='rejected',curation_status='excluded',content_review_status='excluded',
      curation_reason='v16.2.6: '||d.reason,
      content_review_reason='v16.2.6: removed from future generation after full workbook/copy review.',
      enabled=false,eligible_daily=false,updated_at=now()
  from public.category_decisions_v16_2_6 d
  where d.action='remove' and d.source_indicator_code=c.source_indicator_code;

  update public.category_review_state r
  set status='rejected',confusing=false,esoteric=false,subjective_or_composite=false,
      notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.6: '||d.reason),updated_at=now()
  from public.stat_categories c
  join public.category_decisions_v16_2_6 d on d.source_indicator_code=c.source_indicator_code and d.action='remove'
  where r.category_id=c.id;

  -- Clear, ordinary-language copy rewrites.
  update public.stat_categories c
  set title=d.player_title,
      short_title=d.player_title,
      updated_at=now()
  from public.category_decisions_v16_2_6 d
  where d.action='rewrite' and d.player_title is not null
    and d.source_indicator_code=c.source_indicator_code;

  update public.category_review_state r
  set recommended_title=d.player_title,
      notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.6 copy review: '||d.reason),updated_at=now()
  from public.stat_categories c
  join public.category_decisions_v16_2_6 d on d.source_indicator_code=c.source_indicator_code and d.action='rewrite'
  where r.category_id=c.id;

  -- Semantic corrections identified by the deep comparability audit.
  update public.stat_categories
  set title='Largest population in the largest city',short_title='Largest-city population',
      description='Population living in each country''s largest urban area.',
      plain_language_description='Population living in each country''s largest urban area.',
      measurement_type='total',value_type='total',updated_at=now()
  where source_organization='World Bank' and source_indicator_code='EN.URB.LCTY';

  update public.category_review_state r
  set recommended_title='Largest population in the largest city',
      notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.6 correctness fix: EN.URB.LCTY is absolute population, not a percentage share.'),updated_at=now()
  from public.stat_categories c
  where r.category_id=c.id and c.source_organization='World Bank' and c.source_indicator_code='EN.URB.LCTY';

  update public.stat_categories
  set title='Most arable land per person',short_title='Arable land per person',
      measurement_type='per_capita',updated_at=now()
  where source_organization='World Bank' and source_indicator_code='AG.LND.ARBL.HA.PC';

  update public.stat_categories
  set title='Most ATMs per 100,000 adults',short_title='ATMs per 100,000 adults',
      measurement_type='per_capita',updated_at=now()
  where source_organization='World Bank' and source_indicator_code='FB.ATM.TOTL.P5';

  update public.stat_categories
  set title='Most bank branches per 100,000 adults',short_title='Bank branches per 100,000 adults',
      measurement_type='per_capita',updated_at=now()
  where source_organization='World Bank' and source_indicator_code='FB.CBK.BRCH.P5';

  update public.stat_categories
  set title='Highest share of urban population living in the largest city',
      short_title='Largest-city share of urban population',measurement_type='share',updated_at=now()
  where source_organization='World Bank' and source_indicator_code='EN.URB.LCTY.UR.ZS';

  -- Define ambiguous but useful concepts in plain language where the underlying
  -- measure is defensible.
  update public.stat_categories
  set plain_language_description='People who are not considered a national by any country under the operation of its law.',
      description='People residing in the country who are not considered a national by any country under the operation of its law.',updated_at=now()
  where lower(coalesce(source_indicator_code,''))='population:coa:stateless'
     or lower(title) like '%stateless population%';

  update public.stat_categories
  set title='Highest GDP per unit of energy used',short_title='GDP per unit of energy',
      plain_language_description='Economic output per unit of energy used, adjusted for purchasing power.',
      description='GDP per kilogram of oil equivalent of energy use, adjusted for purchasing power parity.',
      unit_explanation='Purchasing-power-adjusted GDP per kilogram of oil equivalent of energy use.',updated_at=now()
  where source_organization='World Bank' and source_indicator_code='EG.GDP.PUSE.KO.PP';

  update public.stat_categories
  set plain_language_description='Pew Research Center’s “other religions” group combines religions outside Christianity, Islam, Hinduism, Buddhism and Judaism; religiously unaffiliated people are counted separately.',
      description='Estimated 2020 population following religions that Pew groups as “other religions”; religiously unaffiliated people are a separate category.',updated_at=now()
  where source_indicator_code in ('PEW_RELIGION_2020_OTHER_RELIGIONS_POPULATION','PEW_RELIGION_2020_OTHER_RELIGIONS_SHARE')
     or lower(title) like '%other religion%';

  -- World Heritage remains a good concept, but it may not be simultaneously
  -- playable and unable-to-verify. Preserve the concept and fail closed until
  -- the official WHC audit is verified.
  update public.stat_categories
  set curation_status='approved',content_review_status='approved',
      curation_reason=case when validation_status in ('verified','verified_with_warnings')
        then 'v16.2.6: World Heritage concept retained; official WHC audit verified.'
        else 'v16.2.6: World Heritage concept retained but fail-closed until the official WHC audit verifies the source query.' end,
      enabled=case when validation_status in ('verified','verified_with_warnings') then enabled else false end,
      eligible_daily=case when validation_status in ('verified','verified_with_warnings') then eligible_daily else false end,
      updated_at=now()
  where source_indicator_code='WHC:all-sites' or id='WHC:all-sites';

  -- The local-currency gross-capital-formation concept stays wanted, but this
  -- specific World Bank series is blocked until a comparable replacement is imported.
  update public.stat_categories
  set review_status='approved',curation_status='approved',content_review_status='approved',
      curation_reason='v16.2.6: concept retained for new-source repair; this local-currency series remains hard-blocked.',
      enabled=false,eligible_daily=false,updated_at=now()
  where source_organization='World Bank' and source_indicator_code='NE.GDI.TOTL.CN';

  -- Every playable/approved legacy row receives explicit player-quality scores.
  -- Existing reviewed scores win; missing values are deterministically reconciled
  -- from the older understandability/fun/specificity dimensions.
  update public.stat_categories
  set immediate_comprehension_score=coalesce(
        immediate_comprehension_score,
        least(100,greatest(80,coalesce(understandability_score,recognizability_score,85)))::smallint),
      gameplay_interest_score=coalesce(
        gameplay_interest_score,
        least(100,greatest(65,coalesce(fun_score,specificity_score,78)))::smallint),
      uniqueness_score=coalesce(
        uniqueness_score,
        least(100,greatest(65,coalesce(specificity_score,75)))::smallint),
      updated_at=now()
  where review_status='approved' or curation_status='approved' or enabled=true or eligible_daily=true;
end;
$$;
revoke all on function public.apply_v16_2_6_catalog_curation() from public,anon,authenticated;
grant execute on function public.apply_v16_2_6_catalog_curation() to service_role;

-- Runtime playability now includes the v16.2.6 hard correctness gate without
-- changing the column layout expected by downstream Workbench views.
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
  (
    a.proposed_status='playable'
    and v.editorial_status='approved'
    and a.strict_pass
    and public.category_v16_2_6_hard_block_reason(c.id,c.source_organization,c.source_indicator_code,v.effective_title,c.metadata) is null
  ) as computed_playable_v16_2,
  array_remove(array[
    case when a.proposed_status<>'playable' then a.primary_blocker end,
    public.category_v16_2_6_hard_block_reason(c.id,c.source_organization,c.source_indicator_code,v.effective_title,c.metadata)
  ],null) as v16_2_blockers,
  array_remove(array[
    case when v.validation_status<>'verified'
      and not public.category_v15_true_integrity_failure(
        v.validation_status,v.validation_reason,
        v.validation_mismatch_count,v.validation_ranking_mismatch_count
      ) then 'Official values are usable; non-data source metadata remain incomplete.' end,
    case when v.ranking_completeness_status='top_end_complete' then 'Ranking is top-end complete rather than fully comprehensive.' end,
    case when v.player_source_status='general' then 'Uses a general official source page rather than an exact shareable view.' end
  ],null) as v16_2_warnings,
  c.measurement_type
from public.category_runtime_review_v16 v
join public.category_promotion_assessment_v16_2 a on a.category_id=v.id
join public.stat_categories c on c.id=v.id;
revoke all on public.category_runtime_review_v16_2 from public,anon,authenticated;
grant select on public.category_runtime_review_v16_2 to service_role;

-- Recreate Workbench because the runtime view is authoritative and CREATE OR
-- REPLACE must preserve its expanded positional layout.
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
left join public.category_auto_vetting_v16 vetting on vetting.category_id=runtime.id;
revoke all on public.category_review_workbench_v16_2 from public,anon,authenticated;
grant select on public.category_review_workbench_v16_2 to service_role;

create or replace function public.assert_v16_2_6_release()
returns table(
  proposed_playable integer,
  hard_blocked_playable integer,
  local_currency_playable integer,
  missing_player_quality integer,
  daily_random_mismatches integer,
  private_profile_policy boolean,
  private_score_policy boolean
)
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
declare
  playable_count integer;
  blocked_playable integer;
  lcu_playable integer;
  missing_quality integer;
  mismatch_count integer;
  profile_public boolean;
  score_public boolean;
begin
  select count(*)::integer into playable_count
  from public.category_runtime_review_v16_2 where computed_playable_v16_2;

  select count(*)::integer into blocked_playable
  from public.category_runtime_review_v16_2 r
  join public.stat_categories c on c.id=r.id
  where r.computed_playable_v16_2
    and public.category_v16_2_6_hard_block_reason(c.id,c.source_organization,c.source_indicator_code,r.effective_title,c.metadata) is not null;

  select count(*)::integer into lcu_playable
  from public.category_runtime_review_v16_2 r
  join public.stat_categories c on c.id=r.id
  where r.computed_playable_v16_2 and c.source_organization='World Bank'
    and coalesce(c.source_indicator_code,'') ~ '\\.(CN|KN)$';

  select count(*)::integer into missing_quality
  from public.category_runtime_review_v16_2 r
  join public.stat_categories c on c.id=r.id
  where r.computed_playable_v16_2
    and (c.immediate_comprehension_score is null or c.gameplay_interest_score is null or c.uniqueness_score is null);

  select coalesce(consistency.daily_random_mismatches,0)::integer into mismatch_count
  from public.category_catalog_consistency_v16_2 consistency;

  select exists(
    select 1 from pg_policies where schemaname='public' and tablename='profiles'
      and cmd='SELECT' and coalesce(qual,'')='true'
  ) into profile_public;
  select exists(
    select 1 from pg_policies where schemaname='public' and tablename='daily_scores'
      and cmd='SELECT' and coalesce(qual,'')='true'
  ) into score_public;

  if playable_count<240 then raise exception 'v16.2.6 publication blocked: only % categories pass the shared gameplay gate.',playable_count; end if;
  if blocked_playable<>0 then raise exception 'v16.2.6 publication blocked: % hard-blocked categories remain playable.',blocked_playable; end if;
  if lcu_playable<>0 then raise exception 'v16.2.6 publication blocked: % World Bank local-currency rows remain playable.',lcu_playable; end if;
  if missing_quality<>0 then raise exception 'v16.2.6 publication blocked: % playable categories lack player-quality scoring.',missing_quality; end if;
  if mismatch_count<>0 then raise exception 'v16.2.6 publication blocked: % catalog flag mismatches exist.',mismatch_count; end if;
  if profile_public then raise exception 'v16.2.6 publication blocked: profiles still have an unrestricted public SELECT policy.'; end if;
  if score_public then raise exception 'v16.2.6 publication blocked: scores still have an unrestricted public SELECT policy.'; end if;

  return query select playable_count,blocked_playable,lcu_playable,missing_quality,mismatch_count,not profile_public,not score_public;
end;
$$;
revoke all on function public.assert_v16_2_6_release() from public,anon,authenticated;
grant execute on function public.assert_v16_2_6_release() to service_role;

create or replace function public.refresh_v16_2_runtime_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='240s'
as $$
begin
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_6_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  -- Restore the explicit v16.2.6 measurement corrections after the generic
  -- measurement pass, which was built before these errors were identified.
  update public.stat_categories set measurement_type='total',updated_at=now()
    where source_organization='World Bank' and source_indicator_code='EN.URB.LCTY';
  update public.stat_categories set measurement_type='per_capita',updated_at=now()
    where source_organization='World Bank' and source_indicator_code in ('AG.LND.ARBL.HA.PC','FB.ATM.TOTL.P5','FB.CBK.BRCH.P5');
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  update public.stat_categories c
  set enabled=v.computed_playable_v16_2,eligible_daily=v.computed_playable_v16_2,updated_at=now()
  from public.category_runtime_review_v16_2 v where v.id=c.id;
  perform public.assert_v16_2_6_release();
end;
$$;
revoke all on function public.refresh_v16_2_runtime_catalog() from public,anon,authenticated;
grant execute on function public.refresh_v16_2_runtime_catalog() to service_role;

create or replace function public.finalize_v16_2_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='360s'
as $$
begin
  perform pg_advisory_xact_lock(hashtext('geostats-v16.2.6-finalize-catalog'));
  perform public.apply_v16_1_copy_corrections();
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_6_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  update public.stat_categories set measurement_type='total',updated_at=now()
    where source_organization='World Bank' and source_indicator_code='EN.URB.LCTY';
  update public.stat_categories set measurement_type='per_capita',updated_at=now()
    where source_organization='World Bank' and source_indicator_code in ('AG.LND.ARBL.HA.PC','FB.ATM.TOTL.P5','FB.CBK.BRCH.P5');
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.apply_conservative_promotions_v16_2();
  perform public.refresh_v16_2_runtime_catalog();
end;
$$;
revoke all on function public.finalize_v16_2_catalog() from public,anon,authenticated;
grant execute on function public.finalize_v16_2_catalog() to service_role;

-- Seed curation now; new source imports remain fail-closed until their own
-- validation workflows run and refresh the runtime catalog.
select public.apply_v16_2_6_catalog_curation();
select public.refresh_measurement_types_v16_2_2();
update public.stat_categories set measurement_type='total',updated_at=now()
  where source_organization='World Bank' and source_indicator_code='EN.URB.LCTY';
update public.stat_categories set measurement_type='per_capita',updated_at=now()
  where source_organization='World Bank' and source_indicator_code in ('AG.LND.ARBL.HA.PC','FB.ATM.TOTL.P5','FB.CBK.BRCH.P5');
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

commit;
