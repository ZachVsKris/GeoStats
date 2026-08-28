begin;

-- The complete 343-category production-solver audit proved these eight rows
-- unreachable in at least one difficulty profile. Keep them out of the shared
-- Random/Daily catalog until a future, separately tested solver change makes
-- each one reachable in Scout, Adventurer, and Expert.
create or replace function public.v16_2_7_durable_exclusion_reason(
  p_id text,p_title text,p_source text,p_indicator text
) returns text language sql immutable as $$
  select case
    when p_id in (
      'pew-religion:jewish-share',
      'undp-hdr:gdi','undp-hdr:gii','undp-hdr:phdi',
      'worldbankclimate:coldest','worldbankclimate:driest',
      'worldbankclimate:hottest','worldbankclimate:wettest'
    ) then 'v16.2.7 production-solver reachability exclusion'
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

-- Re-run the established table-boundary triggers for the diagnosed rows, then
-- recompute every derived gate before a new reachability audit starts.
update public.stat_categories
set updated_at=now()
where id in (
  'pew-religion:jewish-share',
  'undp-hdr:gdi','undp-hdr:gii','undp-hdr:phdi',
  'worldbankclimate:coldest','worldbankclimate:driest',
  'worldbankclimate:hottest','worldbankclimate:wettest'
);

update public.category_review_state r
set updated_at=now()
where r.category_id in (
  'pew-religion:jewish-share',
  'undp-hdr:gdi','undp-hdr:gii','undp-hdr:phdi',
  'worldbankclimate:coldest','worldbankclimate:driest',
  'worldbankclimate:hottest','worldbankclimate:wettest'
);

select public.refresh_category_decision_provenance_v16_2_7();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

commit;
