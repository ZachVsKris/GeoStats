begin;

-- Owner-directed removal of services-only trade totals and every remaining
-- playable trade measure that pools goods/products with services.
create temporary table v074_remove (
  id text primary key,
  reason text not null
) on commit drop;

insert into v074_remove (id,reason) values
  ('exportsShare','Owner review: remove the combined goods-and-services exports percentage from gameplay.'),
  ('worldbank-catalog:bx-gsr-gnfs-cd','Owner review: remove the combined products-and-services export total from gameplay.'),
  ('worldbank-catalog:bm-gsr-gnfs-cd','Owner review: remove the combined products-and-services import total from gameplay.'),
  ('worldbank-catalog:bx-gsr-totl-cd','Owner review: remove the combined export-and-overseas-income receipts total from gameplay.'),
  ('worldbank-catalog:bx-gsr-nfsv-cd','Owner review: remove the services-export total from gameplay.'),
  ('worldbank-catalog:bm-gsr-nfsv-cd','Owner review: remove the services-import total from gameplay.'),
  ('worldbank-catalog:bn-gsr-gnfs-cd','Owner review: remove the combined products-and-services trade-surplus total from gameplay.');

-- Preserve every prior durable exclusion while extending the database boundary
-- to the seven newly retired trade measures.
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
    curation_version='geostats-v16.2.8-owner-trade-retirements',
    content_review_version='geostats-v16.2.8-owner-trade-retirements',
    enabled=false,
    eligible_daily=false,
    updated_at=now()
from v074_remove r
where c.id=r.id;

update public.category_review_state r
set status='rejected',
    duplicate_of=null,
    notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.8 durable owner-directed trade-category exclusion.'),
    updated_at=now()
from v074_remove x
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
    join v074_remove r on r.id=c.id
    where c.computed_playable_v16_2 or c.enabled or c.eligible_daily
  ) then
    raise exception 'v16.2.8 trade-category removals did not remain fail-closed';
  end if;

  if (select count(*) from public.category_runtime_review_v16_2 where computed_playable_v16_2) <> 316 then
    raise exception 'v16.2.8 trade-category follow-up expected exactly 316 runtime-playable categories';
  end if;
end $$;

commit;
