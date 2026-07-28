-- GeoStats v15.1 catalog recovery and audit-policy upgrade
-- Safe to run after v15.0. This does not mass-approve pending editorial categories.
begin;

create or replace function public.category_v15_true_integrity_failure(
  p_status text,
  p_reason text,
  p_value_mismatches integer,
  p_ranking_mismatches integer
)
returns boolean
language sql
immutable
as $$
  select coalesce(p_value_mismatches,0) > 0
      or coalesce(p_ranking_mismatches,0) > 0
      or (
        coalesce(p_status,'') = 'failed'
        and coalesce(p_reason,'') ~* '(value mismatch|ranking mismatch|unexpected stored countr|official countries missing|duplicate countr|snapshot unique)'
      )
$$;

create or replace view public.category_review_queue_v15
with (security_invoker=true)
as
select
  category.*,
  review.status as editorial_status,
  review.political_self_reported,
  review.confusing,
  review.esoteric,
  review.subjective_or_composite,
  review.stale_data,
  review.poor_coverage,
  review.duplicate_of,
  review.recommended_title,
  review.semantic_group,
  review.notes as editorial_notes,
  review.reviewed_by,
  review.reviewed_at,
  review.updated_at as editorial_updated_at,
  coalesce(nullif(review.recommended_title,''), category.title) as effective_title,
  coalesce(nullif(review.semantic_group,''), nullif(category.semantic_family,''), nullif(category.concept_group,''), category.family) as effective_semantic_group,
  (
    public.category_v15_source_is_official(category.source_organization)
    and not public.category_v15_true_integrity_failure(category.validation_status, category.validation_reason, category.validation_mismatch_count, category.validation_ranking_mismatch_count)
    and coalesce(category.quality_score, 0) >= 70
    and coalesce(category.credibility_status, 'approved') <> 'quarantined'
    and coalesce(category.credibility_score, 75) >= 75
    and greatest(coalesce(category.common_year_coverage,0), coalesce(category.country_coverage,0)) >= 30
    and coalesce(category.common_year, category.latest_available_year, 0) >= greatest(category.minimum_year, 2022)
    and category.player_source_status in ('exact','general')
    and public.player_source_url_is_safe(category.player_source_url)
  ) as hard_gate_ready,
  (
    review.status = 'approved'
    and not review.political_self_reported
    and not review.confusing
    and not review.esoteric
    and not review.subjective_or_composite
    and not review.stale_data
    and not review.poor_coverage
    and review.duplicate_of is null
  ) as editorial_ready,
  (
    review.status = 'approved'
    and not review.political_self_reported
    and not review.confusing
    and not review.esoteric
    and not review.subjective_or_composite
    and not review.stale_data
    and not review.poor_coverage
    and review.duplicate_of is null
    and public.category_v15_source_is_official(category.source_organization)
    and not public.category_v15_true_integrity_failure(category.validation_status, category.validation_reason, category.validation_mismatch_count, category.validation_ranking_mismatch_count)
    and coalesce(category.quality_score, 0) >= 70
    and coalesce(category.credibility_status, 'approved') <> 'quarantined'
    and coalesce(category.credibility_score, 75) >= 75
    and greatest(coalesce(category.common_year_coverage,0), coalesce(category.country_coverage,0)) >= 30
    and coalesce(category.common_year, category.latest_available_year, 0) >= greatest(category.minimum_year, 2022)
    and category.player_source_status in ('exact','general')
    and public.player_source_url_is_safe(category.player_source_url)
  ) as computed_playable_v15,
  array_remove(array[
    case when not public.category_v15_source_is_official(category.source_organization) then 'Source is not on the official-source allowlist.' end,
    case when public.category_v15_true_integrity_failure(category.validation_status, category.validation_reason, category.validation_mismatch_count, category.validation_ranking_mismatch_count) then 'A direct value, country-set, duplicate, or ranking integrity failure was found.' when category.validation_status is distinct from 'verified' then 'Official-source verification is pending or produced a non-blocking warning.' end,
    case when coalesce(category.quality_score,0) < 70 then 'Quality score is below 70.' end,
    case when category.credibility_status = 'quarantined' or coalesce(category.credibility_score,75) < 75 then 'Credibility review did not pass.' end,
    case when greatest(coalesce(category.common_year_coverage,0), coalesce(category.country_coverage,0)) < 30 then 'Fewer than 30 countries have comparable data.' end,
    case when coalesce(category.common_year,category.latest_available_year,0) < greatest(category.minimum_year,2022) then 'Comparable data are too old.' end,
    case when category.player_source_status not in ('exact','general') or not public.player_source_url_is_safe(category.player_source_url) then 'No safe human-readable official source page is available.' end,
    case when review.status <> 'approved' then 'Editorial decision is not approved.' end,
    case when review.political_self_reported then 'Flagged as politically vulnerable or self-reported.' end,
    case when review.subjective_or_composite then 'Flagged as subjective, perception-based, or composite.' end,
    case when review.confusing then 'Flagged as difficult to understand.' end,
    case when review.esoteric then 'Flagged as too esoteric for gameplay.' end,
    case when review.stale_data then 'Flagged as stale.' end,
    case when review.poor_coverage then 'Flagged for poor coverage.' end,
    case when review.duplicate_of is not null then 'Marked as a duplicate.' end
  ], null) as v15_blockers
