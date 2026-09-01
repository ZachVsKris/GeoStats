begin;

create or replace function public.apply_v16_3_runtime_corrections()
returns void
language sql
security invoker
set search_path=public
as $$
  with measurement_fix(id,measurement_type,value_type,normalization_type) as (values
    ('natural-earth-capital:capital-closest-equator','value','index','absolute'),
    ('natural-earth-capital:northernmost-capital','value','index','absolute'),
    ('natural-earth-capital:southernmost-capital','value','index','absolute'),
    ('natural-earth:longest-average-land-border','rate','rate','rate'),
    ('natural-earth:northernmost-country','value','index','absolute'),
    ('natural-earth:southernmost-country','value','index','absolute'),
    ('unwpp:highest-male-life-expectancy','value','index','absolute'),
    ('unwpp:highest-mean-age-childbearing','value','index','absolute'),
    ('unwpp:highest-median-age','value','index','absolute'),
    ('unwpp:lowest-fertility','rate','rate','rate'),
    ('unwpp:lowest-median-age','value','index','absolute'),
    ('unwpp:lowest-pop-density','rate','rate','rate'),
    ('natural-earth:longest-land-border','total','total','absolute'),
    ('natural-earth:largest-continuous-land-area','total','total','absolute'),
    ('natural-earth:longest-single-land-border','total','total','absolute'),
    ('natural-earth:most-mapped-river-length','total','total','absolute'),
    ('worldbankclimate:coldest','value','index','absolute'),
    ('worldbankclimate:hottest','value','index','absolute'),
    ('worldbankclimate:wettest','value','index','absolute')
  )
  update public.stat_categories c
  set measurement_type=f.measurement_type,
      value_type=f.value_type,
      metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object(
        'measurementType',f.measurement_type,
        'normalizationType',f.normalization_type
      ),
      content_review_status='approved',
      content_review_reason='v16.3.0 durable runtime correction: concrete player measurement bucket.',
      content_review_version='geostats-v16.3.0-durable-runtime-corrections',
      updated_at=now()
  from measurement_fix f
  where c.id=f.id;

  update public.stat_categories
  set enabled=false,
      eligible_daily=false,
      review_status='rejected',
      curation_status='excluded',
      content_review_status='excluded',
      curation_reason='Owner-retired category; must remain excluded after every runtime refresh.',
      content_review_reason='Owner-retired category; must remain excluded after every runtime refresh.',
      curation_version='geostats-v16.3.0-durable-runtime-corrections',
      content_review_version='geostats-v16.3.0-durable-runtime-corrections',
      updated_at=now()
  where id in (
    'comtrade:most-sports-equipment-exported',
    'koppen-geiger:tropical-savanna-share',
    'natural-earth:largest-geographic-span',
    'natural-earth:largest-north-south-span',
    'natural-earth:largest-east-west-span',
    'natural-earth:farthest-from-equator',
    'natural-earth:most-separate-land-areas',
    'natural-earth:most-large-land-areas',
    'worldbank-catalog:bx-gsr-tran-zs'
  );
$$;

create or replace function public.refresh_v16_2_runtime_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='300s'
as $$
begin
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_6_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  update public.stat_categories set measurement_type='total',updated_at=now() where source_organization='World Bank' and source_indicator_code='EN.URB.LCTY';
  update public.stat_categories set measurement_type='per_capita',updated_at=now() where source_organization='World Bank' and source_indicator_code in ('AG.LND.ARBL.HA.PC','FB.ATM.TOTL.P5','FB.CBK.BRCH.P5');
  perform public.apply_v16_2_7_legacy_reaudit();
  perform public.apply_v16_2_7_exact_title_deduplication();
  perform public.refresh_category_decision_provenance_v16_2_7();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();

  update public.stat_categories c
  set enabled=false,eligible_daily=false,updated_at=now()
  from public.category_runtime_review_v16_2 v
  where v.id=c.id and not v.computed_playable_v16_2 and (c.enabled or c.eligible_daily);

  update public.stat_categories c
  set enabled=true,eligible_daily=true,updated_at=now()
  from public.category_runtime_review_v16_2 v
  where v.id=c.id and v.computed_playable_v16_2
    and not (c.enabled and c.eligible_daily)
    and exists (
      select 1 from public.generator_reachability_v16_2_7 r
      where r.category_id=c.id
      group by r.category_id
      having count(*)=3 and bool_and(r.reachable)
    );

  perform public.apply_v16_3_runtime_corrections();
end;
$$;

revoke execute on function public.apply_v16_3_runtime_corrections() from public,anon,authenticated;
grant execute on function public.apply_v16_3_runtime_corrections() to service_role;

select public.apply_v16_3_runtime_corrections();

do $$ begin
  if exists (
    select 1 from public.category_runtime_review_v16_2
    where computed_playable_v16_2 and enabled and eligible_daily and measurement_type='other'
  ) then raise exception 'durable runtime correction left playable Other measurements'; end if;
  if exists (
    select 1 from public.stat_categories
    where id in ('koppen-geiger:tropical-savanna-share','worldbank-catalog:bx-gsr-tran-zs')
      and (enabled or eligible_daily)
  ) then raise exception 'durable runtime correction re-enabled an owner-retired category'; end if;
end $$;

commit;
