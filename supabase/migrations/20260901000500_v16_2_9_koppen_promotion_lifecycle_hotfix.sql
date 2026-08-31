begin;

-- Re-imports replace observations before the derived review views are refreshed.
-- Refresh those prerequisites first, then clear generic editorial flags that do
-- not apply to this owner-reviewed 1991-2020 climatology bundle.
create or replace function public.promote_v16_2_9_koppen_bundle()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  expected_ids constant text[] := array[
    'koppen-geiger:desert-share',
    'koppen-geiger:arid-share',
    'koppen-geiger:steppe-share',
    'koppen-geiger:tropical-rainforest-share',
    'koppen-geiger:tropical-monsoon-share',
    'koppen-geiger:tropical-savanna-share',
    'koppen-geiger:temperate-share',
    'koppen-geiger:mediterranean-share',
    'koppen-geiger:continental-share',
    'koppen-geiger:polar-share',
    'koppen-geiger:tundra-share'
  ];
  ready_count integer;
  playable_count integer;
begin
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();

  select count(*)::integer into ready_count
  from public.category_runtime_review_v16 c
  where c.id=any(expected_ids)
    and c.validation_status='verified'
    and greatest(c.common_year_coverage,c.country_coverage)>=180
    and c.top_value_distinct_count>=8
    and coalesce(c.content_review_status,'pending')<>'excluded'
    and coalesce(c.curation_status,'pending')<>'excluded';

  if ready_count<>cardinality(expected_ids) then
    raise exception 'v16.2.9 Köppen bundle is incomplete or failed validation: % of % categories are ready',ready_count,cardinality(expected_ids);
  end if;

  update public.stat_categories
  set review_status='approved',
      curation_status='approved',
      content_review_status='approved',
      curation_reason='v16.2.9 bounded climate-geography bundle: passed independent source, coverage, distinct-value, integrity, and Top-20 feasibility gates.',
      content_review_reason='Clear player-facing climate-area share from the peer-reviewed 1991-2020 Köppen-Geiger classification.',
      curation_version='geostats-v16.2.9-bounded-koppen',
      content_review_version='geostats-v16.2.9-bounded-koppen',
      immediate_comprehension_score=greatest(coalesce(immediate_comprehension_score,0),90),
      gameplay_interest_score=greatest(coalesce(gameplay_interest_score,0),92),
      uniqueness_score=greatest(coalesce(uniqueness_score,0),86),
      updated_at=now()
  where id=any(expected_ids);

  insert into public.category_review_state(
    category_id,status,duplicate_of,political_self_reported,confusing,
    esoteric,subjective_or_composite,stale_data,poor_coverage,notes,
    reviewed_at,updated_at
  )
  select id,'approved',null,false,false,false,false,false,false,
    'v16.2.9 bounded climate-geography bundle approved after reproducible 195-country feasibility and stored-source integrity audits.',
    now(),now()
  from public.stat_categories
  where id=any(expected_ids)
  on conflict(category_id) do update
  set status='approved',
      duplicate_of=null,
      political_self_reported=false,
      confusing=false,
      esoteric=false,
      subjective_or_composite=false,
      stale_data=false,
      poor_coverage=false,
      notes=concat_ws(E'\n',nullif(category_review_state.notes,''),excluded.notes),
      reviewed_at=excluded.reviewed_at,
      updated_at=excluded.updated_at;

  perform public.refresh_category_decision_provenance_v16_2_7();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.refresh_v16_2_runtime_catalog();

  select count(*)::integer into playable_count
  from public.category_runtime_review_v16_2
  where id=any(expected_ids) and computed_playable_v16_2;

  if playable_count<>cardinality(expected_ids) then
    raise exception 'v16.2.9 Köppen publication failed closed: % of % categories became playable',playable_count,cardinality(expected_ids);
  end if;
  return playable_count;
end
$$;

revoke all on function public.promote_v16_2_9_koppen_bundle() from public,anon,authenticated;
grant execute on function public.promote_v16_2_9_koppen_bundle() to service_role;

commit;
