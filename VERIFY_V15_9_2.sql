-- GeoStats v15.9.2 verification (read only)
-- Run after RUN_THIS_IN_SUPABASE_FOR_V15_9_2.sql.

-- 1. Required v15.9.1 catalog safeguards and v15.9.2 score columns.
select
  to_regclass('public.category_review_workbench_v15_9') as workbench,
  to_regclass('public.category_review_overview_v15_9') as overview,
  to_regclass('public.v15_9_1_retired_category_ids') as retired_ids,
  to_regclass('public.daily_challenge_archive_v15_9_1') as board_archive,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='daily_scores' and column_name='scoring_version') as scoring_version_column,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='daily_scores' and column_name='board_normalization_version') as normalization_version_column,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='daily_scores' and column_name='leaderboard_rating_version') as rating_version_column;

-- 2. All score version fields must be populated. Expected: zero in every missing column.
select
  count(*) as scores,
  count(*) filter(where scoring_version is null or scoring_version='') as missing_scoring_version,
  count(*) filter(where board_normalization_version is null or board_normalization_version='') as missing_normalization_version,
  count(*) filter(where leaderboard_rating_version is null or leaderboard_rating_version='') as missing_rating_version,
  count(*) filter(where rules_version is null or rules_version='') as missing_rules_version,
  count(*) filter(where category_set_version is null or category_set_version='') as missing_category_set_version,
  count(*) filter(where dataset_version is null or dataset_version='') as missing_dataset_version
from public.daily_scores;

-- 3. One authoritative overview. Both reconciliation booleans must be true.
select * from public.category_review_overview_v15_9;

-- 4. Every query in this section must return zero rows.
select id,effective_title,source_indicator_code
from public.category_review_queue_v15
where computed_playable_v15 and lower(source_organization)='unesco uis';

select id,effective_title,source_indicator_code,unit
from public.category_review_queue_v15
where computed_playable_v15 and lower(source_organization)='faostat'
  and coalesce(source_indicator_code,'') ~* '^QCL:'
  and regexp_replace(regexp_replace(coalesce(source_indicator_code,''), '^.*:', ''),'[^0-9]','','g')
      in ('5312','5320','5412','5417');

select queue.id,queue.effective_title
from public.category_review_queue_v15 queue
join public.v15_9_1_retired_category_ids retired on retired.category_id=queue.id
where queue.computed_playable_v15;

select challenge.challenge_date,challenge.difficulty,invalid.category_id
from public.daily_challenges challenge
cross join lateral jsonb_array_elements(coalesce(challenge.board_payload->'categories','[]'::jsonb)) item
join public.v15_9_1_invalid_board_category_ids invalid
  on invalid.category_id=item->'category'->>'id'
where challenge.challenge_date>=current_date
  and not exists (
    select 1 from public.daily_scores score
    where score.challenge_date=challenge.challenge_date
      and score.difficulty=challenge.difficulty
  );

-- 5. Static Natural Earth categories should use a version/reference label.
select
  count(*) filter(where coalesce((metadata->>'showObservationYear')::boolean,true)) as natural_earth_rows_still_showing_year,
  count(*) filter(where coalesce(metadata->>'referenceLabel','')='') as natural_earth_rows_missing_reference_label,
  count(*) as natural_earth_rows
from public.stat_categories
where lower(coalesce(source_organization,''))='natural earth';

-- 6. Existing good livestock-stock totals remain available.
select count(*) as playable_livestock_populations
from public.category_review_queue_v15
where computed_playable_v15 and source_organization='FAOSTAT'
  and source_indicator_code ~ ':5111$';

-- 7. Automatic expansion inventory. After the workflow: 15, 27, 6, and 1.
select
  count(*) filter(where id like 'pew-religion:%') as pew_candidates,
  count(*) filter(where id like 'faostat-fbs:%') as food_balance_candidates,
  count(*) filter(where id like 'worldbank-expansion:%') as tourism_migration_candidates,
  count(*) filter(where id='unescoheritage:all-sites') as world_heritage_candidates
from public.stat_categories;
