-- GeoStats v15.9.2 score-version compatibility rollback.
-- This does not undo the broader v15.9/v15.9.1 catalog migrations. It keeps
-- the additive version columns and restores defaults that remain compatible
-- with an older application that does not explicitly supply those columns.

begin;
select pg_advisory_xact_lock(hashtext('geostats-v15.9.2-score-versioning'));

alter table if exists public.daily_scores
  alter column scoring_version set default 'placements-pre-v15.9.2',
  alter column board_normalization_version set default 'daily-distribution-z-v1',
  alter column leaderboard_rating_version set default 'board-relative-bayesian-v1',
  alter column rules_version set default 'legacy-unknown',
  alter column category_set_version set default 'legacy-unknown',
  alter column dataset_version set default 'legacy-unknown';

commit;

select 'Score-version defaults are compatible with the prior application. Catalog and board changes were not rolled back.' as result;
