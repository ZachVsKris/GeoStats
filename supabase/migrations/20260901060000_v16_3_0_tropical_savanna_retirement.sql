begin;

-- This is a precise Köppen-Geiger climate class, but its accurate definition
-- requires an awkward rainfall formula. Do not mislabel it as savanna land
-- cover. Retire it from future boards and retain short copy only so immutable
-- historical boards remain readable.
update public.stat_categories
set title='Most land with a hot, seasonally dry climate',
    description='Land that stays at least 18°C year-round and has a pronounced dry season.',
    plain_language_description='Land that stays at least 18°C year-round and has a pronounced dry season.',
    review_status='rejected',
    curation_status='excluded',
    content_review_status='excluded',
    curation_reason='Owner review: the tropical savanna climate class needs a formula too technical for a game card and must not be presented as savanna land cover.',
    content_review_reason='Owner review: retire the combined tropical savanna climate measure; preserve only concise historical-board copy.',
    curation_version='geostats-v16.3.0-owner-retirement',
    content_review_version='geostats-v16.3.0-owner-retirement',
    enabled=false,
    eligible_daily=false,
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'plainLanguageDescription','Land that stays at least 18°C year-round and has a pronounced dry season.',
      'boardDescription','Land that stays at least 18°C year-round and has a pronounced dry season.',
      'ownerRetired',true,
      'ownerRetiredVersion','16.3.0',
      'ownerRetiredReason','Combined tropical savanna climate definition is too technical for gameplay; do not conflate it with savanna land cover.'
    ),
    updated_at=now()
where id='koppen-geiger:tropical-savanna-share';

insert into public.category_review_state(category_id,status,duplicate_of,confusing,notes,reviewed_at,updated_at)
values (
  'koppen-geiger:tropical-savanna-share','rejected',null,true,
  'v16.3.0 owner retirement: accurate wording requires a formula that is too technical for a game card; savanna land cover must use a separate source.',
  now(),now()
)
on conflict(category_id) do update
set status='rejected', duplicate_of=null, confusing=true,
    notes=concat_ws(E'\n',nullif(category_review_state.notes,''),excluded.notes),
    reviewed_at=excluded.reviewed_at, updated_at=excluded.updated_at;

-- Repair the last two verified history rows that predate the canonical domain
-- metadata. This removes an unnecessary fail-closed catalog discrepancy.
update public.stat_categories
set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'broadDomain','history',
      'knowledgeCluster','history-civics',
      'taxonomyVersion','geostats-v16.3.0'
    ),
    updated_at=now()
where id in ('history:oldest-current-constitution','history:un-admission');

-- Re-imports may rediscover the source row. Keep the owner decision at the
-- database boundary as well as in the application/importer hard gates.
create or replace function public.v16_2_7_durable_exclusion_reason(
  p_id text,p_title text,p_source text,p_indicator text
) returns text language sql immutable set search_path='' as $$
  select case
    when p_id='koppen-geiger:tropical-savanna-share'
      then 'v16.3.0 durable owner-directed tropical-savanna climate exclusion'
    when p_id in (
      'exportsShare','worldbank-catalog:bx-gsr-gnfs-cd','worldbank-catalog:bm-gsr-gnfs-cd',
      'worldbank-catalog:bx-gsr-totl-cd','worldbank-catalog:bx-gsr-nfsv-cd',
      'worldbank-catalog:bm-gsr-nfsv-cd','worldbank-catalog:bn-gsr-gnfs-cd',
      'worldbank-catalog:bx-gsr-tran-zs','unescoich:most-elements',
      'worldbank-catalog:bn-gsr-fcty-cd','worldbank-catalog:bn-trf-curr-cd',
      'worldbank-catalog:bg-gsr-nfsv-gd-zs'
    ) then 'v16.2.9 durable owner-directed gameplay exclusion'
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

