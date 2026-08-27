-- GeoStats v16.2.6 catalog regression recovery.
-- Fixes two regressions discovered after the full expansion import:
-- 1) migration 048 accidentally reintroduced a provider-wide UNESCO UIS / U.S. EIA
--    strict-pass ban that v16.2.5 had explicitly removed;
-- 2) the v16.1 semantic audit treated every percentage-like measure as mathematically
--    bounded to 0..100 and ignored explicit per-capita measurement metadata.
--
-- This migration DOES NOT auto-approve excluded/duplicate rows, relax official-source
-- validation, relax ranking-completeness, relax hard local-currency blocks, or bypass
-- player-quality/editorial gates. It only removes false automatic blockers.
begin;
select pg_advisory_xact_lock(hashtext('geostats-v16.2.6-catalog-regression-recovery'));

create or replace function public.refresh_category_semantic_audit_v16_1()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  delete from public.category_semantic_audit_v16_1 where category_id is not null;

  insert into public.category_semantic_audit_v16_1(
    category_id,audit_status,source_identity_status,title_unit_status,result_logic_status,
    issues,warnings,assessed_year,observation_count,distinct_value_count,minimum_value,
    maximum_value,top_values,bottom_values,audit_version,assessed_at
  )
  with base as (
    select q.id,q.title,q.effective_title,q.description,q.unit,q.value_type,q.measurement_type,
           q.ranking_direction,q.source_organization,q.source_indicator_code,
           q.editorial_status,q.validation_status,q.validation_reason,
           coalesce(q.validation_mismatch_count,0) as validation_mismatch_count,
           coalesce(q.validation_ranking_mismatch_count,0) as validation_ranking_mismatch_count,
           coalesce(q.common_year,q.latest_available_year)::smallint as assessed_year,
           lower(coalesce(q.unit,'')) as unit_lower,
           lower(coalesce(q.value_type,'')) as value_type_lower,
           lower(coalesce(q.measurement_type,'')) as measurement_type_lower,
           lower(coalesce(q.effective_title,q.title,'')) as title_lower
    from public.category_review_queue_v15 q
  ), selected as (
    select b.*,o.country_iso3,o.country_name,o.value,o.data_year
    from base b
    left join public.stat_observations o
      on o.category_id=b.id and o.data_year=b.assessed_year
  ), ranked as (
    select s.*,
      row_number() over(partition by s.id order by
        case when s.ranking_direction='high' then s.value end desc nulls last,
        case when s.ranking_direction='low' then s.value end asc nulls last,
        s.country_iso3) as top_rank,
      row_number() over(partition by s.id order by
        case when s.ranking_direction='high' then s.value end asc nulls last,
        case when s.ranking_direction='low' then s.value end desc nulls last,
        s.country_iso3) as bottom_rank
    from selected s
  ), metrics as (
    select b.id,b.title,b.effective_title,b.description,b.unit,b.value_type,b.measurement_type,
      b.ranking_direction,b.source_organization,b.source_indicator_code,b.editorial_status,
      b.validation_status,b.validation_reason,b.validation_mismatch_count,b.validation_ranking_mismatch_count,
      b.assessed_year,b.unit_lower,b.value_type_lower,b.measurement_type_lower,b.title_lower,
      count(r.value)::integer as observation_count,
      count(distinct r.value)::integer as distinct_value_count,
      min(r.value) as minimum_value,max(r.value) as maximum_value,
      coalesce(jsonb_agg(jsonb_build_object(
        'country',r.country_name,'iso3',r.country_iso3,'value',r.value,'year',r.data_year
      ) order by r.top_rank) filter(where r.top_rank<=12 and r.value is not null),'[]'::jsonb) as top_values,
      coalesce(jsonb_agg(jsonb_build_object(
        'country',r.country_name,'iso3',r.country_iso3,'value',r.value,'year',r.data_year
      ) order by r.bottom_rank) filter(where r.bottom_rank<=12 and r.value is not null),'[]'::jsonb) as bottom_values
    from base b left join ranked r on r.id=b.id
    group by b.id,b.title,b.effective_title,b.description,b.unit,b.value_type,b.measurement_type,
      b.ranking_direction,b.source_organization,b.source_indicator_code,b.editorial_status,
      b.validation_status,b.validation_reason,b.validation_mismatch_count,b.validation_ranking_mismatch_count,
      b.assessed_year,b.unit_lower,b.value_type_lower,b.measurement_type_lower,b.title_lower
  ), classified as (
    select m.*,
      (m.value_type_lower like '%percent%' or position('%' in m.unit_lower)>0 or m.unit_lower like '%percent%') as is_percentage,
      (m.unit_lower ~ '(people|persons|sites|animals|tonnes|tons|vehicles|applications|cases|hectares|kilometers|kilometres|square kilometers|square kilometres)') as is_nonnegative_count,
      replace(coalesce(m.source_indicator_code,''),'''','') as clean_code
    from metrics m
  ), findings as (
    select c.*,
      array_remove(array[
        case when c.assessed_year is null then 'No common comparison year is selected.' end,
        case when c.observation_count=0 then 'No observations exist for the selected comparison year.' end,
        case when coalesce(c.source_indicator_code,'')='' then 'Exact official indicator/item/element code is missing.' end,
        case when public.category_v15_true_integrity_failure(
          c.validation_status,c.validation_reason,c.validation_mismatch_count,c.validation_ranking_mismatch_count
        ) then 'Official-source validation found a substantive value, coverage, duplicate, or ranking mismatch.' end,
        case when c.source_indicator_code='PHE_HHAIR_POP_CLEAN_FUELS' then 'Wrong WHO sibling series: population in millions was labeled as a percentage.' end,
        case when c.title_lower like '%clean%cooking%' and c.source_organization='WHO'
                   and c.source_indicator_code<>'PHE_HHAIR_PROP_POP_CLEAN_FUELS'
          then 'Clean-cooking category is not mapped to the official proportion indicator.' end,
        case when c.is_nonnegative_count and c.minimum_value<0
          then format('A count/total category contains a negative value (%s).',c.minimum_value) end,
        case when c.title_lower ~ '^(highest|largest|most|fastest|best) ' and c.ranking_direction='low'
          then 'Title says highest/largest/most but ranking direction is lowest-wins.' end,
        case when c.title_lower ~ '^lowest ' and c.ranking_direction='high'
          then 'Title says lowest but ranking direction is highest-wins.' end,
        case when c.source_organization='FAOSTAT' and c.clean_code ~ ':(5312|5320|5412|5417)$'
                   and c.title_lower ~ '(produced|production|population)'
          then 'FAOSTAT title conflicts with a yield/area/carcass element code.' end,
        case when c.source_organization='FAOSTAT' and c.clean_code ~ ':(5510|5513)$'
                   and c.title_lower ~ '(yield|harvested area|per hectare)'
          then 'FAOSTAT production element is labeled as yield or area.' end,
        case when c.title_lower like '%per person%'
                   and c.measurement_type_lower not in ('per_capita','per capita','per-person','per person')
                   and c.value_type_lower not in ('per_capita','per capita','per-person','per person')
                   and c.unit_lower not like '%per person%'
                   and c.unit_lower not like '%capita%'
                   and lower(c.clean_code) !~ '(\.pc(\.|$)|pcap|per.?capita)'
          then 'Per-person title does not match the stored measurement semantics.' end
      ],null)::text[] as critical_issues,
      array_remove(array[
        case when c.is_percentage and c.title_lower !~ '(share|percentage|percent|rate|prevalence|probability|growth|inflation|change)'
          then 'Percentage/rate semantics are not explicit in the player-facing title.' end,
        case when c.is_percentage and (c.minimum_value<0 or c.maximum_value>100)
          then format('Percentage/rate values fall outside 0-100 (min %s, max %s); valid for growth rates, ratios, and percent-of-GDP measures, so verify source semantics rather than auto-block.',c.minimum_value,c.maximum_value) end,
        case when c.is_percentage and c.observation_count>=30 and c.maximum_value between 0 and 1
          then 'All percentage values are at or below 1; verify that fractions were not mislabeled as percentage points.' end,
        case when c.source_organization='FAOSTAT Food Balances' and c.title_lower !~ '(estimated).*(consumption|intake)'
          then 'Food Balance title should describe estimated consumption/intake.' end,
        case when c.title_lower in ('most forest','highest terrestrial and marine protected areas','most stateless people')
          then 'Player-facing title is ambiguous about total/share/residence.' end,
        case when c.source_organization='UN Comtrade' and c.title_lower like '%spice exports%' and c.observation_count>0
          then 'Verify the icon represents the broad spice group rather than peppers alone.' end,
        case when c.distinct_value_count<10 and c.observation_count>=30
          then 'Fewer than ten distinct values exist in the selected-year results.' end
      ],null)::text[] as audit_warnings
    from classified c
  )
  select id,
    case
      when editorial_status in ('rejected','duplicate') then 'excluded'
      when cardinality(critical_issues)>0 then 'data_repair_required'
      when cardinality(audit_warnings)>0 and (
        title_lower in ('most forest','highest terrestrial and marine protected areas','most stateless people')
        or (is_percentage and title_lower ~ '^(highest|largest|most) ' and title_lower !~ '(share|percentage|percent|rate|prevalence|probability|growth|inflation|change)')
        or (source_organization='FAOSTAT Food Balances' and title_lower !~ '(estimated).*(consumption|intake)')
      ) then 'rewrite_required'
      when coalesce(source_indicator_code,'')='' then 'review_required'
      when is_percentage and observation_count>=30 and maximum_value between 0 and 1 then 'review_required'
      else 'pass'
    end,
    case
      when source_indicator_code='PHE_HHAIR_POP_CLEAN_FUELS' then 'mismatch'
      when public.category_v15_true_integrity_failure(
        validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count
      ) then 'mismatch'
      when coalesce(source_indicator_code,'')='' then 'incomplete'
      else 'identified'
    end,
    case
      when cardinality(audit_warnings)>0 then 'warning'
      else 'aligned'
    end,
    case
      when cardinality(critical_issues)>0 then 'blocked'
      when observation_count=0 then 'blocked'
      else 'plausibility_screen_passed'
    end,
    critical_issues,audit_warnings,assessed_year,observation_count,distinct_value_count,
    minimum_value,maximum_value,top_values,bottom_values,
    'geostats-v16.2.6-semantic-audit-v2',now()
  from findings;
end;
$$;
revoke all on function public.refresh_category_semantic_audit_v16_1() from public,anon,authenticated;
grant execute on function public.refresh_category_semantic_audit_v16_1() to service_role;

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
        -- v16.2.6 recovery: do not ban an entire provider. v16.2.5 already
        -- removed the legacy UNESCO UIS / U.S. EIA blanket exclusion; 048
        -- accidentally reintroduced it. Row-level validation and editorial
        -- gates remain fully enforced below.
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

-- Recompute semantic/ranking/promotion state and the shared playable catalog using
-- the corrected functions. Existing hard blocks and editorial exclusions remain.
select public.refresh_v16_2_runtime_catalog();

commit;
