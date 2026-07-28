-- GeoStats v15.2 catalog recovery
-- Run after RUN_THIS_IN_SUPABASE_FOR_V15.sql and RUN_THIS_IN_SUPABASE_FOR_V15_1.sql.
--
-- Goals:
--   1. Keep direct value, country-set, duplicate, ranking, coverage, freshness,
--      credibility, and editorial failures as hard blockers.
--   2. Treat source-link precision and metadata/API verification warnings as
--      transparency issues, not reasons to remove otherwise good categories.
--   3. Recover only mechanically inherited v15 rejections. Deliberate legacy
--      curation/content exclusions remain rejected.
--
-- Safe to rerun.

begin;

create table if not exists public.v15_2_review_state_backup (
  category_id text primary key,
  review_state jsonb not null,
  captured_at timestamptz not null default now()
);

insert into public.v15_2_review_state_backup (category_id, review_state)
select category_id, to_jsonb(review)
from public.category_review_state review
on conflict (category_id) do nothing;

-- Give official sources a safe human-readable fallback where possible. Exact
-- deep links are still preferred, but the absence of one no longer blocks play.
update public.stat_categories category
set player_source_url = coalesce(
      case
        when public.player_source_url_is_safe(category.player_source_url)
          then category.player_source_url
      end,
      case
        when public.player_source_url_is_safe(category.source_page_url)
          then category.source_page_url
      end,
      case
        when public.player_source_url_is_safe(category.source_url)
          then category.source_url
      end,
      case
        when public.player_source_url_is_safe(category.methodology_url)
          then category.methodology_url
      end,
      public.general_official_source_page_v15(category.source_organization)
    ),
    player_source_status = case
      when category.player_source_status = 'exact'
        and public.player_source_url_is_safe(category.player_source_url)
        then 'exact'
      when coalesce(
        case when public.player_source_url_is_safe(category.player_source_url) then category.player_source_url end,
        case when public.player_source_url_is_safe(category.source_page_url) then category.source_page_url end,
        case when public.player_source_url_is_safe(category.source_url) then category.source_url end,
        case when public.player_source_url_is_safe(category.methodology_url) then category.methodology_url end,
        public.general_official_source_page_v15(category.source_organization)
      ) is not null then 'general'
      else category.player_source_status
    end,
    player_source_reason = case
      when category.player_source_status = 'exact'
        and public.player_source_url_is_safe(category.player_source_url)
        then coalesce(category.player_source_reason, 'Exact audited human-readable data page.')
      when public.general_official_source_page_v15(category.source_organization) is not null
        then 'General human-readable official data portal; exact-link precision is tracked separately from playability.'
      else category.player_source_reason
    end,
    player_source_checked_at = now(),
    link_quality_score = case
      when category.player_source_status = 'exact'
        and public.player_source_url_is_safe(category.player_source_url)
        then greatest(coalesce(category.link_quality_score, 100), 90)
      when public.general_official_source_page_v15(category.source_organization) is not null
        then greatest(coalesce(category.link_quality_score, 0), 70)
      else category.link_quality_score
    end,
    updated_at = now()
where public.category_v15_source_is_official(category.source_organization)
  and (
    category.player_source_status not in ('exact', 'general')
    or not public.player_source_url_is_safe(category.player_source_url)
  );

