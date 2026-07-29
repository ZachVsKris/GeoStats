-- Roll back GeoStats v15.7.0 database changes.
-- Revert the v15.7 Git commit separately for application code.
-- Snapshot/lock/archive infrastructure is retained because it is additive and safe.

begin;
select pg_advisory_xact_lock(hashtext('geostats-v15.7.0-clean-rebuild'));

do $$
begin
  if to_regclass('public.v15_7_category_backup') is null
     or to_regclass('public.v15_7_review_state_backup') is null
     or to_regclass('public.v15_7_editorial_backup') is null then
    raise exception 'v15.7 backups are missing; rollback stopped.';
  end if;
end
$$;

update public.stat_categories category
set
  title = backup.category_state->>'title',
  short_title = backup.category_state->>'short_title',
  semantic_family = backup.category_state->>'semantic_family',
  review_status = backup.category_state->>'review_status',
  curation_status = backup.category_state->>'curation_status',
  curation_reason = backup.category_state->>'curation_reason',
  curation_version = backup.category_state->>'curation_version',
  content_review_status = backup.category_state->>'content_review_status',
  content_review_reason = backup.category_state->>'content_review_reason',
  content_review_version = backup.category_state->>'content_review_version',
  player_quality_status = backup.category_state->>'player_quality_status',
  player_quality_reason = backup.category_state->>'player_quality_reason',
  validation_status = backup.category_state->>'validation_status',
  validation_reason = backup.category_state->>'validation_reason',
  enabled = coalesce((backup.category_state->>'enabled')::boolean, false),
  eligible_daily = coalesce((backup.category_state->>'eligible_daily')::boolean, false),
  metadata = coalesce(backup.category_state->'metadata', '{}'::jsonb),
  updated_at = coalesce(nullif(backup.category_state->>'updated_at','')::timestamptz, now())
from public.v15_7_category_backup backup
where category.id = backup.category_id;

update public.category_review_state review
set
  status = backup.review_state->>'status',
  political_self_reported = coalesce((backup.review_state->>'political_self_reported')::boolean, false),
  confusing = coalesce((backup.review_state->>'confusing')::boolean, false),
  esoteric = coalesce((backup.review_state->>'esoteric')::boolean, false),
  subjective_or_composite = coalesce((backup.review_state->>'subjective_or_composite')::boolean, false),
  stale_data = coalesce((backup.review_state->>'stale_data')::boolean, false),
  poor_coverage = coalesce((backup.review_state->>'poor_coverage')::boolean, false),
  duplicate_of = nullif(backup.review_state->>'duplicate_of',''),
  recommended_title = backup.review_state->>'recommended_title',
  semantic_group = backup.review_state->>'semantic_group',
  notes = backup.review_state->>'notes',
  reviewed_at = nullif(backup.review_state->>'reviewed_at','')::timestamptz,
  reviewed_by = nullif(backup.review_state->>'reviewed_by','')::uuid,
  updated_at = coalesce(nullif(backup.review_state->>'updated_at','')::timestamptz, now())
from public.v15_7_review_state_backup backup
where review.category_id = backup.category_id;

update public.category_catalog_editorial_v15_6 editorial
set
  original_title = backup.editorial_state->>'original_title',
  player_title = backup.editorial_state->>'player_title',
  player_description = backup.editorial_state->>'player_description',
  editorial_outcome = backup.editorial_state->>'editorial_outcome',
  decision_reason = backup.editorial_state->>'decision_reason',
  preferred_category_id = nullif(backup.editorial_state->>'preferred_category_id',''),
  broad_domain = backup.editorial_state->>'broad_domain',
  knowledge_cluster = backup.editorial_state->>'knowledge_cluster',
  strategy_family = backup.editorial_state->>'strategy_family',
  decision_source = backup.editorial_state->>'decision_source',
  reviewed_at = coalesce(nullif(backup.editorial_state->>'reviewed_at','')::timestamptz, now())
from public.v15_7_editorial_backup backup
where editorial.category_id = backup.category_id;

select * from public.reconcile_category_playability_v15();

-- Restore only the unscored boards removed by v15.7.
insert into public.daily_challenges
select archive.*
from public.daily_challenge_archive_v15_7 archive
join public.v15_7_removed_daily_challenges removed
  using (challenge_date, difficulty)
on conflict (challenge_date, difficulty) do update
set
  seed = excluded.seed,
  encoded_board = excluded.encoded_board,
  board_payload = excluded.board_payload,
  board_hash = excluded.board_hash,
  dataset_version = excluded.dataset_version,
  rules_version = excluded.rules_version,
  category_set_version = excluded.category_set_version,
  created_at = excluded.created_at;

commit;

select
  (select count(*) from public.v15_7_category_backup) as restored_categories,
  (select count(*) from public.v15_7_review_state_backup) as restored_review_states,
  (select count(*) from public.v15_7_editorial_backup) as restored_editorial_rows,
  (select count(*) from public.v15_7_removed_daily_challenges) as restored_daily_boards;
