begin;

-- The owner does not want services-import, services-export, or combined
-- goods-and-services measures in gameplay. Match the World Bank indicator
-- family as well as known IDs so later imports cannot restore renamed rows.
create or replace function public.v16_2_7_durable_exclusion_reason(
  p_id text,p_title text,p_source text,p_indicator text
) returns text language sql immutable set search_path='' as $$
  select case
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

create or replace function public.apply_v16_3_1_catalog_integrity()
returns void
language plpgsql
security invoker
set search_path=public
as $$
begin
  -- Reapply reviewed player titles after any source/import refresh. Explicit %
  -- wording is part of the clarity contract and must agree with the runtime.
  with copy(id,title) as (values
    ('agLand','Highest % of land used for agriculture'),
    ('arablePct','Highest % of land that is arable'),
    ('education','Highest education spending as % of GDP'),
    ('forestPct','Highest % of land covered by forest'),
    ('healthSpendShare','Highest health spending as % of GDP'),
    ('natural-earth:highest-mapped-glaciated-share','Highest % of land covered by glaciers'),
    ('natural-earth:highest-mapped-lake-share','Highest % of land covered by lakes and reservoirs'),
    ('pew-religion:hindu-share','Highest % of population that is Hindu'),
    ('protected','Highest % of land protected'),
    ('unwpp:highest-male-share','Highest % of population that is male'),
    ('worldbank-catalog:ag-lnd-crop-zs','Highest % of land in permanent crops'),
    ('worldbank-catalog:bx-trf-pwkr-dt-gd-zs','Highest money sent home from abroad as % of GDP'),
    ('worldbank-catalog:eg-elc-fosl-zs','Highest % of electricity from fossil fuels'),
    ('worldbank-catalog:eg-elc-hyro-zs','Highest % of electricity from hydropower'),
    ('worldbank-catalog:eg-elc-ngas-zs','Highest % of electricity from natural gas'),
    ('worldbank-catalog:eg-elc-petr-zs','Highest % of electricity from oil'),
    ('worldbank-catalog:eg-use-comm-cl-zs','Highest % of energy from alternative and nuclear sources'),
    ('worldbank-catalog:eg-use-crnw-zs','Highest % of energy from biomass and waste'),
    ('worldbank-catalog:en-ghg-co2-pi-mt-ce-ar5','Most CO₂ emissions from power generation'),
    ('worldbank-catalog:en-urb-lcty-ur-zs','Highest % of urban residents living in the largest city'),
    ('worldbank-catalog:en-urb-mcty-tl-zs','Highest % of people in cities over one million'),
    ('worldbank-catalog:er-h2o-fwag-zs','Highest % of freshwater withdrawals used by agriculture'),
    ('worldbank-catalog:er-h2o-fwdm-zs','Highest % of freshwater withdrawals used by households'),
    ('worldbank-catalog:er-h2o-fwin-zs','Highest % of freshwater withdrawals used by industry'),
    ('worldbank-catalog:er-mrn-ptmr-zs','Highest % of territorial waters protected'),
    ('worldbank-catalog:fx-own-totl-zs','Highest % of adults with a financial or mobile money account'),
    ('worldbank-catalog:gc-tax-totl-gd-zs','Highest tax revenue as % of GDP'),
    ('worldbank-catalog:ms-mil-xpnd-zs','Highest military spending as % of government spending'),
    ('faostat-qcl-apricots-production-01343-5510-t','Most apricots produced'),
    ('faostat-qcl-avocados-production-01311-5510-t','Most avocados produced'),
    ('faostat-qcl-papayas-production-01317-5510-t','Most papayas produced'),
    ('faostat-qcl-pineapples-production-01318-5510-t','Most pineapples produced'),
    ('faostat-qcl-pulses-total-production-f1726-5510-t','Most pulses produced')
  )
  update public.stat_categories c
  set title=copy.title,
      content_review_status='approved',
      content_review_reason='v16.3.1 durable catalog copy and semantic review.',
      content_review_version='geostats-v16.3.1-catalog-integrity',
      updated_at=now()
  from copy where c.id=copy.id;

  update public.stat_categories
  set description=case id
        when 'faostat-qcl-apricots-production-01343-5510-t' then 'Total apricots produced during the year.'
        when 'faostat-qcl-avocados-production-01311-5510-t' then 'Total avocados produced during the year.'
        when 'faostat-qcl-papayas-production-01317-5510-t' then 'Total papayas produced during the year.'
        when 'faostat-qcl-pineapples-production-01318-5510-t' then 'Total pineapples produced during the year.'
        when 'faostat-qcl-pulses-total-production-f1726-5510-t' then 'Total dried beans, lentils, peas, and chickpeas produced during the year.'
        else description end,
      plain_language_description=case id
        when 'faostat-qcl-apricots-production-01343-5510-t' then 'Total apricots produced during the year.'
        when 'faostat-qcl-avocados-production-01311-5510-t' then 'Total avocados produced during the year.'
        when 'faostat-qcl-papayas-production-01317-5510-t' then 'Total papayas produced during the year.'
        when 'faostat-qcl-pineapples-production-01318-5510-t' then 'Total pineapples produced during the year.'
        when 'faostat-qcl-pulses-total-production-f1726-5510-t' then 'Total dried beans, lentils, peas, and chickpeas produced during the year.'
        else plain_language_description end,
      updated_at=now()
  where id in (
    'faostat-qcl-apricots-production-01343-5510-t','faostat-qcl-avocados-production-01311-5510-t',
    'faostat-qcl-papayas-production-01317-5510-t','faostat-qcl-pineapples-production-01318-5510-t',
    'faostat-qcl-pulses-total-production-f1726-5510-t'
  );

  -- Repair taxonomy exposed by the catalog audit. Consumption is its own
  -- subject, dates are history, and total country area is geography.
  update public.stat_categories
  set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'broadDomain','consumption','knowledgeCluster','food-consumption',
        'taxonomyVersion','geostats-v16.3.1'
      ),updated_at=now()
  where source_organization='FAOSTAT Food Balances';

  update public.stat_categories
  set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'broadDomain','history','knowledgeCluster','historical-state-institutions',
        'taxonomyVersion','geostats-v16.3.1'
      ),updated_at=now()
  where id in ('history:un-admission','history:oldest-current-constitution');

  update public.stat_categories
  set family='Geography',icon='🗺️',
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'broadDomain','physical-geography','knowledgeCluster','physical-land-form',
        'strategyFamily','physical-land-form','taxonomyVersion','geostats-v16.3.1'
      ),updated_at=now()
  where id='worldbank-catalog:ag-srf-totl-k2';

  update public.stat_categories set icon='🪖',updated_at=now()
  where id='worldbank-catalog:ms-mil-mprt-kd';
  update public.stat_categories set icon='🪖',updated_at=now()
  where id='worldbank-catalog:ms-mil-xpnd-zs';
  update public.stat_categories set icon='🧾',updated_at=now()
  where id='worldbank-catalog:gc-tax-totl-gd-zs';

  -- Replace the blanket grain icon with the actual commodity or animal. The
  -- residual grain icon is reserved for cereals and genuinely grain-like rows.
  update public.stat_categories c
  set icon=case
    when lower(c.title) ~ 'donkey|asses' then '🫏'
    when lower(c.title) ~ 'mule|hinny|horse' then '🐎'
    when lower(c.title) ~ 'cattle|buffalo' then '🐄'
    when lower(c.title) ~ 'goat' then '🐐'
    when lower(c.title) ~ 'sheep' then '🐑'
    when lower(c.title) ~ 'pig population|swine' then '🐖'
    when lower(c.title) ~ 'pork' then '🥓'
    when lower(c.title) ~ 'chicken|poultry' then '🐔'
    when lower(c.title) ~ 'egg' then '🥚'
    when lower(c.title) ~ 'honey' then '🍯'
    when lower(c.title) ~ 'almond|walnut|tree nut|peanut' then '🥜'
    when lower(c.title) ~ 'apricot|peach|nectarine' then '🍑'
    when lower(c.title) ~ 'apple' then '🍎'
    when lower(c.title) ~ 'avocado' then '🥑'
    when lower(c.title) ~ 'cherr' then '🍒'
    when lower(c.title) ~ 'coconut' then '🥥'
    when lower(c.title) ~ 'grape' then '🍇'
    when lower(c.title) ~ 'lemon|lime' then '🍋'
    when lower(c.title) ~ 'orange|mandarin|tangerine|grapefruit|pomelo' then '🍊'
    when lower(c.title) ~ 'mango' then '🥭'
    when lower(c.title) ~ 'pineapple|papaya' then '🍍'
    when lower(c.title) ~ 'pear' then '🍐'
    when lower(c.title) ~ 'strawberr' then '🍓'
    when lower(c.title) ~ 'watermelon|melon' then '🍉'
    when lower(c.title) ~ 'tomato' then '🍅'
    when lower(c.title) ~ 'sweet potato' then '🍠'
    when lower(c.title) ~ 'potato|cassava|roots and tubers' then '🥔'
    when lower(c.title) ~ 'carrot' then '🥕'
    when lower(c.title) ~ 'cucumber|gherkin' then '🥒'
    when lower(c.title) ~ 'eggplant' then '🍆'
    when lower(c.title) ~ 'chili|pepper' then '🌶️'
    when lower(c.title) ~ 'onion|shallot' then '🧅'
    when lower(c.title) ~ 'mushroom|truffle' then '🍄'
    when lower(c.title) ~ 'broccoli|cauliflower' then '🥦'
    when lower(c.title) ~ 'cabbage|lettuce|vegetable' then '🥬'
    when lower(c.title) ~ 'pumpkin|squash|gourd' then '🎃'
    when lower(c.title) ~ 'corn|maize' then '🌽'
    when lower(c.title) ~ 'rice' then '🍚'
    when lower(c.title) ~ 'beans|pulses|peas|soybean' then '🫘'
    when lower(c.title) ~ 'coffee' then '☕'
    when lower(c.title) ~ 'beer' then '🍺'
    when lower(c.title) ~ 'wine' then '🍷'
    when lower(c.title) ~ 'cheese' then '🧀'
    when lower(c.title) ~ 'butter|ghee' then '🧈'
    when lower(c.title) ~ 'milk' then '🥛'
    when lower(c.title) ~ 'cotton' then '🧵'
    when lower(c.title) ~ 'sugar' then '🍬'
    when lower(c.title) ~ 'sunflower|sesame' then '🌻'
    else c.icon end,
    content_review_status='approved',
    content_review_reason='v16.3.1 semantic icon audit.',
    content_review_version='geostats-v16.3.1-catalog-integrity',
    updated_at=now()
  where c.source_organization='FAOSTAT';

  update public.stat_categories c
  set review_status='rejected',curation_status='excluded',content_review_status='excluded',
      curation_reason='Owner-retired services-import/export or combined goods-and-services category.',
      content_review_reason='Owner-retired services-import/export or combined goods-and-services category.',
      curation_version='geostats-v16.3.1-catalog-integrity',
      content_review_version='geostats-v16.3.1-catalog-integrity',
      enabled=false,eligible_daily=false,updated_at=now()
  where public.v16_2_7_durable_exclusion_reason(c.id,c.title,c.source_organization,c.source_indicator_code)
        like 'v16.3.1 durable owner-directed%';

  update public.category_review_state r
  set status='rejected',duplicate_of=null,
      notes=concat_ws(E'\n',nullif(r.notes,''),'v16.3.1 durable owner-directed catalog exclusion.'),
      updated_at=now()
  from public.stat_categories c
  where r.category_id=c.id
    and public.v16_2_7_durable_exclusion_reason(c.id,c.title,c.source_organization,c.source_indicator_code)
        like 'v16.3.1 durable owner-directed%';

  update public.stat_categories c
  set metadata=jsonb_set(
        coalesce(c.metadata,'{}'::jsonb),'{boardDescription}',
        to_jsonb(public.category_board_description_v16_2_8(
          c.title,coalesce(c.plain_language_description,c.description),c.unit,
          c.metadata->>'boardDescription'
        )),true
      ),updated_at=now()
  where c.enabled and c.eligible_daily;
