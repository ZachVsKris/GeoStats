-- GeoStats v15.9.2 safe database rollback.
-- v15.9.2 is additive. Older application versions ignore these columns, so the
-- safest rollback preserves the version history rather than deleting it.

begin;
select pg_advisory_xact_lock(hashtext('geostats-v15.9.2-score-versioning'));

alter table if exists public.daily_scores
  alter column scoring_version drop default,
  alter column board_normalization_version drop default,
  alter column leaderboard_rating_version drop default,
  alter column rules_version drop default,
  alter column category_set_version drop default,
  alter column dataset_version drop default;

commit;

select 'Version metadata columns were preserved; deploy the prior application version to complete rollback.' as result;
