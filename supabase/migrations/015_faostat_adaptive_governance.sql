-- GeoStats v13.4.1
-- FAOSTAT-specific adaptive coverage, documented-estimate acceptance, and
-- semantic duplicate arbitration. Safe to run more than once.

begin;

do $$
begin
  if to_regprocedure('public.refresh_stat_concept_group(text)') is null then
    raise exception 'GeoStats v13.4 governance is required before v13.4.1. Run RUN_THIS_IN_SUPABASE_FOR_V13_4.sql first.';
  end if;
end $$;

with year_counts as (
  select
    observation.category_id,
    observation.data_year,
    count(distinct observation.country_iso3)::numeric as coverage
  from public.stat_observations observation
  join public.stat_categories category on category.id=observation.category_id
  where category.source_organization='FAOSTAT'
  group by observation.category_id,observation.data_year
), maximum_coverage as (
  select category_id,max(coverage)::numeric as maximum_recent_coverage
  from year_counts
  group by category_id
), selected_year as (
  select distinct on (counts.category_id)
    counts.category_id,
    counts.data_year as common_year,
    counts.coverage,
    maximum.maximum_recent_coverage
  from year_counts counts
  join maximum_coverage maximum using(category_id)
  where counts.coverage >= case
    when maximum.maximum_recent_coverage>=60
      then greatest(60,ceil(maximum.maximum_recent_coverage*0.85))
    else greatest(1,ceil(maximum.maximum_recent_coverage*0.85))
  end
  order by counts.category_id,counts.data_year desc
), selected_evidence as (
  select
    observation.category_id,
    count(*)::numeric as observation_count,
    count(*) filter (where observation.metadata->>'reportingClass'='official')::numeric as official_count,
    count(*) filter (where observation.metadata->>'reportingClass'='modeled')::numeric as modeled_count
  from public.stat_observations observation
  join selected_year selected
    on selected.category_id=observation.category_id
   and selected.common_year=observation.data_year
  group by observation.category_id
), base as (
  select
    category.id,
    category.review_status='rejected' as manually_rejected,
    greatest(coalesce(selected.coverage,category.common_year_coverage,category.country_coverage,0),0)::numeric as coverage,
    greatest(
      coalesce(selected.maximum_recent_coverage,nullif(category.metadata->>'maximumRecentCoverage','')::numeric,category.country_coverage,category.common_year_coverage,0),
      1
    ) as maximum_recent_coverage,
    coalesce(selected.common_year,category.common_year,category.latest_available_year,0)::integer as resolved_common_year,
    greatest(
      0,
      extract(year from now())::integer-coalesce(selected.common_year,category.common_year,category.latest_available_year,0)
    )::numeric as common_year_age,
    least(
      1.0,
      greatest(
        0.0,
        coalesce(
          selected_evidence.official_count/nullif(selected_evidence.observation_count,0),
          category.official_observation_share,
          0
        )
      )
      + greatest(
        0.0,
        coalesce(
          selected_evidence.modeled_count/nullif(selected_evidence.observation_count,0),
          category.modeled_observation_share,
          0
        )
      )
    )::numeric as documented_share,
    greatest(
      0.0,
      coalesce(
        selected_evidence.official_count/nullif(selected_evidence.observation_count,0),
        category.official_observation_share,
        0
      )
    )::numeric as official_share,
    greatest(
      0.0,
      coalesce(
        selected_evidence.modeled_count/nullif(selected_evidence.observation_count,0),
        category.modeled_observation_share,
        0
      )
    )::numeric as modeled_share,
    greatest(0,coalesce(category.clustering_score,0))::numeric as clustering,
    greatest(0,coalesce(category.stability_score,0))::numeric as stability,
    coalesce(category.metadata->>'item','') as item_name,
    coalesce(category.metadata->>'element','') as element_name
  from public.stat_categories category
  left join selected_year selected on selected.category_id=category.id
  left join selected_evidence on selected_evidence.category_id=category.id
  where category.source_organization='FAOSTAT'
), measures as (
  select
    base.*,
    greatest(0.0,1.0-base.documented_share) as unknown_share,
    least(1.0,base.coverage/base.maximum_recent_coverage) as alignment_ratio,
    25.0*least(1.0,base.coverage/100.0) as coverage_points,
    15.0*greatest(0.0,1.0-greatest(0.0,base.common_year_age-1.0)/5.0) as freshness_points,
    15.0*least(1.0,base.coverage/base.maximum_recent_coverage) as alignment_points,
    15.0*base.documented_share+5.0*base.official_share as evidence_points,
    15.0*least(1.0,base.clustering/100.0) as distribution_points,
    10.0*least(1.0,base.stability/100.0) as stability_points,
    trim(both '-' from regexp_replace(lower(base.item_name),'[^a-z0-9]+','-','g')) as item_slug,
    trim(regexp_replace(lower(base.item_name),'[^a-z0-9]+',' ','g')) as normalized_item,
    case
      when lower(base.element_name) like '%area harvested%' then 'harvested-area'
      when lower(base.element_name) like '%yield%' then 'yield'
      when lower(base.element_name) like '%producing animals%' then 'producing-animals'
      when lower(base.element_name) like '%animals slaughtered%' or lower(base.element_name) like '%slaughter%' then 'animals-slaughtered'
      when lower(base.element_name) like '%milk animals%' then 'milk-animals'
      when lower(base.element_name) like '%laying%' then 'laying-animals'
      when lower(base.element_name) like '%stocks%' then 'stocks'
      when lower(base.element_name) like '%production%' then 'production'
      else trim(both '-' from regexp_replace(lower(base.element_name),'[^a-z0-9]+','-','g'))
    end as element_class
  from base
), scored as (
  select
    measures.*,
    round(
      measures.coverage_points
      + measures.freshness_points
      + measures.alignment_points
      + measures.evidence_points
      + measures.distribution_points
      + measures.stability_points
    )::integer as adaptive_score
  from measures
), evaluated as (
  select
    scored.*,
    (
      scored.adaptive_score>=75
      and scored.coverage>=60
      and scored.common_year_age<=4
      and scored.alignment_ratio>=0.85
      and scored.documented_share>=0.75
      and scored.clustering>=65
      and scored.stability>=50
    ) as passes,
    case
      when scored.normalized_item in ('cereals primary','cereals primary total','cereals')
        and scored.element_class='production' then 'cerealProduction'
      when scored.normalized_item in ('cereals primary','cereals primary total','cereals')
        and scored.element_class='yield' then 'cerealYield'
      else 'faostat-qcl-'
        || coalesce(nullif(scored.item_slug,''),scored.id)
        || '-'
        || coalesce(nullif(scored.element_class,''),'measure')
    end as resolved_concept_group,
    concat_ws(', ',
      case when scored.adaptive_score<75 then 'qualityScore' end,
      case when scored.coverage<60 then 'coverage' end,
      case when scored.common_year_age>4 then 'freshness' end,
      case when scored.alignment_ratio<0.85 then 'commonYearAlignment' end,
      case when scored.documented_share<0.75 then 'documentedEvidence' end,
      case when scored.clustering<65 then 'distribution' end,
      case when scored.stability<50 then 'stability' end
    ) as failed_checks
  from scored
)
update public.stat_categories category
set
  common_year=evaluated.resolved_common_year,
  common_year_coverage=evaluated.coverage::integer,
  country_coverage=evaluated.coverage::integer,
  official_observation_share=round(evaluated.official_share,6),
  modeled_observation_share=round(evaluated.modeled_share,6),
  quality_score=evaluated.adaptive_score,
  quality_standard_version='geostats-v13.4.1-faostat-adaptive',
  quality_details=coalesce(category.quality_details,'{}'::jsonb) || jsonb_build_object(
    'standard','geostats-v13.4.1-faostat-adaptive',
    'score',evaluated.adaptive_score,
    'autoQualified',evaluated.passes,
    'thresholds',jsonb_build_object(
      'score',75,
      'coverage',60,
      'coverageScoreFullCredit',100,
      'maximumCommonYearAgeYears',4,
      'minimumCommonYearAlignment',0.85,
      'minimumDocumentedObservationShare',0.75,
      'minimumClusteringScore',65,
      'minimumStabilityScore',50,
      'maximumModeledShare',null
    ),
    'components',jsonb_build_object(
      'coverage',round(evaluated.coverage_points,1),
      'freshness',round(evaluated.freshness_points,1),
      'commonYearAlignment',round(evaluated.alignment_points,1),
      'documentedEvidence',round(evaluated.evidence_points,1),
      'distribution',round(evaluated.distribution_points,1),
      'stability',round(evaluated.stability_points,1)
    ),
    'commonYearAlignment',round(evaluated.alignment_ratio,4),
    'documentedObservationShare',round(evaluated.documented_share,6),
    'unknownObservationShare',round(evaluated.unknown_share,6),
    'officialObservationShare',round(evaluated.official_share,6),
    'modeledObservationShare',round(evaluated.modeled_share,6),
    'checks',jsonb_build_object(
      'qualityScore',evaluated.adaptive_score>=75,
      'coverage',evaluated.coverage>=60,
      'freshness',evaluated.common_year_age<=4,
      'commonYearAlignment',evaluated.alignment_ratio>=0.85,
      'documentedEvidence',evaluated.documented_share>=0.75,
      'distribution',evaluated.clustering>=65,
      'stability',evaluated.stability>=50
    ),
    'failedChecks',case when evaluated.failed_checks='' then '[]'::jsonb else to_jsonb(string_to_array(evaluated.failed_checks,', ')) end
  ),
  evidence_tier=case
    when evaluated.documented_share>=0.95 and evaluated.official_share>=0.40 then 'A'
    when evaluated.documented_share>=0.75 then 'B'
    else 'C'
  end,
  provenance_status=case when evaluated.documented_share>=0.75 then 'approved' else 'uncertain' end,
  provenance_class='internationally_harmonized_fao_production_statistics',
  provenance_reason=case
    when evaluated.documented_share>=0.75 then
      'FAOSTAT QCL uses standardized definitions and validation flags. Official records and transparent FAO estimates or imputations count as documented evidence; missing or unclassified records do not. Unsupported political assertions alone are never sufficient.'
    else
      'Too much of the common-year snapshot has missing or unclassified provenance for automatic approval.'
  end,
  methodology_url='https://www.fao.org/faostat/en/#definitions',
  methodology_notes='Physical production measure from FAOSTAT QCL. Official observations and transparent FAO estimates/imputations are distinguished but both count as documented evidence. Missing observations remain missing and are never inferred as zero.',
  independent_validation=(evaluated.documented_share>=0.75),
  government_assertion_risk=case when evaluated.documented_share>=0.75 then 'low' else 'unknown' end,
  concept_group=evaluated.resolved_concept_group,
  governance_priority=11,
  governance_version='geostats-v13.4.1-faostat-adaptive-v1',
  auto_qualified=case when evaluated.manually_rejected then false else evaluated.passes end,
  review_status=case
    when evaluated.manually_rejected then 'rejected'
    when evaluated.passes then 'approved'
    when evaluated.documented_share<0.75 and evaluated.adaptive_score>=75 then 'needs_review'
    else 'candidate'
  end,
  enabled=case when evaluated.manually_rejected then false else evaluated.passes end,
  eligible_daily=case when evaluated.manually_rejected then false else evaluated.passes end,
  duplicate_status='pending',
  superseded_by=null,
  auto_decision_reason=case
    when evaluated.manually_rejected then 'Remains disabled because it was manually rejected.'
    when evaluated.passes then 'Automatically approved under the FAOSTAT adaptive quality and documented-evidence gates; duplicate arbitration may still supersede it.'
    when evaluated.failed_checks<>'' then 'Quarantined: ' || evaluated.failed_checks || '.'
    else 'Quarantined because automatic approval did not pass.'
  end,
  metadata=coalesce(category.metadata,'{}'::jsonb) || jsonb_build_object(
    'governanceVersion','geostats-v13.4.1-faostat-adaptive-v1',
    'conceptGroup',evaluated.resolved_concept_group,
    'coverageFloor',60,
    'coverageScoreFullCredit',100,
    'maximumRecentCoverage',evaluated.maximum_recent_coverage::integer,
    'documentedObservationShare',round(evaluated.documented_share,6),
    'unknownObservationShare',round(evaluated.unknown_share,6),
    'adaptiveFaostatGate',true,
    'documentedEstimatesAllowed',true
  ),
  updated_at=now()
from evaluated
where category.id=evaluated.id;

-- Select only one playable category per semantic concept, including the direct
-- FAOSTAT versions of cereal production/yield versus World Bank republications.
do $$
declare row record;
begin
  for row in
    select distinct concept_group
    from public.stat_categories
    where concept_group is not null
      and (source_organization='FAOSTAT' or concept_group in ('cerealProduction','cerealYield'))
  loop
    perform public.refresh_stat_concept_group(row.concept_group);
  end loop;
end $$;

update public.data_sources
set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'intake_policy','geostats-v13.4.1-faostat-adaptive-v1',
  'review_required',false,
  'automatic_approval',true,
  'coverage_floor',60,
  'coverage_score_full_credit',100,
  'documented_estimates_allowed',true,
  'unknown_evidence_allowed_share',0.25,
  'missing_values_become_zero',false,
  'duplicate_policy','one preferred category per semantic concept'
), updated_at=now()
where id='faostat' or name='FAOSTAT';

commit;
