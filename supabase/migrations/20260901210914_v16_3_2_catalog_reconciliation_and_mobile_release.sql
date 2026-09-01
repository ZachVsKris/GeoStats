begin;

select pg_advisory_xact_lock(hashtext('geostats-v16.3.2-catalog-reconciliation'));

-- Record a finite disposition for every category that was editorially approved
-- but still absent from gameplay at the start of this release. This preserves
-- the distinction between an owner-approved restoration and a category that
-- remains blocked by source, ranking, validation, freshness, or objectivity.
create table if not exists public.category_catalog_reconciliation_v16_3_2 (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  disposition text not null check (disposition in ('restored','kept_blocked')),
  blocker_class text not null,
  rationale text not null,
  evidence jsonb not null default '{}'::jsonb,
  assessed_at timestamptz not null default now()
);
alter table public.category_catalog_reconciliation_v16_3_2 enable row level security;
revoke all on public.category_catalog_reconciliation_v16_3_2 from public,anon,authenticated;
grant select on public.category_catalog_reconciliation_v16_3_2 to service_role;

insert into public.category_catalog_reconciliation_v16_3_2(
  category_id,disposition,blocker_class,rationale,evidence,assessed_at
)
select w.id,
  case when w.id in (
    'natural-earth:largest-mapped-lake-area',
    'natural-earth:largest-single-mapped-lake',
    'natural-earth:highest-mapped-lake-share',
    'natural-earth:largest-mapped-glaciated-area',
    'natural-earth:highest-mapped-glaciated-share',
    'smithsonian-gvp:highest-volcano',
    'smithsonian-gvp:most-holocene-volcanoes',
    'unhcr:most-asylum-applications-by-origin',
    'unhcr:most-asylum-applications-received',
    'unhcr:most-refugees-hosted',
    'unhcr:most-refugees-originating',
    'unhcr:most-stateless-people'
  ) then 'restored' else 'kept_blocked' end,
  coalesce(w.blocker_class_v16_2,'unclassified'),
  case
    when w.id like 'natural-earth:%' and w.id in (
      'natural-earth:largest-mapped-lake-area','natural-earth:largest-single-mapped-lake',
      'natural-earth:highest-mapped-lake-share','natural-earth:largest-mapped-glaciated-area',
      'natural-earth:highest-mapped-glaciated-share'
    ) then 'Restore: the pinned Natural Earth layer, value checksum, ranking, 195-country coverage, copy review, and all three solver modes passed; the missed v16.2.7 curation call was the only blocker.'
    when w.id like 'smithsonian-gvp:%' then 'Restore: the verified Smithsonian GVP data and ranking passed; the existing player link is the official Holocene Volcano List and downloadable table.'
    when w.id like 'unhcr:%' then 'Restore: the verified 2025 UNHCR data and ranking passed; the existing player link is the official Refugee Data Finder for these measures.'
    else 'Keep blocked: '||coalesce(w.primary_blocker_v16_2,'an independent catalog integrity or gameplay gate has not passed.')
  end,
  jsonb_build_object(
    'sourceOrganization',w.source_organization,
    'validationStatus',w.validation_status,
    'semanticAuditStatus',w.semantic_audit_status,
    'credibilityStatus',w.credibility_status,
    'objectiveStatus',w.objective_status,
    'playerSourceStatus',w.player_source_status,
    'commonYear',w.common_year,
    'commonYearCoverage',w.common_year_coverage,
    'countryCoverage',w.country_coverage,
    'originalBlockers',to_jsonb(coalesce(w.v16_2_blockers,array[]::text[]))
  ),
  now()
from public.category_review_workbench_v16_2 w
where w.editorial_status='approved' and not w.computed_playable_v16_2
on conflict(category_id) do update set
  disposition=excluded.disposition,
  blocker_class=excluded.blocker_class,
  rationale=excluded.rationale,
  evidence=excluded.evidence,
  assessed_at=excluded.assessed_at;

do $$
declare reviewed integer;
begin
  select count(*) into reviewed from public.category_catalog_reconciliation_v16_3_2;
  if reviewed<>84 then
    raise exception 'v16.3.2 expected 84 approved-but-blocked reconciliation rows, found %',reviewed;
  end if;
end $$;

