begin;

create index if not exists stat_observations_category_year_value_country_v16_2_7_idx
  on public.stat_observations(category_id,data_year,value,country_iso3);

create or replace function public.refresh_category_ranking_completeness_v16()
returns void language plpgsql security definer set search_path=public set statement_timeout='180s' as $$
begin
  delete from public.category_ranking_completeness_v16 where category_id is not null;

  insert into public.category_ranking_completeness_v16(
    category_id,status,reason,observation_count,distinct_value_count,
    top_value_distinct_count,top_value_feasible,assessed_year,assessed_at
  )
  with selected_year as (
    select c.id,c.source_organization,c.ranking_direction,
      coalesce(c.common_year,latest.latest_year)::smallint assessed_year,
      coalesce(c.eligible_universe_type,'universal') universe_type,
      coalesce(c.eligible_country_count,195) eligible_count,
      c.eligible_country_iso3
    from public.stat_categories c
    left join lateral (
      select max(o.data_year)::smallint latest_year
      from public.stat_observations o
      where o.category_id=c.id
    ) latest on c.common_year is null
  ), metrics as (
    select y.*,
      coalesce(s.observation_count,0)::integer observation_count,
      coalesce(s.distinct_value_count,0)::integer distinct_value_count,
      coalesce(t.top_value_distinct_count,0)::integer top_value_distinct_count
    from selected_year y
    left join lateral (
      select count(*)::integer observation_count,
             count(distinct o.value)::integer distinct_value_count
      from public.stat_observations o
      where o.category_id=y.id and o.data_year=y.assessed_year
    ) s on true
    left join lateral (
      select count(distinct top_rows.value)::integer top_value_distinct_count
      from (
        select o.value
        from public.stat_observations o
        where o.category_id=y.id and o.data_year=y.assessed_year
        order by
          case when y.ranking_direction='high' then o.value end desc nulls last,
          case when y.ranking_direction='low' then o.value end asc nulls last,
          o.country_iso3
        limit 20
      ) top_rows
    ) t on true
  )
  select id,
    case
      when assessed_year is null then 'non_comprehensive'
      when universe_type='defined_subset' and eligible_count>=12 and observation_count>=eligible_count
        and (eligible_country_iso3 is null or cardinality(eligible_country_iso3)=eligible_count) then 'comprehensive'
      when observation_count<30 then 'non_comprehensive'
      when observation_count>=185 then 'comprehensive'
      when ranking_direction='low' then 'non_comprehensive'
      when observation_count>=100 and top_value_distinct_count>=10 then 'top_end_complete'
      when source_organization in ('FAOSTAT','FAOSTAT Food Balances','Natural Earth','Pew Research Center','Smithsonian GVP','USGS','UN Comtrade','UNHCR','United Nations','Constitute Project','Inter-Parliamentary Union') and top_value_distinct_count>=10 then 'top_end_complete'
      else 'non_comprehensive' end,
    case
      when assessed_year is null then 'No common comparison year is available.'
      when universe_type='defined_subset' and eligible_count>=12 and observation_count>=eligible_count
        and (eligible_country_iso3 is null or cardinality(eligible_country_iso3)=eligible_count)
        then 'The common-year snapshot covers the complete explicitly defined eligible universe.'
      when observation_count<30 then 'Fewer than 30 countries have comparable observations.'
      when observation_count>=185 then 'The common-year ranking covers nearly the full supported country universe.'
      when ranking_direction='low' then 'Incomplete universal coverage cannot safely support a lowest-wins ranking; define and fully cover a legitimate eligible subset instead of assigning synthetic values.'
      when observation_count>=100 and top_value_distinct_count>=10 then 'The winning end is sufficiently covered and distinct for the universal category.'
      when source_organization in ('FAOSTAT','FAOSTAT Food Balances','Natural Earth','Pew Research Center','Smithsonian GVP','USGS','UN Comtrade','UNHCR','United Nations','Constitute Project','Inter-Parliamentary Union') and top_value_distinct_count>=10
        then 'The source is structurally sparse, but the meaningful winning end contains enough distinct ranked values.'
      else 'One or more omitted countries could plausibly alter the meaningful winning end.' end,
    observation_count,distinct_value_count,top_value_distinct_count,
    (top_value_distinct_count>=10),assessed_year,now()
  from metrics;
end;
$$;

commit;
