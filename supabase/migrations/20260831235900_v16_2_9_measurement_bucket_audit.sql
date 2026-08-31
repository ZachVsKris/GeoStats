begin;

alter table public.stat_categories
  drop constraint if exists stat_categories_measurement_type_check;

alter table public.stat_categories
  add constraint stat_categories_measurement_type_check
  check (measurement_type is null or measurement_type in (
    'total', 'share', 'per_capita', 'historical_date', 'rate', 'value', 'other'
  ));

update public.stat_categories
set measurement_type = 'rate',
    content_review_status = 'approved',
    content_review_reason = 'v16.2.9 measurement-bucket audit: normalized rate or density',
    content_review_version = 'geostats-v16.2.9.6',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'measurementType', 'rate',
      'playerCopyVersion', 'geostats-v16.2.9.6'
    ),
    updated_at = now()
where id in (
  'density',
  'fertility',
  'natural-earth:longest-average-land-border',
  'unwpp:lowest-fertility',
  'unwpp:lowest-pop-density',
  'worldbank-catalog:eg-gdp-puse-ko-pp',
  'worldbank-catalog:ne-exp-gnfs-kd-zg'
);

update public.stat_categories
set measurement_type = 'value',
    content_review_status = 'approved',
    content_review_reason = 'v16.2.9 measurement-bucket audit: absolute measured value or score',
    content_review_version = 'geostats-v16.2.9.6',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'measurementType', 'value',
      'playerCopyVersion', 'geostats-v16.2.9.6'
    ),
    updated_at = now()
where id in (
  'natural-earth-capital:capital-closest-equator',
  'natural-earth-capital:northernmost-capital',
  'natural-earth-capital:southernmost-capital',
  'natural-earth:largest-continuous-land-area',
  'natural-earth:longest-land-border',
  'natural-earth:longest-single-land-border',
  'natural-earth:most-mapped-river-length',
  'natural-earth:northernmost-country',
  'natural-earth:southernmost-country',
  'pew-religion:religious-diversity',
  'smithsonian-gvp:highest-volcano',
  'unwpp:highest-male-life-expectancy',
  'unwpp:highest-mean-age-childbearing',
  'unwpp:highest-median-age',
  'unwpp:lowest-median-age',
  'usgs:strongest-earthquake-since-1970'
);

notify pgrst, 'reload schema';

commit;
