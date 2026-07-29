-- Verify GeoStats v15.6 corrected installer.
-- Read-only: this file changes nothing.

-- 1. Required v15.6 tables should all exist.
select
  to_regclass('public.v15_6_category_backup') as category_backup,
  to_regclass('public.v15_6_source_backup') as source_backup,
  to_regclass('public.category_catalog_editorial_v15_6') as editorial_table,
  to_regclass('public.daily_challenge_archive_v15_6') as challenge_archive,
  to_regclass('public.daily_score_archive_v15_6') as score_archive,
  to_regclass('public.v15_6_removed_daily_challenges') as removed_challenge_log,
  to_regclass('public.v15_6_removed_daily_scores') as removed_score_log;

-- 2. Editorial outcome totals.
select
  editorial_outcome,
  count(*) as category_count
from public.category_catalog_editorial_v15_6
group by editorial_outcome
order by editorial_outcome;

-- 3. This count exposes the remaining limitation of the v15.6 review.
-- A high number means the catalog has not received a real category-by-category decision.
select count(*) as categories_still_awaiting_full_editorial_decision
from public.category_catalog_editorial_v15_6
where decision_reason = 'Awaiting v15.6 full editorial decision.';

-- 4. Runtime flags should match the editorial outcomes. Must return zero rows.
select
  category.id,
  editorial.editorial_outcome,
  category.enabled,
  category.eligible_daily,
  category.content_review_status,
  category.player_quality_status
from public.stat_categories category
join public.category_catalog_editorial_v15_6 editorial
  on editorial.category_id = category.id
where category.enabled is distinct from
        (editorial.editorial_outcome in ('daily', 'random', 'rewrite'))
   or category.eligible_daily is distinct from
        (editorial.editorial_outcome in ('daily', 'rewrite'))
   or category.content_review_status is distinct from
        case
          when editorial.editorial_outcome in ('retired', 'duplicate') then 'excluded'
          when editorial.editorial_outcome = 'quarantined' then 'pending'
          else 'approved'
        end
   or category.player_quality_status is distinct from
        case
          when editorial.editorial_outcome in ('retired', 'duplicate') then 'blocked'
          when editorial.editorial_outcome = 'quarantined' then 'caution'
          else 'approved'
        end;

-- 5. Duplicate decisions should resolve to a real preferred category.
-- Must return zero rows.
select
  editorial.category_id,
  editorial.preferred_category_id
from public.category_catalog_editorial_v15_6 editorial
left join public.stat_categories preferred
  on preferred.id = editorial.preferred_category_id
where editorial.editorial_outcome = 'duplicate'
  and preferred.id is null;

-- 6. Planned source registrations.
select
  id,
  name,
  status,
  description,
  metadata
from public.data_sources
where id in ('unescoheritage', 'aquastat', 'usgsminerals', 'faofisheries')
order by id;

-- 7. No current/future incompatible board should remain active.
-- Must return zero rows.
select
  challenge_date,
  difficulty,
  rules_version
from public.daily_challenges
where challenge_date >= current_date
  and coalesce(rules_version, '') <> '12.2'
order by challenge_date, difficulty;

-- 8. Archive and removal totals.
select
  (select count(*) from public.daily_challenge_archive_v15_6) as archived_challenges,
  (select count(*) from public.daily_score_archive_v15_6) as archived_scores,
  (select count(*) from public.v15_6_removed_daily_challenges) as removed_current_or_future_challenges,
  (select count(*) from public.v15_6_removed_daily_scores) as removed_current_or_future_scores;

-- 9. Confirm historical incompatible boards were preserved in active tables.
select
  count(*) as historical_incompatible_boards_still_active
from public.daily_challenges
where challenge_date < current_date
  and coalesce(rules_version, '') <> '12.2';
