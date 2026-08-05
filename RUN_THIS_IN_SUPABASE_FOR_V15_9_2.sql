-- GeoStats v15.9.0: automatic culture/consumption expansion and reconciled review totals
-- Prerequisite: v15.8.1 FAOSTAT correction completed.
-- Safe to rerun. New categories remain pending until explicit administrator approval.

begin;
select pg_advisory_xact_lock(hashtext('geostats-v15.9.0-integrated-expansion'));

do $$
begin
  if to_regclass('public.category_review_queue_v15') is null then
    raise exception 'v15.9 stopped: category_review_queue_v15 is missing.';
  end if;
  if to_regprocedure('public.reconcile_category_playability_v15()') is null then
    raise exception 'v15.9 stopped: reconcile_category_playability_v15() is missing.';
  end if;
end $$;

create table if not exists public.v15_9_category_backup (
  category_id text primary key,
  category_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v15_9_category_backup(category_id,category_state)
select id,to_jsonb(category) from public.stat_categories category
on conflict(category_id) do nothing;

create table if not exists public.v15_9_review_backup (
  category_id text primary key,
  review_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v15_9_review_backup(category_id,review_state)
select category_id,to_jsonb(review) from public.category_review_state review
on conflict(category_id) do nothing;

insert into public.data_sources(id,name,status,description,display_order,metadata,created_at,updated_at)
values
 ('faostatfbs','FAOSTAT Food Balances','active','Per-person food supply available for consumption from the official FAOSTAT Food Balances bulk dataset.',46,'{"v15_9":"automatic","manual_review_required":true,"manual_uploads":false}'::jsonb,now(),now()),
 ('pewreligion','Pew Research Center','active','2020 religious-composition estimates: population totals, population shares and diversity.',47,'{"v15_9":"automatic","manual_review_required":true,"manual_uploads":false}'::jsonb,now(),now()),
 ('unescoheritage','UNESCO World Heritage Centre','active','One country-level category: total World Heritage sites.',48,'{"v15_9":"automatic","manual_review_required":true,"scope":"all-sites-only"}'::jsonb,now(),now())
on conflict(id) do update set
 name=excluded.name,status=excluded.status,description=excluded.description,
 metadata=coalesce(public.data_sources.metadata,'{}'::jsonb)||excluded.metadata,updated_at=now();


-- Sources that remain in the backlog must not require administrator-hosted CSVs.
update public.data_sources
set status='planned',
    metadata=coalesce(metadata,'{}'::jsonb)||'{"manual_uploads":false,"deferred_until_automatic":true,"v15_9":"backlog"}'::jsonb,
    updated_at=now()
where id in ('aquastat','usgsminerals','faofisheries','worldcover','hydrosheds','elevation');

-- Expand the official-source allowlist for the automatic, documented v15.9 sources.
create or replace function public.category_v15_source_is_official(p_source text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_source,'')) in (
    'world bank','faostat','faostat food balances','who','ilostat','natural earth',
    'un comtrade','u.s. eia','eia','unhcr','un tourism','imf','oecd',
    'un population division','united nations population division',
    'pew research center','smithsonian gvp','usgs','unesco world heritage centre',
    'esa worldcover','hydrosheds','global elevation','fao aquastat','usgs minerals','fao fisheries'
  )
$$;

-- Fixed-reference studies and delayed international-tourism series need an
-- explicit source-aware freshness rule rather than a universal 2022 cutoff.
create or replace function public.category_v15_minimum_acceptable_year(
  p_source text,
  p_indicator text,
  p_declared_minimum integer
)
returns integer
language sql
immutable
as $$
  select case
    when lower(coalesce(p_source,''))='pew research center'
      then greatest(coalesce(p_declared_minimum,0),2020)
    when lower(coalesce(p_source,''))='world bank'
      and coalesce(p_indicator,'') like 'ST.INT.%'
      then greatest(coalesce(p_declared_minimum,0),2020)
    else greatest(coalesce(p_declared_minimum,0),2022)
  end
$$;

-- Future importer rows use the same source-aware freshness policy.
create or replace function public.ensure_category_review_state_v15()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  normalized text := lower(new.title || ' ' || coalesce(new.description,''));
  hard_reject boolean := normalized ~ '(happiness|corruption perceptions?|freedom index|democracy index|government effectiveness|political stability|internet usage|internet users|internet access|internet coverage|individuals using the internet|labor.?income share|output per worker|employment.?to.?population)';
  discussion boolean := normalized ~ '(self.?reported|survey.?based|perception|satisfaction|subjective|composite index)';
begin
  insert into public.category_review_state (
    category_id,status,political_self_reported,confusing,esoteric,
    subjective_or_composite,stale_data,poor_coverage,semantic_group,notes
  ) values (
    new.id,
    case when hard_reject then 'rejected' when discussion then 'needs_discussion' else 'pending' end,
    normalized ~ '(internet usage|internet users|internet access|internet coverage|individuals using the internet|government effectiveness|political stability)',
    normalized ~ '(labor.?income share|output per worker|employment.?to.?population)',
    normalized ~ '(labor.?income share|output per worker|employment.?to.?population)',
    normalized ~ '(happiness|corruption perceptions?|freedom index|democracy index|government effectiveness|political stability|self.?reported|survey.?based|perception|satisfaction|subjective|composite index)',
    case
      when coalesce(new.common_year,new.latest_available_year) is null then false
      else coalesce(new.common_year,new.latest_available_year) < public.category_v15_minimum_acceptable_year(new.source_organization,new.source_indicator_code,new.minimum_year)
    end,
    greatest(coalesce(new.common_year_coverage,0),coalesce(new.country_coverage,0)) between 1 and 29,
    nullif(new.semantic_family,''),
    case when hard_reject then 'Automatically placed on the permanent GeoStats exclusion list.' when discussion then 'Automatically routed to Needs discussion by the v15 intake screen.' else null end
  )
  on conflict(category_id) do nothing;
  return new;
end;
$$;

-- Clear only the mechanical stale flag for the two explicitly permitted
-- fixed/delayed series families. Human rejection/approval decisions remain intact.
update public.category_review_state review
set stale_data=false,updated_at=now()
from public.stat_categories category
where review.category_id=category.id
  and (
    category.source_organization='Pew Research Center'
    or (category.source_organization='World Bank' and category.source_indicator_code like 'ST.INT.%')
  )
  and coalesce(category.common_year,category.latest_available_year,0)
      >= public.category_v15_minimum_acceptable_year(category.source_organization,category.source_indicator_code,category.minimum_year);

-- UNESCO UIS is removed from new gameplay. Historical board snapshots remain untouched.
update public.category_review_state review
set status='rejected', duplicate_of=null, recommended_title=null,
    notes=concat_ws(E'\n',nullif(review.notes,''),'v15.9: UNESCO UIS removed from the active catalog by product decision.'),
    updated_at=now()
from public.stat_categories category
where review.category_id=category.id
  and category.source_organization='UNESCO UIS';

update public.stat_categories
set enabled=false,eligible_daily=false,
    metadata=coalesce(metadata,'{}'::jsonb)||'{"catalogTier":"quarantined","retiredByV15_9":"unesco-uis-scope"}'::jsonb,
    updated_at=now()
where source_organization='UNESCO UIS';

-- Keep one World Heritage category only, and repair the schema-invalid count type.
update public.stat_categories
set value_type='total', unit='sites', updated_at=now()
where source_organization='UNESCO World Heritage Centre'
  and source_indicator_code='WHC:all-sites';

update public.category_review_state review
set status='rejected', duplicate_of=null,
    notes=concat_ws(E'\n',nullif(review.notes,''),'v15.9: additional World Heritage breakdown retired; only total sites retained.'),
    updated_at=now()
from public.stat_categories category
where review.category_id=category.id
  and category.source_organization='UNESCO World Heritage Centre'
  and category.source_indicator_code<>'WHC:all-sites';

update public.stat_categories
set enabled=false,eligible_daily=false,
    metadata=coalesce(metadata,'{}'::jsonb)||'{"catalogTier":"quarantined","retiredByV15_9":"world-heritage-extra-breakdown"}'::jsonb,
    updated_at=now()
where source_organization='UNESCO World Heritage Centre'
  and source_indicator_code<>'WHC:all-sites';

-- Normalize existing FAOSTAT player copy without changing the underlying data.
-- This applies the same curated titles used by the v15.9 importer, including
-- clear livestock-population titles while keeping every yield category rejected.
with curated(source_indicator_code, player_title) as (
  values
    ('QCL:''0111:5510','Most wheat produced'),
    ('QCL:''0112:5510','Most corn produced'),
    ('QCL:''0113:5510','Most rice produced'),
    ('QCL:''0114:5510','Most sorghum produced'),
    ('QCL:''0115:5510','Most barley produced'),
    ('QCL:''0117:5510','Most oats produced'),
    ('QCL:''0118:5510','Most millet produced'),
    ('QCL:''01212:5510','Most cabbage produced'),
    ('QCL:''01213:5510','Most cauliflower and broccoli produced'),
    ('QCL:''01214:5510','Most lettuce and chicory produced'),
    ('QCL:''01221:5510','Most watermelons produced'),
    ('QCL:''01229:5510','Most melons produced'),
    ('QCL:''01231:5510','Most green chilies and peppers produced'),
    ('QCL:''01232:5510','Most cucumbers and gherkins produced'),
    ('QCL:''01233:5510','Most eggplants produced'),
    ('QCL:''01234:5510','Most tomatoes produced'),
    ('QCL:''01235:5510','Most pumpkins, squash, and gourds produced'),
    ('QCL:''01242:5510','Most green peas produced'),
    ('QCL:''01251:5510','Most carrots and turnips produced'),
    ('QCL:''01253.02:5510','Most onions and shallots produced'),
    ('QCL:''01270:5510','Most mushrooms and truffles produced'),
    ('QCL:''01311:5510','Most avocado produced'),
    ('QCL:''01312:5510','Most bananas produced'),
    ('QCL:''01315:5510','Most figs produced'),
    ('QCL:''01316:5510','Most mangoes, guavas, and mangosteens produced'),
    ('QCL:''01317:5510','Most papaya produced'),
    ('QCL:''01318:5510','Most pineapple produced'),
    ('QCL:''01321:5510','Most grapefruits and pomelos produced'),
    ('QCL:''01322:5510','Most lemons and limes produced'),
    ('QCL:''01323:5510','Most oranges produced'),
    ('QCL:''01324:5510','Most mandarins and tangerines produced'),
    ('QCL:''01330:5510','Most grapes produced'),
    ('QCL:''01341:5510','Most apples produced'),
    ('QCL:''01342.01:5510','Most pears produced'),
    ('QCL:''01343:5510','Most apricot produced'),
    ('QCL:''01344.02:5510','Most cherries produced'),
    ('QCL:''01345:5510','Most peaches and nectarines produced'),
    ('QCL:''01346:5510','Most plums and sloes produced'),
    ('QCL:''01354:5510','Most strawberries produced'),
    ('QCL:''01371:5510','Most almonds produced'),
    ('QCL:''01376:5510','Most walnuts produced'),
    ('QCL:''0141:5510','Most soybeans produced'),
    ('QCL:''0142:5510','Most peanuts produced'),
    ('QCL:''01444:5510','Most sesame seeds produced'),
    ('QCL:''01445:5510','Most sunflower seeds produced'),
    ('QCL:''01460:5510','Most coconuts produced'),
    ('QCL:''01510:5510','Most potatoes produced'),
    ('QCL:''01520.01:5510','Most cassava produced'),
    ('QCL:''01530:5510','Most sweet potatoes produced'),
    ('QCL:''01610:5510','Most coffee produced'),
    ('QCL:''01701:5510','Most dry beans produced'),
    ('QCL:''01705:5510','Most dry peas produced'),
    ('QCL:''01801:5510','Most sugar beets produced'),
    ('QCL:''01802:5510','Most sugarcane produced'),
    ('QCL:''01921.02:5510','Most cotton produced'),
    ('QCL:''01970:5510','Most tobacco produced'),
    ('QCL:''02211:5510','Most cow''s milk produced'),
    ('QCL:''02292:5510','Most goat milk produced'),
    ('QCL:''0231:5513','Most eggs produced'),
    ('QCL:''02910:5510','Most honey produced'),
    ('QCL:''21113.01:5510','Most pork produced'),
    ('QCL:''21121:5510','Most chicken meat produced'),
    ('QCL:''2351f:5510','Most cane and beet sugar produced'),
    ('QCL:''24212.02:5510','Most wine produced'),
    ('QCL:''24310.01:5510','Most beer produced'),
    ('QCL:''F1717:5510','Most cereals produced'),
    ('QCL:''F1720:5510','Most roots and tubers produced'),
    ('QCL:''F1726:5510','Most pulses, total produced'),
    ('QCL:''F1729:5510','Most tree nuts produced'),
    ('QCL:''F1735:5510','Most vegetables produced'),
    ('QCL:''F1738:5510','Most fruit produced'),
    ('QCL:''F1745:5510','Most cheese produced'),
    ('QCL:''F1806:5510','Most beef and buffalo meat produced'),
    ('QCL:''F1807:5510','Most sheep and goat meat produced'),
    ('QCL:''F1811:5510','Most butter and ghee produced'),
    ('QCL:''02111:5111','Largest cattle population'),
    ('QCL:''02112:5111','Largest buffalo population'),
    ('QCL:''02122:5111','Largest sheep population'),
    ('QCL:''02123:5111','Largest goat population'),
    ('QCL:''02140:5111','Largest pig population'),
    ('QCL:''02121.01:5111','Largest camel population'),
    ('QCL:''02131:5111','Largest horse population'),
    ('QCL:''02132:5111','Largest donkey population'),
    ('QCL:''02133:5111','Largest mule and hinny population'),
    ('QCL:''F1746:5111','Largest combined cattle and buffalo population'),
    ('QCL:''F1749:5111','Largest combined sheep and goat population')
)
update public.stat_categories category
set title=curated.player_title,
    short_title=curated.player_title,
    updated_at=now()
from curated
where category.source_organization='FAOSTAT'
  and category.source_indicator_code=curated.source_indicator_code;

with curated(source_indicator_code, player_title) as (
  values
    ('QCL:''0111:5510','Most wheat produced'),
    ('QCL:''0112:5510','Most corn produced'),
    ('QCL:''0113:5510','Most rice produced'),
    ('QCL:''0114:5510','Most sorghum produced'),
    ('QCL:''0115:5510','Most barley produced'),
    ('QCL:''0117:5510','Most oats produced'),
    ('QCL:''0118:5510','Most millet produced'),
    ('QCL:''01212:5510','Most cabbage produced'),
    ('QCL:''01213:5510','Most cauliflower and broccoli produced'),
    ('QCL:''01214:5510','Most lettuce and chicory produced'),
    ('QCL:''01221:5510','Most watermelons produced'),
    ('QCL:''01229:5510','Most melons produced'),
    ('QCL:''01231:5510','Most green chilies and peppers produced'),
    ('QCL:''01232:5510','Most cucumbers and gherkins produced'),
    ('QCL:''01233:5510','Most eggplants produced'),
    ('QCL:''01234:5510','Most tomatoes produced'),
    ('QCL:''01235:5510','Most pumpkins, squash, and gourds produced'),
    ('QCL:''01242:5510','Most green peas produced'),
    ('QCL:''01251:5510','Most carrots and turnips produced'),
    ('QCL:''01253.02:5510','Most onions and shallots produced'),
    ('QCL:''01270:5510','Most mushrooms and truffles produced'),
    ('QCL:''01311:5510','Most avocado produced'),
    ('QCL:''01312:5510','Most bananas produced'),
    ('QCL:''01315:5510','Most figs produced'),
    ('QCL:''01316:5510','Most mangoes, guavas, and mangosteens produced'),
    ('QCL:''01317:5510','Most papaya produced'),
    ('QCL:''01318:5510','Most pineapple produced'),
    ('QCL:''01321:5510','Most grapefruits and pomelos produced'),
    ('QCL:''01322:5510','Most lemons and limes produced'),
    ('QCL:''01323:5510','Most oranges produced'),
    ('QCL:''01324:5510','Most mandarins and tangerines produced'),
    ('QCL:''01330:5510','Most grapes produced'),
    ('QCL:''01341:5510','Most apples produced'),
    ('QCL:''01342.01:5510','Most pears produced'),
    ('QCL:''01343:5510','Most apricot produced'),
    ('QCL:''01344.02:5510','Most cherries produced'),
    ('QCL:''01345:5510','Most peaches and nectarines produced'),
    ('QCL:''01346:5510','Most plums and sloes produced'),
    ('QCL:''01354:5510','Most strawberries produced'),
    ('QCL:''01371:5510','Most almonds produced'),
    ('QCL:''01376:5510','Most walnuts produced'),
    ('QCL:''0141:5510','Most soybeans produced'),
    ('QCL:''0142:5510','Most peanuts produced'),
    ('QCL:''01444:5510','Most sesame seeds produced'),
    ('QCL:''01445:5510','Most sunflower seeds produced'),
    ('QCL:''01460:5510','Most coconuts produced'),
    ('QCL:''01510:5510','Most potatoes produced'),
    ('QCL:''01520.01:5510','Most cassava produced'),
    ('QCL:''01530:5510','Most sweet potatoes produced'),
    ('QCL:''01610:5510','Most coffee produced'),
    ('QCL:''01701:5510','Most dry beans produced'),
    ('QCL:''01705:5510','Most dry peas produced'),
    ('QCL:''01801:5510','Most sugar beets produced'),
    ('QCL:''01802:5510','Most sugarcane produced'),
    ('QCL:''01921.02:5510','Most cotton produced'),
    ('QCL:''01970:5510','Most tobacco produced'),
    ('QCL:''02211:5510','Most cow''s milk produced'),
    ('QCL:''02292:5510','Most goat milk produced'),
    ('QCL:''0231:5513','Most eggs produced'),
    ('QCL:''02910:5510','Most honey produced'),
    ('QCL:''21113.01:5510','Most pork produced'),
    ('QCL:''21121:5510','Most chicken meat produced'),
    ('QCL:''2351f:5510','Most cane and beet sugar produced'),
    ('QCL:''24212.02:5510','Most wine produced'),
    ('QCL:''24310.01:5510','Most beer produced'),
    ('QCL:''F1717:5510','Most cereals produced'),
    ('QCL:''F1720:5510','Most roots and tubers produced'),
    ('QCL:''F1726:5510','Most pulses, total produced'),
    ('QCL:''F1729:5510','Most tree nuts produced'),
    ('QCL:''F1735:5510','Most vegetables produced'),
    ('QCL:''F1738:5510','Most fruit produced'),
    ('QCL:''F1745:5510','Most cheese produced'),
    ('QCL:''F1806:5510','Most beef and buffalo meat produced'),
    ('QCL:''F1807:5510','Most sheep and goat meat produced'),
    ('QCL:''F1811:5510','Most butter and ghee produced'),
    ('QCL:''02111:5111','Largest cattle population'),
    ('QCL:''02112:5111','Largest buffalo population'),
    ('QCL:''02122:5111','Largest sheep population'),
    ('QCL:''02123:5111','Largest goat population'),
    ('QCL:''02140:5111','Largest pig population'),
    ('QCL:''02121.01:5111','Largest camel population'),
    ('QCL:''02131:5111','Largest horse population'),
    ('QCL:''02132:5111','Largest donkey population'),
    ('QCL:''02133:5111','Largest mule and hinny population'),
    ('QCL:''F1746:5111','Largest combined cattle and buffalo population'),
    ('QCL:''F1749:5111','Largest combined sheep and goat population')
)
update public.category_review_state review
set recommended_title=curated.player_title,
    updated_at=now()
from public.stat_categories category
join curated on curated.source_indicator_code=category.source_indicator_code
where review.category_id=category.id
  and category.source_organization='FAOSTAT'
  and review.status in ('approved','pending','needs_rewrite','needs_discussion');

-- Correct the largest-city measure everywhere: it is a percentage, not a total.
update public.stat_categories
set title='Highest share living in largest city',
    short_title='Highest share living in largest city',
    description='Percentage of the country''s population living in its largest urban area.',
    updated_at=now()
where source_organization='World Bank'
  and source_indicator_code='EN.URB.LCTY';

update public.category_review_state review
set recommended_title='Highest share living in largest city',
    updated_at=now()
from public.stat_categories category
where review.category_id=category.id
  and category.source_organization='World Bank'
  and category.source_indicator_code='EN.URB.LCTY'
  and review.status<>'rejected';

-- Rebuild the authoritative queue with the v15.9 source and freshness rules.
create or replace view public.category_review_queue_v15
with (security_invoker=true)
as
select
  category.*,
  review.status as editorial_status,
  review.political_self_reported,
  review.confusing,
  review.esoteric,
  review.subjective_or_composite,
  review.stale_data,
  review.poor_coverage,
  review.duplicate_of,
  review.recommended_title,
  review.semantic_group,
  review.notes as editorial_notes,
  review.reviewed_by,
  review.reviewed_at,
  review.updated_at as editorial_updated_at,
  coalesce(nullif(review.recommended_title,''), category.title) as effective_title,
  coalesce(
    nullif(review.semantic_group,''),
    nullif(category.semantic_family,''),
    nullif(category.concept_group,''),
    category.family
  ) as effective_semantic_group,
  (
    public.category_v15_source_is_official(category.source_organization)
    and not public.category_v15_true_integrity_failure(
      category.validation_status,
      category.validation_reason,
      category.validation_mismatch_count,
      category.validation_ranking_mismatch_count
    )
    and coalesce(category.quality_score, 0) >= 70
    and coalesce(category.credibility_status, 'approved') <> 'quarantined'
    and coalesce(category.credibility_score, 75) >= 75
    and greatest(
      coalesce(category.common_year_coverage,0),
      coalesce(category.country_coverage,0)
    ) >= 30
    and coalesce(
      category.common_year,
      category.latest_available_year,
      0
    ) >= public.category_v15_minimum_acceptable_year(category.source_organization,category.source_indicator_code,category.minimum_year)
  ) as hard_gate_ready,
  (
    review.status = 'approved'
    and not review.political_self_reported
    and not review.confusing
    and not review.esoteric
    and not review.subjective_or_composite
    and not review.stale_data
    and not review.poor_coverage
    and review.duplicate_of is null
  ) as editorial_ready,
  (
    review.status = 'approved'
    and not review.political_self_reported
    and not review.confusing
    and not review.esoteric
    and not review.subjective_or_composite
    and not review.stale_data
    and not review.poor_coverage
    and review.duplicate_of is null
    and public.category_v15_source_is_official(category.source_organization)
    and not public.category_v15_true_integrity_failure(
      category.validation_status,
      category.validation_reason,
      category.validation_mismatch_count,
      category.validation_ranking_mismatch_count
    )
    and coalesce(category.quality_score, 0) >= 70
    and coalesce(category.credibility_status, 'approved') <> 'quarantined'
    and coalesce(category.credibility_score, 75) >= 75
    and greatest(
      coalesce(category.common_year_coverage,0),
      coalesce(category.country_coverage,0)
    ) >= 30
    and coalesce(
      category.common_year,
      category.latest_available_year,
      0
    ) >= public.category_v15_minimum_acceptable_year(category.source_organization,category.source_indicator_code,category.minimum_year)
  ) as computed_playable_v15,
  array_remove(array[
    case when not public.category_v15_source_is_official(category.source_organization)
      then 'Source is not on the official-source allowlist.' end,
    case when public.category_v15_true_integrity_failure(
      category.validation_status,
      category.validation_reason,
      category.validation_mismatch_count,
      category.validation_ranking_mismatch_count
    ) then 'A direct value, country-set, duplicate, or ranking integrity failure was found.' end,
    case when coalesce(category.quality_score,0) < 70
      then 'Quality score is below 70.' end,
    case when category.credibility_status = 'quarantined'
      or coalesce(category.credibility_score,75) < 75
      then 'Credibility review did not pass.' end,
    case when greatest(
      coalesce(category.common_year_coverage,0),
      coalesce(category.country_coverage,0)
    ) < 30 then 'Fewer than 30 countries have comparable data.' end,
    case when coalesce(
      category.common_year,
      category.latest_available_year,
      0
    ) < public.category_v15_minimum_acceptable_year(category.source_organization,category.source_indicator_code,category.minimum_year)
      then 'Comparable data are too old.' end,
    case when review.status <> 'approved'
      then 'Editorial decision is not approved.' end,
    case when review.political_self_reported
      then 'Flagged as politically vulnerable or self-reported.' end,
    case when review.subjective_or_composite
      then 'Flagged as subjective, perception-based, or composite.' end,
    case when review.confusing
      then 'Flagged as difficult to understand.' end,
    case when review.esoteric
      then 'Flagged as too esoteric for gameplay.' end,
    case when review.stale_data
      then 'Flagged as stale.' end,
    case when review.poor_coverage
      then 'Flagged for poor coverage.' end,
    case when review.duplicate_of is not null
      then 'Marked as a duplicate.' end
  ], null) as v15_blockers,
  (
    category.player_source_status in ('exact','general')
    and public.player_source_url_is_safe(category.player_source_url)
  ) as source_link_ready,
  array_remove(array[
    case when category.validation_status is distinct from 'verified'
      and not public.category_v15_true_integrity_failure(
        category.validation_status,
        category.validation_reason,
        category.validation_mismatch_count,
        category.validation_ranking_mismatch_count
      )
      then 'Official-source verification is pending or produced a non-blocking metadata/API warning.' end,
    case when category.player_source_status not in ('exact','general')
      or not public.player_source_url_is_safe(category.player_source_url)
      then 'No safe human-readable official source page is currently available; this does not block play.' end
  ], null) as v15_warnings
from public.stat_categories category
join public.category_review_state review
  on review.category_id = category.id;

revoke all on public.category_review_queue_v15 from public, anon, authenticated;
grant select on public.category_review_queue_v15 to service_role;


-- Recommendations never activate categories.
create table if not exists public.category_auto_vetting_v15_9 (
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
create index if not exists category_auto_vetting_v15_9_rec_idx
  on public.category_auto_vetting_v15_9(recommendation,vetting_score desc);
alter table public.category_auto_vetting_v15_9 enable row level security;
revoke all on public.category_auto_vetting_v15_9 from public,anon,authenticated;
grant all on public.category_auto_vetting_v15_9 to service_role;

-- Carry forward the last recommendation so the Workbench does not temporarily go blank.
insert into public.category_auto_vetting_v15_9(
 category_id,recommendation,vetting_score,reason,possible_duplicate_of,title_similarity,
 rank_correlation,coverage,tie_share,vetting_version,vetted_at
)
select category_id,recommendation,vetting_score,reason,possible_duplicate_of,title_similarity,
 rank_correlation,coverage,tie_share,'geostats-v15.9-carried-forward',vetted_at
from public.category_auto_vetting_v15_8
on conflict(category_id) do nothing;

create or replace view public.category_review_workbench_v15_9
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
left join public.category_auto_vetting_v15_9 vetting on vetting.category_id=queue.id;
revoke all on public.category_review_workbench_v15_9 from public,anon,authenticated;
grant select on public.category_review_workbench_v15_9 to service_role;

-- One authoritative aggregate. By definition approved = playable + approved_but_blocked.
create or replace view public.category_review_overview_v15_9
with(security_invoker=true) as
select
 count(*)::bigint as categories,
 count(*) filter(where editorial_status='pending')::bigint as pending,
 count(*) filter(where editorial_status='approved')::bigint as approved,
 count(*) filter(where editorial_status='rejected')::bigint as rejected,
 count(*) filter(where editorial_status='duplicate')::bigint as duplicate,
 count(*) filter(where editorial_status='needs_rewrite')::bigint as needs_rewrite,
 count(*) filter(where editorial_status='needs_discussion')::bigint as needs_discussion,
 count(*) filter(where hard_gate_ready)::bigint as hard_gate_ready,
 count(*) filter(where computed_playable_v15)::bigint as playable,
 count(*) filter(where editorial_status='approved' and not computed_playable_v15)::bigint as approved_but_blocked,
 bool_and(not computed_playable_v15 or editorial_status='approved') as playable_implies_approved,
 (
   count(*) filter(where editorial_status='approved')
   = count(*) filter(where computed_playable_v15)
   + count(*) filter(where editorial_status='approved' and not computed_playable_v15)
 ) as approved_totals_reconcile
from public.category_review_queue_v15;
revoke all on public.category_review_overview_v15_9 from public,anon,authenticated;
grant select on public.category_review_overview_v15_9 to service_role;

select public.reconcile_category_playability_v15();
commit;

select * from public.category_review_overview_v15_9;

-- ---------------------------------------------------------------------------
-- Embedded v15.9.1 revised safeguards.
-- ---------------------------------------------------------------------------

-- GeoStats v15.9.1: revised geography, clarity, mobile-release, and selective-board safeguards
-- Prerequisite: v15.9 integrated expansion migration.
-- Safe to rerun. Historical scored boards and immutable snapshots remain intact.

begin;
select pg_advisory_xact_lock(hashtext('geostats-v15.9.1-revised-safeguards'));

do $$
begin
  if to_regclass('public.category_review_queue_v15') is null then
    raise exception 'v15.9.1 stopped: category_review_queue_v15 is missing.';
  end if;
  if to_regprocedure('public.reconcile_category_playability_v15()') is null then
    raise exception 'v15.9.1 stopped: reconcile_category_playability_v15() is missing.';
  end if;
  if to_regclass('public.daily_challenges') is null or to_regclass('public.daily_scores') is null then
    raise exception 'v15.9.1 stopped: Daily board tables are missing.';
  end if;
end $$;

-- Full pre-change snapshots make the migration reversible without guessing which
-- rows were touched by clarity, semantic, or geography policy.
create table if not exists public.v15_9_1_category_backup (
  category_id text primary key,
  category_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v15_9_1_category_backup(category_id, category_state)
select id, to_jsonb(category)
from public.stat_categories category
on conflict(category_id) do nothing;

create table if not exists public.v15_9_1_review_backup (
  category_id text primary key,
  review_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v15_9_1_review_backup(category_id, review_state)
select category_id, to_jsonb(review)
from public.category_review_state review
on conflict(category_id) do nothing;

create table if not exists public.v15_9_1_retired_category_ids (
  category_id text primary key,
  reason text not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.v15_9_1_invalid_board_category_ids (
  category_id text primary key,
  reason text not null,
  recorded_at timestamptz not null default now()
);

-- Shape and position concepts were distorted by joining distant territories to
-- an administering sovereign. These exact legacy IDs remain decodable in scored
-- board snapshots but cannot enter new play.
insert into public.v15_9_1_retired_category_ids(category_id, reason)
select category.id,
       'Natural Earth shape/position concept retired pending a separately validated principal-landmass methodology.'
from public.stat_categories category
where lower(coalesce(category.source_organization,'')) = 'natural earth'
  and lower(coalesce(category.source_indicator_code,'')) in (
    'largest-geographic-span',
    'largest-north-south-span',
    'largest-east-west-span',
    'northernmost-country',
    'southernmost-country',
    'farthest-from-equator',
    'most-separate-land-areas',
    'most-large-land-areas'
  )
on conflict(category_id) do update set reason=excluded.reason, recorded_at=now();

-- Explicitly retire the unreadable young-adult Findex variant.
insert into public.v15_9_1_retired_category_ids(category_id, reason)
select category.id,
       'Overqualified Findex subgroup title retired; retain the clear all-adults account-ownership measure.'
from public.stat_categories category
where category.source_indicator_code = 'FX.OWN.TOTL.YG.ZS'
on conflict(category_id) do update set reason=excluded.reason, recorded_at=now();

update public.category_review_state review
set status='rejected', duplicate_of=null, recommended_title=null,
    notes=concat_ws(E'\n', nullif(review.notes,''), retired.reason),
    updated_at=now()
from public.v15_9_1_retired_category_ids retired
where review.category_id=retired.category_id;

update public.stat_categories category
set enabled=false,
    eligible_daily=false,
    metadata=coalesce(category.metadata,'{}'::jsonb)
      || jsonb_build_object('catalogTier','quarantined','retiredByV15_9_1',retired.reason),
    updated_at=now()
from public.v15_9_1_retired_category_ids retired
where category.id=retired.category_id;

-- Similar Findex demographic variants are held for rewrite rather than silently
-- remaining playable. The uncomplicated all-adults measure is retained.
update public.category_review_state review
set status='needs_rewrite', duplicate_of=null,
    notes=concat_ws(E'\n', nullif(review.notes,''),
      'v15.9.1 clarity gate: subgroup-specific combined-provider account-ownership wording requires a shorter distinct player concept.'),
    updated_at=now()
from public.stat_categories category
where review.category_id=category.id
  and category.source_indicator_code ~ '^FX\.OWN\.TOTL\.(FE|MA|OL|40|60|PL|SO)\.ZS$'
  and review.status <> 'rejected';

update public.stat_categories category
set enabled=false, eligible_daily=false,
    metadata=coalesce(category.metadata,'{}'::jsonb)
      || '{"catalogTier":"pending","clarityGateV15_9_1":"findex-subgroup-rewrite"}'::jsonb,
    updated_at=now()
where category.source_indicator_code ~ '^FX\.OWN\.TOTL\.(FE|MA|OL|40|60|PL|SO)\.ZS$';

-- Global copy guardrail: hold long or generic approved cards for editorial rewrite.
create table if not exists public.v15_9_1_unclear_copy(
  category_id text primary key,
  recorded_at timestamptz not null default now()
);
delete from public.v15_9_1_unclear_copy;
insert into public.v15_9_1_unclear_copy(category_id)
select category.id
from public.stat_categories category
join public.category_review_state review on review.category_id=category.id
where review.status='approved'
  and (
    char_length(trim(category.title)) > 96
    or cardinality(regexp_split_to_array(trim(category.title),'\s+')) > 16
    or (
      char_length(trim(category.title)) > 68
      and coalesce(category.plain_language_description, category.description, '')
        ~* '^(compare countries using|compare the official country value|official country value for this measure)'
    )
  );

update public.category_review_state review
set status='needs_rewrite',
    notes=concat_ws(E'\n', nullif(review.notes,''),
      'v15.9.1 clarity gate: title/description is too long or generic for a mobile game card.'),
    updated_at=now()
where review.category_id in (select category_id from public.v15_9_1_unclear_copy);

-- Source semantics outrank titles: blocked FAOSTAT elements remain rejected even
-- when a stale title incorrectly says "produced".
create table if not exists public.v15_9_1_blocked_faostat(
  category_id text primary key,
  recorded_at timestamptz not null default now()
);
delete from public.v15_9_1_blocked_faostat;
insert into public.v15_9_1_blocked_faostat(category_id)
select category.id
from public.stat_categories category
where lower(coalesce(category.source_organization,''))='faostat'
  and coalesce(category.source_indicator_code,'') ~* '^QCL:'
  and regexp_replace(
        regexp_replace(coalesce(category.source_indicator_code,''), '^.*:', ''),
        '[^0-9]', '', 'g'
      ) in ('5312','5320','5412','5417');

update public.category_review_state review
set status='rejected', duplicate_of=null, recommended_title=null,
    notes=concat_ws(E'\n', nullif(review.notes,''),
      'v15.9.1 semantic consistency: source element is yield, area, slaughter/carcass, or productivity and cannot be made playable by title wording.'),
    updated_at=now()
where review.category_id in (select category_id from public.v15_9_1_blocked_faostat);

update public.stat_categories category
set enabled=false, eligible_daily=false,
    metadata=coalesce(category.metadata,'{}'::jsonb)
      || '{"catalogTier":"quarantined","faostatSemanticGateV15_9_1":"blocked-source-element"}'::jsonb,
    updated_at=now()
where category.id in (select category_id from public.v15_9_1_blocked_faostat);

-- Static geography carries a pinned release label, not a fake observation year.
update public.stat_categories category
set metadata=coalesce(category.metadata,'{}'::jsonb)
      || jsonb_build_object(
        'referenceLabel', coalesce(nullif(category.dataset_release,''), 'Natural Earth v5.1.1'),
        'showObservationYear', false,
        'staticGeography', true,
        'territoryPolicy', 'Use ISO country identity before administering sovereign; separately coded dependencies are not unioned into the sovereign geometry.'
      ),
    updated_at=now()
where lower(coalesce(category.source_organization,''))='natural earth';

-- Any category newly made ineligible by this release invalidates an unplayed
-- current/future board. This includes prior UNESCO UIS cleanup and blocked source
-- semantics, not only the two explicitly retired examples.
delete from public.v15_9_1_invalid_board_category_ids;

insert into public.v15_9_1_invalid_board_category_ids(category_id, reason)
select category_id, reason from public.v15_9_1_retired_category_ids
on conflict(category_id) do update set reason=excluded.reason, recorded_at=now();

insert into public.v15_9_1_invalid_board_category_ids(category_id, reason)
select category.id, 'UNESCO UIS is retired from new gameplay in v15.9.'
from public.stat_categories category
where lower(coalesce(category.source_organization,''))='unesco uis'
on conflict(category_id) do update set reason=excluded.reason, recorded_at=now();

insert into public.v15_9_1_invalid_board_category_ids(category_id, reason)
select category_id, 'FAOSTAT source element is blocked independently of player-facing wording.'
from public.v15_9_1_blocked_faostat
on conflict(category_id) do update set reason=excluded.reason, recorded_at=now();

insert into public.v15_9_1_invalid_board_category_ids(category_id, reason)
select category_id, 'Player-facing copy is held for rewrite by the v15.9.1 clarity gate.'
from public.v15_9_1_unclear_copy
on conflict(category_id) do update set reason=excluded.reason, recorded_at=now();

insert into public.v15_9_1_invalid_board_category_ids(category_id, reason)
select category.id, 'Findex subgroup wording is held for rewrite by the v15.9.1 clarity gate.'
from public.stat_categories category
where category.source_indicator_code ~ '^FX\.OWN\.TOTL\.(FE|MA|OL|40|60|PL|SO)\.ZS$'
on conflict(category_id) do update set reason=excluded.reason, recorded_at=now();

select public.reconcile_category_playability_v15();

-- Archive and delete only unscored current/future boards that actually contain
-- an invalidated category. Scored historical boards are never selected.
create table if not exists public.daily_challenge_archive_v15_9_1
  (like public.daily_challenges including all);

create table if not exists public.v15_9_1_removed_daily_challenges (
  challenge_date date not null,
  difficulty text not null,
  invalid_category_ids text[] not null default '{}',
  removed_at timestamptz not null default now(),
  primary key(challenge_date,difficulty)
);

create table if not exists public.v15_9_1_affected_boards (
  challenge_date date not null,
  difficulty text not null,
  invalid_ids text[] not null default '{}',
  recorded_at timestamptz not null default now(),
  primary key(challenge_date,difficulty)
);
delete from public.v15_9_1_affected_boards;
insert into public.v15_9_1_affected_boards(challenge_date,difficulty,invalid_ids)
select challenge.challenge_date,
       challenge.difficulty,
       array_agg(distinct invalid.category_id order by invalid.category_id) as invalid_ids
from public.daily_challenges challenge
cross join lateral jsonb_array_elements(coalesce(challenge.board_payload->'categories','[]'::jsonb)) item
join public.v15_9_1_invalid_board_category_ids invalid
  on invalid.category_id = item->'category'->>'id'
where challenge.challenge_date >= current_date
  and not exists (
    select 1 from public.daily_scores score
    where score.challenge_date=challenge.challenge_date
      and score.difficulty=challenge.difficulty
  )
group by challenge.challenge_date, challenge.difficulty;

insert into public.daily_challenge_archive_v15_9_1
select challenge.*
from public.daily_challenges challenge
join public.v15_9_1_affected_boards affected
  on affected.challenge_date=challenge.challenge_date
 and affected.difficulty=challenge.difficulty
on conflict(challenge_date,difficulty) do update set
  seed=excluded.seed,
  encoded_board=excluded.encoded_board,
  board_payload=excluded.board_payload,
  board_hash=excluded.board_hash,
  dataset_version=excluded.dataset_version,
  rules_version=excluded.rules_version,
  category_set_version=excluded.category_set_version,
  created_at=excluded.created_at;

insert into public.v15_9_1_removed_daily_challenges(challenge_date,difficulty,invalid_category_ids)
select challenge_date,difficulty,invalid_ids
from public.v15_9_1_affected_boards
on conflict(challenge_date,difficulty) do update set
  invalid_category_ids=excluded.invalid_category_ids,
  removed_at=now();

delete from public.daily_challenges challenge
using public.v15_9_1_affected_boards affected
where challenge.challenge_date=affected.challenge_date
  and challenge.difficulty=affected.difficulty
  and challenge.challenge_date >= current_date
  and not exists (
    select 1 from public.daily_scores score
    where score.challenge_date=challenge.challenge_date
      and score.difficulty=challenge.difficulty
  );

commit;

select
  count(*) filter(where computed_playable_v15) as playable,
  count(*) filter(where editorial_status='approved') as approved,
  count(*) filter(where editorial_status='approved' and not computed_playable_v15) as approved_but_blocked,
  count(*) filter(where editorial_status in ('pending','needs_rewrite','needs_discussion')) as awaiting_review
from public.category_review_queue_v15;

select count(*) as playable_blocked_faostat_elements
from public.stat_categories category
where lower(coalesce(category.source_organization,''))='faostat'
  and coalesce(category.source_indicator_code,'') ~* '^QCL:'
  and regexp_replace(regexp_replace(coalesce(category.source_indicator_code,''), '^.*:', ''),'[^0-9]','','g')
      in ('5312','5320','5412','5417')
  and (category.enabled or category.eligible_daily);

select count(*) as playable_retired_v15_9_1
from public.category_review_queue_v15 queue
join public.v15_9_1_retired_category_ids retired on retired.category_id=queue.id
where queue.computed_playable_v15;

select count(*) as selectively_removed_unscored_boards
from public.v15_9_1_removed_daily_challenges;


-- GeoStats v15.9.2: immutable score/rating version metadata
-- Safe to rerun. Additive only; historical scores and boards are preserved.

begin;
select pg_advisory_xact_lock(hashtext('geostats-v15.9.2-score-versioning'));

do $$
begin
  if to_regclass('public.daily_scores') is null then
    raise exception 'v15.9.2 stopped: daily_scores is missing.';
  end if;
  if to_regclass('public.daily_challenges') is null then
    raise exception 'v15.9.2 stopped: daily_challenges is missing.';
  end if;
end $$;

alter table public.daily_scores
  add column if not exists scoring_version text,
  add column if not exists board_normalization_version text,
  add column if not exists leaderboard_rating_version text,
  add column if not exists rules_version text,
  add column if not exists category_set_version text,
  add column if not exists dataset_version text;

-- Recover the exact board versions for every historical score where its Daily
-- board remains present. The immutable board snapshot is not changed.
update public.daily_scores score
set
  rules_version = coalesce(score.rules_version, challenge.rules_version),
  category_set_version = coalesce(score.category_set_version, challenge.category_set_version),
  dataset_version = coalesce(score.dataset_version, challenge.dataset_version)
from public.daily_challenges challenge
where challenge.challenge_date = score.challenge_date
  and challenge.difficulty = score.difficulty
  and (
    score.rules_version is null
    or score.category_set_version is null
    or score.dataset_version is null
  );

update public.daily_scores
set
  scoring_version = coalesce(scoring_version, 'placements-pre-v15.9.2'),
  board_normalization_version = coalesce(board_normalization_version, 'daily-distribution-z-v1'),
  leaderboard_rating_version = coalesce(leaderboard_rating_version, 'board-relative-bayesian-v1'),
  rules_version = coalesce(rules_version, 'legacy-unknown'),
  category_set_version = coalesce(category_set_version, 'legacy-unknown'),
  dataset_version = coalesce(dataset_version, 'legacy-unknown')
where scoring_version is null
   or board_normalization_version is null
   or leaderboard_rating_version is null
   or rules_version is null
   or category_set_version is null
   or dataset_version is null;

alter table public.daily_scores
  alter column scoring_version set default 'placements-v15.9.2',
  alter column board_normalization_version set default 'daily-distribution-z-v1',
  alter column leaderboard_rating_version set default 'board-relative-bayesian-v1',
  alter column rules_version set default 'legacy-unknown',
  alter column category_set_version set default 'legacy-unknown',
  alter column dataset_version set default 'legacy-unknown';

alter table public.daily_scores
  alter column scoring_version set not null,
  alter column board_normalization_version set not null,
  alter column leaderboard_rating_version set not null,
  alter column rules_version set not null,
  alter column category_set_version set not null,
  alter column dataset_version set not null;

comment on column public.daily_scores.scoring_version is
  'Point/placement scoring implementation used when the server verified this submission.';
comment on column public.daily_scores.board_normalization_version is
  'Board-difficulty normalization method used by the all-time leaderboard.';
comment on column public.daily_scores.leaderboard_rating_version is
  'Confidence/experience rating method used by the all-time leaderboard.';
comment on column public.daily_scores.rules_version is
  'Rules version stored on the immutable Daily board at score time.';
comment on column public.daily_scores.category_set_version is
  'Category-set version stored on the immutable Daily board at score time.';
comment on column public.daily_scores.dataset_version is
  'Dataset version stored on the immutable Daily board at score time.';

commit;

select
  count(*) as scores,
  count(*) filter(where scoring_version is null) as missing_scoring_version,
  count(*) filter(where board_normalization_version is null) as missing_normalization_version,
  count(*) filter(where leaderboard_rating_version is null) as missing_rating_version,
  count(*) filter(where rules_version is null or category_set_version is null or dataset_version is null) as missing_board_version
from public.daily_scores;
