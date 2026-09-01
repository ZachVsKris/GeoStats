begin;

-- A v16.3 function replacement inadvertently stopped naming the eight rows
-- that had failed the complete production-solver reachability audit. They
-- remained disabled, but the durable import boundary must also preserve that
-- decision until a separately tested solver change makes each row reachable.
create or replace function public.v16_2_7_durable_exclusion_reason(
  p_id text,p_title text,p_source text,p_indicator text
) returns text language sql immutable set search_path='' as $$
  select case
    when p_id in (
      'pew-religion:jewish-share',
      'undp-hdr:gdi','undp-hdr:gii','undp-hdr:phdi',
      'worldbankclimate:coldest','worldbankclimate:driest',
      'worldbankclimate:hottest','worldbankclimate:wettest'
    ) then 'v16.3.1 restored production-solver reachability exclusion'
    when p_id='koppen-geiger:tropical-savanna-share'
      then 'v16.3.0 durable owner-directed tropical-savanna climate exclusion'
    when coalesce(p_source,'')='World Bank'
      and upper(coalesce(p_indicator,'')) ~ '^(BM|BX)\.GSR\.'
      and upper(coalesce(p_indicator,'')) !~ '^(BM|BX)\.GSR\.MRCH\.'
      then 'v16.3.1 durable owner-directed services-import/export exclusion'
    when p_id in (
      'exports','imports','exportsShare',
      'worldbank-catalog:bx-gsr-gnfs-cd','worldbank-catalog:bm-gsr-gnfs-cd',
      'worldbank-catalog:bx-gsr-totl-cd','worldbank-catalog:bx-gsr-nfsv-cd',
      'worldbank-catalog:bm-gsr-nfsv-cd','worldbank-catalog:bn-gsr-gnfs-cd',
      'unescoich:most-elements','worldbank-catalog:bn-gsr-fcty-cd',
      'worldbank-catalog:bn-trf-curr-cd','worldbank-catalog:bg-gsr-nfsv-gd-zs'
    ) then 'v16.3.1 durable owner-directed gameplay exclusion'
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

update public.stat_categories
set updated_at=now()
where id in (
  'pew-religion:jewish-share',
  'undp-hdr:gdi','undp-hdr:gii','undp-hdr:phdi',
  'worldbankclimate:coldest','worldbankclimate:driest',
  'worldbankclimate:hottest','worldbankclimate:wettest'
);

update public.category_review_state
set updated_at=now()
where category_id in (
  'pew-religion:jewish-share',
  'undp-hdr:gdi','undp-hdr:gii','undp-hdr:phdi',
  'worldbankclimate:coldest','worldbankclimate:driest',
  'worldbankclimate:hottest','worldbankclimate:wettest'
);

select public.refresh_v16_2_runtime_catalog();

do $$
begin
  if (select count(*) from public.category_runtime_review_v16_2 where computed_playable_v16_2)<>306
     or (select count(*) from public.category_runtime_review_v16_2 where computed_playable_v16_2 and enabled and eligible_daily)<>306
  then raise exception 'v16.3.1 durable reachability restoration did not leave one 306-category catalog'; end if;
  if exists (
    select 1 from public.category_runtime_review_v16_2
    where id in (
      'pew-religion:jewish-share',
      'undp-hdr:gdi','undp-hdr:gii','undp-hdr:phdi',
      'worldbankclimate:coldest','worldbankclimate:driest',
      'worldbankclimate:hottest','worldbankclimate:wettest'
    ) and (computed_playable_v16_2 or enabled or eligible_daily)
  ) then raise exception 'v16.3.1 production-solver reachability exclusion regressed'; end if;
end $$;

commit;
