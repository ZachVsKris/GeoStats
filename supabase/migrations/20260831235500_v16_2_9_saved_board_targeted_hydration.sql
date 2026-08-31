begin;

-- The original correction changed the display label but left the primary
-- title untouched. Keep every player-facing title field consistent.
update public.stat_categories
set title = 'Largest lake',
    short_title = 'Largest lake',
    content_review_status = 'approved',
    content_review_reason = 'v16.2.9 saved-board player-copy audit',
    content_review_version = 'geostats-v16.2.9.4',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'playerCopyVersion', 'geostats-v16.2.9.4',
      'source_indicator_name', 'Largest lake'
    ),
    updated_at = now()
where id = 'natural-earth:largest-single-mapped-lake';

notify pgrst, 'reload schema';

commit;
