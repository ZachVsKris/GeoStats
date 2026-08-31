begin;

-- Emergency catalog rollback only. Preserve imported source evidence and never
-- reverse the owner-directed transport-services retirement.
update public.stat_categories
set enabled=false,
    eligible_daily=false,
    review_status='needs_review',
    curation_status='pending',
    curation_reason='v16.2.9 emergency rollback: climate bundle disabled pending review.',
    updated_at=now()
where id=any(array[
  'koppen-geiger:desert-share','koppen-geiger:arid-share','koppen-geiger:steppe-share',
  'koppen-geiger:tropical-rainforest-share','koppen-geiger:tropical-monsoon-share',
  'koppen-geiger:tropical-savanna-share','koppen-geiger:temperate-share',
  'koppen-geiger:mediterranean-share','koppen-geiger:continental-share',
  'koppen-geiger:polar-share','koppen-geiger:tundra-share'
]::text[]);

update public.category_review_state
set status='needs_discussion',
    notes=concat_ws(E'\n',nullif(notes,''),'v16.2.9 emergency rollback: climate bundle disabled pending review.'),
    updated_at=now()
where category_id like 'koppen-geiger:%';

select public.refresh_category_decision_provenance_v16_2_7();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();
select public.refresh_v16_2_runtime_catalog();

commit;
