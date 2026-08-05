-- GeoStats v16.1: catalog-wide semantic audit, corrective copy/data rules,
-- resilient Daily generation support, and canonical v16 finalization fixes.
-- Safe to rerun after v16.0.

begin;

select pg_advisory_xact_lock(hashtext('geostats-v16.1-corrective-audit'));

do $$
begin
  if to_regclass('public.category_review_queue_v15') is null then
    raise exception 'GeoStats v15.9.2/v16.0 review infrastructure is required before v16.1.';
  end if;
  if to_regclass('public.category_ranking_completeness_v16') is null then
    raise exception 'GeoStats v16.0 is required before v16.1.';
  end if;
end $$;

create table if not exists public.v16_1_category_backup (
  category_id text primary key,
  title text not null,
  short_title text,
  description text,
  icon text,
  unit text,
  value_type text,
  ranking_direction text,
  enabled boolean not null,
  eligible_daily boolean not null,
  metadata jsonb,
  captured_at timestamptz not null default now()
);

insert into public.v16_1_category_backup(
  category_id,title,short_title,description,icon,unit,value_type,
  ranking_direction,enabled,eligible_daily,metadata
)
select id,title,short_title,description,icon,unit,value_type,
       ranking_direction,enabled,eligible_daily,metadata
from public.stat_categories
on conflict(category_id) do nothing;

create table if not exists public.v16_1_review_backup (
  category_id text primary key,
  status text not null,
  duplicate_of text,
  recommended_title text,
  semantic_group text,
  notes text,
  captured_at timestamptz not null default now()
);

insert into public.v16_1_review_backup(
  category_id,status,duplicate_of,recommended_title,semantic_group,notes
)
select category_id,status,duplicate_of,recommended_title,semantic_group,notes
from public.category_review_state
on conflict(category_id) do nothing;

create table if not exists public.category_semantic_audit_v16_1 (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  audit_status text not null check(audit_status in (
    'pass','rewrite_required','data_repair_required','review_required','excluded'
  )),
  source_identity_status text not null,
  title_unit_status text not null,
  result_logic_status text not null,
  issues text[] not null default '{}',
  warnings text[] not null default '{}',
  assessed_year smallint,
  observation_count integer not null default 0,
  distinct_value_count integer not null default 0,
  minimum_value double precision,
  maximum_value double precision,
  top_values jsonb not null default '[]'::jsonb,
  bottom_values jsonb not null default '[]'::jsonb,
  audit_version text not null default 'geostats-v16.1-semantic-audit-v1',
  assessed_at timestamptz not null default now()
);
create index if not exists category_semantic_audit_v16_1_status_idx
  on public.category_semantic_audit_v16_1(audit_status,source_identity_status,result_logic_status);
alter table public.category_semantic_audit_v16_1 enable row level security;
revoke all on public.category_semantic_audit_v16_1 from public,anon,authenticated;
grant all on public.category_semantic_audit_v16_1 to service_role;