-- v15.0 treated any legacy "blocked" field as an editorial rejection. Restore
-- only rows for which the pre-v15 backup shows no deliberate curation or content
-- exclusion. Explicit catalog/content exclusions and permanent v15 flags remain.
with recoverable as (
  select
    review.category_id,
    case
      when backup.review_status = 'approved'
        or backup.curation_status = 'approved'
        or backup.content_review_status = 'approved'
        then 'approved'
      else 'pending'
    end as recovered_status
  from public.category_review_state review
  join public.v15_category_state_backup backup
    on backup.category_id = review.category_id
  where review.status = 'rejected'
    and not review.political_self_reported
    and not review.confusing
    and not review.esoteric
    and not review.subjective_or_composite
    and not review.stale_data
    and not review.poor_coverage
    and review.duplicate_of is null
    and coalesce(backup.curation_status, '') <> 'excluded'
    and coalesce(backup.content_review_status, '') <> 'excluded'
)
update public.category_review_state review
set status = recoverable.recovered_status,
    reviewed_at = case
      when recoverable.recovered_status = 'approved'
        then coalesce(review.reviewed_at, now())
      else null
    end,
    reviewed_by = case
      when recoverable.recovered_status = 'approved'
        then review.reviewed_by
      else null
    end,
    notes = concat_ws(
      E'\n',
      nullif(review.notes, ''),
      'v15.2 recovered a mechanically inherited rejection; deliberate legacy curation/content exclusions were preserved.'
    ),
    updated_at = now()
from recoverable
where recoverable.category_id = review.category_id;

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
  coalesce(
    nullif(review.semantic_group,''),
    nullif(category.semantic_family,''),
    nullif(category.concept_group,''),
    category.family
  ) as effective_semantic_group,
  (
    category.player_source_status in ('exact','general')
    and public.player_source_url_is_safe(category.player_source_url)
  ) as source_link_ready,
  (
    public.category_v15_source_is_official(category.source_organization)
    and not public.category_v15_true_integrity_failure(
      category.validation_status,
      category.validation_reason,
      category.validation_mismatch_count,
      category.validation_ranking_mismatch_count
    )
    and coalesce(category.quality_score, 0) >= 70
    and coalesce(category.credibility_status, 'approved') <> 'quarantined'
    and coalesce(category.credibility_score, 75) >= 75
    and greatest(
      coalesce(category.common_year_coverage,0),
      coalesce(category.country_coverage,0)
    ) >= 30
    and coalesce(
      category.common_year,
      category.latest_available_year,
      0
    ) >= greatest(category.minimum_year, 2022)
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
    and not public.category_v15_true_integrity_failure(
      category.validation_status,
      category.validation_reason,
      category.validation_mismatch_count,
      category.validation_ranking_mismatch_count
    )
    and coalesce(category.quality_score, 0) >= 70
    and coalesce(category.credibility_status, 'approved') <> 'quarantined'
    and coalesce(category.credibility_score, 75) >= 75
    and greatest(
      coalesce(category.common_year_coverage,0),
      coalesce(category.country_coverage,0)
    ) >= 30
    and coalesce(
      category.common_year,
      category.latest_available_year,
      0
    ) >= greatest(category.minimum_year, 2022)
  ) as computed_playable_v15,
  array_remove(array[
    case when not public.category_v15_source_is_official(category.source_organization)
      then 'Source is not on the official-source allowlist.' end,
    case when public.category_v15_true_integrity_failure(
      category.validation_status,
      category.validation_reason,
      category.validation_mismatch_count,
      category.validation_ranking_mismatch_count
    ) then 'A direct value, country-set, duplicate, or ranking integrity failure was found.' end,
    case when coalesce(category.quality_score,0) < 70
      then 'Quality score is below 70.' end,
    case when category.credibility_status = 'quarantined'
      or coalesce(category.credibility_score,75) < 75
      then 'Credibility review did not pass.' end,
    case when greatest(
      coalesce(category.common_year_coverage,0),
      coalesce(category.country_coverage,0)
    ) < 30 then 'Fewer than 30 countries have comparable data.' end,
    case when coalesce(
      category.common_year,
      category.latest_available_year,
      0
    ) < greatest(category.minimum_year,2022)
      then 'Comparable data are too old.' end,
    case when review.status <> 'approved'
      then 'Editorial decision is not approved.' end,
    case when review.political_self_reported
      then 'Flagged as politically vulnerable or self-reported.' end,
    case when review.subjective_or_composite
      then 'Flagged as subjective, perception-based, or composite.' end,
    case when review.confusing
      then 'Flagged as difficult to understand.' end,
    case when review.esoteric
      then 'Flagged as too esoteric for gameplay.' end,
    case when review.stale_data
      then 'Flagged as stale.' end,
    case when review.poor_coverage
      then 'Flagged for poor coverage.' end,
    case when review.duplicate_of is not null
      then 'Marked as a duplicate.' end
  ], null) as v15_blockers,
  array_remove(array[
    case when category.validation_status is distinct from 'verified'
      and not public.category_v15_true_integrity_failure(
        category.validation_status,
        category.validation_reason,
        category.validation_mismatch_count,
        category.validation_ranking_mismatch_count
      )
      then 'Official-source verification is pending or produced a non-blocking metadata/API warning.' end,
    case when category.player_source_status not in ('exact','general')
      or not public.player_source_url_is_safe(category.player_source_url)
      then 'No safe human-readable official source page is currently available; this does not block play.' end
  ], null) as v15_warnings
