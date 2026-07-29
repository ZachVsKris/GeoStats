-- GeoStats v15.6.2 verification. Read-only.

-- 1. Required tables.
select
  to_regclass('public.v15_6_2_category_backup') as category_backup,
  to_regclass('public.v15_6_2_review_state_backup') as review_backup,
  to_regclass('public.v15_6_2_editorial_backup') as editorial_backup,
  to_regclass('public.v15_6_2_decisions') as decisions,
  to_regclass('public.category_copy_audit_v15_6_2') as copy_audit,
  to_regclass('public.v15_6_2_removed_daily_challenges') as daily_removal_log;

-- 2. There must be no Random-only editorial outcome. Must return 0.
select count(*) as random_only_categories
from public.category_catalog_editorial_v15_6
where editorial_outcome = 'random';

-- 3. No category marked as Random tier may remain. Must return 0.
select id, title, metadata->>'catalogTier' as catalog_tier
from public.stat_categories
where metadata->>'catalogTier' = 'random';

-- 4. Every runtime-enabled category must be Daily eligible. Must return 0.
select id, title, enabled, eligible_daily
from public.stat_categories
where enabled and not eligible_daily;

-- 5. Curated category copy and status.
select
  id,
  title,
  plain_language_description,
  source_indicator_code,
  enabled,
  eligible_daily,
  content_review_status,
  player_quality_status,
  semantic_family,
  metadata->>'knowledgeCluster' as knowledge_cluster
from public.stat_categories
where source_indicator_code in (
  'EN.GHG.CO2.PC.CE.AR5',
  'EN.GHG.ALL.MT.CE.AR5',
  'BX.GSR.CMCP.ZS',
  'BM.GSR.CMCP.ZS',
  'BX.GSR.TRAN.ZS',
  'BM.GSR.TRAN.ZS',
  'BX.GSR.TRVL.ZS',
  'BM.GSR.TRVL.ZS'
)
order by source_indicator_code;

-- 6. No playable title may contain “etc.” Must return 0.
select id, title
from public.stat_categories
where (enabled or eligible_daily)
  and title ~* '\betc\.';

-- 7. Remaining copy-review queue for the later manual review.
select
  category_id,
  title,
  plain_language_description,
  title_characters,
  title_words,
  description_characters,
  audit_reason
from public.category_copy_audit_v15_6_2
where needs_manual_copy_review
order by
  contains_etc desc,
  contains_nec desc,
  title_too_long desc,
  description_too_long desc,
  title;

-- 8. Current/future boards with an older rules or category version.
-- Any returned row should have saved scores and therefore be intentionally locked.
select
  challenge.challenge_date,
  challenge.difficulty,
  challenge.rules_version,
  challenge.category_set_version,
  count(score.id) as saved_scores
from public.daily_challenges challenge
left join public.daily_scores score
  on score.challenge_date = challenge.challenge_date
 and score.difficulty = challenge.difficulty
where challenge.challenge_date >= current_date
  and (
    coalesce(challenge.rules_version, '') <> '12.2'
    or coalesce(challenge.category_set_version, '') <> 'SCOUT-ADVENTURER-EXPERT-V15-6-2-STABLE'
  )
group by
  challenge.challenge_date,
  challenge.difficulty,
  challenge.rules_version,
  challenge.category_set_version
order by challenge.challenge_date, challenge.difficulty;

-- 9. Playable totals by source.
select
  source_organization,
  count(*) filter (where enabled and eligible_daily) as approved_playable,
  count(*) filter (where content_review_status = 'approved') as content_approved
from public.stat_categories
group by source_organization
order by approved_playable desc, source_organization;
