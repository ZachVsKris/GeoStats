-- GeoStats v15.9.2: immutable score/rating version metadata
-- Safe to rerun. Additive only; historical scores and boards are preserved.

begin;
select pg_advisory_xact_lock(hashtext('geostats-v15.9.2-score-versioning'));

do $$
begin
  if to_regclass('public.daily_scores') is null then
    raise exception 'v15.9.2 stopped: daily_scores is missing.';
  end if;
  if to_regclass('public.daily_challenges') is null then
    raise exception 'v15.9.2 stopped: daily_challenges is missing.';
  end if;
end $$;

alter table public.daily_scores
  add column if not exists scoring_version text,
  add column if not exists board_normalization_version text,
  add column if not exists leaderboard_rating_version text,
  add column if not exists rules_version text,
  add column if not exists category_set_version text,
  add column if not exists dataset_version text;

-- Recover the exact board versions for every historical score where its Daily
-- board remains present. The immutable board snapshot is not changed.
update public.daily_scores score
set
  rules_version = coalesce(score.rules_version, challenge.rules_version),
  category_set_version = coalesce(score.category_set_version, challenge.category_set_version),
  dataset_version = coalesce(score.dataset_version, challenge.dataset_version)
from public.daily_challenges challenge
where challenge.challenge_date = score.challenge_date
  and challenge.difficulty = score.difficulty
  and (
    score.rules_version is null
    or score.category_set_version is null
    or score.dataset_version is null
  );

update public.daily_scores
set
  scoring_version = coalesce(scoring_version, 'placements-pre-v15.9.2'),
  board_normalization_version = coalesce(board_normalization_version, 'daily-distribution-z-v1'),
  leaderboard_rating_version = coalesce(leaderboard_rating_version, 'board-relative-bayesian-v1'),
  rules_version = coalesce(rules_version, 'legacy-unknown'),
  category_set_version = coalesce(category_set_version, 'legacy-unknown'),
  dataset_version = coalesce(dataset_version, 'legacy-unknown')
where scoring_version is null
   or board_normalization_version is null
   or leaderboard_rating_version is null
   or rules_version is null
   or category_set_version is null
   or dataset_version is null;

alter table public.daily_scores
  alter column scoring_version set default 'placements-v15.9.2',
  alter column board_normalization_version set default 'daily-distribution-z-v1',
  alter column leaderboard_rating_version set default 'board-relative-bayesian-v1',
  alter column rules_version set default 'legacy-unknown',
  alter column category_set_version set default 'legacy-unknown',
  alter column dataset_version set default 'legacy-unknown';

alter table public.daily_scores
  alter column scoring_version set not null,
  alter column board_normalization_version set not null,
  alter column leaderboard_rating_version set not null,
  alter column rules_version set not null,
  alter column category_set_version set not null,
  alter column dataset_version set not null;

comment on column public.daily_scores.scoring_version is
  'Point/placement scoring implementation used when the server verified this submission.';
comment on column public.daily_scores.board_normalization_version is
  'Board-difficulty normalization method used by the all-time leaderboard.';
comment on column public.daily_scores.leaderboard_rating_version is
  'Confidence/experience rating method used by the all-time leaderboard.';
comment on column public.daily_scores.rules_version is
  'Rules version stored on the immutable Daily board at score time.';
comment on column public.daily_scores.category_set_version is
  'Category-set version stored on the immutable Daily board at score time.';
comment on column public.daily_scores.dataset_version is
  'Dataset version stored on the immutable Daily board at score time.';

commit;

select
  count(*) as scores,
  count(*) filter(where scoring_version is null) as missing_scoring_version,
  count(*) filter(where board_normalization_version is null) as missing_normalization_version,
  count(*) filter(where leaderboard_rating_version is null) as missing_rating_version,
  count(*) filter(where rules_version is null or category_set_version is null or dataset_version is null) as missing_board_version
from public.daily_scores;
