begin;

-- Keep the formal Beck et al. equations in technical_definition. Game cards
-- teach the concept and decisive thresholds without displaying algebra.
with copy(id,description) as (values
  (
    'koppen-geiger:steppe-share',
    'Land receiving between half and all of the Köppen–Geiger temperature-adjusted rainfall limit'
  ),
  (
    'koppen-geiger:tropical-monsoon-share',
    'Land that stays at least 18°C year-round and has a short dry season, with the driest month under 60 mm but enough annual rain to remain monsoon'
  )
)
update public.stat_categories c
set description=copy.description,
    plain_language_description=copy.description,
    content_review_reason='v16.3.0 card-copy audit: defining thresholds retained in plain language; formal equation remains in the technical definition.',
    content_review_version='geostats-v16.3.0-card-copy-simplification',
    metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object(
      'plainLanguageDescription',copy.description,
      'boardDescription',copy.description,
      'contentReviewVersion','geostats-v16.3.0-card-copy-simplification'
    ),
    updated_at=now()
from copy
where c.id=copy.id;

do $$
begin
  if exists (
    select 1 from public.stat_categories
    where id in ('koppen-geiger:steppe-share','koppen-geiger:tropical-monsoon-share')
      and (
        length(coalesce(metadata->>'boardDescription',''))>150
        or coalesce(metadata->>'boardDescription','') ilike '%annual rainfall divided by%'
      )
  ) then raise exception 'climate card-copy simplification failed'; end if;
end $$;

commit;
