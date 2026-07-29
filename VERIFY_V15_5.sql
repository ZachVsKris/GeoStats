-- GeoStats v15.5 verification. Read-only.

select
  to_regclass('public.category_catalog_editorial_v15_5') as editorial_table,
  to_regclass('public.category_similarity_pairs_v15_5') as similarity_table,
  to_regclass('public.category_normalization_policy_v15_5') as normalization_policy_table,
  to_regclass('public.category_catalog_review_v15_5') as review_view;

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

-- Must return zero rows: no active FAOSTAT category may use a non-production element.
select category.id,category.title,category.source_indicator_code,
  category.metadata->>'item' as item,
  coalesce(category.metadata->>'element',category.source_query->>'element') as element,
  editorial.editorial_outcome,
  editorial.decision_reason
from public.stat_categories category
join public.category_catalog_editorial_v15_5 editorial on editorial.category_id=category.id
where category.source_organization='FAOSTAT'
  and editorial.editorial_outcome in ('daily','random')
  and not (
    lower(coalesce(category.metadata->>'element',category.source_query->>'element','')) in ('production','production quantity')
    or coalesce(category.source_indicator_code,'') ~ ':(5510|5513)$'
  )
order by category.title;

-- Must return zero rows: active agriculture/product titles cannot contain retired efficiency concepts.
select category.id,category.title,category.source_organization,editorial.editorial_outcome
from public.stat_categories category
join public.category_catalog_editorial_v15_5 editorial on editorial.category_id=category.id
where editorial.editorial_outcome in ('daily','random')
  and category.source_organization='FAOSTAT'
  and lower(concat_ws(' ',category.title,category.description,category.unit)) ~
    '(yield|per hectare|per animal|area harvested|harvested area|animals slaughtered|producing animals|livestock stocks|per capita|per person)';

select policy_key,allowed_for_daily,allowed_for_random,player_label,
  required_numerator,required_denominator,decision_reason
from public.category_normalization_policy_v15_5
order by allowed_for_daily desc,policy_key;

select measure_class,normalization_basis,normalization_approved,count(*) as categories
from public.category_catalog_editorial_v15_5
group by measure_class,normalization_basis,normalization_approved
order by categories desc,measure_class;

select recommendation,count(*) as category_pairs
from public.category_similarity_pairs_v15_5
group by recommendation
order by category_pairs desc,recommendation;

select source_organization,count(*) as categories,
  count(*) filter (where editorial_outcome='daily') as daily_ready
from public.category_catalog_review_v15_5
where source_organization in (
  'Pew Research Center','Smithsonian GVP','USGS','ESA WorldCover','HydroSHEDS','Global Elevation'
)
group by source_organization
order by source_organization;

select count(*) as unscored_old_rule_boards
from public.daily_challenges challenge
where coalesce(challenge.rules_version,'')<>'12.0'
  and not exists (
    select 1 from public.daily_scores score
    where score.challenge_date=challenge.challenge_date
  );
