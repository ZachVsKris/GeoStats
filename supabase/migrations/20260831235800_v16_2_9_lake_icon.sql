begin;

update public.stat_categories
set icon = '🏞️',
    content_review_status = 'approved',
    content_review_reason = 'v16.2.9 player-copy icon audit: lake-specific neutral symbol',
    content_review_version = 'geostats-v16.2.9.5',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'playerCopyVersion', 'geostats-v16.2.9.5',
      'iconAuditVersion', 'geostats-v16.2.9.5'
    ),
    updated_at = now()
where id = 'natural-earth:largest-single-mapped-lake';

notify pgrst, 'reload schema';

commit;
