-- GeoStats v13.1 verification
-- Run after the GitHub Actions complete.

select
  source_organization,
  count(*) as categories,
  count(*) filter (where review_status = 'needs_review') as needs_review,
  count(*) filter (where review_status = 'candidate') as candidates,
  count(*) filter (where review_status = 'approved') as approved
from public.stat_categories
where source_organization in ('UNESCO UIS', 'ILOSTAT', 'Natural Earth')
group by source_organization
order by source_organization;

select
  category.source_organization,
  count(*) as observations
from public.stat_observations observation
join public.stat_categories category on category.id = observation.category_id
where category.source_organization in ('UNESCO UIS', 'ILOSTAT', 'Natural Earth')
group by category.source_organization
order by category.source_organization;

select
  source_organization,
  status,
  started_at,
  completed_at,
  categories_processed,
  observations_inserted,
  error_message
from public.stat_import_runs
where source_organization in ('UNESCO UIS', 'ILOSTAT', 'Natural Earth')
order by started_at desc
limit 12;
