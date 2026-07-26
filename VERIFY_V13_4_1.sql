-- GeoStats v13.4.1 FAOSTAT verification
-- Run after RUN_THIS_IN_SUPABASE_FOR_V13_4_1.sql. All violation counts should be 0.

select
  count(*) as faostat_total,
  count(*) filter (where enabled) as faostat_enabled,
  count(*) filter (where review_status='approved') as faostat_approved,
  count(*) filter (where duplicate_status='superseded') as faostat_superseded,
  count(*) filter (where provenance_status='uncertain') as provenance_uncertain,
  count(*) filter (where common_year_coverage<60) as below_coverage_floor
from public.stat_categories
where source_organization='FAOSTAT';

select
  count(*) filter (where enabled and common_year_coverage<60) as enabled_below_coverage_floor,
  count(*) filter (
    where enabled
      and extract(year from now())::integer-coalesce(common_year,latest_available_year,0)>4
  ) as enabled_stale_common_year,
  count(*) filter (
    where enabled
      and least(1.0,coalesce(official_observation_share,0)+coalesce(modeled_observation_share,0))<0.75
  ) as enabled_without_documented_evidence,
  count(*) filter (where enabled and clustering_score<65) as enabled_bad_distribution,
  count(*) filter (where enabled and stability_score<50) as enabled_bad_stability,
  count(*) filter (where enabled and duplicate_status<>'preferred') as enabled_not_preferred,
  count(*) filter (where enabled and review_status='rejected') as rejected_but_enabled
from public.stat_categories
where source_organization='FAOSTAT';

select concept_group,count(*) as enabled_categories
from public.stat_categories
where enabled and concept_group is not null
  and (source_organization='FAOSTAT' or concept_group in ('cerealProduction','cerealYield'))
group by concept_group
having count(*)>1;

select
  title,
  common_year,
  common_year_coverage,
  quality_score,
  round(official_observation_share::numeric,2) as official_share,
  round(modeled_observation_share::numeric,2) as modeled_share,
  duplicate_status,
  superseded_by
from public.stat_categories
where source_organization='FAOSTAT' and review_status='approved'
order by quality_score desc,common_year_coverage desc,title
limit 30;

select
  auto_decision_reason,
  count(*) as categories
from public.stat_categories
where source_organization='FAOSTAT' and not enabled
group by auto_decision_reason
order by categories desc,auto_decision_reason;
