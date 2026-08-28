-- GeoStats v15.3: gameplay-safe catalog expansion and source clarity
--
-- Run after the v15.2 migration. Safe to rerun.
--
-- This migration:
--   * quarantines misleading modeled UNESCO completion-rate categories;
--   * restores exact FAOSTAT item/element labels in source specifications;
--   * approves reproducible Natural Earth physical-geography categories that
--     pass the existing hard integrity gates;
--   * promotes only exceptionally clear pending categories using conservative,
--     source-agnostic editorial thresholds;
--   * leaves value/ranking/coverage/duplicate/credibility failures blocked.

begin;

create table if not exists public.v15_3_review_state_backup (
  category_id text primary key,
  review_state jsonb not null,
  captured_at timestamptz not null default now()
);

insert into public.v15_3_review_state_backup (category_id, review_state)
select category_id, to_jsonb(review)
from public.category_review_state review
on conflict (category_id) do nothing;

create table if not exists public.v15_3_category_backup (
  category_id text primary key,
  category_state jsonb not null,
  captured_at timestamptz not null default now()
);

insert into public.v15_3_category_backup (category_id, category_state)
select id, to_jsonb(category)
from public.stat_categories category
on conflict (category_id) do nothing;

-- Preserve the exact FAOSTAT measure in the player-facing source specification.
-- The importer now writes these fields directly; this backfills existing rows.
update public.stat_categories category
set source_query = coalesce(category.source_query, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
        'domainCode', 'QCL',
        'itemCode', coalesce(category.source_query->>'itemCode', category.metadata->>'itemCode'),
        'item', coalesce(category.source_query->>'item', category.metadata->>'item'),
        'elementCode', coalesce(category.source_query->>'elementCode', category.metadata->>'elementCode'),
        'element', coalesce(category.source_query->>'element', category.metadata->>'element'),
        'year', coalesce(category.source_query->'year', to_jsonb(category.common_year)),
        'unit', coalesce(category.source_query->>'unit', category.metadata->>'unit', category.unit)
      )),
    updated_at = now()
where category.source_organization = 'FAOSTAT';

-- CR.MOD.* is a modeled, age-referenced completion estimate. The old copy
-- incorrectly described it as the share of current students completing school,
-- and the generic data-browser link does not expose a reproducible exact view.
update public.stat_categories category
set title = case category.source_indicator_code
      when 'CR.MOD.1' then 'Modeled primary-education completion rate'
      when 'CR.MOD.2' then 'Modeled lower-secondary completion rate'
      when 'CR.MOD.3' then 'Modeled upper-secondary completion rate'
      else category.title
    end,
    short_title = case category.source_indicator_code
      when 'CR.MOD.1' then 'Modeled primary completion'
      when 'CR.MOD.2' then 'Modeled lower-secondary completion'
      when 'CR.MOD.3' then 'Modeled upper-secondary completion'
      else category.short_title
    end,
    description = 'Modeled completion rate among children three to five years above the official completion age for the education level. Quarantined from Daily play until an exact reproducible official view and tie-suitability review are available.',
    plain_language_description = 'Modeled, age-referenced education completion estimate; not the share of currently enrolled students who graduate.',
    unit = '% of age-referenced population',
    player_quality_status = 'caution',
    player_quality_reason = 'Quarantined in v15.3 because the prior label was misleading, the series is modeled, and the official browser does not expose a stable exact view.',
    updated_at = now()
where category.source_organization = 'UNESCO UIS'
  and category.source_indicator_code in ('CR.MOD.1','CR.MOD.2','CR.MOD.3');

update public.category_review_state review
set status = 'needs_discussion',
    reviewed_at = null,
    reviewed_by = null,
    notes = concat_ws(
      E'\n',
      nullif(review.notes,''),
      'v15.3 quarantine: modeled UNESCO completion series was previously mislabeled, is difficult to reproduce in the linked browser, and is highly tie-prone.'
    ),
    updated_at = now()
from public.stat_categories category
where category.id = review.category_id
  and category.source_organization = 'UNESCO UIS'
  and category.source_indicator_code in ('CR.MOD.1','CR.MOD.2','CR.MOD.3');