end;
$$;

revoke execute on function public.apply_v16_3_1_catalog_integrity() from public,anon,authenticated;
grant execute on function public.apply_v16_3_1_catalog_integrity() to service_role;

-- Run the durable correction before semantic/promotion assessment and again
-- after flag synchronization. SQL and the application therefore publish one
-- identical catalog instead of silently disagreeing.
create or replace function public.refresh_v16_2_runtime_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='300s'
as $$
begin
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_6_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  update public.stat_categories set measurement_type='total',updated_at=now() where source_organization='World Bank' and source_indicator_code='EN.URB.LCTY';
  update public.stat_categories set measurement_type='per_capita',updated_at=now() where source_organization='World Bank' and source_indicator_code in ('AG.LND.ARBL.HA.PC','FB.ATM.TOTL.P5','FB.CBK.BRCH.P5');
  perform public.apply_v16_2_7_legacy_reaudit();
  perform public.apply_v16_2_7_exact_title_deduplication();
  perform public.apply_v16_3_runtime_corrections();
  perform public.apply_v16_3_1_catalog_integrity();
  perform public.refresh_category_decision_provenance_v16_2_7();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();

  update public.stat_categories c
  set enabled=false,eligible_daily=false,updated_at=now()
  from public.category_runtime_review_v16_2 v
  where v.id=c.id and not v.computed_playable_v16_2 and (c.enabled or c.eligible_daily);

  update public.stat_categories c
  set enabled=true,eligible_daily=true,updated_at=now()
  from public.category_runtime_review_v16_2 v
  where v.id=c.id and v.computed_playable_v16_2
    and not (c.enabled and c.eligible_daily)
    and exists (
      select 1 from public.generator_reachability_v16_2_7 r
      where r.category_id=c.id
      group by r.category_id
      having count(*)=3 and bool_and(r.reachable)
    );

  perform public.apply_v16_3_runtime_corrections();
  perform public.apply_v16_3_1_catalog_integrity();
