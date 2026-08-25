-- GeoStats v16.2.5 conservative rollback.
-- This does not delete imported observations. It restores v16.2.4 curation/runtime
-- functions and disables categories that were introduced through the v16.2.5 target set.
begin;

-- Restore inherited role-level statement timeout behavior.
alter function public.record_category_validation(text,text,text,integer,integer,integer,integer,integer,integer,text,text,jsonb,text,jsonb,bigint)
  reset statement_timeout;
alter function public.reconcile_category_playability_v15()
  reset statement_timeout;

update public.stat_categories c
set enabled=false,eligible_daily=false,updated_at=now()
from public.category_release_targets_v16_2_5 t
where t.category_id=c.id;

-- Re-apply the prior release's catalog decisions. Source/audit data stays intact.
select public.apply_v16_2_4_catalog_curation();
select public.refresh_measurement_types_v16_2_2();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

drop index if exists public.stat_observations_category_year_country_v16_2_5_idx;

-- Install the v16.2.4 definitions for the two publication functions by running
-- RUN_THIS_IN_SUPABASE_FOR_V16_2_4.sql if a full rollback is required. The
-- statements above are sufficient to quarantine v16.2.5-only target categories.
commit;