-- Reproducible physical-geography tranche already generated from fixed Natural
-- Earth 1:10m layers. Approval is granted only when the existing hard gate says
-- the stored values, coverage, recency, source and credibility are acceptable.
with physical_clear_pass as (
  select queue.id
  from public.category_review_queue_v15 queue
  where queue.source_organization = 'Natural Earth'
    and queue.id in (
      'natural-earth:most-land-neighbors',
      'natural-earth:longest-land-border',
      'natural-earth:longest-single-land-border',
      'natural-earth:longest-coastline',
      'natural-earth:highest-coastline-density',
      'natural-earth:most-separate-land-areas',
      'natural-earth:most-large-land-areas',
      'natural-earth:largest-continuous-land-area',
      'natural-earth:largest-geographic-span',
      'natural-earth:largest-north-south-span',
      'natural-earth:largest-east-west-span',
      'natural-earth:northernmost-country',
      'natural-earth:southernmost-country',
      'natural-earth:farthest-from-equator',
      'natural-earth:largest-geodesic-land-area',
      'natural-earth:most-mapped-river-length',
      'natural-earth:highest-mapped-river-density',
      'natural-earth:most-mapped-rivers',
      'natural-earth:largest-mapped-lake-area',
      'natural-earth:largest-single-mapped-lake',
      'natural-earth:most-mapped-lakes',
      'natural-earth:highest-mapped-lake-share',
      'natural-earth:largest-mapped-glaciated-area',
      'natural-earth:highest-mapped-glaciated-share'
    )
    and queue.hard_gate_ready
    and coalesce(queue.objective_status,'objective') = 'objective'
    and coalesce(queue.understandability_score, queue.immediate_comprehension_score, 0) >= 88
    and coalesce(queue.fun_score, queue.gameplay_interest_score, 0) >= 88
    and coalesce(queue.content_review_status,'pending') <> 'excluded'
    and not queue.political_self_reported
    and not queue.subjective_or_composite
    and not queue.confusing
    and not queue.esoteric
    and not queue.stale_data
    and not queue.poor_coverage
    and queue.duplicate_of is null
)
update public.category_review_state review
set status = 'approved',
    reviewed_at = coalesce(review.reviewed_at, now()),
    notes = concat_ws(
      E'\n',
      nullif(review.notes,''),
      'v15.3 approved reproducible physical geography derived from fixed Natural Earth 1:10m layers; map scale and geometry method remain visible to players.'
    ),
    updated_at = now()
from physical_clear_pass approved
where approved.id = review.category_id
  and review.status in ('pending','needs_rewrite','needs_discussion');

-- Conservative catalog triage. This is intentionally much stricter than the
-- technical hard gate: only clear, objective, engaging, distinct categories are
-- promoted. Anything ambiguous stays in the Workbench for human review.
with editorial_clear_pass as (
  select queue.id
  from public.category_review_queue_v15 queue
  where queue.editorial_status in ('pending','needs_rewrite','needs_discussion')
    and queue.hard_gate_ready
    and coalesce(queue.objective_status,'uncertain') = 'objective'
    and coalesce(queue.immediate_comprehension_score, queue.understandability_score, 0) >= 90
    and coalesce(queue.gameplay_interest_score, queue.fun_score, 0) >= 86
    and coalesce(queue.uniqueness_score, 0) >= 85
    and coalesce(queue.quality_score, 0) >= 82
    and greatest(coalesce(queue.common_year_coverage,0), coalesce(queue.country_coverage,0)) >= 60
    and coalesce(queue.content_review_status,'pending') <> 'excluded'
    and coalesce(queue.player_quality_status,'caution') <> 'blocked'
    and coalesce(queue.evidence_label,'') <> 'Modeled estimate'
    and not queue.political_self_reported
    and not queue.subjective_or_composite
    and not queue.confusing
    and not queue.esoteric
    and not queue.stale_data
    and not queue.poor_coverage
    and queue.duplicate_of is null
    and queue.source_organization in (
      'World Bank','FAOSTAT','WHO','UNESCO UIS','ILOSTAT',
      'Natural Earth','UN Comtrade','U.S. EIA','UNHCR'
    )
    and lower(queue.effective_title) !~
      '(happiness|life satisfaction|democracy|freedom index|corruption|government effectiveness|political stability|governance index|perception|labor.income share|output per worker|employment.to.population|modeled .*completion|out.of.school|internet users|internet use|composite index)'
    and not (
      queue.source_organization = 'FAOSTAT'
      and lower(queue.effective_title) ~ '(primary|total|other |nes$|harvested area)'
    )
)
update public.category_review_state review
set status = 'approved',
    reviewed_at = coalesce(review.reviewed_at, now()),
    notes = concat_ws(
      E'\n',
      nullif(review.notes,''),
      'v15.3 clear-pass approval: official objective source, strong coverage and quality, high comprehension/interest/uniqueness scores, and no permanent exclusion flags. Runtime tie-density and board-composition checks still apply.'
    ),
    updated_at = now()
from editorial_clear_pass approved
where approved.id = review.category_id;

-- Keep legacy mirrors synchronized with the authoritative v15 review state.
select * from public.reconcile_category_playability_v15();

-- Audit outputs: exact decisions and remaining blockers.
select
  source_organization,
  count(*) filter (where computed_playable_v15) as playable,
  count(*) filter (where editorial_status='approved') as approved,
  count(*) filter (where editorial_status in ('pending','needs_rewrite','needs_discussion')) as awaiting_review,
  count(*) filter (where hard_gate_ready) as integrity_ready
from public.category_review_queue_v15
group by source_organization
order by playable desc, source_organization;

select
  id,
  effective_title,
  source_organization,
  editorial_status,
  hard_gate_ready,
  computed_playable_v15,
  v15_blockers,
  v15_warnings
from public.category_review_queue_v15
where editorial_status='approved'
  and not computed_playable_v15
order by source_organization, effective_title;

commit;
