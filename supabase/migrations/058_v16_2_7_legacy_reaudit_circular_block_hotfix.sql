begin;

-- v16.2.7: an inherited generic rejection must not count as independent
-- evidence for keeping itself rejected. This remains deliberately narrow:
-- only non-durable legacy-generic exclusions can clear a player-quality block,
-- and only when that block merely repeats the historical v15 rejection while
-- every independent source, validation, clarity, interest, uniqueness,
-- objectivity, player-link, and hard-block gate passes.
create or replace function public.apply_v16_2_7_legacy_reaudit()
returns integer language plpgsql security definer set search_path=public as $$
declare reopened integer;
begin
  perform public.refresh_category_decision_provenance_v16_2_7();

  with candidates as (
    select c.id
    from public.stat_categories c
    join public.category_review_state r on r.category_id=c.id
    join public.category_decision_provenance_v16_2_7 p on p.category_id=c.id
    where p.decision_class='legacy_generic_exclusion' and not p.durable
      and public.category_macro_domain_v16_2_7(c.family,c.source_organization,c.title,c.metadata) in (
        'history','government-civics','culture-language-religion','sports','physical-geography',
        'geology-natural-hazards','climate-environment-resources','health-demographics',
        'education-labor-society','infrastructure-technology-science'
      )
      and c.validation_status='verified'
      and coalesce(c.validation_mismatch_count,0)=0
      and coalesce(c.validation_ranking_mismatch_count,0)=0
      and coalesce(c.quality_score,0)>=70
      and coalesce(c.immediate_comprehension_score,c.understandability_score,0)>=88
      and coalesce(c.gameplay_interest_score,c.fun_score,0)>=80
      and coalesce(c.uniqueness_score,c.specificity_score,0)>=75
      and coalesce(c.objective_status,'objective')='objective'
      and coalesce(c.credibility_status,'approved')<>'quarantined'
      and (
        coalesce(c.player_quality_status,'approved')<>'blocked'
        or (
          c.player_quality_status='blocked'
          and coalesce(c.player_quality_reason,'') ilike 'GeoStats v15 authoritative category review state: rejected.%'
        )
      )
      and c.player_source_status in ('exact','general')
      and public.player_source_url_is_safe(c.player_source_url)
      and public.category_v16_2_6_hard_block_reason(c.id,c.source_organization,c.source_indicator_code,c.title,c.metadata) is null
      and lower(c.title) !~ '(yield|harvested area|carcass|slaughter|producing animals)'
  ), reopened_rows as (
    update public.category_review_state r
    set status='approved',
        political_self_reported=false,confusing=false,esoteric=false,subjective_or_composite=false,
        stale_data=false,poor_coverage=false,duplicate_of=null,
        notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.7 first-principles re-audit: inherited generic rejection cleared by independent current source, player-quality and integrity evidence. A stale player-quality block that merely repeated the inherited rejection is not treated as independent evidence.'),
        reviewed_at=coalesce(r.reviewed_at,now()),updated_at=now()
    from candidates x
    where r.category_id=x.id
    returning r.category_id
  )
  select count(*)::integer into reopened from reopened_rows;

  update public.stat_categories c
  set review_status='approved',curation_status='approved',content_review_status='approved',
      curation_reason='v16.2.7 first-principles re-audit: inherited generic rejection cleared by strong current evidence.',
      content_review_reason='v16.2.7 current source integrity, clarity, interest, uniqueness and objective-status gates passed.',
      content_review_version='geostats-v16.2.7-first-principles-recovery-v2',
      player_quality_status=case
        when c.player_quality_status='blocked'
         and coalesce(c.player_quality_reason,'') ilike 'GeoStats v15 authoritative category review state: rejected.%'
        then 'approved'
        else c.player_quality_status
      end,
      player_quality_reason=case
        when c.player_quality_status='blocked'
         and coalesce(c.player_quality_reason,'') ilike 'GeoStats v15 authoritative category review state: rejected.%'
        then 'v16.2.7 first-principles re-audit: stale inherited rejection block cleared after independent source, clarity, interest, uniqueness and integrity gates passed.'
        else c.player_quality_reason
      end,
      updated_at=now()
  from public.category_review_state r
  join public.category_decision_provenance_v16_2_7 p on p.category_id=r.category_id
  where c.id=r.category_id and r.status='approved'
    and p.decision_class='legacy_generic_exclusion' and not p.durable;

  perform public.refresh_category_decision_provenance_v16_2_7();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  return reopened;
end;
$$;
revoke all on function public.apply_v16_2_7_legacy_reaudit() from public,anon,authenticated;
grant execute on function public.apply_v16_2_7_legacy_reaudit() to service_role;

select public.apply_v16_2_7_legacy_reaudit();

commit;