from public.stat_categories category
join public.category_review_state review
  on review.category_id = category.id;

revoke all on public.category_review_queue_v15 from public, anon, authenticated;
grant select on public.category_review_queue_v15 to service_role;

create or replace function public.reconcile_category_playability_v15()
returns table(
  playable integer,
  blocked integer,
  editorial_approved integer,
  integrity_ready integer
)
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.stat_categories category
  set title = case
        when queue.computed_playable_v15
          and nullif(queue.recommended_title,'') is not null
          then queue.recommended_title
        else category.title
      end,
      short_title = case
        when queue.computed_playable_v15
          and nullif(queue.recommended_title,'') is not null
          then left(queue.recommended_title,70)
        else category.short_title
      end,
      semantic_family = coalesce(
        nullif(queue.semantic_group,''),
        category.semantic_family
      ),
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
      curation_reason = 'GeoStats v15 authoritative category review state: '
        || queue.editorial_status || '.',
      curation_version = 'geostats-v15.2-review-v3',
      content_review_status = case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'excluded'
        else 'pending'
      end,
      content_review_reason = 'GeoStats v15 authoritative category review state: '
        || queue.editorial_status || '.',
      content_review_version = 'geostats-v15.2-review-v3',
      player_quality_status = case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'blocked'
        else 'caution'
      end,
      player_quality_reason = 'GeoStats v15 authoritative category review state: '
        || queue.editorial_status || '.',
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
      or (
        queue.computed_playable_v15
        and nullif(queue.recommended_title,'') is not null
        and category.title is distinct from queue.recommended_title
      )
      or (
        nullif(queue.semantic_group,'') is not null
        and category.semantic_family is distinct from queue.semantic_group
      )
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

revoke all on function public.reconcile_category_playability_v15()
  from public, anon, authenticated;
grant execute on function public.reconcile_category_playability_v15()
  to service_role;

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
  count(*) filter (where source_link_ready)::bigint as source_link_ready,
  count(*) filter (where cardinality(v15_warnings) > 0)::bigint as warning_only,
  count(*) filter (where political_self_reported)::bigint as political_self_reported,
  count(*) filter (where confusing or esoteric)::bigint as confusing_or_esoteric,
  count(*) filter (where subjective_or_composite)::bigint as subjective_or_composite
from public.category_review_queue_v15;

revoke all on public.category_review_overview_v15
  from public, anon, authenticated;
grant select on public.category_review_overview_v15 to service_role;

select * from public.reconcile_category_playability_v15();

-- Useful verification result: the final playable catalog by source.
select
  source_organization,
  count(*) filter (where computed_playable_v15) as playable,
  count(*) filter (where editorial_status = 'approved') as approved,
  count(*) filter (where hard_gate_ready) as integrity_ready,
  count(*) filter (where cardinality(v15_warnings) > 0) as warning_only
from public.category_review_queue_v15
group by source_organization
order by playable desc, source_organization;

commit;
