-- GeoStats v16.2.4: new mode/scoring release, country-variety preferences,
-- broad historical milestone expansion, and guarded catalog publication.
begin;

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
    select q.id,q.source_organization,q.source_dataset,q.ranking_direction,
           coalesce(q.common_year,q.latest_available_year)::smallint as assessed_year
    from public.category_review_queue_v15 q
  ), ranked as (
    select y.id,y.source_organization,y.source_dataset,y.ranking_direction,y.assessed_year,o.value,
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
    select y.id,y.source_organization,y.source_dataset,y.ranking_direction,y.assessed_year,
           count(r.value)::integer as observation_count,
           count(distinct r.value)::integer as distinct_value_count,
           count(distinct r.value) filter(where r.ranking_position<=50)::integer as top_value_distinct_count
    from selected_year y
    left join ranked r on r.id=y.id
    group by y.id,y.source_organization,y.source_dataset,y.ranking_direction,y.assessed_year
  )
  select id,
    case
      when assessed_year is null or observation_count<30 then 'non_comprehensive'
      when observation_count>=185 then 'comprehensive'
      when ranking_direction='low' then 'non_comprehensive'
      when source_dataset='World Development Indicators: historical threshold milestones'
           and top_value_distinct_count>=10 then 'top_end_complete'
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
      when source_dataset='World Development Indicators: historical threshold milestones'
           and top_value_distinct_count>=10
        then 'The importer records only exact consecutive-year threshold crossings; omitted left-censored or never-crossed countries cannot outrank the most recent observed crossings.'
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

create or replace function public.apply_v16_2_4_catalog_curation()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.apply_v16_2_3_catalog_curation();

  -- Resolve four broad share-category rewrites from the v16.2.3 backlog. These
  -- are editorial repairs only: source validation and ranking completeness remain
  -- authoritative, so a repaired category can still stay out of play.
  update public.stat_categories
  set title=case source_indicator_code
        when 'AG.LND.IRIG.AG.ZS' then 'Largest share of agricultural land irrigated'
        when 'EG.ELC.COAL.ZS' then 'Largest share of electricity from coal'
        when 'EG.ELC.NUCL.ZS' then 'Largest share of electricity from nuclear power'
        when 'GB.XPD.RSDV.GD.ZS' then 'Highest R&D spending as a share of GDP'
        else title end,
      short_title=case source_indicator_code
        when 'AG.LND.IRIG.AG.ZS' then 'Irrigated agricultural land'
        when 'EG.ELC.COAL.ZS' then 'Coal electricity share'
        when 'EG.ELC.NUCL.ZS' then 'Nuclear electricity share'
        when 'GB.XPD.RSDV.GD.ZS' then 'R&D share of GDP'
        else short_title end,
      description=case source_indicator_code
        when 'AG.LND.IRIG.AG.ZS' then 'Percentage of a country''s agricultural land that is irrigated.'
        when 'EG.ELC.COAL.ZS' then 'Percentage of a country''s electricity generated from coal sources.'
        when 'EG.ELC.NUCL.ZS' then 'Percentage of a country''s electricity generated from nuclear power.'
        when 'GB.XPD.RSDV.GD.ZS' then 'Research and development expenditure as a percentage of GDP.'
        else description end,
      measurement_type='share',
      review_status='approved',curation_status='approved',content_review_status='approved',updated_at=now()
  where source_indicator_code in ('AG.LND.IRIG.AG.ZS','EG.ELC.COAL.ZS','EG.ELC.NUCL.ZS','GB.XPD.RSDV.GD.ZS');

  update public.category_review_state r
  set status='approved',confusing=false,esoteric=false,subjective_or_composite=false,duplicate_of=null,
      recommended_title=c.title,
      notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.4: broad share-category copy repaired; source/ranking gates remain authoritative.'),
      reviewed_at=coalesce(r.reviewed_at,now()),updated_at=now()
  from public.stat_categories c
  where c.id=r.category_id
    and c.source_indicator_code in ('AG.LND.IRIG.AG.ZS','EG.ELC.COAL.ZS','EG.ELC.NUCL.ZS','GB.XPD.RSDV.GD.ZS');

  update public.category_review_state r
  set status='approved',political_self_reported=false,confusing=false,esoteric=false,
      subjective_or_composite=false,stale_data=false,poor_coverage=false,duplicate_of=null,
      recommended_title=c.title,
      semantic_group=coalesce(r.semantic_group,'historical-development-milestone'),
      notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.4 broad historical milestone: exact annual threshold crossing from an official World Bank series.'),
      reviewed_at=coalesce(r.reviewed_at,now()),updated_at=now()
  from public.stat_categories c
  where c.id=r.category_id
    and c.id in (
      'history:worldbank-majority-urban',
      'history:worldbank-internet-half',
      'history:worldbank-electricity-half',
      'history:worldbank-life-expectancy-70'
    )
    and c.validation_status='verified'
    and coalesce(c.validation_mismatch_count,0)=0
    and coalesce(c.validation_ranking_mismatch_count,0)=0;

  update public.stat_categories
  set review_status='approved',curation_status='approved',
      curation_reason='v16.2.4 historical milestone: broad, guessable, source-audited, and derived only from exact consecutive-year crossings.',
      content_review_status='approved',
      content_review_reason='v16.2.4 historical review: distinct concept, clear threshold, reproducible derivation, and provenance.',
      measurement_type='historical_date',updated_at=now()
  where id in (
      'history:worldbank-majority-urban',
      'history:worldbank-internet-half',
      'history:worldbank-electricity-half',
      'history:worldbank-life-expectancy-70'
    )
    and validation_status='verified'
    and coalesce(validation_mismatch_count,0)=0
    and coalesce(validation_ranking_mismatch_count,0)=0;
