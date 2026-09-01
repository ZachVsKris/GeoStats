begin;

with measurement_fix(id,measurement_type,value_type,normalization_type) as (values
  ('natural-earth:longest-land-border','total','total','absolute'),
  ('natural-earth:largest-continuous-land-area','total','total','absolute'),
  ('natural-earth:longest-average-land-border','rate','rate','rate'),
  ('natural-earth:longest-single-land-border','total','total','absolute'),
  ('natural-earth:most-mapped-river-length','total','total','absolute'),
  ('natural-earth:northernmost-country','value','index','absolute'),
  ('natural-earth:southernmost-country','value','index','absolute'),
  ('worldbankclimate:coldest','value','index','absolute'),
  ('worldbankclimate:hottest','value','index','absolute'),
  ('worldbankclimate:wettest','value','index','absolute')
)
update public.stat_categories c
set measurement_type=f.measurement_type,
    value_type=f.value_type,
    content_review_status='approved',
    content_review_reason='v16.3.0 measurement audit: eliminated the unsupported Other badge.',
    content_review_version='geostats-v16.3.0-measurement-final',
    metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object(
      'measurementType',f.measurement_type,
      'normalizationType',f.normalization_type,
      'contentReviewVersion','geostats-v16.3.0-measurement-final'
    ),
    updated_at=now()
from measurement_fix f
where c.id=f.id;

do $$
begin
  if exists (
    select 1 from public.category_runtime_review_v16_2
    where computed_playable_v16_2 and measurement_type='other'
  ) then
    raise exception 'playable catalog still contains unsupported Other measurement badges';
  end if;
end $$;

commit;
