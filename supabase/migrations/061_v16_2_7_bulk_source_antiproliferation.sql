begin;

-- Global Findex is an economy/finance source family, already an overrepresented
-- GeoStats domain. Retain only two intuitive, distinct concepts with adequate
-- 2024 official coverage. Preserve the remaining rows in the catalog ledger,
-- but make their retirement explicit and durable instead of deleting history.
update public.category_review_state r
set status='rejected', duplicate_of=null,
    notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.7 durable anti-proliferation exclusion: Findex family capped to account ownership and digital merchant-payment use.'),
    updated_at=now()
where r.category_id like 'global-findex:%'
  and r.category_id not in ('global-findex:account-ownership','global-findex:digital-merchant-payment');

update public.stat_categories c
set review_status='rejected',curation_status='excluded',content_review_status='excluded',
    curation_reason='v16.2.7: intentionally excluded because the Findex family is capped to a small set of distinct, high-value concepts rather than repetitive financial-inclusion variants.',
    content_review_reason='v16.2.7 durable anti-proliferation decision: retain account ownership and digital merchant-payment use only.',
    enabled=false,eligible_daily=false,updated_at=now()
where c.id like 'global-findex:%'
  and c.id not in ('global-findex:account-ownership','global-findex:digital-merchant-payment');

-- The HDR composite time-series release does not contain the MPI family. Keep
-- those old placeholder rows as retired ledger records; a future dedicated MPI
-- source may add a new independently validated concept. Sex-specific HDI rows
-- are also retired to avoid subgroup proliferation; female variants separately
-- remain covered by the durable women-category product rule.
update public.category_review_state r
set status='rejected', duplicate_of=null,
    notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.7 durable bulk-source curation: unsupported/retired UNDP HDR variant.'),
    updated_at=now()
where r.category_id in (
  'undp-hdr:mpi','undp-hdr:mpi-headcount','undp-hdr:mpi-intensity',
  'undp-hdr:female-hdi','undp-hdr:male-hdi'
);

update public.stat_categories c
set review_status='rejected',curation_status='excluded',content_review_status='excluded',
    curation_reason=case
      when c.id like 'undp-hdr:mpi%' then 'v16.2.7: intentionally excluded because the official HDR composite time-series file does not provide this MPI concept; require a dedicated first-party MPI source before reconsideration.'
      else 'v16.2.7: intentionally excluded because sex-specific HDI variants are outside the curated anti-proliferation product mix.'
    end,
    content_review_reason='v16.2.7 durable bulk-source curation decision.',
    enabled=false,eligible_daily=false,updated_at=now()
where c.id in (
  'undp-hdr:mpi','undp-hdr:mpi-headcount','undp-hdr:mpi-intensity',
  'undp-hdr:female-hdi','undp-hdr:male-hdi'
);

select public.refresh_category_decision_provenance_v16_2_7();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

commit;
