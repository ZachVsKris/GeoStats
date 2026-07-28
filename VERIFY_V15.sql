-- GeoStats v15.0 verification. All queries are read-only.

-- 1. Overall review and playable counts.
select * from public.category_review_overview_v15;

-- 2. Breakdown by source.
select
  source_organization,
  count(*) as total,
  count(*) filter (where editorial_status='pending') as pending,
  count(*) filter (where editorial_status='approved') as approved,
  count(*) filter (where editorial_status='rejected') as rejected,
  count(*) filter (where hard_gate_ready) as integrity_ready,
  count(*) filter (where computed_playable_v15) as playable
from public.category_review_queue_v15
group by source_organization
order by total desc, source_organization;


-- 3. Source-link recovery by provider.
select
  source_organization,
  count(*) as total,
  count(*) filter (where player_source_status='exact' and public.player_source_url_is_safe(player_source_url)) as exact_links,
  count(*) filter (where player_source_status='general' and public.player_source_url_is_safe(player_source_url)) as general_links,
  count(*) filter (where not public.player_source_url_is_safe(player_source_url)) as missing_or_unsafe
from public.category_review_queue_v15
group by source_organization
order by total desc,source_organization;

-- 4. Permanent policy exclusions should be visible and not playable.
select id,effective_title,source_organization,editorial_status,
       political_self_reported,confusing,esoteric,subjective_or_composite,
       computed_playable_v15
from public.category_review_queue_v15
where political_self_reported or confusing or esoteric or subjective_or_composite
order by source_organization,effective_title;

-- 6. Must return zero rows: blocking flags escaped into play.
select id,effective_title,v15_blockers
from public.category_review_queue_v15
where computed_playable_v15
  and (
    editorial_status <> 'approved'
    or political_self_reported
    or confusing
    or esoteric
    or subjective_or_composite
    or stale_data
    or poor_coverage
    or duplicate_of is not null
  );

-- 6. Must return zero rows: runtime flags disagree with v15 policy.
select category.id,category.enabled,category.eligible_daily,queue.computed_playable_v15
from public.stat_categories category
join public.category_review_queue_v15 queue on queue.id=category.id
where category.enabled is distinct from queue.computed_playable_v15
   or category.eligible_daily is distinct from queue.computed_playable_v15;

-- 7. Review queue readiness: the first 100 strong pending candidates.
select id,effective_title,source_organization,source_indicator_code,
       quality_score,greatest(common_year_coverage,country_coverage) as coverage,
       coalesce(common_year,latest_available_year) as year,
       effective_semantic_group
from public.category_review_queue_v15
where editorial_status in ('pending','needs_discussion','needs_rewrite')
  and hard_gate_ready
order by quality_score desc nulls last,
         greatest(common_year_coverage,country_coverage) desc nulls last
limit 100;