end;
$$;
revoke all on function public.apply_v16_2_4_catalog_curation() from public,anon,authenticated;
grant execute on function public.apply_v16_2_4_catalog_curation() to service_role;

create or replace function public.assert_v16_2_4_release()
returns table(
  historical_verified integer,
  world_bank_milestones_verified integer,
  proposed_playable integer,
  pending_editorial integer,
  daily_random_mismatches integer,
  catalog_rewrites_resolved integer
)
language plpgsql
security definer
set search_path=public
set statement_timeout='120s'
as $$
declare
  history_count integer; milestone_count integer; playable_count integer;
  pending_count integer; mismatch_count integer; rewrite_count integer;
begin
  perform public.assert_v16_2_3_source_recovery();

  select count(*)::integer into history_count
  from public.category_runtime_review_v16
  where id in (
    'history:un-admission','history:oldest-current-constitution',
    'history:ipu-recent-independence','history:ipu-universal-womens-suffrage',
    'history:worldbank-majority-urban','history:worldbank-internet-half',
    'history:worldbank-electricity-half','history:worldbank-life-expectancy-70'
  ) and validation_status='verified';

  select count(*)::integer into milestone_count
  from public.category_runtime_review_v16
  where id like 'history:worldbank-%' and validation_status='verified';

  select count(*)::integer into playable_count
  from public.category_promotion_assessment_v16_2
  where proposed_status in ('playable','auto_promote') and strict_pass;

  select count(*)::integer into pending_count
  from public.category_review_state where status='pending';

  select coalesce(daily_random_mismatches,0)::integer into mismatch_count
  from public.category_catalog_consistency_v16_2;

  select count(*)::integer into rewrite_count
  from public.category_review_state r
  join public.stat_categories c on c.id=r.category_id
  where c.source_indicator_code in ('AG.LND.IRIG.AG.ZS','EG.ELC.COAL.ZS','EG.ELC.NUCL.ZS','GB.XPD.RSDV.GD.ZS')
    and r.status='approved' and c.measurement_type='share';

  if history_count < 8 then raise exception 'v16.2.4 publication blocked: only % of 8 curated historical categories are source-verified.',history_count; end if;
  if milestone_count < 4 then raise exception 'v16.2.4 publication blocked: only % of 4 World Bank historical milestones are source-verified.',milestone_count; end if;
  if playable_count < 260 then raise exception 'v16.2.4 publication blocked: only % categories pass the shared Daily/Random gate; expected at least 260.',playable_count; end if;
  if pending_count <> 0 then raise exception 'v16.2.4 publication blocked: % category review rows are still pending.',pending_count; end if;
  if mismatch_count <> 0 then raise exception 'v16.2.4 publication blocked: % Daily/Random catalog flag mismatches exist.',mismatch_count; end if;
  if rewrite_count <> 4 then raise exception 'v16.2.4 publication blocked: only % of 4 targeted share-category rewrites are resolved.',rewrite_count; end if;

  return query select history_count,milestone_count,playable_count,pending_count,mismatch_count,rewrite_count;
end;
$$;
revoke all on function public.assert_v16_2_4_release() from public,anon,authenticated;
grant execute on function public.assert_v16_2_4_release() to service_role;

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
  perform public.apply_v16_2_4_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.assert_v16_2_4_release();
  update public.stat_categories c
  set enabled=v.computed_playable_v16_2,
      eligible_daily=v.computed_playable_v16_2,
      updated_at=now()
  from public.category_runtime_review_v16_2 v
  where v.id=c.id;
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
  perform pg_advisory_xact_lock(hashtext('geostats-v16.2.4-finalize-catalog'));
  perform public.apply_v16_1_copy_corrections();
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_4_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.assert_v16_2_4_release();
  perform public.apply_conservative_promotions_v16_2();
  perform public.refresh_v16_2_runtime_catalog();
end;
$$;
revoke all on function public.finalize_v16_2_catalog() from public,anon,authenticated;
grant execute on function public.finalize_v16_2_catalog() to service_role;

select public.apply_v16_2_4_catalog_curation();
select public.refresh_measurement_types_v16_2_2();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

commit;
