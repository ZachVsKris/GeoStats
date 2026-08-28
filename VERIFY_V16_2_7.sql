-- GeoStats v16.2.7 post-install verification.
-- Read-only except for the final release assertion, which is also read-only.
select count(*) as total_categories from public.stat_categories;
select count(*) as playable_categories from public.category_runtime_review_v16_2 where computed_playable_v16_2;
select * from public.catalog_macro_domain_summary_v16_2_7 order by playable desc,categories desc;
select * from public.generator_reachability_summary_v16_2_7;
select category_id,difficulty,failure_stage,detail,checked_at
from public.generator_reachability_v16_2_7
where not reachable
order by category_id,difficulty;
select title,source_organization,source_indicator_code,eligible_universe_type,eligible_country_count,ranking_completeness_status,computed_playable_v16_2
from public.category_runtime_review_v16_2
where family='Sports' or title ilike '%World Cup%' or title ilike '%Olympic%'
order by title;
select * from public.assert_v16_2_7_release();
