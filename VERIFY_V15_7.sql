-- GeoStats v15.7.0 verification. Read-only.

-- 1. Required infrastructure.
select
  to_regclass('public.v15_7_category_backup') as category_backup,
  to_regclass('public.v15_7_review_state_backup') as review_backup,
  to_regclass('public.v15_7_editorial_backup') as editorial_backup,
  to_regclass('public.daily_generation_locks_v15_7') as generation_locks,
  to_regclass('public.daily_challenge_archive_v15_7') as challenge_archive,
  to_regclass('public.category_manual_review_v15_7') as manual_review_view,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='daily_challenges' and column_name='board_payload'
  ) as board_payload_column;

-- 2. One authoritative catalog. All three must be zero.
select count(*) as random_editorial_outcomes
from public.category_catalog_editorial_v15_6
where editorial_outcome = 'random';

select count(*) as random_tier_metadata
from public.stat_categories
where metadata->>'catalogTier' = 'random';

select count(*) as enabled_but_not_daily_eligible
from public.stat_categories
where enabled and not eligible_daily;

-- 3. Authoritative counts used by both the game and Workbench.
select
  count(*) filter (where computed_playable_v15) as playable,
  count(*) filter (where editorial_status = 'approved') as approved,
  count(*) filter (where editorial_status = 'approved' and not computed_playable_v15) as approved_but_blocked,
  count(*) filter (where hard_gate_ready) as integrity_ready,
  count(*) filter (where editorial_status = 'pending') as pending,
  count(*) filter (where editorial_status in ('rejected','duplicate')) as rejected_or_duplicate
from public.category_review_queue_v15;

-- 4. Runtime flags must exactly mirror computed playability. Must return zero.
select
  category.id,
  category.title,
  queue.computed_playable_v15,
  category.enabled,
  category.eligible_daily
from public.stat_categories category
join public.category_review_queue_v15 queue on queue.id = category.id
where category.enabled is distinct from queue.computed_playable_v15
   or category.eligible_daily is distinct from queue.computed_playable_v15;

-- 5. Structured generation metadata must be present on every playable category.
-- Must return zero.
select
  category.id,
  category.title,
  category.metadata->>'strategyFamily' as strategy_family,
  category.metadata->>'knowledgeCluster' as knowledge_cluster,
  category.metadata->>'measureType' as measure_type,
  category.metadata->>'normalizationType' as normalization_type
from public.stat_categories category
join public.category_review_queue_v15 queue on queue.id = category.id
where queue.computed_playable_v15
  and (
    nullif(category.metadata->>'strategyFamily','') is null
    or nullif(category.metadata->>'knowledgeCluster','') is null
    or nullif(category.metadata->>'measureType','') is null
    or nullif(category.metadata->>'normalizationType','') is null
  );

-- 6. Known copy corrections and board descriptions.
select
  id,
  title,
  source_indicator_code,
  metadata->>'boardDescription' as board_description,
  enabled,
  eligible_daily
from public.stat_categories
where source_indicator_code in (
  'EN.URB.LCTY',
  'AG.LND.TOTL.K2',
  'EN.GHG.ALL.MT.CE.AR5',
  'EN.GHG.CO2.PC.CE.AR5',
  'EN.ATM.PM25.MC.M3',
  'BX.GSR.CMCP.ZS',
  'BM.GSR.CMCP.ZS',
  'BX.GSR.TRAN.ZS',
  'BM.GSR.TRAN.ZS',
  'BX.GSR.TRVL.ZS',
  'BM.GSR.TRVL.ZS'
)
order by source_indicator_code;

-- Curated copy must be editorially approved, while integrity remains independent.
-- Must return zero.
select
  category.id,
  category.title,
  category.source_indicator_code,
  review.status as review_status,
  editorial.editorial_outcome
from public.stat_categories category
join public.category_review_state review on review.category_id = category.id
join public.category_catalog_editorial_v15_6 editorial on editorial.category_id = category.id
where category.source_indicator_code in (
  'EN.URB.LCTY', 'AG.LND.TOTL.K2', 'EN.GHG.ALL.MT.CE.AR5',
  'EN.GHG.CO2.PC.CE.AR5', 'EN.ATM.PM25.MC.M3',
  'BX.GSR.CMCP.ZS', 'BM.GSR.CMCP.ZS', 'BX.GSR.TRAN.ZS',
  'BM.GSR.TRAN.ZS', 'BX.GSR.TRVL.ZS', 'BM.GSR.TRVL.ZS'
)
  and (review.status <> 'approved' or editorial.editorial_outcome <> 'daily');

-- The mapped Natural Earth area calculation must not compete with the preferred
-- official land-area measure. Must return zero.
select category.id, category.title, category.enabled, category.eligible_daily,
       review.status, review.duplicate_of
from public.stat_categories category
join public.category_review_state review on review.category_id = category.id
where category.source_organization = 'Natural Earth'
  and category.source_indicator_code = 'largest-geodesic-land-area'
  and (
    review.status <> 'duplicate'
    or review.duplicate_of is null
    or category.enabled
    or category.eligible_daily
  );

-- No playable title may retain the source jargon that prompted this review.
-- Must return zero.
select id, title
from public.stat_categories
where (enabled or eligible_daily)
  and title ~* '\betc\.|\bn\.e\.c\.';

-- 7. No playable board description may be explicitly stored as a truncated or
-- overlong string. Categories without curated copy use the app's complete-sentence fallback.
-- Must return zero.
select id, title, metadata->>'boardDescription' as board_description
from public.stat_categories
where enabled
  and (
    char_length(coalesce(metadata->>'boardDescription','')) > 110
    or coalesce(metadata->>'boardDescription','') ~ '(…|\.\.\.)\s*$'
  );

-- 8. Broken zero-observation physical datasets should be blocked, not playable.
select
  decision.category_id,
  decision.title,
  decision.observation_count,
  category.enabled,
  category.eligible_daily,
  review.status as editorial_status,
  review.poor_coverage,
  category.validation_status,
  category.validation_reason
from public.v15_7_broken_dataset_decisions decision
join public.stat_categories category on category.id = decision.category_id
join public.category_review_state review on review.category_id = decision.category_id
order by decision.title;

-- Must return zero.
select category.id, category.title
from public.stat_categories category
where category.id in (select category_id from public.v15_7_broken_dataset_decisions)
  and (category.enabled or category.eligible_daily);

-- 9. Current/future boards from earlier releases may remain only when that exact
-- mode has saved scores. Ideally returns zero.
select
  challenge.challenge_date,
  challenge.difficulty,
  challenge.rules_version,
  challenge.category_set_version,
  challenge.board_payload is not null as has_snapshot,
  count(score.id) as saved_scores
from public.daily_challenges challenge
left join public.daily_scores score
  on score.challenge_date = challenge.challenge_date
 and score.difficulty = challenge.difficulty
where challenge.challenge_date >= current_date
  and (
    coalesce(challenge.rules_version,'') <> '13.0'
    or coalesce(challenge.category_set_version,'') <> 'SCOUT-ADVENTURER-EXPERT-V15-7-CLEAN'
  )
group by
  challenge.challenge_date,
  challenge.difficulty,
  challenge.rules_version,
  challenge.category_set_version,
  challenge.board_payload
order by challenge.challenge_date, challenge.difficulty;

-- 10. Manual copy-review queue summary.
select
  count(*) as approved_categories,
  count(*) filter (where cardinality(copy_flags) > 0) as needs_copy_review,
  count(*) filter (where board_description is null) as missing_board_description
from public.category_manual_review_v15_7;