create or replace function public.apply_v16_1_copy_corrections()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  -- Exact known corrections from player review.
  update public.stat_categories
  set title='Largest poultry meat exports',
      short_title='Poultry meat exports',
      description='Annual value of poultry meat exported by each country.',
      updated_at=now()
  where title='Largest poultry-meat exports'
     or source_indicator_code='COMTRADE:most-poultry-exported';

  update public.stat_categories
  set title='Largest spice exports',
      short_title='Spice exports',
      description='Annual value of spices exported by each country.',
      icon='🫙',
      updated_at=now()
  where title ilike 'Largest spice exports%'
     or source_indicator_code='COMTRADE:most-spices-exported';

  update public.stat_categories
  set title='Largest forest area',
      short_title='Forest area',
      description='Total land area covered by forest.',
      updated_at=now()
  where title='Most forest'
     or source_indicator_code='AG.LND.FRST.K2';

  update public.stat_categories
  set title='Highest share of land and sea protected',
      short_title='Land and sea protected',
      description='Percentage of a country''s terrestrial and marine area that is protected.',
      updated_at=now()
  where title ilike 'Highest terrestrial and marine protected areas%'
     or (position('%' in coalesce(unit,''))>0 and title ilike '%terrestrial%marine%protected%');

  update public.stat_categories
  set title='Largest stateless population residing in the country',
      short_title='Stateless residents',
      description='Number of stateless people reported as living in each country.',
      updated_at=now()
  where id='unhcr:most-stateless-people'
     or source_indicator_code in ('population:coa:stateless','population:coa:sta');

  -- The old WHO code is a population count in millions, not a percentage.
  update public.stat_categories
  set enabled=false,eligible_daily=false,review_status='rejected',
      curation_status='excluded',
      curation_reason='Wrong WHO series: population count in millions was labeled as a percentage.',
      updated_at=now()
  where id='who:PHE_HHAIR_POP_CLEAN_FUELS'
     or source_indicator_code='PHE_HHAIR_POP_CLEAN_FUELS';

  update public.category_review_state r
  set status='rejected',
      notes='Data repair required: WHO population count in millions was labeled as a percentage. Replaced by PHE_HHAIR_PROP_POP_CLEAN_FUELS.',
      updated_at=now(),reviewed_at=coalesce(r.reviewed_at,now())
  from public.stat_categories c
  where c.id=r.category_id
    and (c.id='who:PHE_HHAIR_POP_CLEAN_FUELS' or c.source_indicator_code='PHE_HHAIR_POP_CLEAN_FUELS');

  update public.stat_categories
  set title='Highest share using clean cooking fuels',
      short_title='Clean cooking access',
      description='Percentage of the population primarily relying on clean fuels and technologies for cooking.',
      unit='%',value_type='percentage',ranking_direction='high',updated_at=now()
  where id='who:PHE_HHAIR_PROP_POP_CLEAN_FUELS'
     or source_indicator_code='PHE_HHAIR_PROP_POP_CLEAN_FUELS';

  -- Food Balance Sheets are apparent-consumption estimates, not household surveys.
  update public.stat_categories c
  set title=m.title,
      short_title=regexp_replace(m.title,'^Highest estimated ','','i'),
      description=d.description,
      metadata=coalesce(c.metadata,'{}'::jsonb)
        || jsonb_build_object(
          'boardDescription','Estimated from national food-balance data; not measured household intake.',
          'apparentConsumption',true,
          'copyVersion','v16.1-estimated-consumption'
        ),
      updated_at=now()
  from (values
    ('faostat-fbs:beer','Highest estimated beer consumption per person'),
    ('faostat-fbs:wine','Highest estimated wine consumption per person'),
    ('faostat-fbs:milk','Highest estimated milk consumption per person'),
    ('faostat-fbs:cheese','Highest estimated cheese consumption per person'),
    ('faostat-fbs:eggs','Highest estimated egg consumption per person'),
    ('faostat-fbs:beef','Highest estimated beef consumption per person'),
    ('faostat-fbs:pork','Highest estimated pork consumption per person'),
    ('faostat-fbs:poultry','Highest estimated poultry consumption per person'),
    ('faostat-fbs:fish','Highest estimated fish consumption per person'),
    ('faostat-fbs:rice','Highest estimated rice consumption per person'),
    ('faostat-fbs:potatoes','Highest estimated potato consumption per person'),
    ('faostat-fbs:sugar','Highest estimated sugar consumption per person'),
    ('faostat-fbs:vegetable-oil','Highest estimated vegetable oil consumption per person'),
    ('faostat-fbs:coffee','Highest estimated coffee consumption per person'),
    ('faostat-fbs:tea','Highest estimated tea consumption per person'),
    ('faostat-fbs:wheat-products','Highest estimated wheat consumption per person'),
    ('faostat-fbs:maize','Highest estimated maize consumption per person'),
    ('faostat-fbs:bananas','Highest estimated banana consumption per person'),
    ('faostat-fbs:tomatoes','Highest estimated tomato consumption per person'),
    ('faostat-fbs:onions','Highest estimated onion consumption per person'),
    ('faostat-fbs:fruit','Highest estimated fruit consumption per person'),
    ('faostat-fbs:vegetables','Highest estimated vegetable consumption per person'),
    ('faostat-fbs:meat','Highest estimated meat consumption per person'),
    ('faostat-fbs:dairy-products','Highest estimated dairy consumption per person'),
    ('faostat-fbs:pulses','Highest estimated pulse consumption per person'),
    ('faostat-fbs:calories','Highest estimated calorie intake per person'),
    ('faostat-fbs:protein','Highest estimated protein intake per person')
  ) as m(id,title)
  cross join lateral (
    select case
      when m.id='faostat-fbs:calories' then 'Estimated calorie intake per person from national food-balance data; it is not measured household intake.'
      when m.id='faostat-fbs:protein' then 'Estimated protein intake per person from national food-balance data; it is not measured household intake.'
      else 'Estimated consumption per person from national food-balance data. It accounts for production, trade, stocks, losses and non-food uses; it is not measured household intake.'
    end as description
  ) d
  where c.id=m.id;

  -- Keep the review copy synchronized with corrected canonical titles.
  update public.category_review_state r
  set recommended_title=c.title,updated_at=now()
  from public.stat_categories c
  where c.id=r.category_id and (
    c.id like 'faostat-fbs:%'
    or c.id='unhcr:most-stateless-people'
    or c.source_indicator_code in (
      'COMTRADE:most-poultry-exported','COMTRADE:most-spices-exported',
      'AG.LND.FRST.K2','PHE_HHAIR_PROP_POP_CLEAN_FUELS'
    )
    or c.title in (
      'Largest poultry meat exports','Largest spice exports','Largest forest area',
      'Highest share of land and sea protected','Largest stateless population residing in the country',
      'Highest share using clean cooking fuels'
    )
  );
