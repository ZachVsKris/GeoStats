begin;

-- v16.2.7 durable product rule: keep the broad, recognizable universal
-- women's-suffrage history concept, but do not proliferate separate female/women
-- variants across labor, finance, health, ownership, management, etc.
update public.category_review_state r
set status='rejected',duplicate_of=null,
    notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.7 durable product decision: exclude female/women variants except universal women’s suffrage.'),
    updated_at=now()
from public.stat_categories c
where c.id=r.category_id
  and c.id<>'history:ipu-universal-womens-suffrage'
  and lower(c.title) ~ '(^|[^a-z])(women|woman|female)([^a-z]|$)';

update public.stat_categories c
set review_status='rejected',curation_status='excluded',content_review_status='excluded',
    curation_reason='v16.2.7: intentionally excluded because female/women variants are outside the curated product mix except universal women’s suffrage.',
    content_review_reason='v16.2.7 durable product decision: keep only the universal women’s suffrage history concept from this family.',
    enabled=false,eligible_daily=false,updated_at=now()
where c.id<>'history:ipu-universal-womens-suffrage'
  and lower(c.title) ~ '(^|[^a-z])(women|woman|female)([^a-z]|$)';

select public.refresh_category_decision_provenance_v16_2_7();

commit;
