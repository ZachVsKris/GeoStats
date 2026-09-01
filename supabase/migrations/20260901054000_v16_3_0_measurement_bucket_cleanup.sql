begin;

-- Player badges describe how a value is measured. Retire the remaining generic
-- OTHER badges from the approved catalog: ages and coordinates are measured
-- values, while demographic frequencies and density are rates.
with measurement_fix(id, measurement_type) as (values
  ('natural-earth-capital:capital-closest-equator','value'),
  ('natural-earth-capital:northernmost-capital','value'),
  ('natural-earth-capital:southernmost-capital','value'),
  ('unwpp:highest-male-life-expectancy','value'),
  ('unwpp:highest-median-age','value'),
  ('unwpp:lowest-median-age','value'),
  ('unwpp:highest-mean-age-childbearing','value'),
  ('unwpp:lowest-death-rate','rate'),
  ('unwpp:highest-birth-rate','rate'),
  ('unwpp:lowest-fertility','rate'),
  ('unwpp:lowest-pop-density','rate'),
  ('unwpp:highest-sex-ratio-at-birth','rate')
)
update public.stat_categories c
set measurement_type=f.measurement_type,
    value_type=case when f.measurement_type='rate' then 'rate' else c.value_type end,
    content_review_status='approved',
    content_review_reason='v16.3.0 measurement audit: replaced the generic OTHER player badge with a concrete value or rate classification.',
    content_review_version='geostats-v16.3.0-measurement-cleanup',
    metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object(
      'measurementType',f.measurement_type,
      'normalizationType',case when f.measurement_type='rate' then 'rate' else 'absolute' end,
      'contentReviewVersion','geostats-v16.3.0-measurement-cleanup'
    ),
    updated_at=now()
from measurement_fix f
where c.id=f.id;

commit;
