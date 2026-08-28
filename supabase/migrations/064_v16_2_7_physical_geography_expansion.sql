begin;

-- Recover a small, explicit physical-geography set after source integrity has
-- verified the pinned Natural Earth snapshot. Mapped lake/glacier measures are
-- named as mapped-layer measurements rather than exhaustive inventories.
create or replace function public.apply_v16_2_7_physical_geography_curation()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare changed integer;
begin
  with decisions(id,title,description,credibility_score,credibility_reason,comparability_risk) as (values
    ('natural-earth:largest-mapped-lake-area','Largest mapped lake area','Combined area of lakes and reservoirs represented in the pinned Natural Earth 1:10m lake layer inside each country.',84,'Reproducible mapped-area measurement from one pinned global vector layer; the title explicitly avoids claiming an exhaustive lake inventory.','medium'),
    ('natural-earth:largest-single-mapped-lake','Largest mapped lake','Largest single lake or reservoir area represented in the pinned Natural Earth 1:10m lake layer inside each country.',84,'Reproducible largest-feature measurement from one pinned global vector layer; the title explicitly identifies it as mapped.','medium'),
    ('natural-earth:highest-mapped-lake-share','Largest mapped lake share','Share of mapped country land covered by lakes and reservoirs represented in the pinned Natural Earth 1:10m lake layer.',82,'Reproducible mapped-area share from one pinned global vector layer, with the source-layer limitation disclosed in the title and definition.','medium'),
    ('natural-earth:largest-mapped-glaciated-area','Largest mapped glaciated area','Combined area represented by the pinned Natural Earth 1:10m glaciated-area layer inside each country.',84,'Reproducible mapped-area measurement from one pinned global vector layer, presented as a mapped-layer statistic.','medium'),
    ('natural-earth:highest-mapped-glaciated-share','Largest mapped glaciated share','Share of mapped country land represented by the pinned Natural Earth 1:10m glaciated-area layer.',82,'Reproducible mapped-area share from one pinned global vector layer, presented as a mapped-layer statistic.','medium'),
    ('natural-earth:longest-average-land-border','Longest average land border','Average mapped land-border length per neighboring country, among countries with at least one mapped land border.',92,'Reproducible geodesic derivation from one pinned global country-boundary layer with an explicit eligible-country universe.','low'),
    ('natural-earth:highest-land-border-density','Most land border for its size','Combined mapped land-border length per 1,000 square kilometers of mapped land.',90,'Reproducible geodesic length-and-area derivation from the same pinned global country geometry.','low')
  )
  update public.stat_categories c
  set title=d.title,short_title=d.title,
      description=d.description,plain_language_description=d.description,
      review_status='approved',curation_status='approved',content_review_status='approved',
      curation_reason='v16.2.7 physical-geography expansion: explicit product review retained this clear, reproducible Natural Earth measure.',
      content_review_reason='v16.2.7 physical-geography expansion: player-facing title, unit, eligible universe and mapped-layer limitation reviewed.',
      content_review_version='geostats-v16.2.7-physical-geography-v1',
      credibility_status='approved',credibility_score=greatest(coalesce(c.credibility_score,0),d.credibility_score),
      credibility_reason=d.credibility_reason,comparability_risk=d.comparability_risk,
      metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object(
        'physicalGeographyCurationVersion','geostats-v16.2.7-physical-geography-v1',
        'mappedLayerLimitationDisclosed',true,
        'stagedForReachabilityV16_2_7',true
      ),
      enabled=false,eligible_daily=false,updated_at=now()
  from decisions d
  where c.id=d.id
    and c.validation_status='verified'
    and coalesce(c.validation_mismatch_count,0)=0
    and coalesce(c.validation_ranking_mismatch_count,0)=0;
  get diagnostics changed = row_count;

  update public.category_review_state r
  set status='approved',political_self_reported=false,confusing=false,esoteric=false,
      subjective_or_composite=false,stale_data=false,poor_coverage=false,duplicate_of=null,
      notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.7 explicit physical-geography product review completed after verified source audit.'),
      reviewed_at=coalesce(r.reviewed_at,now()),updated_at=now()
  from public.stat_categories c
  where r.category_id=c.id
    and c.id in (
      'natural-earth:largest-mapped-lake-area','natural-earth:largest-single-mapped-lake',
      'natural-earth:highest-mapped-lake-share','natural-earth:largest-mapped-glaciated-area',
      'natural-earth:highest-mapped-glaciated-share','natural-earth:longest-average-land-border',
      'natural-earth:highest-land-border-density'
    )
    and c.validation_status='verified'
    and coalesce(c.validation_mismatch_count,0)=0
    and coalesce(c.validation_ranking_mismatch_count,0)=0;

  perform public.refresh_category_decision_provenance_v16_2_7();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  return changed;
end;
$$;
revoke all on function public.apply_v16_2_7_physical_geography_curation() from public,anon,authenticated;
grant execute on function public.apply_v16_2_7_physical_geography_curation() to service_role;

commit;