end;
$$;
revoke all on function public.apply_v16_1_copy_corrections() from public,anon,authenticated;
grant execute on function public.apply_v16_1_copy_corrections() to service_role;

create or replace function public.refresh_category_semantic_audit_v16_1()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  delete from public.category_semantic_audit_v16_1 where category_id is not null;

  insert into public.category_semantic_audit_v16_1(
    category_id,audit_status,source_identity_status,title_unit_status,result_logic_status,
    issues,warnings,assessed_year,observation_count,distinct_value_count,minimum_value,
    maximum_value,top_values,bottom_values,audit_version,assessed_at
  )
  with base as (
    select q.id,q.title,q.effective_title,q.description,q.unit,q.value_type,
           q.ranking_direction,q.source_organization,q.source_indicator_code,
           q.editorial_status,q.validation_status,q.validation_reason,
           coalesce(q.validation_mismatch_count,0) as validation_mismatch_count,
           coalesce(q.validation_ranking_mismatch_count,0) as validation_ranking_mismatch_count,
           coalesce(q.common_year,q.latest_available_year)::smallint as assessed_year,
           lower(coalesce(q.unit,'')) as unit_lower,
           lower(coalesce(q.value_type,'')) as value_type_lower,
           lower(coalesce(q.effective_title,q.title,'')) as title_lower
    from public.category_review_queue_v15 q
  ), selected as (
    select b.*,o.country_iso3,o.country_name,o.value,o.data_year
    from base b
    left join public.stat_observations o
      on o.category_id=b.id and o.data_year=b.assessed_year
  ), ranked as (
    select s.*,
      row_number() over(partition by s.id order by
        case when s.ranking_direction='high' then s.value end desc nulls last,
        case when s.ranking_direction='low' then s.value end asc nulls last,
        s.country_iso3) as top_rank,
      row_number() over(partition by s.id order by
        case when s.ranking_direction='high' then s.value end asc nulls last,
        case when s.ranking_direction='low' then s.value end desc nulls last,
        s.country_iso3) as bottom_rank
    from selected s
  ), metrics as (
    select b.id,b.title,b.effective_title,b.description,b.unit,b.value_type,
      b.ranking_direction,b.source_organization,b.source_indicator_code,b.editorial_status,
      b.validation_status,b.validation_reason,b.validation_mismatch_count,b.validation_ranking_mismatch_count,
      b.assessed_year,b.unit_lower,b.value_type_lower,b.title_lower,
      count(r.value)::integer as observation_count,
      count(distinct r.value)::integer as distinct_value_count,
      min(r.value) as minimum_value,max(r.value) as maximum_value,
      coalesce(jsonb_agg(jsonb_build_object(
        'country',r.country_name,'iso3',r.country_iso3,'value',r.value,'year',r.data_year
      ) order by r.top_rank) filter(where r.top_rank<=12 and r.value is not null),'[]'::jsonb) as top_values,
      coalesce(jsonb_agg(jsonb_build_object(
        'country',r.country_name,'iso3',r.country_iso3,'value',r.value,'year',r.data_year
      ) order by r.bottom_rank) filter(where r.bottom_rank<=12 and r.value is not null),'[]'::jsonb) as bottom_values
    from base b left join ranked r on r.id=b.id
    group by b.id,b.title,b.effective_title,b.description,b.unit,b.value_type,
      b.ranking_direction,b.source_organization,b.source_indicator_code,b.editorial_status,
      b.validation_status,b.validation_reason,b.validation_mismatch_count,b.validation_ranking_mismatch_count,
      b.assessed_year,b.unit_lower,b.value_type_lower,b.title_lower
  ), classified as (
    select m.*,
      (m.value_type_lower like '%percent%' or position('%' in m.unit_lower)>0 or m.unit_lower like '%percent%') as is_percentage,
      (m.unit_lower ~ '(people|persons|sites|animals|tonnes|tons|vehicles|applications|cases|hectares|kilometers|kilometres|square kilometers|square kilometres)') as is_nonnegative_count,
      replace(coalesce(m.source_indicator_code,''),'''','') as clean_code
    from metrics m
  ), findings as (
    select c.*,
      array_remove(array[
        case when c.assessed_year is null then 'No common comparison year is selected.' end,
        case when c.observation_count=0 then 'No observations exist for the selected comparison year.' end,
        case when coalesce(c.source_indicator_code,'')='' then 'Exact official indicator/item/element code is missing.' end,
        case when public.category_v15_true_integrity_failure(
          c.validation_status,c.validation_reason,c.validation_mismatch_count,c.validation_ranking_mismatch_count
        ) then 'Official-source validation found a substantive value, coverage, duplicate, or ranking mismatch.' end,
        case when c.source_indicator_code='PHE_HHAIR_POP_CLEAN_FUELS' then 'Wrong WHO sibling series: population in millions was labeled as a percentage.' end,
        case when c.title_lower like '%clean%cooking%' and c.source_organization='WHO'
                   and c.source_indicator_code<>'PHE_HHAIR_PROP_POP_CLEAN_FUELS'
          then 'Clean-cooking category is not mapped to the official proportion indicator.' end,
        case when c.is_percentage and (c.minimum_value<0 or c.maximum_value>100)
          then format('Percentage values fall outside 0-100 (min %s, max %s).',c.minimum_value,c.maximum_value) end,
        case when c.is_nonnegative_count and c.minimum_value<0
          then format('A count/total category contains a negative value (%s).',c.minimum_value) end,
        case when c.title_lower ~ '^(highest|largest|most|fastest|best) ' and c.ranking_direction='low'
          then 'Title says highest/largest/most but ranking direction is lowest-wins.' end,
        case when c.title_lower ~ '^lowest ' and c.ranking_direction='high'
          then 'Title says lowest but ranking direction is highest-wins.' end,
        case when c.source_organization='FAOSTAT' and c.clean_code ~ ':(5312|5320|5412|5417)$'
                   and c.title_lower ~ '(produced|production|population)'
          then 'FAOSTAT title conflicts with a yield/area/carcass element code.' end,
        case when c.source_organization='FAOSTAT' and c.clean_code ~ ':(5510|5513)$'
                   and c.title_lower ~ '(yield|harvested area|per hectare)'
          then 'FAOSTAT production element is labeled as yield or area.' end,
        case when c.title_lower like '%per person%' and c.unit_lower not like '%per person%'
                   and c.unit_lower not like '%capita%'
          then 'Per-person title does not match the stored unit.' end
      ],null)::text[] as critical_issues,
      array_remove(array[
        case when c.is_percentage and c.title_lower !~ '(share|percentage|percent|rate|prevalence|probability)'
          then 'Percentage is not explicit in the player-facing title.' end,
        case when c.is_percentage and c.observation_count>=30 and c.maximum_value between 0 and 1
          then 'All percentage values are at or below 1; verify that fractions were not mislabeled as percentage points.' end,
        case when c.source_organization='FAOSTAT Food Balances' and c.title_lower !~ '(estimated).*(consumption|intake)'
          then 'Food Balance title should describe estimated consumption/intake.' end,
        case when c.title_lower in ('most forest','highest terrestrial and marine protected areas','most stateless people')
          then 'Player-facing title is ambiguous about total/share/residence.' end,
        case when c.source_organization='UN Comtrade' and c.title_lower like '%spice exports%' and c.observation_count>0
          then 'Verify the icon represents the broad spice group rather than peppers alone.' end,
        case when c.distinct_value_count<10 and c.observation_count>=30
          then 'Fewer than ten distinct values exist in the selected-year results.' end
      ],null)::text[] as audit_warnings
    from classified c
  )
  select id,
    case
      when editorial_status in ('rejected','duplicate') then 'excluded'
      when cardinality(critical_issues)>0 then 'data_repair_required'
      when cardinality(audit_warnings)>0 and (
        title_lower in ('most forest','highest terrestrial and marine protected areas','most stateless people')
        or (is_percentage and title_lower ~ '^(highest|largest|most) ' and title_lower !~ '(share|percentage|percent|rate)')
        or (source_organization='FAOSTAT Food Balances' and title_lower !~ '(estimated).*(consumption|intake)')
      ) then 'rewrite_required'
      when coalesce(source_indicator_code,'')='' then 'review_required'
      when is_percentage and observation_count>=30 and maximum_value between 0 and 1 then 'review_required'
      else 'pass'
    end,
    case
      when source_indicator_code='PHE_HHAIR_POP_CLEAN_FUELS' then 'mismatch'
      when public.category_v15_true_integrity_failure(
        validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count
      ) then 'mismatch'
      when coalesce(source_indicator_code,'')='' then 'incomplete'
      else 'identified'
    end,
    case
      when cardinality(audit_warnings)>0 then 'warning'
      else 'aligned'
    end,
    case
      when cardinality(critical_issues)>0 then 'blocked'
      when observation_count=0 then 'blocked'
      else 'plausibility_screen_passed'
    end,
    critical_issues,audit_warnings,assessed_year,observation_count,distinct_value_count,
    minimum_value,maximum_value,top_values,bottom_values,
    'geostats-v16.1-semantic-audit-v1',now()
  from findings;
end;
$$;
revoke all on function public.refresh_category_semantic_audit_v16_1() from public,anon,authenticated;
grant execute on function public.refresh_category_semantic_audit_v16_1() to service_role;

-- Preserve the v16 ranking-completeness logic while making the refresh safe
-- under Supabase's protected DELETE policy.
create or replace function public.refresh_category_ranking_completeness_v16()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  delete from public.category_ranking_completeness_v16 where category_id is not null;

  insert into public.category_ranking_completeness_v16(
    category_id,status,reason,observation_count,distinct_value_count,
    top_value_distinct_count,top_value_feasible,assessed_year,assessed_at
  )
  with selected_year as (
    select q.id,q.source_organization,q.ranking_direction,
           coalesce(q.common_year,q.latest_available_year)::smallint as assessed_year
    from public.category_review_queue_v15 q
  ), ranked as (
    select y.id,y.source_organization,y.ranking_direction,y.assessed_year,o.value,
           row_number() over(
             partition by y.id
             order by
               case when y.ranking_direction='high' then o.value end desc nulls last,
               case when y.ranking_direction='low' then o.value end asc nulls last,
               o.country_iso3
           ) as ranking_position
    from selected_year y
    join public.stat_observations o
      on o.category_id=y.id and o.data_year=y.assessed_year
  ), metrics as (
    select y.id,y.source_organization,y.ranking_direction,y.assessed_year,
           count(r.value)::integer as observation_count,
           count(distinct r.value)::integer as distinct_value_count,
           count(distinct r.value) filter(where r.ranking_position<=50)::integer as top_value_distinct_count
    from selected_year y
    left join ranked r on r.id=y.id
    group by y.id,y.source_organization,y.ranking_direction,y.assessed_year
  )
  select id,
    case
      when assessed_year is null or observation_count<30 then 'non_comprehensive'
      when observation_count>=185 then 'comprehensive'
      when ranking_direction='low' then 'non_comprehensive'
      when source_organization in (
        'FAOSTAT','FAOSTAT Food Balances','Natural Earth','Pew Research Center',
        'Smithsonian GVP','USGS','UN Comtrade','UNHCR'
      ) and top_value_distinct_count>=10 then 'top_end_complete'
      else 'non_comprehensive'
    end,
    case
      when assessed_year is null then 'No common comparison year is available.'
      when observation_count<30 then 'Fewer than 30 countries have comparable observations.'
      when observation_count>=185 then 'The common-year ranking covers nearly the full supported country universe.'
      when ranking_direction='low' then 'Incomplete coverage cannot safely support a lowest-wins ranking.'
      when source_organization in (
        'FAOSTAT','FAOSTAT Food Balances','Natural Earth','Pew Research Center',
        'Smithsonian GVP','USGS','UN Comtrade','UNHCR'
      ) and top_value_distinct_count>=10
        then 'The source is structurally sparse, but the meaningful high end contains enough distinct ranked values.'
      else 'One or more omitted countries could plausibly alter the meaningful top ranking.'
    end,
    observation_count,distinct_value_count,top_value_distinct_count,
    (top_value_distinct_count>=10),assessed_year,now()
  from metrics;
end;
$$;
revoke all on function public.refresh_category_ranking_completeness_v16() from public,anon,authenticated;
grant execute on function public.refresh_category_ranking_completeness_v16() to service_role;

select public.apply_v16_1_copy_corrections();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();

-- Promote the corrected WHO proportion only after it exists and passes the
-- semantic screen. The wrong population-count sibling remains rejected.
update public.category_review_state r
set status='approved',recommended_title='Highest share using clean cooking fuels',
    semantic_group='clean-cooking-access',
    notes='Correct WHO proportion series; values constrained to 0-100%.',
    updated_at=now(),reviewed_at=coalesce(reviewed_at,now())
from public.stat_categories c
join public.category_semantic_audit_v16_1 a on a.category_id=c.id
where c.id=r.category_id
  and c.source_indicator_code='PHE_HHAIR_PROP_POP_CLEAN_FUELS'
  and a.audit_status='pass'
  and greatest(c.common_year_coverage,c.country_coverage)>=100
  and r.reviewed_by is null;

select public.reconcile_category_playability_v15();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();

create or replace view public.category_runtime_review_v16
with(security_invoker=true) as
select q.*,
       coalesce(k.status,'unreviewed') as ranking_completeness_status,
       coalesce(k.reason,'Ranking completeness has not been assessed.') as ranking_completeness_reason,
       coalesce(k.top_value_distinct_count,0) as top_value_distinct_count,
       coalesce(k.top_value_feasible,false) as top_value_feasible,
       (
         q.computed_playable_v15
         and coalesce(k.status,'unreviewed') in ('comprehensive','top_end_complete')
         and coalesce(k.top_value_feasible,false)
         and coalesce(a.audit_status,'review_required')='pass'
       ) as computed_playable_v16,
       q.v15_blockers || array_remove(array[
         case when coalesce(k.status,'unreviewed') not in ('comprehensive','top_end_complete') then coalesce(k.reason,'Ranking completeness has not been assessed.') end,
         case when not coalesce(k.top_value_feasible,false) then 'Fewer than ten distinct values exist among the meaningful top rankings.' end,
         case when coalesce(a.audit_status,'review_required')<>'pass' then 'Semantic audit: '||coalesce(array_to_string(a.issues||a.warnings,'; '),'review required') end
       ],null) as v16_blockers,
       array_remove(array[
         case when k.status='top_end_complete' then 'Ranking is top-end complete rather than fully comprehensive.' end,
         case when q.validation_status<>'verified' and not public.category_v15_true_integrity_failure(q.validation_status,q.validation_reason,q.validation_mismatch_count,q.validation_ranking_mismatch_count)
           then 'Official values are usable, but non-data audit metadata remain incomplete.' end,
         case when cardinality(coalesce(a.warnings,'{}'::text[]))>0 then array_to_string(a.warnings,'; ') end
       ],null) as v16_warnings,
       coalesce(a.audit_status,'review_required') as semantic_audit_status,
       coalesce(a.source_identity_status,'incomplete') as semantic_source_identity_status,
       coalesce(a.title_unit_status,'warning') as semantic_title_unit_status,
       coalesce(a.result_logic_status,'blocked') as semantic_result_logic_status,
       coalesce(a.issues,'{}'::text[]) as semantic_audit_issues,
       coalesce(a.warnings,'{}'::text[]) as semantic_audit_warnings,
       a.top_values as semantic_top_values,
       a.bottom_values as semantic_bottom_values
from public.category_review_queue_v15 q
left join public.category_ranking_completeness_v16 k on k.category_id=q.id
left join public.category_semantic_audit_v16_1 a on a.category_id=q.id;
revoke all on public.category_runtime_review_v16 from public,anon,authenticated;
grant select on public.category_runtime_review_v16 to service_role;

drop view if exists public.category_review_workbench_v16;
create view public.category_review_workbench_v16
with(security_invoker=true) as
select runtime.*,
 vetting.recommendation as auto_vetting_recommendation,
 vetting.vetting_score as auto_vetting_score,
 vetting.reason as auto_vetting_reason,
 vetting.possible_duplicate_of as auto_possible_duplicate_of,
 vetting.title_similarity as auto_title_similarity,
 vetting.rank_correlation as auto_rank_correlation,
 vetting.tie_share as auto_tie_share,
 vetting.vetting_version as auto_vetting_version,
 vetting.vetted_at as auto_vetted_at
from public.category_runtime_review_v16 runtime
left join public.category_auto_vetting_v15_9 vetting on vetting.category_id=runtime.id;
revoke all on public.category_review_workbench_v16 from public,anon,authenticated;
grant select on public.category_review_workbench_v16 to service_role;

create or replace view public.category_full_audit_v16_1
with(security_invoker=true) as
select
  v.id,v.effective_title as player_title,v.short_title,v.description,
  v.plain_language_description,v.technical_definition,v.icon,v.unit,v.value_type,
  v.ranking_direction,v.family,v.effective_semantic_group,
  v.source_organization,v.source_dataset,v.source_indicator_code,
  v.source_url,v.source_page_url,v.methodology_url,
  v.player_source_url,v.player_source_status,v.source_query,
  v.common_year,v.common_year_coverage,v.country_coverage,v.quality_score,
  v.editorial_status,v.editorial_notes,v.reviewed_by,v.reviewed_at,v.validation_status,v.validation_reason,
  v.validation_mismatch_count,v.validation_ranking_mismatch_count,
  v.ranking_completeness_status,v.ranking_completeness_reason,
  v.semantic_audit_status,v.semantic_source_identity_status,
  v.semantic_title_unit_status,v.semantic_result_logic_status,
  v.semantic_audit_issues,v.semantic_audit_warnings,
  v.semantic_top_values,v.semantic_bottom_values,
  v.computed_playable_v16,v.v16_blockers,v.v16_warnings
from public.category_runtime_review_v16 v
order by v.computed_playable_v16 desc,v.source_organization,v.effective_title;
revoke all on public.category_full_audit_v16_1 from public,anon,authenticated;
grant select on public.category_full_audit_v16_1 to service_role;

create or replace view public.category_review_overview_v16
with(security_invoker=true) as
select count(*)::bigint categories,
 count(*) filter(where editorial_status='pending')::bigint pending,
 count(*) filter(where editorial_status='approved')::bigint approved,
 count(*) filter(where editorial_status='rejected')::bigint rejected,
 count(*) filter(where editorial_status='duplicate')::bigint duplicates,
 count(*) filter(where editorial_status='needs_rewrite')::bigint needs_rewrite,
 count(*) filter(where editorial_status='needs_discussion')::bigint needs_discussion,
 count(*) filter(where hard_gate_ready)::bigint hard_gate_ready,
 count(*) filter(where computed_playable_v16)::bigint playable,
 count(*) filter(where editorial_status='approved' and not computed_playable_v16)::bigint approved_but_blocked,
 count(*) filter(where political_self_reported)::bigint political_self_reported,
 count(*) filter(where confusing or esoteric)::bigint confusing_or_esoteric,
 count(*) filter(where subjective_or_composite)::bigint subjective_or_composite,
 count(*) filter(where semantic_audit_status='pass')::bigint semantic_audit_passed,
 count(*) filter(where semantic_audit_status='rewrite_required')::bigint semantic_rewrite_required,
 count(*) filter(where semantic_audit_status='data_repair_required')::bigint semantic_data_repair_required,
 count(*) filter(where semantic_audit_status='review_required')::bigint semantic_review_required
from public.category_runtime_review_v16;
revoke all on public.category_review_overview_v16 from public,anon,authenticated;
grant select on public.category_review_overview_v16 to service_role;

-- Manual review refresh never reapplies one-time editorial defaults, but always
-- refreshes ranking and semantic audit gates before publishing runtime flags.
create or replace function public.refresh_v16_runtime_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.reconcile_category_playability_v15();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  update public.stat_categories c
  set enabled=v.computed_playable_v16,
      eligible_daily=v.computed_playable_v16,
      updated_at=now()
  from public.category_runtime_review_v16 v
  where v.id=c.id;
end;
$$;
revoke all on function public.refresh_v16_runtime_catalog() from public,anon,authenticated;
grant execute on function public.refresh_v16_runtime_catalog() to service_role;

create or replace function public.finalize_v16_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  perform pg_advisory_xact_lock(hashtext('geostats-v16.1-finalize-catalog'));
  perform public.apply_v16_1_copy_corrections();
  perform public.refresh_v16_runtime_catalog();
end;
$$;
revoke all on function public.finalize_v16_catalog() from public,anon,authenticated;
grant execute on function public.finalize_v16_catalog() to service_role;

select public.refresh_v16_runtime_catalog();

commit;

select * from public.category_review_overview_v16;
