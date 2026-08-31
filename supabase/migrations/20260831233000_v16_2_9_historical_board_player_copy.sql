-- Keep current player-facing copy available on immutable saved boards even
-- after a category is retired from future generation.

update public.stat_categories
set
  short_title = 'Largest lake',
  description = 'Area of the largest lake or reservoir within each country.',
  plain_language_description = 'Area of the largest lake or reservoir within each country.',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'boardDescription', 'Area of the largest lake or reservoir within each country',
    'plainLanguageDescription', 'Area of the largest lake or reservoir within each country.',
    'source_indicator_name', 'Largest lake',
    'playerCopyVersion', 'geostats-v16.2.9.2'
  ),
  updated_at = now()
where id = 'natural-earth:largest-single-mapped-lake';

update public.stat_categories
set
  icon = '🕯️',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'playerCopyVersion', 'geostats-v16.2.9.2',
    'iconReason', 'Neutral symbol for multiple smaller religious traditions'
  ),
  updated_at = now()
where id = 'pew-religion:other-religions-share';

notify pgrst, 'reload schema';
