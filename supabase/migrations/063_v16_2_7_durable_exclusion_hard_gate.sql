begin;

-- A later staging refresh must never reopen a deliberate product exclusion.
-- Centralize every v16.2.7 durable anti-proliferation/product rule behind a
-- table-boundary predicate so importer upserts and catalog staging cannot drift.
create or replace function public.v16_2_7_durable_exclusion_reason(
  p_id text,p_title text,p_source text,p_indicator text
) returns text language sql immutable as $$
  select case
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

create or replace function public.enforce_v16_2_7_category_product_exclusions()
returns trigger language plpgsql set search_path=public as $$
declare why text;
begin
  why := public.v16_2_7_durable_exclusion_reason(new.id,new.title,new.source_organization,new.source_indicator_code);
  if why is not null then
    new.enabled := false;
    new.eligible_daily := false;
    new.review_status := 'rejected';
    new.curation_status := 'excluded';
    new.content_review_status := 'excluded';
    new.curation_reason := why||': this category is intentionally outside the curated playable catalog.';
    new.content_review_reason := new.curation_reason;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_v16_2_7_category_product_exclusions on public.stat_categories;
create trigger trg_enforce_v16_2_7_category_product_exclusions
before insert or update on public.stat_categories
for each row execute function public.enforce_v16_2_7_category_product_exclusions();

create or replace function public.enforce_v16_2_7_review_product_exclusions()
returns trigger language plpgsql set search_path=public as $$
declare c record; why text;
begin
  select id,title,source_organization,source_indicator_code into c
  from public.stat_categories where id=new.category_id;
  why := public.v16_2_7_durable_exclusion_reason(c.id,c.title,c.source_organization,c.source_indicator_code);
  if why is not null then
    new.status := 'rejected';
    new.duplicate_of := null;
    new.notes := why||': protected at the table boundary from importer/staging reactivation.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_v16_2_7_review_product_exclusions on public.category_review_state;
create trigger trg_enforce_v16_2_7_review_product_exclusions
before insert or update on public.category_review_state
for each row execute function public.enforce_v16_2_7_review_product_exclusions();

-- Normalize all existing durable rows immediately through the new triggers.
update public.stat_categories
set updated_at=now()
where public.v16_2_7_durable_exclusion_reason(id,title,source_organization,source_indicator_code) is not null;
update public.category_review_state r set updated_at=now()
from public.stat_categories c
where c.id=r.category_id
  and public.v16_2_7_durable_exclusion_reason(c.id,c.title,c.source_organization,c.source_indicator_code) is not null;

select public.refresh_category_decision_provenance_v16_2_7();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

commit;