-- The remaining ten independently understandable Köppen-Geiger measures keep
-- their all-or-nothing validation gate; the retired category is not promoted.
create or replace function public.promote_v16_2_9_koppen_bundle()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  expected_ids constant text[] := array[
    'koppen-geiger:desert-share','koppen-geiger:arid-share','koppen-geiger:steppe-share',
    'koppen-geiger:tropical-rainforest-share','koppen-geiger:tropical-monsoon-share',
    'koppen-geiger:temperate-share','koppen-geiger:mediterranean-share',
    'koppen-geiger:continental-share','koppen-geiger:polar-share','koppen-geiger:tundra-share'
  ];
  ready_count integer;
  playable_count integer;
begin
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();

  select count(*)::integer into ready_count
  from public.category_runtime_review_v16 c
  where c.id=any(expected_ids)
    and c.validation_status='verified'
    and greatest(c.common_year_coverage,c.country_coverage)>=180
    and c.top_value_distinct_count>=8
    and coalesce(c.content_review_status,'pending')<>'excluded'
    and coalesce(c.curation_status,'pending')<>'excluded';

  if ready_count<>cardinality(expected_ids) then
    raise exception 'v16.3.0 Köppen bundle is incomplete or failed validation: % of % categories are ready',ready_count,cardinality(expected_ids);
  end if;

  update public.stat_categories
  set review_status='approved',curation_status='approved',content_review_status='approved',
      curation_reason='v16.3.0 bounded climate-geography bundle: passed source, coverage, distinct-value, integrity, and Top-20 feasibility gates.',
      content_review_reason='Clear player-facing climate-area share from the peer-reviewed 1991–2020 Köppen-Geiger classification.',
      curation_version='geostats-v16.3.0-bounded-koppen',
      content_review_version='geostats-v16.3.0-bounded-koppen',
      immediate_comprehension_score=greatest(coalesce(immediate_comprehension_score,0),90),
      gameplay_interest_score=greatest(coalesce(gameplay_interest_score,0),92),
      uniqueness_score=greatest(coalesce(uniqueness_score,0),86),updated_at=now()
  where id=any(expected_ids);

  insert into public.category_review_state(
    category_id,status,duplicate_of,political_self_reported,confusing,
    esoteric,subjective_or_composite,stale_data,poor_coverage,notes,reviewed_at,updated_at
  )
  select id,'approved',null,false,false,false,false,false,false,
    'v16.3.0 bounded climate-geography bundle approved after reproducible 195-country feasibility and stored-source integrity audits.',now(),now()
  from public.stat_categories where id=any(expected_ids)
  on conflict(category_id) do update
  set status='approved',duplicate_of=null,political_self_reported=false,confusing=false,
      esoteric=false,subjective_or_composite=false,stale_data=false,poor_coverage=false,
      notes=concat_ws(E'\n',nullif(category_review_state.notes,''),excluded.notes),
      reviewed_at=excluded.reviewed_at,updated_at=excluded.updated_at;

  perform public.refresh_category_decision_provenance_v16_2_7();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.refresh_v16_2_runtime_catalog();

  select count(*)::integer into playable_count
  from public.category_runtime_review_v16_2
  where id=any(expected_ids) and computed_playable_v16_2;

  if playable_count<>cardinality(expected_ids) then
    raise exception 'v16.3.0 Köppen publication failed closed: % of % categories became playable',playable_count,cardinality(expected_ids);
  end if;
  return playable_count;
end
$$;

revoke all on function public.promote_v16_2_9_koppen_bundle() from public,anon,authenticated;
grant execute on function public.promote_v16_2_9_koppen_bundle() to service_role;

do $$
begin
  if exists (
    select 1 from public.stat_categories
    where id='koppen-geiger:tropical-savanna-share'
      and (review_status<>'rejected' or curation_status<>'excluded'
        or content_review_status<>'excluded' or enabled or eligible_daily)
  ) then raise exception 'tropical-savanna category did not remain fail-closed'; end if;
end $$;

commit;
