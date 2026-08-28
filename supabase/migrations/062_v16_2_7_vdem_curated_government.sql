begin;

-- V-Dem v16 breadth recovery: explicitly approve only the clearest, most
-- meaningfully distinct government/civics concepts from the independently
-- verified 2025 snapshot. Keep them disabled until the v16.2.7 release gate
-- proves all-mode solver reachability and publishes atomically.
update public.category_review_state r
set status='approved', duplicate_of=null,
    notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.7 curated government expansion: independently verified V-Dem v16 concept approved for staged reachability.'),
    updated_at=now()
where r.category_id in (
  'vdem-v16:freedom-expression',
  'vdem-v16:clean-elections',
  'vdem-v16:rule-law',
  'vdem-v16:political-corruption',
  'vdem-v16:civil-society-participation'
);

update public.stat_categories c
set review_status='approved',curation_status='approved',content_review_status='approved',
    curation_reason='v16.2.7 curated government expansion: intuitive, distinct V-Dem v16 concept with a verified 2025 country snapshot.',
    content_review_reason='v16.2.7 explicit player-facing concept and wording review completed.',
    content_review_version='geostats-v16.2.7-vdem-curation-v1',
    enabled=false,eligible_daily=false,updated_at=now()
where c.id in (
  'vdem-v16:freedom-expression',
  'vdem-v16:clean-elections',
  'vdem-v16:rule-law',
  'vdem-v16:political-corruption',
  'vdem-v16:civil-society-participation'
);

-- Electoral and Liberal Democracy are valid source series but overlap too
-- heavily with one another and the retained component concepts for the current
-- catalog. Preserve them as auditable ledger rows rather than padding count.
update public.category_review_state r
set status='rejected', duplicate_of=null,
    notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.7 durable anti-proliferation exclusion: overlapping headline V-Dem democracy index.'),
    updated_at=now()
where r.category_id in ('vdem-v16:electoral-democracy','vdem-v16:liberal-democracy');

update public.stat_categories c
set review_status='rejected',curation_status='excluded',content_review_status='excluded',
    curation_reason='v16.2.7: intentionally excluded to avoid proliferating overlapping headline democracy indices alongside clearer retained components.',
    content_review_reason='v16.2.7 durable anti-proliferation decision.',
    enabled=false,eligible_daily=false,updated_at=now()
where c.id in ('vdem-v16:electoral-democracy','vdem-v16:liberal-democracy');

select public.refresh_category_decision_provenance_v16_2_7();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

commit;
