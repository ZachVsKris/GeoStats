-- GeoStats v16.2 scoped rollback.
-- Restores catalog/editorial fields captured before the first v16.2 run,
-- returns runtime playability to the v16.1 policy, and removes v16.2-only views.
-- Historical Daily boards, scores, source imports, and observations are preserved.

begin;
select pg_advisory_xact_lock(hashtext('geostats-v16.2-catalog-recovery'));

update public.stat_categories c
set title=b.category_state->>'title',
    short_title=b.category_state->>'short_title',
    description=b.category_state->>'description',
    enabled=coalesce((b.category_state->>'enabled')::boolean,false),
    eligible_daily=coalesce((b.category_state->>'eligible_daily')::boolean,false),
    review_status=b.category_state->>'review_status',
    curation_status=b.category_state->>'curation_status',
    content_review_status=b.category_state->>'content_review_status',
    content_review_reason=b.category_state->>'content_review_reason',
    metadata=coalesce(b.category_state->'metadata','{}'::jsonb),
    updated_at=now()
from public.v16_2_category_backup b
where b.category_id=c.id;

update public.category_review_state r
set status=b.review_state->>'status',
    political_self_reported=coalesce((b.review_state->>'political_self_reported')::boolean,false),
    confusing=coalesce((b.review_state->>'confusing')::boolean,false),
    esoteric=coalesce((b.review_state->>'esoteric')::boolean,false),
    subjective_or_composite=coalesce((b.review_state->>'subjective_or_composite')::boolean,false),
    stale_data=coalesce((b.review_state->>'stale_data')::boolean,false),
    poor_coverage=coalesce((b.review_state->>'poor_coverage')::boolean,false),
    duplicate_of=b.review_state->>'duplicate_of',
    recommended_title=b.review_state->>'recommended_title',
    semantic_group=b.review_state->>'semantic_group',
    notes=b.review_state->>'notes',
    reviewed_at=nullif(b.review_state->>'reviewed_at','')::timestamptz,
    updated_at=now()
from public.v16_2_review_backup b
where b.category_id=r.category_id;

-- Reapply the retained v16.1 ranking, semantic, and single-catalog policy.
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.reconcile_category_playability_v15();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();

update public.stat_categories c
set enabled=v.computed_playable_v16,
    eligible_daily=v.computed_playable_v16,
    updated_at=now()
from public.category_runtime_review_v16 v
where v.id=c.id;

-- Remove only v16.2 runtime/assessment objects. Keep the two backup tables so
-- the original pre-v16.2 state remains inspectable.
drop view if exists public.category_review_workbench_v16_2;
drop view if exists public.category_promotion_dry_run_v16_2;
drop view if exists public.category_review_overview_v16_2;
drop view if exists public.data_integrity_issues_v16_2;
drop view if exists public.data_integrity_overview_v16_2;
drop view if exists public.data_integrity_by_source_v16_2;
drop view if exists public.category_catalog_consistency_v16_2;
drop view if exists public.category_runtime_review_v16_2;

drop function if exists public.finalize_v16_2_catalog();
drop function if exists public.refresh_v16_2_runtime_catalog();
drop function if exists public.apply_conservative_promotions_v16_2();
drop function if exists public.refresh_category_promotion_assessment_v16_2();
drop function if exists public.apply_v16_2_copy_corrections();
drop function if exists public.category_v16_2_copy_is_clear(text,text,text,text);
drop function if exists public.category_v16_2_quality_floor(text);
drop function if exists public.replace_stat_category_observations_v16_2(text,jsonb);

drop table if exists public.category_auto_promotion_events_v16_2;
drop table if exists public.category_promotion_assessment_v16_2;

notify pgrst,'reload schema';
commit;

select * from public.category_review_overview_v16;
