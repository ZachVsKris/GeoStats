-- GeoStats v15.4 verification

select catalog_tier,count(*) as categories
from public.category_runtime_review_v15_4
group by catalog_tier
order by catalog_tier;

select category.source_organization,
  count(*) filter (where category.metadata->>'catalogTier'='daily') as daily_ready,
  count(*) filter (where category.metadata->>'catalogTier'='random') as random_only,
  count(*) filter (where category.metadata->>'catalogTier'='quarantined') as quarantined
from public.stat_categories category
group by category.source_organization
order by daily_ready desc,random_only desc,category.source_organization;

select result.category_id,category.title,category.source_organization,
  result.catalog_tier,result.coverage,result.distinct_display_values,
  result.largest_display_tie_share,result.qualification_score,result.reasons
from public.category_runtime_review_v15_4 result
join public.stat_categories category on category.id=result.category_id
where result.catalog_tier='quarantined'
order by result.qualification_score desc,category.source_organization,category.title
limit 100;

select challenge_date,difficulty,rules_version,dataset_version,category_set_version
from public.daily_challenges
order by challenge_date desc,difficulty
limit 30;

select count(*) as unscored_old_rule_boards
from public.daily_challenges challenge
where coalesce(challenge.rules_version,'')<>'11.0'
  and not exists (
    select 1 from public.daily_scores score
    where score.challenge_date=challenge.challenge_date
  );
