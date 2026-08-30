begin;

-- GeoStats v16.2.8 owner follow-up: remove four concepts that are not useful
-- enough for the game, keep statelessness only with an immediate definition,
-- and make every decision survive future importer and catalog rebuilds.
create temporary table v071_remove (
  id text primary key,
  reason text not null
) on commit drop;

insert into v071_remove (id,reason) values
  ('unescoich:most-elements','Owner review: remove the UNESCO living-cultural-traditions count from gameplay.'),
  ('worldbank-catalog:bn-gsr-fcty-cd','Owner review: remove this technical net work-and-investment-income measure from gameplay.'),
  ('worldbank-catalog:bn-trf-curr-cd','Owner review: remove this technical net-transfers measure from gameplay.'),
  ('worldbank-catalog:bg-gsr-nfsv-gd-zs','Owner review: remove this broad international-services-trade percentage from gameplay.');

-- Extend the table-boundary hard gate. The importer also filters these IDs,
-- but the database remains the final fail-closed authority.
create or replace function public.v16_2_7_durable_exclusion_reason(
  p_id text,p_title text,p_source text,p_indicator text
) returns text language sql immutable as $$
  select case
    when p_id in (
      'unescoich:most-elements',
      'worldbank-catalog:bn-gsr-fcty-cd',
      'worldbank-catalog:bn-trf-curr-cd',
      'worldbank-catalog:bg-gsr-nfsv-gd-zs'
    ) then 'v16.2.8 durable owner-directed gameplay exclusion'
    when p_id in ('unescoheritage:all-sites','comtrade:most-sports-equipment-exported','worldbank-catalog:er-ptd-totl-zs')
      then 'v16.2.7 durable product exclusion'
    when p_id <> 'history:ipu-universal-womens-suffrage'
      and lower(coalesce(p_title,'')) ~ '(^|[^a-z])(women|woman|female)([^a-z]|$)'
      then 'v16.2.7 durable women-category exclusion'
    when p_id in (
      'natural-earth:largest-geographic-span','natural-earth:largest-north-south-span',
      'natural-earth:largest-east-west-span','natural-earth:farthest-from-equator',
      'natural-earth:most-separate-land-areas','natural-earth:most-large-land-areas'
    ) then 'v16.2.7 durable Natural Earth span/fragmentation exclusion'
    when coalesce(p_source,'')='World Bank' and upper(coalesce(p_indicator,'')) like 'EN.GHG.%'
      and p_id not in ('worldbank-catalog:en-ghg-all-mt-ce-ar5','worldbank-catalog:en-ghg-all-pc-ce-ar5','worldbank-catalog:en-ghg-co2-pi-mt-ce-ar5')
      then 'v16.2.7 durable greenhouse-gas anti-proliferation exclusion'
    when p_id like 'global-findex:%'
      and p_id not in ('global-findex:account-ownership','global-findex:digital-merchant-payment')
      then 'v16.2.7 durable Findex anti-proliferation exclusion'
    when p_id in ('undp-hdr:mpi','undp-hdr:mpi-headcount','undp-hdr:mpi-intensity','undp-hdr:female-hdi','undp-hdr:male-hdi')
      then 'v16.2.7 durable UNDP HDR exclusion'
    when p_id in ('vdem-v16:electoral-democracy','vdem-v16:liberal-democracy')
      then 'v16.2.7 durable V-Dem anti-proliferation exclusion'
    else null
  end
$$;

update public.stat_categories c
set review_status='rejected',
    curation_status='excluded',
    content_review_status='excluded',
    curation_reason=r.reason,
    content_review_reason=r.reason,
    curation_version='geostats-v16.2.8-owner-followup',
    content_review_version='geostats-v16.2.8-owner-followup',
    enabled=false,
    eligible_daily=false,
    updated_at=now()
from v071_remove r
where c.id=r.id;

update public.category_review_state r
set status='rejected',
    duplicate_of=null,
    notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.8 durable owner-directed gameplay exclusion.'),
    updated_at=now()
from v071_remove x
where r.category_id=x.id;

-- Keep this concept because it is distinct from refugees, but define the term
-- before a player needs any specialist knowledge.
update public.stat_categories
set title='Most people without citizenship in any country',
    short_title='People without citizenship',
    description='People not legally recognized as citizens by any country; this is what “stateless” means. Unlike refugees, they may never have crossed a border.',
    plain_language_description='People not legally recognized as citizens by any country; this is what “stateless” means. Unlike refugees, they may never have crossed a border.',
    metadata=jsonb_set(
      coalesce(metadata,'{}'::jsonb),
      '{boardDescription}',
      to_jsonb('People not recognized as citizens by any country.'::text),
      true
    ),
    content_review_status='approved',
    content_review_reason='v16.2.8 owner follow-up: retained only with a plain definition of statelessness and its distinction from refugee status.',
    content_review_version='geostats-v16.2.8-owner-followup',
    immediate_comprehension_score=greatest(coalesce(immediate_comprehension_score,0),96),
    understandability_score=greatest(coalesce(understandability_score,0),96),
    updated_at=now()
where id='unhcr:most-stateless-people';

select public.refresh_category_decision_provenance_v16_2_7();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

do $$
begin
  if exists (
    select 1
    from public.category_runtime_review_v16_2 c
    join v071_remove r on r.id=c.id
    where c.computed_playable_v16_2 or c.enabled or c.eligible_daily
  ) then
    raise exception 'v16.2.8 follow-up removals did not remain fail-closed';
  end if;

  if (select count(*) from public.category_runtime_review_v16_2 where computed_playable_v16_2) <> 323 then
    raise exception 'v16.2.8 follow-up expected exactly 323 runtime-playable categories';
  end if;

  if not exists (
    select 1 from public.category_runtime_review_v16_2
    where id='unhcr:most-stateless-people'
      and computed_playable_v16_2
      and title='Most people without citizenship in any country'
  ) then
    raise exception 'v16.2.8 statelessness definition did not remain playable';
  end if;

  if (select count(*) from public.category_runtime_review_v16_2 where id='airPassengers' and computed_playable_v16_2) <> 1
     or exists (select 1 from public.category_runtime_review_v16_2 where id='worldbankinfra:air-passengers' and computed_playable_v16_2)
  then
    raise exception 'v16.2.8 airline-passenger deduplication regressed';
  end if;
end $$;

commit;
