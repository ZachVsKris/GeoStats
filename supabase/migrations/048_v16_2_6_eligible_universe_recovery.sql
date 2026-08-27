-- GeoStats v16.2.6 expansion recovery: legitimate eligible-universe metadata,
-- subset-completeness gating, and generator support. Additive/rerunnable.
begin;
select pg_advisory_xact_lock(hashtext('geostats-v16.2.6-eligible-universe'));

alter table public.stat_categories
  add column if not exists eligible_universe_type text not null default 'universal',
  add column if not exists eligible_universe_rule text,
  add column if not exists eligible_country_count integer not null default 195,
  add column if not exists eligible_country_iso3 text[],
  add column if not exists coverage_within_eligible_universe integer,
  add column if not exists excluded_country_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='stat_categories_eligible_universe_type_v16_2_6_check'
      and conrelid='public.stat_categories'::regclass
  ) then
    alter table public.stat_categories add constraint stat_categories_eligible_universe_type_v16_2_6_check
      check(eligible_universe_type in ('universal','defined_subset'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname='stat_categories_eligible_country_count_v16_2_6_check'
      and conrelid='public.stat_categories'::regclass
  ) then
    alter table public.stat_categories add constraint stat_categories_eligible_country_count_v16_2_6_check
      check(eligible_country_count between 1 and 195);
  end if;
end $$;

update public.stat_categories
set eligible_universe_rule=coalesce(nullif(eligible_universe_rule,''),'GeoStats canonical current-country universe'),
    coverage_within_eligible_universe=coalesce(coverage_within_eligible_universe,common_year_coverage,country_coverage)
where eligible_universe_type='universal';

-- PostgreSQL expands SELECT * when a view is created; columns added later to
-- stat_categories do not automatically appear in existing runtime views. Rebuild
-- the v16.2 runtime view here and append the eligible-universe fields explicitly.
create or replace view public.category_runtime_review_v16_2
with(security_invoker=true) as
select
  v.*,
  a.proposed_status as promotion_decision_v16_2,
  a.reason as promotion_reason_v16_2,
  a.primary_blocker as primary_blocker_v16_2,
  a.blocker_class as blocker_class_v16_2,
  a.strict_pass as strict_pass_v16_2,
  a.source_quality_floor as source_quality_floor_v16_2,
  a.suggested_duplicate_of as suggested_duplicate_of_v16_2,
  (
    a.proposed_status='playable'
    and v.editorial_status='approved'
    and a.strict_pass
    and public.category_v16_2_6_hard_block_reason(c.id,c.source_organization,c.source_indicator_code,v.effective_title,c.metadata) is null
  ) as computed_playable_v16_2,
  array_remove(array[
    case when a.proposed_status<>'playable' then a.primary_blocker end,
    public.category_v16_2_6_hard_block_reason(c.id,c.source_organization,c.source_indicator_code,v.effective_title,c.metadata)
  ],null) as v16_2_blockers,
  array_remove(array[
    case when v.validation_status<>'verified'
      and not public.category_v15_true_integrity_failure(
        v.validation_status,v.validation_reason,
        v.validation_mismatch_count,v.validation_ranking_mismatch_count
      ) then 'Official values are usable; non-data source metadata remain incomplete.' end,
    case when v.ranking_completeness_status='top_end_complete' then 'Ranking is top-end complete rather than fully comprehensive.' end,
    case when v.player_source_status='general' then 'Uses a general official source page rather than an exact shareable view.' end
  ],null) as v16_2_warnings,
  c.measurement_type,
  c.eligible_universe_type,
  c.eligible_universe_rule,
  c.eligible_country_count,
  c.eligible_country_iso3,
  c.coverage_within_eligible_universe,
  c.excluded_country_reason
from public.category_runtime_review_v16 v
join public.category_promotion_assessment_v16_2 a on a.category_id=v.id
join public.stat_categories c on c.id=v.id;
revoke all on public.category_runtime_review_v16_2 from public,anon,authenticated;
grant select on public.category_runtime_review_v16_2 to service_role;

drop view if exists public.category_review_workbench_v16_2;
create view public.category_review_workbench_v16_2
with(security_invoker=true) as
select runtime.*,
 vetting.recommendation as auto_vetting_recommendation,
 vetting.vetting_score as auto_vetting_score,
 vetting.reason as auto_vetting_reason,
 vetting.possible_duplicate_of as auto_possible_duplicate_of,
 vetting.title_similarity as auto_title_similarity,
 vetting.rank_correlation as auto_rank_correlation,
 vetting.tie_share as auto_tie_share,
 vetting.vetting_version as auto_vetting_version,
 vetting.vetted_at as auto_vetted_at
from public.category_runtime_review_v16_2 runtime
left join public.category_auto_vetting_v15_9 vetting on vetting.category_id=runtime.id;
revoke all on public.category_review_workbench_v16_2 from public,anon,authenticated;
grant select on public.category_review_workbench_v16_2 to service_role;

create or replace function public.refresh_category_promotion_assessment_v16_2()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  delete from public.category_promotion_assessment_v16_2 where category_id is not null;

  insert into public.category_promotion_assessment_v16_2(
    category_id,current_editorial_status,proposed_status,blocker_class,
    primary_blocker,reason,strict_pass,source_quality_floor,suggested_duplicate_of,assessed_at
  )
  with base as (
    select
      v.*,
      c.eligible_universe_type,
      c.eligible_universe_rule,
      c.eligible_country_count,
      c.eligible_country_iso3,
      c.coverage_within_eligible_universe,
      c.excluded_country_reason,
      public.category_v16_2_quality_floor(v.source_organization) as source_floor,
      public.category_v15_true_integrity_failure(
        v.validation_status,v.validation_reason,
        v.validation_mismatch_count,v.validation_ranking_mismatch_count
      ) as true_integrity_failure,
      public.category_v16_2_copy_is_clear(
        v.effective_title,coalesce(v.plain_language_description,v.description),
        v.unit,v.source_indicator_code
      ) as copy_clear,
      case
        when nullif(trim(coalesce(v.source_indicator_code,'')),'') is not null then
          'series|'||lower(coalesce(v.source_organization,''))||'|'||lower(v.source_indicator_code)||'|'||coalesce(v.ranking_direction,'high')
        else
          'title|'||regexp_replace(lower(coalesce(v.effective_title,'')),'[^a-z0-9]+','','g')||'|'||lower(coalesce(v.unit,''))||'|'||coalesce(v.ranking_direction,'high')
      end as exact_duplicate_key,
      (
        v.semantic_audit_status='pass'
        and v.ranking_completeness_status in ('comprehensive','top_end_complete')
        and coalesce(v.top_value_feasible,false)
        and not public.category_v15_true_integrity_failure(
          v.validation_status,v.validation_reason,
          v.validation_mismatch_count,v.validation_ranking_mismatch_count
        )
        and (
          v.validation_status='verified'
          or (
            v.validation_status='unable_to_verify'
            and coalesce(v.validation_reason,'') ilike 'Non-blocking audit warning:%'
          )
        )
        and coalesce(v.quality_score,0)>=public.category_v16_2_quality_floor(v.source_organization)
        and coalesce(v.credibility_status,'approved')<>'quarantined'
        and coalesce(v.credibility_score,75)>=70
        and (
          case when coalesce(c.eligible_universe_type,'universal')='defined_subset' then
            coalesce(c.eligible_country_count,0)>=12
            and (
              coalesce(c.eligible_country_count,0)>=16
              or coalesce(v.metadata->>'eligibleUniverseExceptionApproved','false')='true'
            )
            and greatest(coalesce(v.common_year_coverage,0),coalesce(v.country_coverage,0))>=coalesce(c.eligible_country_count,0)
            and (
              c.eligible_country_iso3 is null
              or cardinality(c.eligible_country_iso3)=c.eligible_country_count
            )
          else greatest(coalesce(v.common_year_coverage,0),coalesce(v.country_coverage,0))>=30
          end
        )
        and not coalesce(v.stale_data,false)
        and v.player_source_status in ('exact','general')
        and public.player_source_url_is_safe(v.player_source_url)
        and coalesce(v.objective_status,'objective')='objective'
        and coalesce(v.player_quality_status,'approved')<>'blocked'
        and coalesce(v.content_review_status,'pending')<>'excluded'
        and coalesce(v.curation_status,'pending')<>'excluded'
        and (
          v.content_review_status='approved'
          or (
            coalesce(v.immediate_comprehension_score,0)>=85
            and coalesce(v.gameplay_interest_score,0)>=70
            and coalesce(v.uniqueness_score,0)>=65
          )
        )
        and public.category_v16_2_copy_is_clear(
          v.effective_title,coalesce(v.plain_language_description,v.description),
          v.unit,v.source_indicator_code
        )
        and not coalesce(v.political_self_reported,false)
        and not coalesce(v.confusing,false)
        and not coalesce(v.esoteric,false)
        and not coalesce(v.subjective_or_composite,false)
        and not coalesce(v.poor_coverage,false)
        and v.duplicate_of is null
        and lower(v.source_organization) not in ('unesco uis','u.s. eia')
        and lower(coalesce(v.effective_title,'')) !~ '(yield|harvested area|carcass|slaughter|producing animals|output per worker|employment.?to.?population|labor.?income share)'
      ) as strict_pass
    from public.category_runtime_review_v16 v
    join public.stat_categories c on c.id=v.id
  ), ranked as (
    select b.*,
      count(*) over(partition by exact_duplicate_key) as exact_duplicate_count,
      first_value(id) over(
        partition by exact_duplicate_key
        order by
          case when editorial_status='approved' then 0 else 1 end,
          case when validation_status='verified' then 0 else 1 end,
          coalesce(quality_score,0) desc,
          id
      ) as preferred_exact_duplicate_id
    from base b
  ), assessed as (
    select r.*,case
      when exact_duplicate_count>1 and id<>preferred_exact_duplicate_id then preferred_exact_duplicate_id
      else null
    end as detected_duplicate_of
    from ranked r
  )
  select
    id,
    editorial_status,
    case
      when editorial_status='duplicate' or duplicate_of is not null or detected_duplicate_of is not null then 'duplicate'
      when editorial_status='rejected' then 'excluded'
      when semantic_audit_status='data_repair_required' or true_integrity_failure then 'data_repair_required'
      when semantic_audit_status='rewrite_required' or not copy_clear then 'rewrite_required'
      when strict_pass and editorial_status='approved' then 'playable'
      when strict_pass and editorial_status in ('pending','needs_rewrite') then 'auto_promote'
      else 'manual_review'
    end,
    case
      when editorial_status='duplicate' or duplicate_of is not null or detected_duplicate_of is not null then 'duplicate'
      when editorial_status='rejected' then 'editorial_exclusion'
      when semantic_audit_status='data_repair_required' or true_integrity_failure then 'substantive_data_failure'
      when semantic_audit_status='rewrite_required' or not copy_clear then 'copy_or_semantic_rewrite'
      when strict_pass and editorial_status in ('approved','pending','needs_rewrite') then 'strict_automatic_pass'
      when validation_status not in ('verified','unable_to_verify')
        or (validation_status='unable_to_verify' and coalesce(validation_reason,'') not ilike 'Non-blocking audit warning:%')
        then 'source_audit_pending'
      when semantic_audit_status<>'pass' then 'semantic_review'
      when ranking_completeness_status not in ('comprehensive','top_end_complete') or not coalesce(top_value_feasible,false) then 'ranking_completeness'
      when coalesce(quality_score,0)<source_floor then 'source_specific_quality'
      when content_review_status<>'approved' then 'editorial_content_review'
      else 'manual_editorial_review'
    end,
    case
      when detected_duplicate_of is not null then 'Exact duplicate of preferred category '||detected_duplicate_of||'.'
      when editorial_status='duplicate' or duplicate_of is not null then 'Marked as a duplicate of another category.'
      when editorial_status='rejected' then 'Deliberately excluded by editorial policy.'
      when semantic_audit_status='data_repair_required' then 'Semantic audit identified a substantive data repair.'
      when true_integrity_failure then coalesce(validation_reason,'Official-source values or rankings do not match the stored data.')
      when semantic_audit_status='rewrite_required' or not copy_clear then 'Player-facing title, description, or unit needs a clearer rewrite.'
      when strict_pass and editorial_status='approved' then null
      when strict_pass then null
      when validation_status not in ('verified','unable_to_verify') then 'Official-source value and ranking audit has not completed.'
      when validation_status='unable_to_verify' and coalesce(validation_reason,'') not ilike 'Non-blocking audit warning:%' then coalesce(validation_reason,'Official-source audit could not verify this category.')
      when semantic_audit_status<>'pass' then 'Semantic audit has not passed.'
      when ranking_completeness_status not in ('comprehensive','top_end_complete') then coalesce(ranking_completeness_reason,'Ranking completeness has not passed.')
      when not coalesce(top_value_feasible,false) then 'The meaningful top values are not distinct enough for a GeoStats board.'
      when coalesce(quality_score,0)<source_floor then 'Below the source-specific quality floor.'
      when coalesce(eligible_universe_type,'universal')='defined_subset' and coalesce(eligible_country_count,0)<12 then 'Defined subset has fewer than 12 eligible countries.'
      when coalesce(eligible_universe_type,'universal')='defined_subset' and coalesce(eligible_country_count,0)<16 and coalesce(metadata->>'eligibleUniverseExceptionApproved','false')<>'true' then 'A 12–15-country subset requires explicit board-feasibility/editorial exception approval.'
      when coalesce(eligible_universe_type,'universal')='defined_subset' and greatest(coalesce(common_year_coverage,0),coalesce(country_coverage,0))<coalesce(eligible_country_count,0) then 'The common-year snapshot is incomplete across the declared eligible universe.'
      when coalesce(eligible_universe_type,'universal')='defined_subset' and eligible_country_iso3 is not null and cardinality(eligible_country_iso3)<>eligible_country_count then 'Eligible-country list and declared universe size disagree.'
      when coalesce(eligible_universe_type,'universal')<>'defined_subset' and greatest(coalesce(common_year_coverage,0),coalesce(country_coverage,0))<30 then 'Fewer than 30 comparable country values are available.'
      when coalesce(objective_status,'objective')<>'objective' then 'The measure is not classified as objective.'
      when coalesce(player_quality_status,'approved')='blocked' then coalesce(player_quality_reason,'Player-quality review blocked the category.')
      when content_review_status<>'approved' then coalesce(content_review_reason,'Content review is not approved and automatic clarity scores are insufficient.')
      else 'Requires a human editorial decision.'
    end,
    case
      when detected_duplicate_of is not null then 'Keep blocked as an exact duplicate of preferred category '||detected_duplicate_of||'.'
      when editorial_status='duplicate' or duplicate_of is not null then 'Keep blocked as a duplicate of the preferred category.'
      when strict_pass and editorial_status='approved' then 'Already approved and passes the v16.2 source-specific, semantic, ranking, clarity, and board-feasibility gates.'
      when strict_pass then 'Auto-approve: objective official-source measure; semantic identity, bounds, rankings, coverage, clarity, and board feasibility all pass.'
      when semantic_audit_status='data_repair_required' or true_integrity_failure then 'Keep blocked until source values, dimensions, year, coverage, or rankings are repaired and re-audited.'
      when semantic_audit_status='rewrite_required' or not copy_clear then 'Keep blocked until player-facing copy accurately distinguishes totals, shares, rates, per-person measures, residence, and origin.'
      else 'Do not auto-approve; retain for focused manual review.'
    end,
    strict_pass and detected_duplicate_of is null,
    source_floor,
    detected_duplicate_of,
    now()
  from assessed;
end;
$$;
revoke all on function public.refresh_category_promotion_assessment_v16_2() from public,anon,authenticated;
grant execute on function public.refresh_category_promotion_assessment_v16_2() to service_role;


-- The runtime/workbench views were explicitly rebuilt above because PostgreSQL
-- freezes SELECT * at view-creation time. Recompute the dry-run assessment; no
-- category is auto-enabled here.
select public.refresh_category_promotion_assessment_v16_2();

commit;
