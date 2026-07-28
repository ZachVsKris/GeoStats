-- GeoStats v15.0 rollback. Restores category runtime and player-link fields
-- captured before the first v15 installer run. Human review decisions and
-- history are retained unless the optional DROP TABLE lines are uncommented.

begin;

update public.stat_categories category
set title = backup.title,
    short_title = backup.short_title,
    semantic_family = backup.semantic_family,
    review_status = backup.review_status,
    curation_status = backup.curation_status,
    curation_reason = backup.curation_reason,
    curation_version = backup.curation_version,
    content_review_status = backup.content_review_status,
    content_review_reason = backup.content_review_reason,
    content_review_version = backup.content_review_version,
    player_quality_status = backup.player_quality_status,
    player_quality_reason = backup.player_quality_reason,
    player_source_url = backup.player_source_url,
    player_source_status = backup.player_source_status,
    player_source_reason = backup.player_source_reason,
    player_source_checked_at = backup.player_source_checked_at,
    link_quality_score = backup.link_quality_score,
    enabled = backup.enabled,
    eligible_daily = backup.eligible_daily,
    updated_at = now()
from public.v15_category_state_backup backup
where backup.category_id = category.id;

drop trigger if exists stat_categories_v15_review_intake on public.stat_categories;
drop function if exists public.ensure_category_review_state_v15();

drop view if exists public.category_review_overview_v15;
drop view if exists public.category_review_queue_v15;
drop function if exists public.reconcile_category_playability_v15();
drop function if exists public.category_v15_source_is_official(text);
drop function if exists public.general_official_source_page_v15(text);

-- Preserve the human review history by default.
-- drop table if exists public.category_review_events_v15;
-- drop table if exists public.category_review_state;

commit;
