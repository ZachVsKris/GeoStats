-- GeoStats v16.0 catalog-policy rollback.
-- Historical Daily boards and scores are preserved. This restores the catalog
-- fields captured before the first v16 installer run and removes only v16 views/functions.
begin;
select pg_advisory_xact_lock(hashtext('geostats-v16.0-integrated-release'));

update public.stat_categories c set
 title=b.title,short_title=b.short_title,description=b.description,
 common_year=b.common_year,common_year_coverage=b.common_year_coverage,
 latest_available_year=b.latest_available_year,country_coverage=b.country_coverage,
 enabled=b.enabled,eligible_daily=b.eligible_daily,review_status=b.review_status,
 curation_status=b.curation_status,curation_reason=b.curation_reason,
 content_review_status=b.content_review_status,player_quality_status=b.player_quality_status,
 updated_at=now()
from public.v16_category_backup b where b.category_id=c.id;

update public.category_review_state r set
 status=b.status,duplicate_of=b.duplicate_of,recommended_title=b.recommended_title,
 semantic_group=b.semantic_group,notes=b.notes,confusing=b.confusing,esoteric=b.esoteric,
 stale_data=b.stale_data,poor_coverage=b.poor_coverage,updated_at=now()
from public.v16_review_backup b where b.category_id=r.category_id;

update public.data_sources set metadata=coalesce(metadata,'{}'::jsonb)-'retired'-'retiredVersion',updated_at=now()
where id in ('unescoheritage','unesco');

select public.reconcile_category_playability_v15();

drop function if exists public.finalize_v16_catalog();
drop function if exists public.refresh_v16_runtime_catalog();
drop function if exists public.apply_v16_curated_decisions();
drop function if exists public.publish_daily_trio_v16(date,jsonb);
drop view if exists public.data_integrity_issues_v16;
drop view if exists public.data_integrity_overview_v16;
drop view if exists public.data_integrity_by_source_v16;
drop view if exists public.category_review_overview_v16;
drop view if exists public.category_review_workbench_v16;
drop view if exists public.category_runtime_review_v16;
drop function if exists public.refresh_category_ranking_completeness_v16();
drop table if exists public.category_ranking_completeness_v16;
commit;
