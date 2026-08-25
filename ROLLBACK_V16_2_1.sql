-- GeoStats v16.2.1 code-level rollback.
-- This restores the unguarded v16.2 runtime publication functions. It does not
-- reverse benign source-link or credibility metadata repairs; restore the
-- pre-install Supabase backup for a byte-for-byte database rollback.

begin;

drop view if exists public.catalog_recovery_status_v16_2_1;
drop function if exists public.assert_v16_2_1_source_recovery();
drop function if exists public.apply_v16_2_1_audit_reconciliation();

create or replace function public.refresh_v16_2_runtime_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  perform public.apply_v16_2_copy_corrections();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();

  update public.stat_categories c
  set enabled=v.computed_playable_v16_2,
      eligible_daily=v.computed_playable_v16_2,
      updated_at=now()
  from public.category_runtime_review_v16_2 v
  where v.id=c.id;
end;
$$;

create or replace function public.finalize_v16_2_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='240s'
as $$
begin
  perform pg_advisory_xact_lock(hashtext('geostats-v16.2-finalize-catalog'));
  perform public.apply_v16_1_copy_corrections();
  perform public.apply_conservative_promotions_v16_2();
  perform public.refresh_v16_2_runtime_catalog();
end;
$$;

grant execute on function public.refresh_v16_2_runtime_catalog() to service_role;
grant execute on function public.finalize_v16_2_catalog() to service_role;
notify pgrst,'reload schema';
commit;
