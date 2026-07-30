-- GeoStats v15.8.1: expansion intake, corrected FAOSTAT livestock policy, and review tooling
-- Prerequisite: v15.7 fixed installer completed successfully.
-- Safe to rerun. New source candidates remain pending until manually approved.

begin;
select pg_advisory_xact_lock(hashtext('geostats-v15.8.1-expansion-intake'));

do $$
begin
  if to_regclass('public.category_review_queue_v15') is null then
    raise exception 'v15.8 stopped: category_review_queue_v15 is missing.';
  end if;
  if to_regprocedure('public.reconcile_category_playability_v15()') is null then
    raise exception 'v15.8 stopped: reconcile_category_playability_v15() is missing.';
  end if;
end $$;

create table if not exists public.v15_8_category_backup (
  category_id text primary key,
  category_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v15_8_category_backup(category_id, category_state)
select id, to_jsonb(category) from public.stat_categories category
on conflict (category_id) do nothing;

create table if not exists public.v15_8_review_backup (
  category_id text primary key,
  review_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v15_8_review_backup(category_id, review_state)
select category_id, to_jsonb(review) from public.category_review_state review
on conflict (category_id) do nothing;

create table if not exists public.v15_8_editorial_backup (
  category_id text primary key,
  editorial_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v15_8_editorial_backup(category_id, editorial_state)
select category_id, to_jsonb(editorial) from public.category_catalog_editorial_v15_6 editorial
on conflict (category_id) do nothing;

create table if not exists public.v15_8_source_backup (
  source_id text primary key,
  existed_before boolean not null,
  source_state jsonb,
  captured_at timestamptz not null default now()
);
insert into public.v15_8_source_backup(source_id, existed_before, source_state)
select requested.source_id,
       source.id is not null,
       case when source.id is null then null else to_jsonb(source) end
from (values
  ('unescoheritage'::text),
  ('aquastat'::text),
  ('usgsminerals'::text),
  ('faofisheries'::text)
) requested(source_id)
left join public.data_sources source on source.id=requested.source_id
on conflict(source_id) do nothing;

-- Register the prepared source intakes. Registration does not make categories playable.
insert into public.data_sources(id,name,status,description,display_order,metadata,created_at,updated_at)
values
 ('unescoheritage','UNESCO World Heritage Centre','active','Country counts of inscribed World Heritage properties.',42,'{"v15_8":"importer-ready","manual_review_required":true}'::jsonb,now(),now()),
 ('aquastat','FAO AQUASTAT','active','Curated water-resource, water-use and irrigation measures.',43,'{"v15_8":"importer-ready","manual_review_required":true}'::jsonb,now(),now()),
 ('usgsminerals','USGS Minerals','active','Familiar total mine-production categories only.',44,'{"v15_8":"importer-ready","manual_review_required":true}'::jsonb,now(),now()),
 ('faofisheries','FAO Fisheries','active','Capture and aquaculture production totals.',45,'{"v15_8":"importer-ready","manual_review_required":true}'::jsonb,now(),now())
on conflict (id) do update set
 status=excluded.status, description=excluded.description,
 metadata=coalesce(public.data_sources.metadata,'{}'::jsonb)||excluded.metadata,
 updated_at=now();

-- Human-readable official fallback pages for new sources.
create or replace function public.general_official_source_page_v15(p_source_organization text)
returns text language sql immutable as $$
  select case lower(coalesce(p_source_organization,''))
    when 'world bank' then 'https://data.worldbank.org/indicator/'
    when 'faostat' then 'https://www.fao.org/faostat/en/'
    when 'who' then 'https://www.who.int/data/gho/data'
    when 'unesco uis' then 'https://databrowser.uis.unesco.org/'
    when 'ilostat' then 'https://ilostat.ilo.org/data/'
    when 'natural earth' then 'https://www.naturalearthdata.com/'
    when 'un comtrade' then 'https://comtradeplus.un.org/'
    when 'u.s. eia' then 'https://www.eia.gov/international/data/world'
    when 'unhcr' then 'https://www.unhcr.org/refugee-statistics/'
    when 'un tourism' then 'https://www.unwto.org/tourism-statistics'
    when 'pew research center' then 'https://www.pewresearch.org/religion/feature/religious-composition-by-country-2010-2020/'
    when 'smithsonian gvp' then 'https://volcano.si.edu/volcanolist_holocene.cfm'
    when 'usgs' then 'https://earthquake.usgs.gov/earthquakes/search/'
    when 'esa worldcover' then 'https://esa-worldcover.org/en/data-access'
    when 'hydrosheds' then 'https://www.hydrosheds.org/products'
    when 'global elevation' then 'https://www.gebco.net/data-products-gridded-bathymetry-data'
    when 'unesco world heritage centre' then 'https://whc.unesco.org/en/list/'
    when 'fao aquastat' then 'https://www.fao.org/aquastat/en/databases/maindatabase/'
    when 'usgs minerals' then 'https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries'
    when 'fao fisheries' then 'https://www.fao.org/statistics/data-collection/fishery-and-aquaculture/en'
    else null
  end
$$;

-- Correct the percentage-based largest-city concept.
update public.stat_categories
set title='Highest share living in largest city',
    short_title='Share living in largest city',
    description='Percentage of the country’s population living in its largest urban area.',
    plain_language_description='Percentage of the country’s population living in its largest urban area.',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'boardDescription','Percentage living in the country’s largest urban area.',
      'officialSourceTitleV15_8',coalesce(metadata->>'officialSourceTitleV15_8',title)
    ),
    updated_at=now()
where source_indicator_code='EN.URB.LCTY';

-- Correct FAOSTAT policy: keep total production and clear livestock-population totals.
create table if not exists public.v15_8_faostat_policy_decisions (
 category_id text primary key references public.stat_categories(id) on delete cascade,
 decision text not null check(decision in('keep-production','keep-livestock-population','retire-yield-or-productivity','review')),
 reason text not null,
 assessed_at timestamptz not null default now()
);

insert into public.v15_8_faostat_policy_decisions(category_id,decision,reason)
select category.id,
 case
  when category.source_indicator_code ~ ':55(10|13)$' then 'keep-production'
  when category.source_indicator_code ~ ':5111$'
   and lower(concat_ws(' ',category.title,category.description,category.technical_definition,category.unit)) ~ '(horse|cattle|buffalo|sheep|goat|pig|swine|chicken|poultry|duck|turkey|camel|rabbit|livestock|animal|beehive)'
   and lower(coalesce(category.unit,'')) ~ '(head|number|animal|beehive)' then 'keep-livestock-population'
  when lower(concat_ws(' ',category.title,category.description,category.technical_definition,category.unit)) ~ '(yield|kg/ha|tonnes?/ha|per hectare|area harvested|harvested area|carcass|slaughter|per animal|output per animal|producing animals|milk animals|laying hens?)' then 'retire-yield-or-productivity'
  else 'review'
 end,
 case
  when category.source_indicator_code ~ ':55(10|13)$' then 'Clear national production total.'
  when category.source_indicator_code ~ ':5111$' then 'Clear national livestock-population total.'
  else 'FAOSTAT measure requires or fails the yield/productivity policy review.'
 end
from public.stat_categories category
where category.source_organization='FAOSTAT'
on conflict(category_id) do update set decision=excluded.decision,reason=excluded.reason,assessed_at=now();

-- Restore only intuitive livestock-population categories that the overly broad
-- v15.7 production-only migration itself retired. Do not override an unrelated
-- human rejection, and do not re-approve every production category wholesale.
update public.category_review_state review
set status='approved', political_self_reported=false, confusing=false, esoteric=false,
 subjective_or_composite=false, stale_data=false, poor_coverage=false, duplicate_of=null,
 notes=concat_ws(E'\n',nullif(review.notes,''),'v15.8: restored after the v15.7 blanket FAOSTAT rule; clear livestock-population total.'),
 reviewed_at=coalesce(review.reviewed_at,now()), updated_at=now()
where review.category_id in (
 select decision.category_id
 from public.v15_8_faostat_policy_decisions decision
 join public.v15_7_faostat_nonproduction_decisions prior
   on prior.category_id=decision.category_id
 where decision.decision='keep-livestock-population'
)
and coalesce(review.notes,'') like '%v15.7 production-only policy%';

update public.category_catalog_editorial_v15_6 editorial
set editorial_outcome='daily', preferred_category_id=null,
 decision_reason='Restored after the v15.7 blanket FAOSTAT rule as a clear livestock-population total.',
 decision_source='v15.8 FAOSTAT concept policy', reviewed_at=now()
where editorial.category_id in (
 select decision.category_id
 from public.v15_8_faostat_policy_decisions decision
 join public.v15_7_faostat_nonproduction_decisions prior
   on prior.category_id=decision.category_id
 where decision.decision='keep-livestock-population'
)
and editorial.decision_source='v15.7 production-only policy';

update public.stat_categories category
set metadata=(coalesce(category.metadata,'{}'::jsonb)-'faostatProductionOnlyV15_7')||jsonb_build_object(
 'faostatPolicyV15_8',decision.decision,
 'boardDescription',case when decision.decision='keep-livestock-population'
  then 'Total national population of this livestock species.'
  else coalesce(category.metadata->>'boardDescription',category.plain_language_description,category.description) end
), updated_at=now()
from public.v15_8_faostat_policy_decisions decision
where category.id=decision.category_id
and decision.decision in('keep-production','keep-livestock-population');

-- Retire yield/productivity categories, but do not retire intuitive livestock totals.
update public.category_review_state review
set status='rejected', duplicate_of=null,
 notes=concat_ws(E'\n',nullif(review.notes,''),'v15.8: yield, per-area, per-animal, slaughter, carcass or productivity measure excluded.'),
 updated_at=now()
where review.category_id in (
 select category_id from public.v15_8_faostat_policy_decisions where decision='retire-yield-or-productivity'
);
update public.category_catalog_editorial_v15_6 editorial
set editorial_outcome='retired',preferred_category_id=null,
 decision_reason='Yield/productivity/input category excluded; clear national totals remain eligible.',
 decision_source='v15.8 FAOSTAT concept policy',reviewed_at=now()
where editorial.category_id in (
 select category_id from public.v15_8_faostat_policy_decisions where decision='retire-yield-or-productivity'
);
update public.stat_categories category
set enabled=false,eligible_daily=false,
 metadata=coalesce(category.metadata,'{}'::jsonb)||jsonb_build_object('catalogTier','quarantined','faostatPolicyV15_8','retire-yield-or-productivity'),
 updated_at=now()
where category.id in (
 select category_id from public.v15_8_faostat_policy_decisions where decision='retire-yield-or-productivity'
);

-- Remove restored livestock totals from the earlier overbroad decision ledger when present.
delete from public.v15_7_faostat_nonproduction_decisions
where category_id in (
 select category_id from public.v15_8_faostat_policy_decisions where decision='keep-livestock-population'
);

-- Automated vetting stores recommendations only. It never activates a category.
create table if not exists public.category_auto_vetting_v15_8 (
 category_id text primary key references public.stat_categories(id) on delete cascade,
 recommendation text not null check(recommendation in('approve','rewrite','duplicate','quarantine_data','retire')),
 vetting_score integer not null check(vetting_score between 0 and 100),
 reason text not null,
 possible_duplicate_of text references public.stat_categories(id) on delete set null,
 title_similarity double precision,
 rank_correlation double precision,
 coverage integer,
 tie_share double precision,
 vetting_version text not null,
 vetted_at timestamptz not null default now()
);
create index if not exists category_auto_vetting_v15_8_rec_idx on public.category_auto_vetting_v15_8(recommendation,vetting_score desc);
alter table public.category_auto_vetting_v15_8 enable row level security;
revoke all on public.category_auto_vetting_v15_8 from public,anon,authenticated;
grant all on public.category_auto_vetting_v15_8 to service_role;

create or replace view public.category_review_workbench_v15_8
with(security_invoker=true) as
select queue.*,
 vetting.recommendation as auto_vetting_recommendation,
 vetting.vetting_score as auto_vetting_score,
 vetting.reason as auto_vetting_reason,
 vetting.possible_duplicate_of as auto_possible_duplicate_of,
 vetting.title_similarity as auto_title_similarity,
 vetting.rank_correlation as auto_rank_correlation,
 vetting.tie_share as auto_tie_share,
 vetting.vetting_version as auto_vetting_version,
 vetting.vetted_at as auto_vetted_at
from public.category_review_queue_v15 queue
left join public.category_auto_vetting_v15_8 vetting on vetting.category_id=queue.id;
revoke all on public.category_review_workbench_v15_8 from public,anon,authenticated;
grant select on public.category_review_workbench_v15_8 to service_role;

-- All imported expansion candidates remain pending even if numerical governance passes.
update public.category_review_state review
set status='pending',reviewed_at=null,reviewed_by=null,
 notes=concat_ws(E'\n',nullif(review.notes,''),'v15.8 expansion candidate: automated vetting and manual approval required.'),updated_at=now()
from public.stat_categories category
where review.category_id=category.id
and category.source_organization in(
 'Pew Research Center','Smithsonian GVP','USGS','ESA WorldCover','HydroSHEDS','Global Elevation',
 'UNESCO World Heritage Centre','FAO AQUASTAT','USGS Minerals','FAO Fisheries'
)
and category.metadata->>'manualApprovedV15_8' is distinct from 'true';


-- ---------------------------------------------------------------------------
-- v15.8.1 correction: FAOSTAT official unit An means animals.
-- ---------------------------------------------------------------------------
-- FAOSTAT QCL uses the official unit abbreviation "An" for animal counts.
-- Element 5111 is Stocks: a total live-animal population, not a yield.
update public.v15_8_faostat_policy_decisions decision
set
  decision = 'keep-livestock-population',
  reason = 'Clear national live-animal population total. FAOSTAT unit An means animals.',
  assessed_at = now()
from public.stat_categories category
where category.id = decision.category_id
  and category.source_organization = 'FAOSTAT'
  and category.source_indicator_code ~ ':5111$';

-- Restore individual-species categories that were rejected only by v15.7.
update public.category_review_state review
set
  status = 'approved',
  recommended_title = case
    when category.source_indicator_code ~ '02132:5111$' then 'Largest donkey population'
    when category.source_indicator_code ~ '02112:5111$' then 'Largest buffalo population'
    when category.source_indicator_code ~ '02121[.]01:5111$' then 'Largest camel population'
    when category.source_indicator_code ~ '02111:5111$' then 'Largest cattle population'
    when category.source_indicator_code ~ '02123:5111$' then 'Largest goat population'
    when category.source_indicator_code ~ '02131:5111$' then 'Largest horse population'
    when category.source_indicator_code ~ '02133:5111$' then 'Largest mule and hinny population'
    when category.source_indicator_code ~ '02140:5111$' then 'Largest pig population'
    when category.source_indicator_code ~ '02122:5111$' then 'Largest sheep population'
    else coalesce(review.recommended_title, category.title)
  end,
  political_self_reported = false,
  confusing = false,
  esoteric = false,
  subjective_or_composite = false,
  stale_data = false,
  poor_coverage = false,
  duplicate_of = null,
  notes = concat_ws(
    E'\n',
    nullif(review.notes, ''),
    'v15.8.1: restored as a clear live-animal population total; FAOSTAT unit An means animals.'
  ),
  reviewed_at = coalesce(review.reviewed_at, now()),
  updated_at = now()
from public.stat_categories category
where review.category_id = category.id
  and category.source_organization = 'FAOSTAT'
  and category.source_indicator_code ~ ':5111$'
  and category.source_indicator_code !~ '(F1746|F1749):5111$'
  and review.status = 'rejected'
  and coalesce(review.notes, '') like '%v15.7 production-only policy%';

-- Combined aggregates overlap with the individual categories. Preserve them for
-- manual review rather than retiring or automatically activating them.
update public.category_review_state review
set
  status = 'needs_rewrite',
  recommended_title = case
    when category.source_indicator_code ~ 'F1746:5111$' then 'Largest combined cattle and buffalo population'
    when category.source_indicator_code ~ 'F1749:5111$' then 'Largest combined sheep and goat population'
    else coalesce(review.recommended_title, category.title)
  end,
  duplicate_of = null,
  notes = concat_ws(
    E'\n',
    nullif(review.notes, ''),
    'v15.8.1: restored from blanket rejection but held for manual overlap review.'
  ),
  updated_at = now()
from public.stat_categories category
where review.category_id = category.id
  and category.source_organization = 'FAOSTAT'
  and category.source_indicator_code ~ '(F1746|F1749):5111$'
  and review.status = 'rejected'
  and coalesce(review.notes, '') like '%v15.7 production-only policy%';

update public.category_catalog_editorial_v15_6 editorial
set
  editorial_outcome = case
    when category.source_indicator_code ~ '(F1746|F1749):5111$' then 'rewrite'
    else 'daily'
  end,
  preferred_category_id = null,
  decision_reason = case
    when category.source_indicator_code ~ '(F1746|F1749):5111$'
      then 'Live-animal population total retained for manual overlap review.'
    else 'Clear live-animal population total restored after the v15.7 blanket FAOSTAT rule.'
  end,
  decision_source = 'v15.8.1 FAOSTAT livestock correction',
  reviewed_at = now()
from public.stat_categories category
where editorial.category_id = category.id
  and category.source_organization = 'FAOSTAT'
  and category.source_indicator_code ~ ':5111$'
  and editorial.decision_source in ('v15.7 production-only policy', 'v15.8 FAOSTAT concept policy');

-- Use a player-readable unit while preserving the official abbreviation.
update public.stat_categories category
set
  unit = 'animals',
  unit_explanation = 'Number of live animals',
  plain_language_description = 'Total national population of this livestock species.',
  metadata = (coalesce(category.metadata, '{}'::jsonb) - 'faostatProductionOnlyV15_7')
    || jsonb_build_object(
      'faostatPolicyV15_8', 'keep-livestock-population',
      'faostatPolicyV15_8_1', 'keep-live-animal-population',
      'sourceUnit', coalesce(category.metadata->>'sourceUnit', 'An'),
      'boardDescription', 'Total national population of this livestock species.'
    ),
  updated_at = now()
where category.source_organization = 'FAOSTAT'
  and category.source_indicator_code ~ ':5111$';

-- The prior ledger represented the superseded blanket policy and must no longer
-- claim that Stocks categories are prohibited non-production measures.
delete from public.v15_7_faostat_nonproduction_decisions prior
using public.stat_categories category
where prior.category_id = category.id
  and category.source_organization = 'FAOSTAT'
  and category.source_indicator_code ~ ':5111$';


select * from public.reconcile_category_playability_v15();

-- Invalidate only unscored current/future boards so excluded yields disappear.
create table if not exists public.daily_challenge_archive_v15_8 (like public.daily_challenges including all);
insert into public.daily_challenge_archive_v15_8
select challenge.* from public.daily_challenges challenge
where challenge.challenge_date>=current_date
and not exists(select 1 from public.daily_scores score where score.challenge_date=challenge.challenge_date and score.difficulty=challenge.difficulty)
on conflict(challenge_date,difficulty) do update set
 seed=excluded.seed,encoded_board=excluded.encoded_board,board_payload=excluded.board_payload,board_hash=excluded.board_hash,
 dataset_version=excluded.dataset_version,rules_version=excluded.rules_version,category_set_version=excluded.category_set_version,created_at=excluded.created_at;
delete from public.daily_challenges challenge
where challenge.challenge_date>=current_date
and not exists(select 1 from public.daily_scores score where score.challenge_date=challenge.challenge_date and score.difficulty=challenge.difficulty);

commit;

select decision,count(*) as faostat_categories from public.v15_8_faostat_policy_decisions group by decision order by decision;
select count(*) as playable_yield_or_productivity_categories
from public.category_review_queue_v15 queue join public.stat_categories category on category.id=queue.id
where queue.computed_playable_v15 and category.source_organization='FAOSTAT'
and lower(concat_ws(' ',queue.effective_title,category.description,category.unit)) ~ '(yield|kg/ha|tonnes?/ha|per hectare|area harvested|carcass|slaughter|per animal)';
select count(*) as playable_livestock_population_categories
from public.category_review_queue_v15 queue join public.stat_categories category on category.id=queue.id
where queue.computed_playable_v15 and category.source_organization='FAOSTAT' and category.source_indicator_code ~ ':5111$';
