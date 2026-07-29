-- Roll back only the database changes from GeoStats v15.6.1.
-- Code files must be rolled back through Git/GitHub separately.
-- Backup and decision tables are retained for auditability.

begin;

select pg_advisory_xact_lock(hashtext('geostats-v15.6.1-corrective'));

do $$
begin
  if to_regclass('public.v15_6_1_category_backup') is null then
    raise exception 'v15_6_1_category_backup does not exist; nothing can be restored.';
  end if;
end
$$;

update public.stat_categories category
set
  title = backup.category_state->>'title',
  short_title = backup.category_state->>'short_title',
  description = backup.category_state->>'description',
  plain_language_description = backup.category_state->>'plain_language_description',
  enabled = (backup.category_state->>'enabled')::boolean,
  eligible_daily = (backup.category_state->>'eligible_daily')::boolean,
  content_review_status = backup.category_state->>'content_review_status',
  player_quality_status = backup.category_state->>'player_quality_status',
  metadata = coalesce(backup.category_state->'metadata', '{}'::jsonb),
  updated_at = (backup.category_state->>'updated_at')::timestamptz
from public.v15_6_1_category_backup backup
where category.id = backup.category_id;

-- Restore v15.6 editorial copy from the restored category state. This does not
-- erase the v15.6.1 decision ledger.
update public.category_catalog_editorial_v15_6 editorial
set
  player_title = category.title,
  player_description = coalesce(category.plain_language_description, category.description),
  editorial_outcome = case
    when category.enabled and category.eligible_daily then 'daily'
    when category.enabled then 'random'
    when category.content_review_status = 'excluded' then 'retired'
    else 'quarantined'
  end,
  decision_reason = 'Restored from pre-v15.6.1 category backup.',
  decision_source = 'v15.6.1 rollback',
  reviewed_at = now()
from public.stat_categories category
where editorial.category_id = category.id
  and category.id in (select category_id from public.v15_6_1_category_backup);

commit;

select count(*) as restored_categories
from public.v15_6_1_category_backup;
