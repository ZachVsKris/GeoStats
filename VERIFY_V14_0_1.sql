-- GeoStats v14.0.1 import verification
-- Run after the "Repair and expand v14 imports" GitHub Action completes.

select *
from public.v14_import_health
where source_organization in ('Natural Earth','World Bank','UN Comtrade')
order by source_organization;

-- Natural Earth should show a completed latest run with 24 successful categories.
select source_organization, import_status, latest_run_attempted,
       latest_run_successful, latest_run_failures, latest_run_error,
       category_count, pending_review_count
from public.v14_import_health
where source_organization='Natural Earth';

-- New v14 candidates should be disabled and visibly queued, never silently playable.
select id, source_organization, title, review_status, curation_status,
       player_quality_status, enabled, eligible_daily
from public.stat_categories
where coalesce(metadata->>'import_framework','') in ('v14.0','v14.0.1')
  and curation_status='pending'
order by source_organization, title
limit 100;

-- Zero-row safety checks.
select id,title from public.stat_categories
where curation_status='pending' and (enabled or eligible_daily);

select id,title from public.stat_categories
where enabled and eligible_daily
  and (coalesce(objective_status,'uncertain')<>'objective'
    or coalesce(verifiability_score,0)<80
    or coalesce(understandability_score,0)<70
    or coalesce(fun_score,0)<55);
