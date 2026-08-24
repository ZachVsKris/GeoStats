-- GeoStats v16.2.4 conservative rollback
-- Prefer restoring the database snapshot taken immediately before installation.
-- This script fail-closes v16.2.4-only history and restores the v16.2.3
-- ranking-completeness/runtime/finalizer functions. It does not delete provenance.

begin;
select pg_advisory_xact_lock(hashtext('geostats-v16.2.4-rollback'));

-- Remove v16.2.4-only historical milestones from gameplay while retaining source data.
update public.stat_categories
set enabled=false,eligible_daily=false,review_status='needs_review',curation_status='pending',
    content_review_status='pending',updated_at=now()
where id in (
  'history:worldbank-majority-urban','history:worldbank-internet-half',
  'history:worldbank-electricity-half','history:worldbank-life-expectancy-70'
);

update public.category_review_state
set status='pending',updated_at=now()
where category_id in (
  'history:worldbank-majority-urban','history:worldbank-internet-half',
  'history:worldbank-electricity-half','history:worldbank-life-expectancy-70'
);

-- Restore v16.2.3 editorial state for the four copy-repair candidates. The clearer
-- v16.2.4 copy may remain in provenance, but rollback must not treat the repair as approved.
update public.category_review_state r
set status='needs_rewrite',updated_at=now()
from public.stat_categories c
where c.id=r.category_id
  and c.source_indicator_code in ('AG.LND.IRIG.AG.ZS','EG.ELC.COAL.ZS','EG.ELC.NUCL.ZS','GB.XPD.RSDV.GD.ZS');
update public.stat_categories
set review_status='needs_rewrite',curation_status='pending',content_review_status='pending',enabled=false,eligible_daily=false,updated_at=now()
where source_indicator_code in ('AG.LND.IRIG.AG.ZS','EG.ELC.COAL.ZS','EG.ELC.NUCL.ZS','GB.XPD.RSDV.GD.ZS');

drop function if exists public.assert_v16_2_4_release();
drop function if exists public.apply_v16_2_4_catalog_curation();

create or replace function public.refresh_category_ranking_completeness_v16()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  delete from public.category_ranking_completeness_v16 where category_id is not null;

  insert into public.category_ranking_completeness_v16(
    category_id,status,reason,observation_count,distinct_value_count,
    top_value_distinct_count,top_value_feasible,assessed_year,assessed_at
  )
  with selected_year as (
    select q.id,q.source_organization,q.ranking_direction,
           coalesce(q.common_year,q.latest_available_year)::smallint as assessed_year
    from public.category_review_queue_v15 q
  ), ranked as (
    select y.id,y.source_organization,y.ranking_direction,y.assessed_year,o.value,
           row_number() over(
             partition by y.id
             order by
               case when y.ranking_direction='high' then o.value end desc nulls last,
               case when y.ranking_direction='low' then o.value end asc nulls last,
               o.country_iso3
           ) as ranking_position
    from selected_year y
    join public.stat_observations o
      on o.category_id=y.id and o.data_year=y.assessed_year
  ), metrics as (
    select y.id,y.source_organization,y.ranking_direction,y.assessed_year,
           count(r.value)::integer as observation_count,
           count(distinct r.value)::integer as distinct_value_count,
           count(distinct r.value) filter(where r.ranking_position<=50)::integer as top_value_distinct_count
    from selected_year y
    left join ranked r on r.id=y.id
    group by y.id,y.source_organization,y.ranking_direction,y.assessed_year
  )
  select id,
    case
      when assessed_year is null or observation_count<30 then 'non_comprehensive'
      when observation_count>=185 then 'comprehensive'
      when ranking_direction='low' then 'non_comprehensive'
      when observation_count>=100 and top_value_distinct_count>=15 then 'top_end_complete'
      when source_organization in (
        'FAOSTAT','FAOSTAT Food Balances','Natural Earth','Pew Research Center',
        'Smithsonian GVP','USGS','UN Comtrade','UNHCR','United Nations','Constitute Project','Inter-Parliamentary Union'
      ) and top_value_distinct_count>=10 then 'top_end_complete'
      else 'non_comprehensive'
    end,
    case
      when assessed_year is null then 'No common comparison year is available.'
      when observation_count<30 then 'Fewer than 30 countries have comparable observations.'
      when observation_count>=185 then 'The common-year ranking covers nearly the full supported country universe.'
      when ranking_direction='low' then 'Incomplete coverage cannot safely support a lowest-wins ranking.'
      when observation_count>=100 and top_value_distinct_count>=15
        then 'The high end is sufficiently covered and distinct for gameplay even though some countries are omitted.'
      when source_organization in (
        'FAOSTAT','FAOSTAT Food Balances','Natural Earth','Pew Research Center',
        'Smithsonian GVP','USGS','UN Comtrade','UNHCR','United Nations','Constitute Project','Inter-Parliamentary Union'
      ) and top_value_distinct_count>=10
        then 'The source is structurally sparse, but the meaningful high end contains enough distinct ranked values.'
      else 'One or more omitted countries could plausibly alter the meaningful top ranking.'
    end,
    observation_count,distinct_value_count,top_value_distinct_count,
    (top_value_distinct_count>=10),assessed_year,now()
  from metrics;
end;
$$;
revoke all on function public.refresh_category_ranking_completeness_v16() from public,anon,authenticated;
grant execute on function public.refresh_category_ranking_completeness_v16() to service_role;

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
  perform public.apply_v16_2_3_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.assert_v16_2_3_source_recovery();
  update public.stat_categories c
  set enabled=v.computed_playable_v16_2,
      eligible_daily=v.computed_playable_v16_2,
      updated_at=now()
  from public.category_runtime_review_v16_2 v
  where v.id=c.id;
  -- Never re-enable the inverse constitution category after the shared-gate refresh.
  update public.stat_categories set enabled=false,eligible_daily=false,updated_at=now()
  where id='history:newest-current-constitution';
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
  perform pg_advisory_xact_lock(hashtext('geostats-v16.2.3-finalize-catalog'));
  perform public.apply_v16_1_copy_corrections();
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_3_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.assert_v16_2_3_source_recovery();
  perform public.apply_conservative_promotions_v16_2();
  perform public.refresh_v16_2_runtime_catalog();
end;
$$;
revoke all on function public.finalize_v16_2_catalog() from public,anon,authenticated;
grant execute on function public.finalize_v16_2_catalog() to service_role;

-- Recompute using restored v16.2.3 logic, then fail-close v16.2.4-only rows again.
select public.refresh_measurement_types_v16_2_2();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();
update public.stat_categories c
set enabled=v.computed_playable_v16_2,eligible_daily=v.computed_playable_v16_2,updated_at=now()
from public.category_runtime_review_v16_2 v where v.id=c.id;
update public.stat_categories
set enabled=false,eligible_daily=false,updated_at=now()
where id in (
  'history:worldbank-majority-urban','history:worldbank-internet-half',
  'history:worldbank-electricity-half','history:worldbank-life-expectancy-70'
);

commit;
