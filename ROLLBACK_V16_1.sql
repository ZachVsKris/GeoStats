-- GeoStats v16.1 scoped rollback.
-- Restores category copy/status fields captured before the first v16.1 run.
-- It intentionally preserves the audit table and historical boards/scores.

begin;
select pg_advisory_xact_lock(hashtext('geostats-v16.1-corrective-audit'));

update public.stat_categories c
set title=b.title,short_title=b.short_title,description=b.description,
    icon=b.icon,unit=b.unit,value_type=b.value_type,
    ranking_direction=b.ranking_direction,enabled=b.enabled,
    eligible_daily=b.eligible_daily,metadata=b.metadata,updated_at=now()
from public.v16_1_category_backup b
where b.category_id=c.id;

update public.category_review_state r
set status=b.status,duplicate_of=b.duplicate_of,
    recommended_title=b.recommended_title,semantic_group=b.semantic_group,
    notes=b.notes,updated_at=now()
from public.v16_1_review_backup b
where b.category_id=r.category_id;

-- Recompute the retained audit/runtime views against restored copy and states.
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

commit;

select * from public.category_review_overview_v16;