create or replace function public.apply_v16_3_2_catalog_reconciliation()
returns integer
language plpgsql
security invoker
set search_path=public
as $$
declare changed integer:=0;
declare step_changed integer:=0;
begin
  -- These five mapped lake/glacier measures were approved and reachable in all
  -- modes. Restore the credibility decision that v16.2.7 defined but failed to
  -- invoke, while remaining fail-closed if source integrity ever regresses.
  with physical_restore(id,credibility_score,credibility_reason) as (values
    ('natural-earth:largest-mapped-lake-area',84,'Reproducible mapped lake-and-reservoir area from the pinned official Natural Earth 1:10m layer; player copy states the mapped-layer scope.'),
    ('natural-earth:largest-single-mapped-lake',84,'Reproducible largest mapped lake-or-reservoir area from the pinned official Natural Earth 1:10m layer; player copy states the mapped-layer scope.'),
    ('natural-earth:highest-mapped-lake-share',82,'Reproducible mapped lake-and-reservoir share from the pinned official Natural Earth 1:10m layer; player copy states the mapped-layer scope.'),
    ('natural-earth:largest-mapped-glaciated-area',84,'Reproducible mapped glaciated area from the pinned official Natural Earth 1:10m layer; player copy states the mapped-layer scope.'),
    ('natural-earth:highest-mapped-glaciated-share',82,'Reproducible mapped glaciated share from the pinned official Natural Earth 1:10m layer; player copy states the mapped-layer scope.')
  )
  update public.stat_categories c
  set review_status='approved',curation_status='approved',content_review_status='approved',
      curation_reason='v16.3.2 owner-reviewed catalog reconciliation: restore the verified mapped lake/glacier measure.',
      content_review_reason='v16.3.2 owner-reviewed mapped-layer scope, title, unit, source, ranking, and solver reachability.',
      curation_version='geostats-v16.3.2-catalog-reconciliation',
      content_review_version='geostats-v16.3.2-catalog-reconciliation',
      credibility_status='approved',
      credibility_score=greatest(coalesce(c.credibility_score,0),r.credibility_score),
      credibility_reason=r.credibility_reason,
      comparability_risk='medium',
      metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object(
        'catalogReconciliationVersion','geostats-v16.3.2',
        'ownerApprovedRestore',true,
        'mappedLayerLimitationDisclosed',true,
        'credibilityStatus','approved',
        'credibilityScore',greatest(coalesce(c.credibility_score,0),r.credibility_score),
        'comparabilityRisk','medium',
        'contentReviewStatus','approved'
      ),
      updated_at=now()
  from physical_restore r
  where c.id=r.id
    and c.validation_status='verified'
    and coalesce(c.validation_mismatch_count,0)=0
    and coalesce(c.validation_ranking_mismatch_count,0)=0;
  get diagnostics step_changed=row_count;
  changed:=changed+step_changed;

  -- The remaining seven rows already passed data, semantic, ranking,
  -- objectivity, and reachability review. Their only blocker was that an
  -- existing official player link had never been classified.
  update public.stat_categories c
  set player_source_status=case when c.source_organization='Smithsonian GVP' then 'exact' else 'general' end,
      player_source_reason=case when c.source_organization='Smithsonian GVP'
        then 'Official Smithsonian GVP Holocene Volcano List with a downloadable source table.'
        else 'Official UNHCR Refugee Data Finder covering the reviewed population measure.'
      end,
      review_status='approved',curation_status='approved',content_review_status='approved',
      curation_reason='v16.3.2 owner-reviewed catalog reconciliation: official player source link classified.',
      content_review_reason='v16.3.2 owner-reviewed official player source, title, unit, ranking, and solver reachability.',
      curation_version='geostats-v16.3.2-catalog-reconciliation',
      content_review_version='geostats-v16.3.2-catalog-reconciliation',
      metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object(
        'catalogReconciliationVersion','geostats-v16.3.2',
        'ownerApprovedRestore',true,
        'playerSourceStatus',case when c.source_organization='Smithsonian GVP' then 'exact' else 'general' end,
        'contentReviewStatus','approved'
      ),
      updated_at=now()
  where c.id in (
    'smithsonian-gvp:highest-volcano',
    'smithsonian-gvp:most-holocene-volcanoes',
    'unhcr:most-asylum-applications-by-origin',
    'unhcr:most-asylum-applications-received',
    'unhcr:most-refugees-hosted',
    'unhcr:most-refugees-originating',
    'unhcr:most-stateless-people'
  )
    and c.validation_status='verified'
    and coalesce(c.validation_mismatch_count,0)=0
    and coalesce(c.validation_ranking_mismatch_count,0)=0
    and public.player_source_url_is_safe(c.player_source_url);
  get diagnostics step_changed=row_count;
  changed:=changed+step_changed;

  update public.category_review_state r
  set status='approved',political_self_reported=false,confusing=false,esoteric=false,
      subjective_or_composite=false,stale_data=false,poor_coverage=false,duplicate_of=null,
      notes=concat_ws(E'\n',nullif(r.notes,''),'v16.3.2 owner-reviewed catalog reconciliation: restored after verified source, semantic, ranking, objective, and solver-reachability review.'),
      reviewed_at=coalesce(r.reviewed_at,now()),updated_at=now()
  from public.stat_categories c
  where r.category_id=c.id
    and c.id in (
      'natural-earth:largest-mapped-lake-area','natural-earth:largest-single-mapped-lake',
      'natural-earth:highest-mapped-lake-share','natural-earth:largest-mapped-glaciated-area',
      'natural-earth:highest-mapped-glaciated-share','smithsonian-gvp:highest-volcano',
      'smithsonian-gvp:most-holocene-volcanoes','unhcr:most-asylum-applications-by-origin',
      'unhcr:most-asylum-applications-received','unhcr:most-refugees-hosted',
      'unhcr:most-refugees-originating','unhcr:most-stateless-people'
    )
    and c.validation_status='verified'
    and coalesce(c.validation_mismatch_count,0)=0
    and coalesce(c.validation_ranking_mismatch_count,0)=0;

  return changed;