from public.stat_categories category
join public.category_review_state review on review.category_id = category.id;

revoke all on public.category_review_queue_v15 from public, anon, authenticated;
grant select on public.category_review_queue_v15 to service_role;

create or replace function public.reconcile_category_playability_v15()
returns table(playable integer, blocked integer, editorial_approved integer, integrity_ready integer)
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.stat_categories category
  set title = case
        when queue.computed_playable_v15 and nullif(queue.recommended_title,'') is not null
          then queue.recommended_title
        else category.title
      end,
      short_title = case
        when queue.computed_playable_v15 and nullif(queue.recommended_title,'') is not null
          then left(queue.recommended_title,70)
        else category.short_title
      end,
      semantic_family = coalesce(nullif(queue.semantic_group,''), category.semantic_family),
      review_status = case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'rejected'
        else 'needs_review'
      end,
      curation_status = case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'excluded'
        else 'pending'
      end,
      curation_reason = 'GeoStats v15 authoritative category review state: ' || queue.editorial_status || '.',
      curation_version = 'geostats-v15.1-review-v2',
      content_review_status = case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'excluded'
        else 'pending'
      end,
      content_review_reason = 'GeoStats v15 authoritative category review state: ' || queue.editorial_status || '.',
      content_review_version = 'geostats-v15.1-review-v2',
      player_quality_status = case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'blocked'
        else 'caution'
      end,
      player_quality_reason = 'GeoStats v15 authoritative category review state: ' || queue.editorial_status || '.',
      enabled = queue.computed_playable_v15,
      eligible_daily = queue.computed_playable_v15,
      updated_at = now()
  from public.category_review_queue_v15 queue
  where queue.id = category.id
    and (
      category.enabled is distinct from queue.computed_playable_v15
      or category.eligible_daily is distinct from queue.computed_playable_v15
      or category.review_status is distinct from case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'rejected'
        else 'needs_review'
      end
      or category.curation_status is distinct from case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'excluded'
        else 'pending'
      end
      or category.content_review_status is distinct from case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'excluded'
        else 'pending'
      end
      or category.player_quality_status is distinct from case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'blocked'
        else 'caution'
      end
      or (queue.computed_playable_v15 and nullif(queue.recommended_title,'') is not null and category.title is distinct from queue.recommended_title)
      or (nullif(queue.semantic_group,'') is not null and category.semantic_family is distinct from queue.semantic_group)
    );

  return query
  select
    count(*) filter (where computed_playable_v15)::integer,
    count(*) filter (where not computed_playable_v15)::integer,
    count(*) filter (where editorial_status='approved')::integer,
    count(*) filter (where hard_gate_ready)::integer
  from public.category_review_queue_v15;
end;
$$;

revoke all on function public.reconcile_category_playability_v15() from public, anon, authenticated;
grant execute on function public.reconcile_category_playability_v15() to service_role;

create or replace view public.category_review_overview_v15
with (security_invoker=true)
as
select
  count(*)::bigint as categories,
  count(*) filter (where editorial_status='pending')::bigint as pending,
  count(*) filter (where editorial_status='approved')::bigint as approved,
  count(*) filter (where editorial_status='rejected')::bigint as rejected,
  count(*) filter (where editorial_status='duplicate')::bigint as duplicates,
  count(*) filter (where editorial_status='needs_rewrite')::bigint as needs_rewrite,
  count(*) filter (where editorial_status='needs_discussion')::bigint as needs_discussion,
  count(*) filter (where hard_gate_ready)::bigint as hard_gate_ready,
  count(*) filter (where computed_playable_v15)::bigint as playable,
  count(*) filter (where political_self_reported)::bigint as political_self_reported,
  count(*) filter (where confusing or esoteric)::bigint as confusing_or_esoteric,
  count(*) filter (where subjective_or_composite)::bigint as subjective_or_composite
from public.category_review_queue_v15;

revoke all on public.category_review_overview_v15 from public, anon, authenticated;
grant select on public.category_review_overview_v15 to service_role;

select * from public.reconcile_category_playability_v15();

commit;
