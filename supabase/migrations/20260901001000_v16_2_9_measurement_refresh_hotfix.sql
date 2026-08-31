begin;

-- Preserve explicit audited measurement metadata during every catalog refresh.
-- The older inference routine collapsed RATE and VALUE back into OTHER.
create or replace function public.refresh_measurement_types_v16_2_2()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  with classified as (
    select id,
      case
        when lower(coalesce(metadata->>'measurementType',metadata->>'measurement_type',''))
          in ('total','share','per_capita','historical_date','rate','value')
          then lower(coalesce(metadata->>'measurementType',metadata->>'measurement_type',''))
        when source_organization in ('United Nations','Constitute Project') then 'historical_date'
        when lower(coalesce(value_type,''))='percentage'
          or lower(coalesce(unit,'')) ~ '(^%$|percent|percentage|% of|share)'
          or lower(coalesce(title,'')) ~ '(share|percentage|percent)' then 'share'
        when lower(coalesce(value_type,''))='per_capita'
          or lower(coalesce(unit,'')) ~ '(per person|per capita|per 100|per 1,?000|per 10,?000|per 100,?000|per million)'
          or lower(coalesce(title,'')) ~ '(per person|per capita|per 100|per 1,?000|per 10,?000|per 100,?000|per million)' then 'per_capita'
        when lower(coalesce(value_type,''))='total' then 'total'
        else 'other'
      end as inferred_type
    from public.stat_categories
  )
  update public.stat_categories category
  set measurement_type=classified.inferred_type,
      updated_at=now()
  from classified
  where classified.id=category.id
    and category.measurement_type is distinct from classified.inferred_type;
end;
$$;

revoke all on function public.refresh_measurement_types_v16_2_2() from public,anon,authenticated;
grant execute on function public.refresh_measurement_types_v16_2_2() to service_role;

select public.refresh_measurement_types_v16_2_2();

commit;
