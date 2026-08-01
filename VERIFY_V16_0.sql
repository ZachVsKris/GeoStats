-- GeoStats v16.0 read-only verification
select * from public.category_review_overview_v16;

select ranking_completeness_status,count(*) categories,
       count(*) filter(where top_value_feasible) top_value_feasible
from public.category_runtime_review_v16
group by ranking_completeness_status
order by ranking_completeness_status;

select source_organization,count(*) categories,
       count(*) filter(where computed_playable_v16) playable,
       count(*) filter(where editorial_status='approved' and not computed_playable_v16) approved_but_blocked
from public.category_runtime_review_v16
group by source_organization
order by source_organization;

select source_organization,validation_status,count(*) categories
from public.category_runtime_review_v16
where computed_playable_v16
group by source_organization,validation_status
order by source_organization,validation_status;

select id,effective_title,ranking_completeness_status,ranking_completeness_reason,
       top_value_distinct_count,computed_playable_v16,v16_blockers,v16_warnings
from public.category_runtime_review_v16
where id like 'pew-religion:%'
   or id like 'faostat-fbs:%'
   or id like 'worldbank-expansion:%'
   or id like 'natural-earth:%'
   or source_organization in ('Smithsonian GVP','USGS')
order by source_organization,effective_title;

select challenge_date,count(*) modes,
       count(*) filter(where board_payload is not null) self_contained_modes,
       array_agg(difficulty order by difficulty) difficulties
from public.daily_challenges
group by challenge_date
order by challenge_date desc
limit 10;

select to_regprocedure('public.publish_daily_trio_v16(date,jsonb)') is not null as atomic_daily_function_installed,
       to_regprocedure('public.finalize_v16_catalog()') is not null as catalog_finalizer_installed,
       to_regprocedure('public.refresh_v16_runtime_catalog()') is not null as manual_review_refresh_installed,
       to_regclass('public.category_runtime_review_v16') is not null as runtime_view_installed;
