-- GeoStats v16.2.3 conservative rollback
-- Prefer restoring the database snapshot taken immediately before installation.
-- This script restores the 307 editorial dispositions and removes v16.2.3-only
-- historical categories from gameplay without deleting source/provenance records.

begin;
select pg_advisory_xact_lock(hashtext('geostats-v16.2.3-rollback'));

update public.category_review_state r
set status=case d.prior_editorial_status
      when 'approved' then 'approved'
      when 'rejected' then 'rejected'
      when 'duplicate' then 'duplicate'
      when 'needs_rewrite' then 'needs_rewrite'
      when 'needs_discussion' then 'needs_discussion'
      else 'pending'
    end,
    updated_at=now()
from public.category_release_decisions_v16_2_3 d
where d.category_id=r.category_id;

-- v16.2.3-only historical replacements are fail-closed on rollback.
update public.stat_categories
set enabled=false,eligible_daily=false,review_status='needs_review',curation_status='pending',
    content_review_status='pending',updated_at=now()
where id in ('history:oldest-current-constitution','history:ipu-recent-independence','history:ipu-universal-womens-suffrage');

update public.data_sources set status='inactive',updated_at=now() where id='ipu';

-- Restore the v16.2.2 constitution direction when its source audit is still valid.
update public.category_review_state r
set status='approved',updated_at=now()
from public.stat_categories c
where c.id=r.category_id and c.id='history:newest-current-constitution'
  and c.validation_status='verified' and coalesce(c.validation_mismatch_count,0)=0 and coalesce(c.validation_ranking_mismatch_count,0)=0;
update public.stat_categories
set review_status='approved',curation_status='approved',content_review_status='approved',measurement_type='historical_date',updated_at=now()
where id='history:newest-current-constitution' and validation_status='verified';

-- Recompute the shared catalog without invoking the v16.2.3 finalizer.
select public.refresh_measurement_types_v16_2_2();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();
update public.stat_categories c
set enabled=v.computed_playable_v16_2,eligible_daily=v.computed_playable_v16_2,updated_at=now()
from public.category_runtime_review_v16_2 v where v.id=c.id;

commit;
