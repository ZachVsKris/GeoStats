-- GeoStats v13.4 verification. Violation counts should all be 0.

select 'noncanonical_observation_names' as check_name, count(*) as violations
from public.stat_observations o
join public.countries c on c.iso3 = o.country_iso3
where o.country_name is distinct from c.name;

select 'enabled_without_provenance' as check_name, count(*) as violations
from public.stat_categories
where (enabled or eligible_daily)
  and (provenance_status <> 'approved' or independent_validation is not true);

select 'enabled_without_quality_gate' as check_name, count(*) as violations
from public.stat_categories
where (enabled or eligible_daily)
  and auto_qualified is not true;

select 'enabled_nonpreferred_duplicate' as check_name, count(*) as violations
from public.stat_categories
where (enabled or eligible_daily)
  and duplicate_status <> 'preferred';

select 'concept_groups_with_multiple_enabled_categories' as check_name, count(*) as violations
from (
  select concept_group
  from public.stat_categories
  where enabled and concept_group is not null
  group by concept_group
  having count(*) > 1
) duplicate_groups;

select 'internet_category_enabled' as check_name, count(*) as violations
from public.stat_categories
where source_organization = 'World Bank'
  and id = 'internet'
  and (enabled or eligible_daily);

select
  source_organization,
  count(*) filter (where enabled) as enabled,
  count(*) filter (where review_status = 'approved') as approved,
  count(*) filter (where provenance_status = 'uncertain') as provenance_uncertain,
  count(*) filter (where duplicate_status = 'superseded') as superseded,
  count(*) as total
from public.stat_categories
group by source_organization
order by source_organization;
