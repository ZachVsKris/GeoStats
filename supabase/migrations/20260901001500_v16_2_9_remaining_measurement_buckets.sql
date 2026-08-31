begin;

update public.stat_categories
set measurement_type='rate',
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'measurementType','rate','playerCopyVersion','geostats-v16.2.9.6'
    ),
    content_review_status='approved',
    content_review_reason='v16.2.9 measurement-bucket audit: normalized concentration or annual rate',
    content_review_version='geostats-v16.2.9.6',
    updated_at=now()
where id in ('unsdg:pm25-exposure','worldbankclimate:driest');

update public.stat_categories
set measurement_type='value',
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'measurementType','value','playerCopyVersion','geostats-v16.2.9.6'
    ),
    content_review_status='approved',
    content_review_reason='v16.2.9 measurement-bucket audit: normalized absolute measured value',
    content_review_version='geostats-v16.2.9.6',
    updated_at=now()
where id='worldbankclimate:coldest';

commit;
