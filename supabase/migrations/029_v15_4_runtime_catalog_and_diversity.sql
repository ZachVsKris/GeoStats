-- GeoStats v15.4: runtime tiers, catalog clear-pass review, title cleanup,
-- stronger strategy diversity metadata, and stale-board regeneration.
--
-- Run after RUN_THIS_IN_SUPABASE_FOR_V15_3.sql. Safe to rerun.

begin;

create table if not exists public.v15_4_review_state_backup (
  category_id text primary key,
  review_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v15_4_review_state_backup(category_id, review_state)
select category_id, to_jsonb(review)
from public.category_review_state review
on conflict (category_id) do nothing;

create table if not exists public.v15_4_category_backup (
  category_id text primary key,
  category_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v15_4_category_backup(category_id, category_state)
select id, to_jsonb(category)
from public.stat_categories category
on conflict (category_id) do nothing;

-- Plain-language title cleanup. Technical qualifications remain in the
-- description and exact source specification shown to players.
update public.stat_categories
set title = case id
    when 'natural-earth:most-land-neighbors' then 'Most bordering countries'
    when 'natural-earth:longest-land-border' then 'Longest combined land borders'
    when 'natural-earth:longest-single-land-border' then 'Longest single land border'
    when 'natural-earth:longest-coastline' then 'Longest coastline'
    when 'natural-earth:highest-coastline-density' then 'Most coastline for its size'
    when 'natural-earth:most-separate-land-areas' then 'Most separate land areas'
    when 'natural-earth:most-large-land-areas' then 'Most large separate land areas'
    when 'natural-earth:largest-continuous-land-area' then 'Largest continuous land area'
    when 'natural-earth:largest-geographic-span' then 'Largest geographic span'
    when 'natural-earth:largest-north-south-span' then 'Largest north-south span'
    when 'natural-earth:largest-east-west-span' then 'Largest east-west span'
    when 'natural-earth:most-mapped-river-length' then 'Longest river network'
    when 'natural-earth:highest-mapped-river-density' then 'Highest river density'
    when 'natural-earth:most-mapped-rivers' then 'Most rivers'
    when 'natural-earth:largest-mapped-lake-area' then 'Largest total lake area'
    when 'natural-earth:largest-single-mapped-lake' then 'Largest lake'
    when 'natural-earth:most-mapped-lakes' then 'Most lakes'
    when 'natural-earth:highest-mapped-lake-share' then 'Most lake-covered'
    when 'natural-earth:largest-mapped-glaciated-area' then 'Largest glaciated area'
    when 'natural-earth:highest-mapped-glaciated-share' then 'Most glaciated'
    when 'unhcr:most-refugees-originating' then 'Most refugees living abroad'
    when 'unhcr:most-asylum-applications-received' then 'Most asylum applications'
    when 'worldbank-catalog:EN.GHG.CO2.MT.CE.AR5' then 'Most CO₂ emissions'
    else title
  end,
  short_title = case id
    when 'natural-earth:most-land-neighbors' then 'Bordering countries'
    when 'natural-earth:longest-land-border' then 'Combined land borders'
    when 'natural-earth:longest-coastline' then 'Coastline'
    when 'natural-earth:highest-mapped-river-density' then 'River density'
    when 'natural-earth:most-mapped-river-length' then 'River network'
    when 'natural-earth:largest-mapped-lake-area' then 'Total lake area'
    when 'natural-earth:highest-mapped-lake-share' then 'Lake coverage'
    when 'natural-earth:largest-mapped-glaciated-area' then 'Glaciated area'
    when 'unhcr:most-refugees-originating' then 'Refugees living abroad'
    when 'unhcr:most-asylum-applications-received' then 'Asylum applications'
    else short_title
  end,
  updated_at = now()
where id in (
  'natural-earth:most-land-neighbors','natural-earth:longest-land-border',
  'natural-earth:longest-single-land-border','natural-earth:longest-coastline',
  'natural-earth:highest-coastline-density','natural-earth:most-separate-land-areas',
  'natural-earth:most-large-land-areas','natural-earth:largest-continuous-land-area',
  'natural-earth:largest-geographic-span','natural-earth:largest-north-south-span',
  'natural-earth:largest-east-west-span','natural-earth:most-mapped-river-length',
  'natural-earth:highest-mapped-river-density','natural-earth:most-mapped-rivers',
  'natural-earth:largest-mapped-lake-area','natural-earth:largest-single-mapped-lake',
  'natural-earth:most-mapped-lakes','natural-earth:highest-mapped-lake-share',
  'natural-earth:largest-mapped-glaciated-area','natural-earth:highest-mapped-glaciated-share',
  'unhcr:most-refugees-originating','unhcr:most-asylum-applications-received',
  'worldbank-catalog:EN.GHG.CO2.MT.CE.AR5'
);

-- Additional plain-language titles for common objective series. The exact
-- indicator code and unit remain visible in the source specification.
update public.stat_categories category
set title = case category.source_indicator_code
    when 'TX.VAL.MRCH.CD.WT' then 'Most merchandise exports'
    when 'TM.VAL.MRCH.CD.WT' then 'Most merchandise imports'
    when 'EN.GHG.CO2.MT.CE.AR5' then 'Most CO₂ emissions'
    when 'EN.GHG.CO2.PC.CE.AR5' then 'Most CO₂ emissions per person'
    when 'EN.GHG.CH4.MT.CE.AR5' then 'Most methane emissions'
    when 'IT.NET.BBND.P2' then 'Most fixed broadband subscriptions'
    else category.title
  end,
  short_title = case category.source_indicator_code
    when 'TX.VAL.MRCH.CD.WT' then 'Merchandise exports'
    when 'TM.VAL.MRCH.CD.WT' then 'Merchandise imports'
    when 'EN.GHG.CO2.MT.CE.AR5' then 'CO₂ emissions'
    when 'EN.GHG.CO2.PC.CE.AR5' then 'CO₂ per person'
    when 'EN.GHG.CH4.MT.CE.AR5' then 'Methane emissions'
    when 'IT.NET.BBND.P2' then 'Fixed broadband'
    else category.short_title
  end,
  updated_at=now()
where category.source_organization='World Bank'
  and category.source_indicator_code in (
    'TX.VAL.MRCH.CD.WT','TM.VAL.MRCH.CD.WT','EN.GHG.CO2.MT.CE.AR5',
    'EN.GHG.CO2.PC.CE.AR5','EN.GHG.CH4.MT.CE.AR5','IT.NET.BBND.P2'
  );

-- Normalize product-trade descriptions so the source panel reads naturally
-- while retaining the exact HS code, flow, partner, unit and year in metadata.
update public.stat_categories category
set description = 'Annual value of ' || lower(regexp_replace(regexp_replace(category.title,'^Largest\s+','','i'),'\s+exports$','','i')) || ' exported from each country to the world.',
    plain_language_description = 'Annual value of ' || lower(regexp_replace(regexp_replace(category.title,'^Largest\s+','','i'),'\s+exports$','','i')) || ' exported from each country to the world.',
    updated_at = now()
where category.source_organization='UN Comtrade'
  and category.title ~* '^Largest .+ exports$';

-- Store broad-domain and knowledge-cluster metadata used by the v15.4 board
-- composer. The runtime also has a deterministic fallback inference layer.
update public.stat_categories category
set metadata = coalesce(category.metadata,'{}'::jsonb) || jsonb_build_object(
  'broadDomain', case
    when category.source_organization='Natural Earth' then 'physical-geography'
    when category.source_organization='FAOSTAT' then 'agriculture'
    when category.source_organization='UN Comtrade' then 'trade'
    when category.source_organization='UNHCR' then 'displacement'
    when lower(category.family) in ('population','demographics') then 'demographics'
    when lower(category.family) in ('crops','fruit','vegetables','livestock','dairy','agriculture') then 'agriculture'
    when lower(category.family) in ('geography','land','climate') then 'physical-geography'
    when lower(category.family)='vaccination' then 'health'
    else lower(regexp_replace(category.family,'[^a-z0-9]+','-','g'))
  end,
  'knowledgeCluster', case
    when category.source_organization='UNHCR' then 'forced-displacement'
    when category.source_organization='UN Comtrade' then 'product-exports'
    when category.source_organization='Natural Earth' and lower(category.title) ~ 'river|lake' then 'physical-waterways'
    when category.source_organization='Natural Earth' and lower(category.title) ~ 'coast' then 'physical-coastline'
    when category.source_organization='Natural Earth' and lower(category.title) ~ 'border|neighbor' then 'physical-borders'
    when category.source_organization='Natural Earth' and lower(category.title) ~ 'glaciat|snow|ice' then 'physical-ice'
    when category.source_organization='Natural Earth' and lower(category.title) ~ 'span' then 'physical-span'
    when category.source_organization='Natural Earth' and lower(category.title) ~ 'north|south|equator|latitude' then 'physical-position'
    when category.source_organization='Natural Earth' then 'physical-land-form'
    when category.source_organization='FAOSTAT' and lower(category.title) ~ 'yield'
      and lower(category.title) ~ 'cattle|cow|buffalo|sheep|goat|chicken|pig|meat|milk|egg' then 'livestock-efficiency'
    when category.source_organization='FAOSTAT' and lower(category.title) ~ 'yield' then 'crop-efficiency'
    when category.source_organization='FAOSTAT' and lower(category.title) ~ 'production'
      and lower(category.title) ~ 'cattle|cow|buffalo|sheep|goat|chicken|pig|meat|milk|egg' then 'livestock-output'
    when category.source_organization='FAOSTAT' and lower(category.title) ~ 'production' then 'crop-output'
    when category.source_organization='FAOSTAT' and lower(category.title) ~ 'population|stocks|animals' then 'livestock-population'
    when lower(category.title) ~ 'refugee|asylum|stateless|displacement' then 'forced-displacement'
    when lower(category.title) ~ 'co.?2|methane|emission|greenhouse' then 'emissions'
    when lower(category.title) ~ 'urban population|rural population|population share' then 'population-composition'
    when lower(category.title) ~ 'oldest population|youngest population|age 65|age 0.?14' then 'population-age'
    when lower(category.title) ~ 'merchandise import|merchandise export|exports share|imports share' then 'aggregate-trade'
    when lower(category.title) ~ 'broadband|mobile subscription|telephone subscription' then 'telecommunications-adoption'
    else lower(regexp_replace(coalesce(category.semantic_family,category.concept_group,category.family),'[^a-z0-9]+','-','g'))
  end
), updated_at=now();

create table if not exists public.category_runtime_review_v15_4 (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  catalog_tier text not null check (catalog_tier in ('daily','random','quarantined')),
  daily_qualified boolean not null,
  random_qualified boolean not null,
  coverage integer not null,
  distinct_display_values integer not null,
  largest_display_tie_share numeric(8,5) not null,
  qualification_score numeric(5,1) not null,
  reasons text[] not null default '{}'::text[],
  assessed_at timestamptz not null default now()
);

with displayed_observations as (
  select
    category.id as category_id,
    case
      when lower(regexp_replace(coalesce(category.unit,''),'\s+',' ','g')) in ('usd','usd/person')
        or lower(coalesce(category.unit,'')) like '%current us$%'
        or lower(coalesce(category.unit,'')) like '%current usd%'
        or lower(coalesce(category.unit,'')) like '%us dollars%'
        or lower(coalesce(category.unit,'')) like '%u.s. dollars%'
      then case
        when abs(observation.value)>=1e12 then 'currency:t:' || round((observation.value/1e12)::numeric,2)::text
        when abs(observation.value)>=1e9 then 'currency:b:' || round((observation.value/1e9)::numeric,1)::text
        when abs(observation.value)>=1e6 then 'currency:m:' || round((observation.value/1e6)::numeric,1)::text
        else 'currency:raw:' || round(observation.value::numeric,greatest(0,least(coalesce(category.decimals,1)::integer,6)))::text
      end
      when coalesce(category.unit,'') in ('people','passengers','arrivals','departures','passenger-km','hectares','km²','square kilometers','tonnes','animals')
        and abs(observation.value)>=1e6
      then case
        when abs(observation.value)>=1e12 then 'compact:t:' || round((observation.value/1e12)::numeric,2)::text
        when abs(observation.value)>=1e9 then 'compact:b:' || round((observation.value/1e9)::numeric,2)::text
        else 'compact:m:' || round((observation.value/1e6)::numeric,1)::text
      end
      else 'raw:' || round(observation.value::numeric,greatest(0,least(coalesce(category.decimals,1)::integer,6)))::text
    end as displayed_value
  from public.stat_categories category
  join public.stat_observations observation
    on observation.category_id=category.id
   and observation.data_year=coalesce(category.common_year,category.latest_available_year)
  where observation.value is not null
), display_groups as (
  select category_id,displayed_value,count(*)::integer as group_size
  from displayed_observations
  group by category_id,displayed_value
), tie_stats as (
  select category_id,
    sum(group_size)::integer as observation_count,
    count(*)::integer as distinct_display_values,
    (max(group_size)::numeric/nullif(sum(group_size),0))::numeric(8,5) as largest_display_tie_share
  from display_groups group by category_id
), base as (
  select queue.*,
    greatest(coalesce(queue.common_year_coverage,0),coalesce(queue.country_coverage,0))::integer as coverage,
    greatest(coalesce(queue.immediate_comprehension_score,0),coalesce(queue.understandability_score,0),coalesce(queue.recognizability_score,0))::integer as comprehension,
    greatest(coalesce(queue.gameplay_interest_score,0),coalesce(queue.fun_score,0),coalesce(queue.specificity_score,0))::integer as interest,
    greatest(coalesce(queue.uniqueness_score,0),coalesce(queue.specificity_score,0))::integer as uniqueness,
    greatest(coalesce(queue.verifiability_score,0),case when queue.validation_status='verified' then 100 when not public.category_v15_true_integrity_failure(queue.validation_status,queue.validation_reason,queue.validation_mismatch_count,queue.validation_ranking_mismatch_count) then 85 else 0 end)::integer as verifiability,
    greatest(coalesce(queue.credibility_score,0),case when queue.credibility_status='quarantined' then 0 when public.category_v15_true_integrity_failure(queue.validation_status,queue.validation_reason,queue.validation_mismatch_count,queue.validation_ranking_mismatch_count) then 0 when queue.source_organization='UN Comtrade' then 96 when queue.source_organization='Natural Earth' then 90 when queue.source_organization='FAOSTAT' then 88 when queue.source_organization in ('World Bank','UNHCR') then 86 when queue.source_organization='WHO' then 84 when queue.source_organization='ILOSTAT' then 83 when queue.source_organization='U.S. EIA' then 82 when queue.source_organization='UNESCO UIS' then 80 else 0 end)::integer as credibility,
    public.category_v15_true_integrity_failure(queue.validation_status,queue.validation_reason,queue.validation_mismatch_count,queue.validation_ranking_mismatch_count) as true_integrity_failure,
    coalesce(tie.distinct_display_values,0)::integer as distinct_display_values,
    coalesce(tie.largest_display_tie_share,1)::numeric(8,5) as largest_display_tie_share,
    lower(concat_ws(' ',queue.effective_title,queue.plain_language_description,queue.description,queue.technical_definition)) as searchable_copy,
    case queue.source_organization
      when 'World Bank' then nullif(queue.source_indicator_code,'') is not null
      when 'FAOSTAT' then queue.source_query->>'domainCode'='QCL' and nullif(queue.source_query->>'itemCode','') is not null and nullif(queue.source_query->>'elementCode','') is not null and nullif(queue.source_query->>'unit','') is not null and nullif(queue.source_query->>'year','') is not null
      when 'WHO' then coalesce(nullif(queue.source_query->>'indicator',''),nullif(queue.source_indicator_code,'')) is not null
      when 'UNESCO UIS' then coalesce(nullif(queue.source_query->>'indicator',''),nullif(queue.source_indicator_code,'')) is not null and nullif(queue.exact_query_url,'') is not null
      when 'ILOSTAT' then coalesce(nullif(queue.source_query->>'indicator',''),nullif(queue.source_indicator_code,'')) is not null and nullif(queue.exact_query_url,'') is not null
      when 'Natural Earth' then queue.source_query->>'scale'='1:10m' and nullif(queue.derivation_method,'') is not null
      when 'UN Comtrade' then queue.source_query->>'flowCode'='X' and coalesce(queue.source_query->>'partnerCode','') like '0%' and nullif(queue.source_query->>'cmdCode','') is not null
      when 'U.S. EIA' then nullif(queue.source_query->>'productId','') is not null and nullif(queue.source_query->>'activityId','') is not null
      when 'UNHCR' then nullif(queue.source_query->>'endpoint','') is not null and nullif(queue.source_query->>'dimension','') is not null
      else false
    end as source_spec_ready
  from public.category_review_queue_v15 queue
  left join tie_stats tie on tie.category_id=queue.id
), scored as (
  select base.*,
    round((credibility*.20+verifiability*.20+comprehension*.20+interest*.15+uniqueness*.10+least(coverage,100)*.15)::numeric,1) as qualification_score,
    searchable_copy ~ '(happiness|life satisfaction|democracy|freedom index|corruption|government effectiveness|political stability|governance index|perception|competitiveness index|fragility index|human development index)' as subjective_copy,
    searchable_copy ~ '(labor.?income share|output per worker|employment.?to.?population|unit labor cost|adjusted net savings|statistical capacity|terms of trade|broad money|domestic credit|current account balance|external debt stock)' as esoteric_copy,
    searchable_copy ~ '(internet users|individuals using the internet|internet usage|internet use)' as vulnerable_internet,
    (source_organization='UNESCO UIS' and (source_indicator_code in ('CR.MOD.1','CR.MOD.2','CR.MOD.3') or searchable_copy ~ '(modeled .*completion|out.of.school)')) as excluded_education_model,
    (source_organization='FAOSTAT' and lower(effective_title) ~ '(^|[^a-z])(primary|total|other|nes)([^a-z]|$)|harvested area') as ambiguous_faostat
  from base
), qualified as (
  select scored.*,
    (
      editorial_status not in ('rejected','duplicate')
      and public.category_v15_source_is_official(source_organization)
      and not true_integrity_failure
      and coalesce(credibility_status,'approved')<>'quarantined'
      and coalesce(objective_status,'uncertain')='objective'
      and not political_self_reported and not subjective_or_composite and not confusing and not esoteric and not stale_data and not poor_coverage and duplicate_of is null
      and coalesce(content_review_status,'pending')<>'excluded' and coalesce(player_quality_status,'caution')<>'blocked'
      and source_spec_ready and coverage>=50
      and coalesce(common_year,latest_available_year,0)>=greatest(minimum_year,2022)
      and comprehension>=85 and interest>=72 and uniqueness>=72 and verifiability>=80 and credibility>=75 and coalesce(quality_score,0)>=70 and qualification_score>=78
      and distinct_display_values>=greatest(12,ceil(coverage*.15)::integer) and largest_display_tie_share<=.20
      and not subjective_copy and not esoteric_copy and not vulnerable_internet and not excluded_education_model and not ambiguous_faostat
      and coalesce(evidence_label,'')<>'Modeled estimate' and coalesce(modeled_observation_share,0)<.80
    ) as daily_qualified,
    (
      editorial_status not in ('rejected','duplicate')
      and public.category_v15_source_is_official(source_organization)
      and not true_integrity_failure
      and coalesce(credibility_status,'approved')<>'quarantined'
      and coalesce(objective_status,'uncertain')='objective'
      and not political_self_reported and not subjective_or_composite and not confusing and not esoteric and not stale_data and duplicate_of is null
      and coalesce(content_review_status,'pending')<>'excluded' and coalesce(player_quality_status,'caution')<>'blocked'
      and source_spec_ready and coverage>=35
      and coalesce(common_year,latest_available_year,0)>=greatest(2020,least(minimum_year,2022))
      and comprehension>=80 and interest>=65 and uniqueness>=60 and verifiability>=75 and credibility>=75 and coalesce(quality_score,0)>=65 and qualification_score>=72
      and distinct_display_values>=8 and largest_display_tie_share<=.35
      and not subjective_copy and not esoteric_copy and not vulnerable_internet and not excluded_education_model and not ambiguous_faostat
    ) as random_qualified
  from scored
)
insert into public.category_runtime_review_v15_4(category_id,catalog_tier,daily_qualified,random_qualified,coverage,distinct_display_values,largest_display_tie_share,qualification_score,reasons,assessed_at)
select id,
  case when daily_qualified then 'daily' when random_qualified then 'random' else 'quarantined' end,
  daily_qualified,random_qualified,coverage,distinct_display_values,largest_display_tie_share,qualification_score,
  array_remove(array[
    case when true_integrity_failure then 'Direct value, country-set, duplicate, or ranking integrity failure.' end,
    case when not source_spec_ready then 'Exact source specification is incomplete.' end,
    case when coverage<35 then 'Coverage below 35 countries.' end,
    case when comprehension<80 then 'Comprehension score below random-mode minimum.' end,
    case when interest<65 then 'Gameplay-interest score below random-mode minimum.' end,
    case when uniqueness<60 then 'Uniqueness score below random-mode minimum.' end,
    case when distinct_display_values<8 or largest_display_tie_share>.35 then 'Insufficient displayed-value variety.' end,
    case when subjective_copy or esoteric_copy or vulnerable_internet or excluded_education_model or ambiguous_faostat then 'Permanent editorial exclusion rule.' end
  ],null), now()
from qualified
on conflict(category_id) do update set
  catalog_tier=excluded.catalog_tier,
  daily_qualified=excluded.daily_qualified,
  random_qualified=excluded.random_qualified,
  coverage=excluded.coverage,
  distinct_display_values=excluded.distinct_display_values,
  largest_display_tie_share=excluded.largest_display_tie_share,
  qualification_score=excluded.qualification_score,
  reasons=excluded.reasons,
  assessed_at=now();

-- Approve only deterministic clear passes. Explicit rejected/duplicate decisions
-- remain untouched. Daily and random-only tiers are both legitimate catalog
-- approvals; Daily remains the stricter subset.
update public.category_review_state review
set status='approved', reviewed_at=coalesce(review.reviewed_at,now()), reviewed_by=null,
  notes=concat_ws(E'\n',nullif(review.notes,''),case result.catalog_tier
    when 'daily' then 'v15.4 automated Daily-ready clear pass: official objective source, no direct integrity failure, reproducible source specification, adequate recent coverage, strong clarity/interest/uniqueness, and low tie concentration.'
    else 'v15.4 automated Random-only clear pass: valid official category with narrower coverage or greater tie concentration than Daily permits.' end),
  updated_at=now()
from public.category_runtime_review_v15_4 result
where result.category_id=review.category_id
  and result.catalog_tier in ('daily','random')
  and review.status in ('pending','needs_rewrite','needs_discussion');

update public.stat_categories category
set metadata=coalesce(category.metadata,'{}'::jsonb) || jsonb_build_object('catalogTier',result.catalog_tier),
    quality_score=case when result.catalog_tier in ('daily','random') then greatest(coalesce(category.quality_score,0),least(90,greatest(65,round(result.qualification_score)::integer))) else category.quality_score end,
    enabled=result.catalog_tier in ('daily','random'),
    eligible_daily=result.catalog_tier='daily',
    updated_at=now()
from public.category_runtime_review_v15_4 result
where result.category_id=category.id;

select * from public.reconcile_category_playability_v15();

-- Reassert v15.4 runtime tier after the legacy reconciliation mirrors run.
update public.stat_categories category
set enabled=result.catalog_tier in ('daily','random'),
    eligible_daily=result.catalog_tier='daily',
    updated_at=now()
from public.category_runtime_review_v15_4 result
where result.category_id=category.id;

-- Remove only unscored boards created under older rules. Scored historical
-- boards remain locked and are never silently rewritten.
delete from public.daily_challenges challenge
where coalesce(challenge.rules_version,'') <> '11.0'
  and not exists (
    select 1 from public.daily_scores score
    where score.challenge_date=challenge.challenge_date
  );

select catalog_tier,count(*) as categories
from public.category_runtime_review_v15_4
group by catalog_tier order by catalog_tier;

select source_organization,
  count(*) filter (where category.metadata->>'catalogTier'='daily') as daily_ready,
  count(*) filter (where category.metadata->>'catalogTier'='random') as random_only,
  count(*) filter (where category.metadata->>'catalogTier'='quarantined') as quarantined
from public.stat_categories category
group by source_organization
order by daily_ready desc,random_only desc,source_organization;

commit;
