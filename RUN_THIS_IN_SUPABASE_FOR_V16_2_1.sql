-- GeoStats v16.2.1 focused audit-recovery hotfix
-- Repairs false source-audit failures, prevents catalog-collapse publication,
-- refreshes stale credibility only after a clean source audit, and keeps one
-- shared Daily/Random playable catalog.

begin;

create or replace function public.apply_v16_2_1_audit_reconciliation()
returns table(
  faostat_links_repaired integer,
  pew_credibility_repaired integer
)
language plpgsql
security definer
set search_path=public
set statement_timeout='120s'
as $$
declare
  faostat_count integer := 0;
  pew_count integer := 0;
begin
  update public.stat_categories c
  set player_source_url=coalesce(nullif(c.player_source_url,''),c.source_page_url,c.source_url),
      player_source_status=case when c.player_source_status='exact' then 'exact' else 'general' end,
      player_source_reason=case
        when c.player_source_status='exact' then c.player_source_reason
        else 'Official FAOSTAT QCL dataset page; item, element, year, and unit are preserved in source-query metadata.'
      end,
      player_source_checked_at=coalesce(c.player_source_checked_at,now()),
      link_quality_score=greatest(coalesce(c.link_quality_score,0),80),
      updated_at=now()
  where c.source_organization='FAOSTAT'
    and c.source_dataset='Production: Crops and livestock products (QCL)'
    and coalesce(c.player_source_status,'needs_exact_url')<>'exact';
  get diagnostics faostat_count = row_count;

  -- A current, clean, zero-mismatch Pew audit supersedes the stale v16.1
  -- quarantine record. This is deliberately source-specific and does not
  -- erase substantive credibility decisions for any other source.
  update public.stat_categories c
  set credibility_status='approved',
      credibility_score=greatest(coalesce(c.credibility_score,0),75),
      credibility_reason='Current official-source audit verified the stored series, values, coverage, and rankings with zero mismatches.',
      updated_at=now()
  where c.source_organization='Pew Research Center'
    and c.validation_status='verified'
    and coalesce(c.validation_mismatch_count,0)=0
    and coalesce(c.validation_ranking_mismatch_count,0)=0
    and coalesce(c.credibility_status,'approved')='quarantined';
  get diagnostics pew_count = row_count;

  return query select faostat_count,pew_count;
end;
$$;
revoke all on function public.apply_v16_2_1_audit_reconciliation() from public,anon,authenticated;
grant execute on function public.apply_v16_2_1_audit_reconciliation() to service_role;

create or replace function public.assert_v16_2_1_source_recovery()
returns table(
  world_bank_audited integer,
  faostat_qcl_audited integer,
  who_audited integer,
  comtrade_audited integer,
  proposed_playable integer
)
language plpgsql
security definer
set search_path=public
set statement_timeout='120s'
as $$
declare
  wb_count integer;
  fao_count integer;
  who_count integer;
  trade_count integer;
  playable_count integer;
begin
  select count(*)::integer into wb_count
  from public.category_runtime_review_v16
  where source_organization='World Bank'
    and (
      validation_status='verified'
      or (validation_status='unable_to_verify' and coalesce(validation_reason,'') ilike 'Non-blocking audit warning:%')
    );

  select count(*)::integer into fao_count
  from public.category_runtime_review_v16
  where source_organization='FAOSTAT'
    and source_dataset='Production: Crops and livestock products (QCL)'
    and validation_status='verified';

  select count(*)::integer into who_count
  from public.category_runtime_review_v16
  where source_organization='WHO'
    and (
      validation_status='verified'
      or (validation_status='unable_to_verify' and coalesce(validation_reason,'') ilike 'Non-blocking audit warning:%')
    );

  select count(*)::integer into trade_count
  from public.category_runtime_review_v16
  where source_organization='UN Comtrade'
    and validation_status='verified';

  select count(*)::integer into playable_count
  from public.category_promotion_assessment_v16_2
  where proposed_status in ('playable','auto_promote')
    and strict_pass;

  if wb_count < 300 then
    raise exception 'v16.2.1 publication blocked: only % World Bank categories completed a usable official-source audit; expected at least 300.',wb_count;
  end if;
  if fao_count < 25 then
    raise exception 'v16.2.1 publication blocked: only % FAOSTAT QCL categories verified; expected at least 25.',fao_count;
  end if;
  if who_count < 15 then
    raise exception 'v16.2.1 publication blocked: only % WHO categories completed a usable audit; expected at least 15.',who_count;
  end if;
  if trade_count < 40 then
    raise exception 'v16.2.1 publication blocked: only % UN Comtrade categories verified; expected at least 40. Confirm COMTRADE_API_KEY and rerun recovery.',trade_count;
  end if;
  if playable_count < 180 then
    raise exception 'v16.2.1 publication blocked: only % categories pass the shared Daily/Random gate; expected at least 180.',playable_count;
  end if;

  return query select wb_count,fao_count,who_count,trade_count,playable_count;