end;
$$;

select public.refresh_v16_2_runtime_catalog();

do $$
declare
  v_sql_catalog integer;
  v_enabled_catalog integer;
begin
  select count(*) into v_sql_catalog
  from public.category_runtime_review_v16_2
  where computed_playable_v16_2 and enabled and eligible_daily;
  select count(*) into v_enabled_catalog
  from public.category_runtime_review_v16_2
  where enabled and eligible_daily;

  if v_sql_catalog<>306 or v_enabled_catalog<>306 then
    raise exception 'v16.3.1 expected one 306-category SQL/runtime catalog, found SQL %, enabled %',v_sql_catalog,v_enabled_catalog;
  end if;
  if exists (
    select 1 from public.category_runtime_review_v16_2
    where computed_playable_v16_2 and enabled and eligible_daily
      and (
        (value_type='percentage' and title ~* '(^|[^a-z])share([^a-z]|$)')
        or (value_type='total' and title ~* '^Highest ')
        or measurement_type='other'
      )
  ) then raise exception 'v16.3.1 SQL catalog still conflicts with runtime copy/measurement gates'; end if;
  if exists (
    select 1 from public.category_runtime_review_v16_2
    where computed_playable_v16_2 and enabled and eligible_daily
      and source_organization='World Bank'
      and upper(source_indicator_code) ~ '^(BM|BX)\.GSR\.'
      and upper(source_indicator_code) !~ '^(BM|BX)\.GSR\.MRCH\.'
  ) then raise exception 'v16.3.1 services-import/export retirement regressed'; end if;
  if exists (
    select 1 from public.category_runtime_review_v16_2
    where computed_playable_v16_2 and enabled and eligible_daily
      and nullif(trim(coalesce(metadata->>'broadDomain','')),'') is null
  ) then raise exception 'v16.3.1 playable category is missing a broad domain'; end if;
  if not exists (
    select 1 from public.category_runtime_review_v16_2
    where id='worldbank-catalog:ms-mil-mprt-kd' and computed_playable_v16_2 and icon='🪖'
  ) then raise exception 'v16.3.1 arms-import icon correction failed'; end if;
  if not exists (
    select 1 from public.category_runtime_review_v16_2
    where id='worldbank-catalog:ag-srf-totl-k2' and computed_playable_v16_2
      and icon='🗺️' and family='Geography' and metadata->>'broadDomain'='physical-geography'
  ) then raise exception 'v16.3.1 country-area taxonomy correction failed'; end if;
  if exists (
    select 1 from public.category_runtime_review_v16_2
    where computed_playable_v16_2 and enabled and eligible_daily
      and source_organization='FAOSTAT Food Balances' and metadata->>'broadDomain'<>'consumption'
  ) then raise exception 'v16.3.1 consumption taxonomy correction failed'; end if;
  if (
    select count(*) from public.category_runtime_review_v16_2
    where computed_playable_v16_2 and enabled and eligible_daily and icon='🌾'
  )>30 then raise exception 'v16.3.1 semantic icon audit left the generic grain icon overused'; end if;
end $$;

commit;