end;
$$;

revoke execute on function public.apply_v16_3_2_catalog_reconciliation() from public,anon,authenticated;
grant execute on function public.apply_v16_3_2_catalog_reconciliation() to service_role;

-- Make reconciliation durable across future importer/runtime refreshes. It is
-- applied after inherited curation and catalog-integrity corrections, then the
-- canonical assessment functions decide playability from the reconciled facts.
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
  perform public.apply_v16_3_runtime_corrections();
  perform public.apply_v16_3_1_catalog_integrity();
  perform public.apply_v16_3_2_catalog_reconciliation();
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
  perform public.apply_v16_3_1_catalog_integrity();
end;
$$;

revoke execute on function public.refresh_v16_2_runtime_catalog() from public,anon,authenticated;
grant execute on function public.refresh_v16_2_runtime_catalog() to service_role;

select public.refresh_v16_2_runtime_catalog();

do $$
declare restored integer;
declare kept_blocked integer;
declare catalog_size integer;
begin
  select count(*) into restored
  from public.category_runtime_review_v16_2 v
  join public.category_catalog_reconciliation_v16_3_2 r on r.category_id=v.id
  where r.disposition='restored' and v.computed_playable_v16_2 and v.enabled and v.eligible_daily;
  if restored<>12 then
    raise exception 'v16.3.2 expected 12 restored categories in gameplay, found %',restored;
  end if;

  select count(*) into kept_blocked
  from public.category_runtime_review_v16_2 v
  join public.category_catalog_reconciliation_v16_3_2 r on r.category_id=v.id
  where r.disposition='kept_blocked' and not v.computed_playable_v16_2 and not v.enabled and not v.eligible_daily;
  if kept_blocked<>72 then
    raise exception 'v16.3.2 expected 72 independently blocked approved categories, found %',kept_blocked;
  end if;

  select count(*) into catalog_size
  from public.category_runtime_review_v16_2
  where computed_playable_v16_2 and enabled and eligible_daily;
  if catalog_size<>318 then
    raise exception 'v16.3.2 expected one 318-category SQL/runtime catalog, found %',catalog_size;
  end if;

  if exists (
    select 1 from public.category_runtime_review_v16_2 v
    join public.category_catalog_reconciliation_v16_3_2 r on r.category_id=v.id
    where r.disposition='restored'
      and not exists (
        select 1 from public.generator_reachability_v16_2_7 g
        where g.category_id=v.id
        group by g.category_id
        having count(*)=3 and bool_and(g.reachable)
      )
  ) then raise exception 'v16.3.2 restored a category without three-mode solver reachability'; end if;

  if exists (
    select 1 from public.category_runtime_review_v16_2
    where enabled and eligible_daily and not computed_playable_v16_2
  ) then raise exception 'v16.3.2 SQL/runtime catalog flags diverged'; end if;

  if exists (
    select 1 from public.stat_categories
    where id in ('koppen-geiger:tropical-savanna-share','worldbank-catalog:bx-gsr-tran-zs','comtrade:most-sports-equipment-exported')
      and (enabled or eligible_daily)
  ) then raise exception 'v16.3.2 reconciliation regressed a durable owner exclusion'; end if;
end $$;

commit;
