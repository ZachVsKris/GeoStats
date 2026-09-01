begin;

update public.stat_categories
set title='Most threatened vascular plant species',
    short_title='Most threatened vascular plant species',
    description='Number of native vascular plant species classified as threatened with extinction.',
    plain_language_description='Number of native vascular plant species classified as threatened with extinction.',
    unit='species',
    unit_explanation='native vascular plant species',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'shortName','Most threatened vascular plant species',
      'plainLanguageDescription','Number of native vascular plant species classified as threatened with extinction.',
      'boardDescription','Number of native vascular plant species classified as threatened with extinction.',
      'unitExplanation','native vascular plant species'
    ),
    content_review_status='approved',
    content_review_reason='v16.3.0 live Daily copy audit: replace the source-order label and define higher plants as native vascular plants.',
    content_review_version='geostats-v16.3.0-live-copy-audit',
    updated_at=now()
where id='worldbank-catalog:en-hpt-thrd-no';

do $$ begin
  if not exists (
    select 1 from public.stat_categories
    where id='worldbank-catalog:en-hpt-thrd-no'
      and short_title='Most threatened vascular plant species'
      and metadata->>'boardDescription'='Number of native vascular plant species classified as threatened with extinction.'
  ) then
    raise exception 'vascular-plant player-copy update did not apply';
  end if;
end $$;

commit;