end;
$$;
revoke all on function public.assert_v16_2_1_source_recovery() from public,anon,authenticated;
grant execute on function public.assert_v16_2_1_source_recovery() to service_role;

-- Guard every runtime publication, including audit export and admin review.
-- A failed assertion raises before any enabled/eligible_daily flags change.
create or replace function public.refresh_v16_2_runtime_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.assert_v16_2_1_source_recovery();

  update public.stat_categories c
  set enabled=v.computed_playable_v16_2,
      eligible_daily=v.computed_playable_v16_2,
      updated_at=now()
  from public.category_runtime_review_v16_2 v
  where v.id=c.id;
end;
$$;
revoke all on function public.refresh_v16_2_runtime_catalog() from public,anon,authenticated;
grant execute on function public.refresh_v16_2_runtime_catalog() to service_role;

create or replace function public.finalize_v16_2_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='300s'
as $$
begin
  perform pg_advisory_xact_lock(hashtext('geostats-v16.2.1-finalize-catalog'));
  perform public.apply_v16_1_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.assert_v16_2_1_source_recovery();
  perform public.apply_conservative_promotions_v16_2();
  perform public.refresh_v16_2_runtime_catalog();
end;
$$;
revoke all on function public.finalize_v16_2_catalog() from public,anon,authenticated;
grant execute on function public.finalize_v16_2_catalog() to service_role;

create or replace view public.catalog_recovery_status_v16_2_1
with(security_invoker=true) as
select
  count(*) filter(where source_organization='World Bank' and validation_status='verified')::bigint as world_bank_verified,
  count(*) filter(where source_organization='World Bank' and validation_status='unable_to_verify' and coalesce(validation_reason,'') ilike 'Non-blocking audit warning:%')::bigint as world_bank_warnings,
  count(*) filter(where source_organization='FAOSTAT' and source_dataset='Production: Crops and livestock products (QCL)' and validation_status='verified')::bigint as faostat_qcl_verified,
  count(*) filter(where source_organization='WHO' and validation_status='verified')::bigint as who_verified,
  count(*) filter(where source_organization='WHO' and validation_status='unable_to_verify' and coalesce(validation_reason,'') ilike 'Non-blocking audit warning:%')::bigint as who_warnings,
  count(*) filter(where source_organization='UN Comtrade' and validation_status='verified')::bigint as comtrade_verified,
  count(*) filter(where computed_playable_v16_2)::bigint as currently_published_playable,
  count(*) filter(where promotion_decision_v16_2 in ('playable','auto_promote') and strict_pass_v16_2)::bigint as proposed_playable,
  count(*) filter(where promotion_decision_v16_2='auto_promote')::bigint as proposed_automatic_promotions,
  count(*) filter(where enabled is distinct from eligible_daily)::bigint as daily_random_mismatches
from public.category_runtime_review_v16_2;
revoke all on public.catalog_recovery_status_v16_2_1 from public,anon,authenticated;
grant select on public.catalog_recovery_status_v16_2_1 to service_role;

-- The installer deliberately does not publish a runtime catalog. Recovery,
-- source audits, and the guarded finalizer must succeed first.
select public.apply_v16_2_1_audit_reconciliation();
select public.refresh_category_promotion_assessment_v16_2();

notify pgrst,'reload schema';
commit;
