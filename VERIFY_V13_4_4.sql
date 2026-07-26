-- GeoStats v13.4.4 verification

-- Result set 1: the completed editorial registry should contain
-- 726 rules: 241 approved and 485 excluded.
select
  count(*) as reviewed_rules,
  count(*) filter (where decision='approved') as approved_rules,
  count(*) filter (where decision='excluded') as excluded_rules
from public.stat_category_curation_rules
where version='geostats-v13.4.4-final-playability-v1';

-- Result set 2: exactly 33 category-specific playability rules.
select
  count(*) as calibrated_rules
from public.stat_category_playability_rules
where version='geostats-v13.4.4-final-playability-v1';

-- Every value in result set 3 should be 0.
with matched as (
  select
    category.*,
    curation.decision as editorial_decision,
    play.decision as calibrated_decision
  from public.stat_categories category
  left join lateral (
    select selected.decision
    from public.stat_category_curation_rules selected
    where selected.source_organization=category.source_organization
      and selected.source_indicator_code=category.source_indicator_code
      and selected.category_id in ('',category.id)
    order by case when selected.category_id=category.id then 0 else 1 end
    limit 1
  ) curation on true
  left join lateral (
    select selected.decision
    from public.stat_category_playability_rules selected
    where selected.source_organization=category.source_organization
      and selected.source_indicator_code=category.source_indicator_code
      and selected.category_id in ('',category.id)
    order by case when selected.category_id=category.id then 0 else 1 end
    limit 1
  ) play on true
)
select
  count(*) filter (where editorial_decision is null) as current_categories_without_review_rule,
  count(*) filter (where enabled and curation_status<>'approved') as enabled_but_curated_out,
  count(*) filter (where enabled and not auto_qualified) as enabled_without_numeric_quality,
  count(*) filter (where enabled and provenance_status<>'approved') as enabled_without_approved_provenance,
  count(*) filter (where enabled and independent_validation is not true) as enabled_without_independent_validation,
  count(*) filter (
    where calibrated_decision='approved'
      and curation_status='approved'
      and review_status<>'rejected'
      and duplicate_status<>'superseded'
      and not (enabled and eligible_daily and review_status='approved')
  ) as calibrated_category_not_playable,
  count(*) filter (
    where editorial_decision='excluded'
      and (enabled or eligible_daily or review_status='approved')
  ) as excluded_category_still_playable,
  count(*) filter (
    where enabled and source_organization='ILOSTAT'
      and coalesce(common_year,latest_available_year,9999)>extract(year from current_date)::integer-1
  ) as enabled_future_ilostat_categories,
  count(*) filter (where enabled and review_status='rejected') as manually_rejected_but_enabled
from matched;

-- Result set 4: current playable totals by source.
-- On the supplied database snapshot the total should rise from 203 to 236.
-- It can later rise to 241 after ILOSTAT is rerun and the five currently
-- projected indicators acquire completed-year observations.
select
  source_organization,
  count(*) filter (
    where enabled and eligible_daily and review_status='approved'
      and curation_status='approved'
  ) as playable,
  count(*) as warehouse_total
from public.stat_categories
group by source_organization
order by source_organization;

-- Result set 5: these are the only retained rules that may remain non-playable.
-- Five ILOSTAT rows remain temporarily blocked while their stored common year is
-- 2026/2027, and forest coverage remains superseded by the stronger forest-area concept.
select
  category.id,
  category.source_organization,
  category.title,
  category.common_year,
  category.quality_score,
  category.curation_status,
  category.duplicate_status,
  category.auto_decision_reason
from public.stat_categories category
join lateral (
  select selected.decision
  from public.stat_category_curation_rules selected
  where selected.source_organization=category.source_organization
    and selected.source_indicator_code=category.source_indicator_code
    and selected.category_id in ('',category.id)
  order by case when selected.category_id=category.id then 0 else 1 end
  limit 1
) rule on true
where rule.decision='approved'
  and not (
    category.enabled and category.eligible_daily and category.review_status='approved'
  )
order by category.source_organization,category.title;
