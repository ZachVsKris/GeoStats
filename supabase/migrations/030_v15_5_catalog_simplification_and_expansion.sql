-- GeoStats v15.5: catalog simplification, intuitive titles, retirement,
-- preferred representatives, cultural/physical source intake, and correlation review.
--
-- Run after the corrected v15.4 installer. Safe to rerun.

begin;

create table if not exists public.v15_5_category_backup (
  category_id text primary key,
  category_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v15_5_category_backup(category_id, category_state)
select id, to_jsonb(category)
from public.stat_categories category
on conflict (category_id) do nothing;

create table if not exists public.v15_5_review_state_backup (
  category_id text primary key,
  review_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v15_5_review_state_backup(category_id, review_state)
select category_id, to_jsonb(review)
from public.category_review_state review
on conflict (category_id) do nothing;

create table if not exists public.category_catalog_editorial_v15_5 (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  editorial_outcome text not null
    check (editorial_outcome in ('daily','random','rewrite','quarantined','retired')),
  player_title text,
  player_description text,
  broad_domain text,
  knowledge_cluster text,
  strategy_family text,
  preferred_category_id text references public.stat_categories(id) on delete set null,
  wonkiness_score integer not null default 0 check (wonkiness_score between 0 and 100),
  clarity_score integer not null default 0 check (clarity_score between 0 and 100),
  decision_reason text not null,
  decision_source text not null default 'v15.5 policy',
  reviewed_at timestamptz not null default now()
);

alter table public.category_catalog_editorial_v15_5
  add column if not exists measure_class text not null default 'unclassified';
alter table public.category_catalog_editorial_v15_5
  add column if not exists normalization_basis text;
alter table public.category_catalog_editorial_v15_5
  add column if not exists normalization_approved boolean not null default false;

create table if not exists public.category_normalization_policy_v15_5 (
  policy_key text primary key,
  allowed_for_daily boolean not null,
  allowed_for_random boolean not null,
  player_label text not null,
  required_numerator text,
  required_denominator text,
  decision_reason text not null,
  updated_at timestamptz not null default now()
);

insert into public.category_normalization_policy_v15_5(
  policy_key,allowed_for_daily,allowed_for_random,player_label,
  required_numerator,required_denominator,decision_reason,updated_at
)
values
  ('absolute-total',true,true,'Absolute national total','Source-reported national total',null,
   'Immediately understandable totals such as amount produced, imported or exported are allowed.',now()),
  ('sector-value-added-share-gdp',true,true,'Sector share of GDP','Sector value added','GDP',
   'A genuine value-added share of GDP is a compatible and intuitive economic-composition measure.',now()),
  ('product-value-added-share-gdp',true,true,'Product share of GDP','Product-specific value added','GDP',
   'Allowed only when the numerator is genuine product-specific value added rather than gross production value.',now()),
  ('product-export-share-total-exports',true,true,'Export dependence','Product export value','Total merchandise export value',
   'An intuitive specialization measure when numerator and denominator use compatible trade values.',now()),
  ('product-production-value-share-ag-output',true,true,'Share of farm output','Product production value','Total agricultural production value',
   'An intuitive agricultural-specialization measure when both values use the same valuation basis.',now()),
  ('electricity-source-share-generation',true,true,'Electricity mix','Generation from one source','Total electricity generation',
   'A clear composition percentage with compatible numerator and denominator.',now()),
  ('land-cover-share-land-area',true,true,'Land-cover share','Area in one land-cover class','Total land area',
   'A clear physical-composition percentage with compatible numerator and denominator.',now()),
  ('yield-per-area',false,false,'Yield per area','Production quantity','Harvested area',
   'Retired: production efficiency per hectare is not immediately intuitive for GeoStats gameplay.',now()),
  ('yield-per-animal',false,false,'Yield per animal','Production quantity','Producing animals',
   'Retired: production efficiency per animal is not immediately intuitive for GeoStats gameplay.',now()),
  ('product-output-per-capita',false,false,'Product output per person','Production quantity','Population',
   'Retired: per-person agricultural output is a normalization rather than the total product concept players expect.',now()),
  ('harvested-area',false,false,'Harvested area','Harvested area',null,
   'Retired: land devoted to a product is not the amount produced.',now()),
  ('animal-stock-or-slaughter-count',false,false,'Animal count','Animal stock or slaughter count',null,
   'Retired from the product-production catalog because it is not the amount of a product produced.',now()),
  ('gross-production-value-to-gdp',false,false,'Gross production value relative to GDP','Gross production value','GDP',
   'Not described as a GDP share because gross production value and GDP value added are not compatible accounting concepts.',now())
on conflict(policy_key) do update set
  allowed_for_daily=excluded.allowed_for_daily,
  allowed_for_random=excluded.allowed_for_random,
  player_label=excluded.player_label,
  required_numerator=excluded.required_numerator,
  required_denominator=excluded.required_denominator,
  decision_reason=excluded.decision_reason,
  updated_at=now();

create table if not exists public.category_similarity_pairs_v15_5 (
  category_id_a text not null references public.stat_categories(id) on delete cascade,
  category_id_b text not null references public.stat_categories(id) on delete cascade,
  overlapping_countries integer not null,
  spearman_correlation numeric(8,5),
  top_10_overlap numeric(8,5),
  top_30_overlap numeric(8,5),
  title_similarity numeric(8,5),
  shared_knowledge_cluster boolean not null default false,
  shared_strategy_family boolean not null default false,
  recommendation text not null
    check (recommendation in ('keep_both','review','prefer_a','prefer_b','random_a','random_b','retire_a','retire_b')),
  rationale text not null,
  calculated_at timestamptz not null default now(),
  primary key (category_id_a, category_id_b),
  check (category_id_a < category_id_b)
);

create index if not exists category_similarity_pairs_v15_5_recommendation_idx
  on public.category_similarity_pairs_v15_5(recommendation);
create index if not exists category_similarity_pairs_v15_5_cluster_idx
  on public.category_similarity_pairs_v15_5(shared_knowledge_cluster, shared_strategy_family);

create or replace function public.apply_category_catalog_editorial_v15_5()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.stat_categories category
  set metadata=coalesce(category.metadata,'{}'::jsonb) || jsonb_build_object(
        'editorialOutcome',new.editorial_outcome,
        'catalogTier',case new.editorial_outcome when 'daily' then 'daily' when 'random' then 'random' else 'quarantined' end,
        'broadDomain',new.broad_domain,
        'knowledgeCluster',new.knowledge_cluster,
        'strategyFamily',new.strategy_family,
        'preferredCategoryId',new.preferred_category_id,
        'wonkinessScore',new.wonkiness_score,
        'clarityScore',new.clarity_score,
        'measureClass',new.measure_class,
        'normalizationBasis',new.normalization_basis,
        'normalizationApproved',new.normalization_approved,
        'catalogDecisionReason',new.decision_reason
      ),
      title=coalesce(nullif(new.player_title,''),category.title),
      short_title=left(regexp_replace(coalesce(nullif(new.player_title,''),category.title),'^(Highest|Lowest|Largest|Most)\s+','','i'),70),
      description=coalesce(nullif(new.player_description,''),category.description),
      plain_language_description=coalesce(nullif(new.player_description,''),category.plain_language_description,category.description),
      enabled=new.editorial_outcome in ('daily','random'),
      eligible_daily=new.editorial_outcome='daily',
      content_review_status=case when new.editorial_outcome='retired' then 'excluded' when new.editorial_outcome='rewrite' then 'pending' when new.editorial_outcome in ('daily','random') then 'approved' else category.content_review_status end,
      content_review_reason=new.decision_reason,
      content_review_version='geostats-v15.5-catalog-simplification-v1',
      player_quality_status=case when new.editorial_outcome='retired' then 'blocked' when new.editorial_outcome='rewrite' then 'caution' when new.editorial_outcome in ('daily','random') then 'approved' else category.player_quality_status end,
      player_quality_reason=new.decision_reason,
      updated_at=now()
  where category.id=new.category_id;

  update public.category_runtime_review_v15_4 runtime
  set catalog_tier=case new.editorial_outcome when 'daily' then 'daily' when 'random' then 'random' else 'quarantined' end,
      daily_qualified=new.editorial_outcome='daily',
      random_qualified=new.editorial_outcome in ('daily','random'),
      reasons=array[new.decision_reason],
      assessed_at=now()
  where runtime.category_id=new.category_id;
  return new;
end;
$$;

drop trigger if exists category_catalog_editorial_v15_5_apply on public.category_catalog_editorial_v15_5;
create trigger category_catalog_editorial_v15_5_apply
after insert or update on public.category_catalog_editorial_v15_5
for each row execute function public.apply_category_catalog_editorial_v15_5();


create or replace function public.ensure_category_catalog_editorial_v15_5()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.category_catalog_editorial_v15_5(
    category_id,editorial_outcome,player_title,player_description,broad_domain,
    knowledge_cluster,strategy_family,preferred_category_id,wonkiness_score,clarity_score,
    decision_reason,decision_source,reviewed_at
  )
  values(
    new.id,
    'quarantined',
    new.title,
    coalesce(new.plain_language_description,new.description),
    coalesce(new.metadata->>'broadDomain',lower(new.family)),
    coalesce(new.metadata->>'knowledgeCluster',new.semantic_family,new.concept_group,lower(new.family)),
    coalesce(new.metadata->>'strategyFamily',new.semantic_family,new.concept_group,lower(new.family)),
    null,
    0,
    coalesce(new.immediate_comprehension_score,new.understandability_score,0),
    'New or refreshed imports remain quarantined until the v15.5 editorial and correlation review passes.',
    'v15.5 intake trigger',
    now()
  )
  on conflict(category_id) do nothing;
  return new;
end;
$$;

drop trigger if exists stat_categories_v15_5_editorial_intake on public.stat_categories;
create trigger stat_categories_v15_5_editorial_intake
after insert or update of title,source_organization,source_indicator_code on public.stat_categories
for each row execute function public.ensure_category_catalog_editorial_v15_5();

-- New official source registrations. These sources enter review quarantine and
-- never become playable merely because an importer completed.
insert into public.data_sources(id,name,status,description,display_order,metadata,created_at,updated_at)
values
  ('pewreligion','Pew Research Center','planned',
   'Global religious-composition estimates for 2010 and 2020. Figures are estimates and must disclose the reference year and methodology.',
   60,jsonb_build_object('homepage_url','https://www.pewresearch.org/religion/feature/religious-composition-by-country-2010-2020/'),now(),now()),
  ('smithsoniangvp','Smithsonian Global Volcanism Program','planned',
   'Country counts and summaries from the official Holocene volcano database.',
   70,jsonb_build_object('homepage_url','https://volcano.si.edu/volcanolist_holocene.cfm'),now(),now()),
  ('usgs','USGS Earthquake Catalog','planned',
   'Fixed-period, fixed-threshold earthquake categories from the ANSS Comprehensive Earthquake Catalog.',
   80,jsonb_build_object('homepage_url','https://earthquake.usgs.gov/earthquakes/search/'),now(),now()),
  ('worldcover','ESA WorldCover','planned',
   'Country summaries from one fixed 10-meter WorldCover land-cover release using source-defined classes.',
   90,jsonb_build_object('homepage_url','https://esa-worldcover.org/en/data-access'),now(),now()),
  ('hydrosheds','HydroSHEDS','planned',
   'Country summaries derived from HydroRIVERS and HydroLAKES with their inclusion thresholds disclosed.',
   100,jsonb_build_object('homepage_url','https://www.hydrosheds.org/products'),now(),now()),
  ('elevation','Global Elevation','planned',
   'Country terrain summaries derived from one fixed elevation grid, land mask and boundary set.',
   110,jsonb_build_object('homepage_url','https://www.gebco.net/data-products-gridded-bathymetry-data'),now(),now())
on conflict(id) do update set
  name=excluded.name,
  description=excluded.description,
  display_order=excluded.display_order,
  metadata=coalesce(public.data_sources.metadata,'{}'::jsonb) || excluded.metadata,
  updated_at=now();

-- Curated player-facing rewrites. The source definition and technical
-- qualification remain in the description and source panel.
with rewrites(id,player_title,player_description) as (
  values
    ('natural-earth:highest-mapped-river-density','Highest river density','Kilometers of mapped rivers per 1,000 square kilometers of land.'),
    ('natural-earth:most-mapped-river-length','Longest river network','Combined length of mapped rivers inside the country.'),
    ('natural-earth:largest-mapped-lake-area','Most lake area','Combined area of mapped lakes and reservoirs.'),
    ('natural-earth:highest-mapped-lake-share','Most lake-covered','Share of land covered by mapped lakes and reservoirs.'),
    ('natural-earth:largest-mapped-glaciated-area','Most glacier-covered land','Combined area of mapped glaciers and permanent ice.'),
    ('natural-earth:highest-mapped-glaciated-share','Most glaciated','Share of land covered by mapped glaciers and permanent ice.'),
    ('unhcr:most-refugees-originating','Most refugees living abroad','Recognized refugees living outside their country of origin.'),
    ('unhcr:most-refugees-hosted','Most refugees hosted','Recognized refugees living in each host country.'),
    ('unhcr:most-asylum-applications-received','Most asylum applications','New asylum applications filed in each destination country.'),
    ('worldbank-catalog:SE.SEC.ENRL.VO.ZS','Most students in vocational education','Share of secondary students enrolled in vocational programs.'),
    ('worldbank-catalog:IT.NET.BBND.P2','Most fixed broadband subscriptions','Fixed broadband subscriptions per 100 people.'),
    ('worldbank-catalog:EN.GHG.CO2.MT.CE.AR5','Most CO₂ emissions','Total annual carbon-dioxide emissions.'),
    ('worldbank-catalog:EN.GHG.CO2.PC.CE.AR5','Most CO₂ emissions per person','Annual carbon-dioxide emissions per person.'),
    ('worldbank-catalog:TX.VAL.MRCH.CD.WT','Most merchandise exports','Annual value of goods exported.'),
    ('worldbank-catalog:TM.VAL.MRCH.CD.WT','Most merchandise imports','Annual value of goods imported.')
)
update public.stat_categories category
set title=rewrites.player_title,
    short_title=left(regexp_replace(rewrites.player_title,'^(Highest|Lowest|Largest|Most)\s+','','i'),70),
    description=rewrites.player_description,
    plain_language_description=rewrites.player_description,
    updated_at=now()
from rewrites
where category.id=rewrites.id;

-- Normalize especially awkward titles when their exact source concept is still
-- intuitive after a faithful rewrite.
update public.stat_categories category
set title=case
      when lower(category.title)='highest vocational enrollment share' then 'Most students in vocational education'
      when lower(category.title)='largest forest area' then 'Most forest'
      when lower(category.title)='highest forest coverage' then 'Most forested'
      when lower(category.title)='largest combined surface water' then 'Most inland water'
      when lower(category.title)='highest surface water share' then 'Most land covered by water'
      when lower(category.title)='highest mapped river density' then 'Highest river density'
      else category.title
    end,
    short_title=case
      when lower(category.title)='highest vocational enrollment share' then 'Vocational education'
      when lower(category.title)='largest forest area' then 'Forest area'
      when lower(category.title)='highest forest coverage' then 'Forest coverage'
      when lower(category.title)='largest combined surface water' then 'Inland water'
      when lower(category.title)='highest surface water share' then 'Water-covered land'
      when lower(category.title)='highest mapped river density' then 'River density'
      else category.short_title
    end,
    description=case
      when lower(category.title)='highest vocational enrollment share' then 'Share of secondary students enrolled in vocational programs.'
      when lower(category.title)='largest forest area' then 'Total land area covered by forest.'
      when lower(category.title)='highest forest coverage' then 'Share of the country’s land covered by forest.'
      when lower(category.title)='largest combined surface water' then 'Total mapped area covered by lakes, reservoirs and major rivers.'
      when lower(category.title)='highest surface water share' then 'Share of mapped land covered by lakes, reservoirs and major rivers.'
      when lower(category.title)='highest mapped river density' then 'Kilometers of mapped rivers per 1,000 square kilometers of land.'
      else category.description
    end,
    plain_language_description=case
      when lower(category.title)='highest vocational enrollment share' then 'Share of secondary students enrolled in vocational programs.'
      when lower(category.title)='largest forest area' then 'Total land area covered by forest.'
      when lower(category.title)='highest forest coverage' then 'Share of the country’s land covered by forest.'
      when lower(category.title)='largest combined surface water' then 'Total mapped area covered by lakes, reservoirs and major rivers.'
      when lower(category.title)='highest surface water share' then 'Share of mapped land covered by lakes, reservoirs and major rivers.'
      when lower(category.title)='highest mapped river density' then 'Kilometers of mapped rivers per 1,000 square kilometers of land.'
      else category.plain_language_description
    end,
    updated_at=now()
where lower(category.title) in (
  'highest vocational enrollment share','largest forest area','highest forest coverage',
  'largest combined surface water','highest surface water share','highest mapped river density'
);

-- Editorially retire measures whose accurate title cannot become intuitive
-- without concealing an essential technical qualification.
with explicit_retirements(id,reason) as (
  values
    ('worldbank-catalog:FI.RES.XGLD.CD','Technical central-bank accounting concept: total reserves excluding monetary gold.'),
    ('worldbank-catalog:SP.URB.TOTL.MA.ZS','Definition depends on urban agglomerations above a one-million-person threshold.'),
    ('worldbank-catalog:SL.EMP.TOTL.SP.ZS','Employment-to-population ratio is a technical labor-market ratio.'),
    ('worldbank-catalog:SL.GDP.PCAP.EM.KD','Output per worker is an abstract productivity ratio.'),
    ('worldbank-catalog:LAB.SHARE.GDP','Labor-income share is an abstract national-accounting ratio.')
)
insert into public.category_catalog_editorial_v15_5(
  category_id,editorial_outcome,player_title,player_description,broad_domain,
  knowledge_cluster,strategy_family,preferred_category_id,wonkiness_score,clarity_score,
  decision_reason,decision_source,reviewed_at
)
select category.id,'retired',category.title,category.plain_language_description,
  coalesce(category.metadata->>'broadDomain',lower(category.family)),
  coalesce(category.metadata->>'knowledgeCluster',category.semantic_family,category.concept_group,lower(category.family)),
  coalesce(category.metadata->>'strategyFamily',category.semantic_family,category.concept_group,lower(category.family)),
  null,100,20,explicit_retirements.reason,'v15.5 explicit editorial retirement',now()
from explicit_retirements
join public.stat_categories category on category.id=explicit_retirements.id
on conflict(category_id) do update set
  editorial_outcome='retired',
  wonkiness_score=100,
  clarity_score=20,
  decision_reason=excluded.decision_reason,
  decision_source=excluded.decision_source,
  reviewed_at=now();

-- Broader conservative wonkiness rules. These rows are retired only when the
-- source concept itself is technical; long but salvageable titles are routed to
-- rewrite instead.
with candidate as (
  select category.*,
    lower(concat_ws(' ',category.title,category.description,category.plain_language_description,category.technical_definition)) as copy,
    array_length(regexp_split_to_array(trim(category.title),'\s+'),1) as title_words
  from public.stat_categories category
), scored as (
  select candidate.*,
    case
      when copy ~ '(total reserves minus gold|adjusted net savings|broad money|domestic credit|statistical capacity|terms of trade|labor.?income share|output per worker|employment.?to.?population|unit labor cost|official exchange rate|purchasing power parity conversion factor)' then 100
      when copy ~ '(urban agglomerations? of more than 1 million|relevant population|constant 20[0-9]{2} us\$|constant lcu|index \(2010 ?= ?100\)|net barter)' then 92
      when title_words>9 or length(title)>82 then 72
      when title_words>6 or length(title)>62 or copy ~ '(mapped|modeled|merchandise|per 100 people|share of)' then 45
      else 10
    end as wonkiness_score,
    case
      when title_words<=5 and length(title)<=52 then 94
      when title_words<=7 and length(title)<=68 then 82
      when title_words<=9 and length(title)<=82 then 68
      else 45
    end as clarity_score
  from candidate
), outcome as (
  select scored.*,
    case
      when wonkiness_score>=90 then 'retired'
      when wonkiness_score>=60 then 'rewrite'
      when coalesce(metadata->>'catalogTier','quarantined')='daily' then 'daily'
      when coalesce(metadata->>'catalogTier','quarantined')='random' then 'random'
      else 'quarantined'
    end as editorial_outcome,
    case
      when wonkiness_score>=90 then 'The measure is too technical or contrived for intuitive gameplay.'
      when wonkiness_score>=60 then 'The underlying measure may be useful, but the player-facing concept requires editorial rewriting.'
      when coalesce(metadata->>'catalogTier','quarantined')='daily' then 'Clear existing Daily-ready category.'
      when coalesce(metadata->>'catalogTier','quarantined')='random' then 'Valid but better suited to Random mode.'
      else 'Not currently qualified for gameplay.'
    end as decision_reason
  from scored
)
insert into public.category_catalog_editorial_v15_5(
  category_id,editorial_outcome,player_title,player_description,broad_domain,
  knowledge_cluster,strategy_family,preferred_category_id,wonkiness_score,clarity_score,
  decision_reason,decision_source,reviewed_at
)
select id,editorial_outcome,title,coalesce(plain_language_description,description),
  coalesce(metadata->>'broadDomain',lower(family)),
  coalesce(metadata->>'knowledgeCluster',semantic_family,concept_group,lower(family)),
  coalesce(metadata->>'strategyFamily',semantic_family,concept_group,lower(family)),
  null,wonkiness_score,clarity_score,decision_reason,'v15.5 automated comprehensibility screen',now()
from outcome
on conflict(category_id) do update set
  editorial_outcome=case
    when public.category_catalog_editorial_v15_5.decision_source='v15.5 explicit editorial retirement'
      then public.category_catalog_editorial_v15_5.editorial_outcome
    else excluded.editorial_outcome
  end,
  player_title=excluded.player_title,
  player_description=excluded.player_description,
  broad_domain=excluded.broad_domain,
  knowledge_cluster=excluded.knowledge_cluster,
  strategy_family=excluded.strategy_family,
  wonkiness_score=case
    when public.category_catalog_editorial_v15_5.decision_source='v15.5 explicit editorial retirement'
      then public.category_catalog_editorial_v15_5.wonkiness_score
    else excluded.wonkiness_score
  end,
  clarity_score=excluded.clarity_score,
  decision_reason=case
    when public.category_catalog_editorial_v15_5.decision_source='v15.5 explicit editorial retirement'
      then public.category_catalog_editorial_v15_5.decision_reason
    else excluded.decision_reason
  end,
  decision_source=case
    when public.category_catalog_editorial_v15_5.decision_source='v15.5 explicit editorial retirement'
      then public.category_catalog_editorial_v15_5.decision_source
    else excluded.decision_source
  end,
  reviewed_at=now();

-- Agricultural/product gameplay policy. FAOSTAT contributes only absolute total
-- production quantities. Yield, harvested area, livestock stocks, slaughter counts
-- and other per-area/per-animal/per-person normalizations are retired even when the
-- underlying data are technically valid. Compatible composition measures remain
-- eligible when their numerator and denominator genuinely match.
with faostat_measure as (
  select
    category.id,
    coalesce(nullif(category.metadata->>'item',''),category.short_title,category.title) as item,
    lower(coalesce(nullif(category.metadata->>'element',''),nullif(category.source_query->>'element',''),'')) as element,
    coalesce(category.source_indicator_code,'') as indicator_code
  from public.stat_categories category
  where category.source_organization='FAOSTAT'
), classified as (
  select *,
    case
      when element in ('production','production quantity')
        or indicator_code ~ ':(5510|5513)$'
      then true
      else false
    end as is_absolute_production
  from faostat_measure
)
update public.category_catalog_editorial_v15_5 editorial
set editorial_outcome=case
      when classified.is_absolute_production then editorial.editorial_outcome
      else 'retired'
    end,
    player_title=case
      when classified.is_absolute_production and nullif(trim(classified.item),'') is not null
        then 'Most ' || trim(classified.item) || ' produced'
      else editorial.player_title
    end,
    player_description=case
      when classified.is_absolute_production and nullif(trim(classified.item),'') is not null
        then 'Total national production of ' || trim(classified.item) || ' in the source-reported physical unit.'
      else editorial.player_description
    end,
    measure_class=case when classified.is_absolute_production then 'absolute-total' else 'retired-normalized-agriculture' end,
    normalization_basis=case when classified.is_absolute_production then 'none' else coalesce(nullif(classified.element,''),'non-production FAOSTAT element') end,
    normalization_approved=classified.is_absolute_production,
    wonkiness_score=case when classified.is_absolute_production then editorial.wonkiness_score else 100 end,
    clarity_score=case when classified.is_absolute_production then greatest(editorial.clarity_score,88) else least(editorial.clarity_score,35) end,
    decision_reason=case
      when classified.is_absolute_production
        then 'Allowed agricultural measure: absolute total national production. Yield and other normalized efficiency measures are excluded.'
      else 'Retired by the production-only agriculture policy: GeoStats keeps total amounts produced, imported or exported, not yield, harvested area, animal counts, slaughter counts or per-person efficiency measures.'
    end,
    decision_source='v15.5 production-only agriculture policy',
    reviewed_at=now()
from classified
where editorial.category_id=classified.id;

-- Classify clear, compatible normalizations without automatically promoting a
-- category that is otherwise quarantined or retired. A percentage is allowed only
-- when the numerator and denominator describe the same accounting or physical whole.
update public.category_catalog_editorial_v15_5 editorial
set measure_class=case
      when category.source_organization='UN Comtrade' then 'absolute-total'
      when category.source_indicator_code in ('NV.AGR.TOTL.ZS','NV.IND.TOTL.ZS','NV.SRV.TOTL.ZS') then 'composition-share'
      when lower(coalesce(category.metadata->>'normalizationPolicy',''))='product-export-share-total-exports' then 'economic-specialization'
      when lower(coalesce(category.metadata->>'normalizationPolicy',''))='product-production-value-share-ag-output' then 'economic-specialization'
      when lower(coalesce(category.metadata->>'normalizationPolicy',''))='product-value-added-share-gdp' then 'economic-specialization'
      when lower(coalesce(category.metadata->>'normalizationPolicy',''))='electricity-source-share-generation' then 'composition-share'
      when lower(coalesce(category.metadata->>'normalizationPolicy',''))='land-cover-share-land-area' then 'composition-share'
      else editorial.measure_class
    end,
    normalization_basis=case
      when category.source_organization='UN Comtrade' then 'none'
      when category.source_indicator_code in ('NV.AGR.TOTL.ZS','NV.IND.TOTL.ZS','NV.SRV.TOTL.ZS') then 'sector-value-added-share-gdp'
      when nullif(category.metadata->>'normalizationPolicy','') is not null then category.metadata->>'normalizationPolicy'
      else editorial.normalization_basis
    end,
    normalization_approved=case
      when category.source_organization='UN Comtrade' then true
      when category.source_indicator_code in ('NV.AGR.TOTL.ZS','NV.IND.TOTL.ZS','NV.SRV.TOTL.ZS') then true
      when lower(coalesce(category.metadata->>'normalizationPolicy','')) in (
        'product-export-share-total-exports','product-production-value-share-ag-output',
        'product-value-added-share-gdp','electricity-source-share-generation','land-cover-share-land-area'
      ) then true
      else editorial.normalization_approved
    end
from public.stat_categories category
where editorial.category_id=category.id;

-- Preferred-representative decisions for known redundant clusters. Correlation
-- review can extend these rules later, but these obvious pairs do not need to
-- remain simultaneously active.
with policy(category_id,outcome,preferred_id,reason) as (
  values
    ('unhcr:most-refugees-originating','daily','unhcr:most-refugees-originating','Preferred origin-based forced-displacement measure.'),
    ('unhcr:most-asylum-applications-by-origin','retired','unhcr:most-refugees-originating','Near-duplicate origin-based displacement strategy; the refugee measure is clearer and more stable.'),
    ('unhcr:most-refugees-hosted','random','unhcr:most-refugees-hosted','Valid destination-based counterpart, retained outside Daily to reduce displacement repetition.'),
    ('unhcr:most-asylum-applications-received','retired','unhcr:most-refugees-hosted','Near-duplicate destination-based displacement strategy; refugee hosting is clearer.'),
    ('worldbank-catalog:SP.RUR.TOTL.ZS','retired','worldbank-catalog:SP.URB.TOTL.IN.ZS','Exact inverse of urban population share; keep only the more intuitive urban version.'),
    ('worldbank-catalog:AG.LND.FRST.K2','daily','worldbank-catalog:AG.LND.FRST.K2','Preferred total forest measure.'),
    ('worldbank-catalog:AG.LND.FRST.ZS','random','worldbank-catalog:AG.LND.FRST.K2','Valid percentage alternate, kept out of Daily to reduce duplicate strategy.'),
    ('natural-earth:largest-mapped-lake-area','daily','natural-earth:largest-mapped-lake-area','Preferred total lake-area measure.'),
    ('natural-earth:highest-mapped-lake-share','random','natural-earth:largest-mapped-lake-area','Valid percentage alternate, kept out of Daily to reduce duplicate strategy.'),
    ('natural-earth:largest-mapped-glaciated-area','daily','natural-earth:largest-mapped-glaciated-area','Preferred total glacier-area measure.'),
    ('natural-earth:highest-mapped-glaciated-share','random','natural-earth:largest-mapped-glaciated-area','Valid percentage alternate, kept out of Daily to reduce duplicate strategy.')
)
update public.category_catalog_editorial_v15_5 editorial
set editorial_outcome=policy.outcome,
    preferred_category_id=policy.preferred_id,
    decision_reason=policy.reason,
    decision_source='v15.5 preferred-representative policy',
    reviewed_at=now()
from policy
where editorial.category_id=policy.category_id;

-- New source metadata and strategy classification.
update public.stat_categories category
set metadata=coalesce(category.metadata,'{}'::jsonb) || jsonb_build_object(
      'editorialOutcome',editorial.editorial_outcome,
      'catalogTier',case editorial.editorial_outcome
        when 'daily' then 'daily'
        when 'random' then 'random'
        else 'quarantined'
      end,
      'broadDomain',editorial.broad_domain,
      'knowledgeCluster',editorial.knowledge_cluster,
      'strategyFamily',editorial.strategy_family,
      'preferredCategoryId',editorial.preferred_category_id,
      'wonkinessScore',editorial.wonkiness_score,
      'clarityScore',editorial.clarity_score,
      'measureClass',editorial.measure_class,
      'normalizationBasis',editorial.normalization_basis,
      'normalizationApproved',editorial.normalization_approved,
      'catalogDecisionReason',editorial.decision_reason
    ),
    title=coalesce(nullif(editorial.player_title,''),category.title),
    short_title=left(regexp_replace(coalesce(nullif(editorial.player_title,''),category.title),'^(Highest|Lowest|Largest|Most)\s+','','i'),70),
    description=coalesce(nullif(editorial.player_description,''),category.description),
    plain_language_description=coalesce(nullif(editorial.player_description,''),category.plain_language_description,category.description),
    enabled=editorial.editorial_outcome in ('daily','random'),
    eligible_daily=editorial.editorial_outcome='daily',
    content_review_status=case
      when editorial.editorial_outcome='retired' then 'excluded'
      when editorial.editorial_outcome='rewrite' then 'pending'
      when editorial.editorial_outcome in ('daily','random') then 'approved'
      else category.content_review_status
    end,
    content_review_reason=editorial.decision_reason,
    content_review_version='geostats-v15.5-catalog-simplification-v1',
    player_quality_status=case
      when editorial.editorial_outcome='retired' then 'blocked'
      when editorial.editorial_outcome='rewrite' then 'caution'
      when editorial.editorial_outcome in ('daily','random') then 'approved'
      else category.player_quality_status
    end,
    player_quality_reason=editorial.decision_reason,
    updated_at=now()
from public.category_catalog_editorial_v15_5 editorial
where editorial.category_id=category.id;

-- New cultural, geology and physical categories enter quarantine until source
-- import, integrity validation and the same editorial screen all pass.
update public.stat_categories category
set metadata=coalesce(category.metadata,'{}'::jsonb) || jsonb_build_object(
      'broadDomain',case category.source_organization
        when 'Pew Research Center' then 'culture'
        when 'Smithsonian GVP' then 'geology'
        when 'USGS' then 'natural-hazards'
        when 'ESA WorldCover' then 'physical-geography'
        when 'HydroSHEDS' then 'physical-geography'
        when 'Global Elevation' then 'physical-geography'
        else coalesce(category.metadata->>'broadDomain',lower(category.family))
      end,
      'knowledgeCluster',case category.source_organization
        when 'Pew Research Center' then 'religious-composition'
        when 'Smithsonian GVP' then 'volcanoes'
        when 'USGS' then 'earthquakes'
        when 'ESA WorldCover' then 'land-cover'
        when 'HydroSHEDS' then 'physical-waterways'
        when 'Global Elevation' then 'terrain-elevation'
        else coalesce(category.metadata->>'knowledgeCluster',category.semantic_family,category.concept_group,lower(category.family))
      end,
      'strategyFamily',case category.source_organization
        when 'Pew Research Center' then 'religious-composition'
        when 'Smithsonian GVP' then 'volcanic-geography'
        when 'USGS' then 'seismic-activity'
        when 'ESA WorldCover' then 'land-cover'
        when 'HydroSHEDS' then 'hydrography'
        when 'Global Elevation' then 'terrain'
        else coalesce(category.metadata->>'strategyFamily',category.semantic_family,category.concept_group,lower(category.family))
      end
    ),
    updated_at=now()
where category.source_organization in (
  'Pew Research Center','Smithsonian GVP','USGS','ESA WorldCover','HydroSHEDS','Global Elevation'
);

-- Mirror editorial decisions into v15.4 runtime rows so existing APIs and admin
-- screens remain compatible while v15.5 metadata becomes authoritative.
update public.category_runtime_review_v15_4 runtime
set catalog_tier=case editorial.editorial_outcome
      when 'daily' then 'daily'
      when 'random' then 'random'
      else 'quarantined'
    end,
    daily_qualified=editorial.editorial_outcome='daily',
    random_qualified=editorial.editorial_outcome in ('daily','random'),
    reasons=array[editorial.decision_reason],
    assessed_at=now()
from public.category_catalog_editorial_v15_5 editorial
where runtime.category_id=editorial.category_id;

-- Legacy reconciliation can mirror older decisions; reassert v15.5 afterward.
select * from public.reconcile_category_playability_v15();

update public.stat_categories category
set enabled=editorial.editorial_outcome in ('daily','random'),
    eligible_daily=editorial.editorial_outcome='daily',
    updated_at=now()
from public.category_catalog_editorial_v15_5 editorial
where editorial.category_id=category.id;

-- Remove only unscored boards created before the v15.5 rules. Scored history is
-- preserved and never silently rewritten.
delete from public.daily_challenges challenge
where coalesce(challenge.rules_version,'')<>'12.0'
  and not exists (
    select 1 from public.daily_scores score
    where score.challenge_date=challenge.challenge_date
  );

create or replace view public.category_catalog_review_v15_5 as
select
  category.id,
  category.title,
  category.short_title,
  category.source_organization,
  category.source_indicator_code,
  category.family,
  editorial.editorial_outcome,
  editorial.player_title,
  editorial.player_description,
  editorial.broad_domain,
  editorial.knowledge_cluster,
  editorial.strategy_family,
  editorial.preferred_category_id,
  editorial.wonkiness_score,
  editorial.clarity_score,
  editorial.measure_class,
  editorial.normalization_basis,
  editorial.normalization_approved,
  editorial.decision_reason,
  editorial.decision_source,
  runtime.coverage,
  runtime.distinct_display_values,
  runtime.largest_display_tie_share,
  runtime.qualification_score,
  category.validation_status,
  category.validation_reason,
  category.common_year,
  category.common_year_coverage,
  category.quality_score,
  category.enabled,
  category.eligible_daily
from public.stat_categories category
join public.category_catalog_editorial_v15_5 editorial on editorial.category_id=category.id
left join public.category_runtime_review_v15_4 runtime on runtime.category_id=category.id;

select editorial_outcome,count(*) as categories
from public.category_catalog_editorial_v15_5
group by editorial_outcome
order by editorial_outcome;

select source_organization,
  count(*) filter (where editorial_outcome='daily') as daily_ready,
  count(*) filter (where editorial_outcome='random') as random_only,
  count(*) filter (where editorial_outcome='rewrite') as needs_rewrite,
  count(*) filter (where editorial_outcome='retired') as retired,
  count(*) filter (where editorial_outcome='quarantined') as quarantined
from public.category_catalog_review_v15_5
group by source_organization
order by daily_ready desc,random_only desc,source_organization;

commit;
