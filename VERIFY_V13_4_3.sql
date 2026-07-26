-- GeoStats v13.4.3 verification
-- Result set 1 summarizes the completed 726-row editorial registry.
select
  source_organization,
  count(*) filter (where decision='approved') as approved_rules,
  count(*) filter (where decision='excluded') as excluded_rules,
  count(*) as reviewed_rules
from public.stat_category_curation_rules
where version='geostats-v13.4.3-complete-catalog-v1'
group by source_organization
order by source_organization;

-- Result set 2 must contain exactly one row: 726 reviewed, 252 approved, 474 excluded.
select
  count(*) as reviewed_rules,
  count(*) filter (where decision='approved') as approved_rules,
  count(*) filter (where decision='excluded') as excluded_rules
from public.stat_category_curation_rules
where version='geostats-v13.4.3-complete-catalog-v1';

-- Every value in result set 3 should be 0.
with matched as (
  select
    category.id,
    category.enabled,
    category.eligible_daily,
    category.review_status,
    category.auto_qualified,
    category.provenance_status,
    category.independent_validation,
    category.curation_status,
    category.source_organization,
    category.source_indicator_code,
    category.common_year,
    category.latest_available_year,
    rule.decision
  from public.stat_categories category
  left join lateral (
    select selected.decision
    from public.stat_category_curation_rules selected
    where selected.source_organization=category.source_organization
      and selected.source_indicator_code=category.source_indicator_code
      and selected.category_id in ('',category.id)
    order by case when selected.category_id=category.id then 0 else 1 end
    limit 1
  ) rule on true
)
select
  count(*) filter (where decision is null) as current_categories_without_review_rule,
  count(*) filter (where enabled and curation_status<>'approved') as enabled_but_curated_out,
  count(*) filter (where enabled and not auto_qualified) as enabled_without_numeric_quality,
  count(*) filter (where enabled and provenance_status<>'approved') as enabled_without_approved_provenance,
  count(*) filter (where enabled and independent_validation is not true) as enabled_without_independent_validation,
  count(*) filter (
    where enabled and source_organization='ILOSTAT'
      and coalesce(common_year,latest_available_year,9999)>extract(year from current_date)::integer-1
  ) as enabled_future_ilostat_categories,
  count(*) filter (where enabled and review_status='rejected') as manually_rejected_but_enabled
from matched;

-- Exactly one rainfall direction should be curated in; currently it is the high-rainfall version.
select
  id,title,curation_status,enabled,eligible_daily
from public.stat_categories
where source_organization='World Bank'
  and source_indicator_code='AG.LND.PRCP.MM'
order by id;

-- Current playable totals after all numerical, provenance, curation, and duplicate gates.
select
  source_organization,
  count(*) filter (where enabled and eligible_daily and review_status='approved') as playable,
  count(*) as warehouse_total
from public.stat_categories
group by source_organization
order by source_organization;
