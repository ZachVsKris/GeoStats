begin;

-- Owner-directed removal: this service-composition ratio is too technical and
-- was explicitly rejected for gameplay. Historical boards and scores remain.
create temporary table v079_remove (
  id text primary key,
  reason text not null
) on commit drop;

insert into v079_remove (id, reason) values
  ('worldbank-catalog:bx-gsr-tran-zs', 'Owner review: remove transport services as a share of service exports from gameplay.');

-- Preserve all earlier durable exclusions and extend the database boundary so
-- no later importer or review action can reactivate this category.
create or replace function public.v16_2_7_durable_exclusion_reason(
  p_id text,p_title text,p_source text,p_indicator text
) returns text language sql immutable as $$
  select case
    when p_id in (
      'exportsShare',
      'worldbank-catalog:bx-gsr-gnfs-cd',
      'worldbank-catalog:bm-gsr-gnfs-cd',
      'worldbank-catalog:bx-gsr-totl-cd',
      'worldbank-catalog:bx-gsr-nfsv-cd',
      'worldbank-catalog:bm-gsr-nfsv-cd',
      'worldbank-catalog:bn-gsr-gnfs-cd',
      'worldbank-catalog:bx-gsr-tran-zs',
      'unescoich:most-elements',
      'worldbank-catalog:bn-gsr-fcty-cd',
      'worldbank-catalog:bn-trf-curr-cd',
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

update public.stat_categories c
set review_status='rejected',
    curation_status='excluded',
    content_review_status='excluded',
    curation_reason=r.reason,
    content_review_reason=r.reason,
    curation_version='geostats-v16.2.9-owner-retirement',
    content_review_version='geostats-v16.2.9-owner-retirement',
    enabled=false,
    eligible_daily=false,
    updated_at=now()
from v079_remove r
where c.id=r.id;

update public.category_review_state r
set status='rejected',
    duplicate_of=null,
    notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.9 durable owner-directed transport-services exclusion.'),
    updated_at=now()
from v079_remove x
where r.category_id=x.id;

select public.refresh_category_decision_provenance_v16_2_7();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

do $$
begin
  if exists (
    select 1
    from public.category_runtime_review_v16_2 c
    join v079_remove r on r.id=c.id
    where c.computed_playable_v16_2 or c.enabled or c.eligible_daily
  ) then
    raise exception 'v16.2.9 owner-directed category removal did not remain fail-closed';
  end if;
end $$;

-- The bounded climate-geography job imports only the eleven candidates that
-- cleared the independent 195-country feasibility audit. This RPC is the sole
-- publication boundary: an incomplete, unverified, low-coverage, or
-- insufficiently distinct bundle fails atomically and remains unavailable.
create or replace function public.promote_v16_2_9_koppen_bundle()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  expected_ids constant text[] := array[
    'koppen-geiger:desert-share',
    'koppen-geiger:arid-share',
    'koppen-geiger:steppe-share',
    'koppen-geiger:tropical-rainforest-share',
    'koppen-geiger:tropical-monsoon-share',
    'koppen-geiger:tropical-savanna-share',
    'koppen-geiger:temperate-share',
    'koppen-geiger:mediterranean-share',
    'koppen-geiger:continental-share',
    'koppen-geiger:polar-share',
    'koppen-geiger:tundra-share'
  ];
  ready_count integer;
  playable_count integer;
begin
  select count(*)::integer into ready_count
  from public.category_runtime_review_v16 c
  where c.id=any(expected_ids)
    and c.validation_status='verified'
    and greatest(c.common_year_coverage,c.country_coverage)>=180
    and c.top_value_distinct_count>=8
    and coalesce(c.content_review_status,'pending')<>'excluded'
    and coalesce(c.curation_status,'pending')<>'excluded';

  if ready_count<>cardinality(expected_ids) then
    raise exception 'v16.2.9 Köppen bundle is incomplete or failed validation: % of % categories are ready',ready_count,cardinality(expected_ids);
  end if;

  update public.stat_categories
  set review_status='approved',
      curation_status='approved',
      content_review_status='approved',
      curation_reason='v16.2.9 bounded climate-geography bundle: passed independent source, coverage, distinct-value, integrity, and Top-20 feasibility gates.',
      content_review_reason='Clear player-facing climate-area share from the peer-reviewed 1991–2020 Köppen-Geiger classification.',
      curation_version='geostats-v16.2.9-bounded-koppen',
      content_review_version='geostats-v16.2.9-bounded-koppen',
      immediate_comprehension_score=greatest(coalesce(immediate_comprehension_score,0),90),
      gameplay_interest_score=greatest(coalesce(gameplay_interest_score,0),92),
      uniqueness_score=greatest(coalesce(uniqueness_score,0),86),
      updated_at=now()
  where id=any(expected_ids);

  insert into public.category_review_state(category_id,status,duplicate_of,notes,reviewed_at,updated_at)
  select id,'approved',null,'v16.2.9 bounded climate-geography bundle approved after reproducible 195-country feasibility and stored-source integrity audits.',now(),now()
  from public.stat_categories
  where id=any(expected_ids)
  on conflict(category_id) do update
  set status='approved',
      duplicate_of=null,
      notes=concat_ws(E'\n',nullif(category_review_state.notes,''),excluded.notes),
      reviewed_at=excluded.reviewed_at,
      updated_at=excluded.updated_at;

  perform public.refresh_category_decision_provenance_v16_2_7();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.refresh_v16_2_runtime_catalog();

  select count(*)::integer into playable_count
  from public.category_runtime_review_v16_2
  where id=any(expected_ids) and computed_playable_v16_2;

  if playable_count<>cardinality(expected_ids) then
    raise exception 'v16.2.9 Köppen publication failed closed: % of % categories became playable',playable_count,cardinality(expected_ids);
  end if;
  return playable_count;
end
$$;

revoke all on function public.promote_v16_2_9_koppen_bundle() from public,anon,authenticated;
grant execute on function public.promote_v16_2_9_koppen_bundle() to service_role;

commit;
