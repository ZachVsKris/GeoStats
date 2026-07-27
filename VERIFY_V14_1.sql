-- GeoStats v14.1 verification

select 'analytics_events' as check_name, count(*) as rows from public.analytics_events
union all
select 'daily_generation_runs', count(*) from public.daily_generation_runs
union all
select 'customized_usernames', count(*) from public.profiles where username_customized = true;

select * from public.analytics_overview_30d;

select
  source_organization,
  count(*) as categories,
  count(*) filter (where enabled and eligible_daily) as playable,
  count(*) filter (where curation_status='pending' or review_status in ('candidate','needs_review')) as awaiting_review,
  max(retrieved_at) as latest_retrieval
from public.stat_categories
group by source_organization
order by categories desc;

select challenge_date, status, source, created_at, error_message
from public.daily_generation_runs
order by created_at desc
limit 10;

select
  count(*) filter (where source_organization='UN Comtrade') as comtrade_total,
  count(*) filter (where source_organization='UN Comtrade' and enabled and eligible_daily) as comtrade_playable,
  count(*) filter (where source_organization='UN Comtrade' and curation_status='pending') as comtrade_pending
from public.stat_categories;
