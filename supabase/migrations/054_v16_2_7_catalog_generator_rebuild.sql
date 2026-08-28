-- GeoStats v16.2.7: catalog governance + defined-subset chronology + balance/reachability release gates.
-- This migration is intentionally conservative about old rejects: only rows that can be
-- proven to be inherited generic exclusions AND independently pass strong current evidence
-- are reopened automatically. Explicit/manual removals and crop-yield/harvested-area
-- exclusions remain durable.
begin;
select pg_advisory_xact_lock(hashtext('geostats-v16.2.7-catalog-generator-rebuild'));

create table if not exists public.category_decision_provenance_v16_2_7 (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  decision_class text not null check(decision_class in (
    'approved_current','durable_manual_exclusion','duplicate_exclusion','current_editorial_exclusion',
    'legacy_generic_exclusion','pending_copy_rewrite','pending_source_repair','pending_editorial'
  )),
  durable boolean not null default false,
  origin text not null,
  reason text not null,
  decision_version text not null default 'geostats-v16.2.7-decision-provenance-v1',
  assessed_at timestamptz not null default now()
);
revoke all on public.category_decision_provenance_v16_2_7 from public,anon,authenticated;
grant all on public.category_decision_provenance_v16_2_7 to service_role;

create or replace function public.category_macro_domain_v16_2_7(
  p_family text,p_source text,p_title text,p_metadata jsonb default '{}'::jsonb
) returns text language sql immutable as $$
  select case
    when lower(coalesce(p_metadata->>'broadDomain',''))='sports' or lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(sport|world cup|fifa|olympic|paralympic|football|soccer)' then 'sports'
    when lower(coalesce(p_metadata->>'broadDomain',''))='history' or lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(history|historical|suffrage|independence|admitted to the un|constitution.*year|milestone)' then 'history'
    when lower(coalesce(p_family,'')) ~ '(government|politic|civic)' or lower(coalesce(p_title,'')) ~ '(government|parliament|election|constitution|politic|democracy)' then 'government-civics'
    when lower(coalesce(p_family,'')) ~ '(religion|culture|language|heritage)' or lower(coalesce(p_title,'')) ~ '(religion|christian|muslim|hindu|buddhist|jewish|language|heritage|culture)' then 'culture-language-religion'
    when lower(coalesce(p_family,'')) ~ '(geolog|hazard)' or lower(coalesce(p_title,'')) ~ '(volcano|earthquake|tsunami|seismic|tectonic)' then 'geology-natural-hazards'
    when lower(coalesce(p_family,'')) ~ '(geography|land|terrain)' or lower(coalesce(p_title,'')) ~ '(coast|river|lake|border|neighbor|glaciat|elevation|terrain|landlocked|arctic|tropical land)' then 'physical-geography'
    when lower(coalesce(p_family,'')) ~ '(climate|environment|energy|water|resource)' or lower(coalesce(p_title,'')) ~ '(climate|temperature|rain|precipitation|forest|emission|energy|water|protected)' then 'climate-environment-resources'
    when lower(coalesce(p_family,'')) ~ '(health|population|demograph|migration|displacement)' or lower(coalesce(p_title,'')) ~ '(life expectancy|mortality|fertility|population|refugee|asylum|migration|health)' then 'health-demographics'
    when lower(coalesce(p_family,'')) ~ '(education|labor|labour|society)' or lower(coalesce(p_title,'')) ~ '(school|education|literacy|labor|labour|employment)' then 'education-labor-society'
    when lower(coalesce(p_family,'')) ~ '(infrastructure|transport|technology|science)' or lower(coalesce(p_title,'')) ~ '(internet|technology|rail|road|transport|patent|research|telecom)' then 'infrastructure-technology-science'
    when lower(coalesce(p_family,'')) ~ '(trade)' or lower(coalesce(p_title,'')) ~ '(export|import|trade)' then 'trade'
    when lower(coalesce(p_family,'')) ~ '(agric|crop|fruit|vegetable|livestock|dairy|food)' or lower(coalesce(p_source,'')) like 'faostat%' then 'food-agriculture'
    else 'economy-finance'
  end
$$;

create or replace function public.refresh_category_decision_provenance_v16_2_7()
returns void language plpgsql security definer set search_path=public as $$
begin
  delete from public.category_decision_provenance_v16_2_7 where category_id is not null;
  insert into public.category_decision_provenance_v16_2_7(category_id,decision_class,durable,origin,reason,assessed_at)
  select c.id,
    case
      when r.status='duplicate' or r.duplicate_of is not null then 'duplicate_exclusion'
      when exists(select 1 from public.category_decisions_v16_2_6 d where d.source_indicator_code=c.source_indicator_code and d.action='remove')
        or lower(c.title) ~ '(yield|harvested area)' then 'durable_manual_exclusion'
      when r.status='rejected' and (
        coalesce(c.curation_reason,'') ilike 'v16.2.3: superseded%'
        or coalesce(c.curation_reason,'') ilike '%intentionally excluded because%'
        or coalesce(c.curation_reason,'') ilike 'Curated out:%'
        or coalesce(c.content_review_reason,'') ilike '%intentionally excluded because%'
      ) then 'current_editorial_exclusion'
      when r.status='rejected' then 'legacy_generic_exclusion'
      when r.status='needs_rewrite' or c.content_review_status='pending' and coalesce(c.curation_status,'pending')<>'approved' then 'pending_copy_rewrite'
      when c.validation_status in ('failed','pending','unable_to_verify') then 'pending_source_repair'
      when r.status='approved' then 'approved_current'
      else 'pending_editorial'
    end,
    case
      when r.status='duplicate' or r.duplicate_of is not null then true
      when exists(select 1 from public.category_decisions_v16_2_6 d where d.source_indicator_code=c.source_indicator_code and d.action='remove') then true
      when lower(c.title) ~ '(yield|harvested area)' then true
      when r.status='rejected' and (
        coalesce(c.curation_reason,'') ilike 'v16.2.3: superseded%'
        or coalesce(c.curation_reason,'') ilike '%intentionally excluded because%'
        or coalesce(c.curation_reason,'') ilike 'Curated out:%'
        or coalesce(c.content_review_reason,'') ilike '%intentionally excluded because%'
      ) then true
      else false
    end,
    case
      when exists(select 1 from public.category_decisions_v16_2_6 d where d.source_indicator_code=c.source_indicator_code and d.action='remove') then 'v16.2.6 explicit decision table'
      when lower(c.title) ~ '(yield|harvested area)' then 'durable product rule'
      when r.status='rejected' then 'historical editorial state'
      else 'current catalog state'
    end,
    case
      when exists(select 1 from public.category_decisions_v16_2_6 d where d.source_indicator_code=c.source_indicator_code and d.action='remove')
        then coalesce((select d.reason from public.category_decisions_v16_2_6 d where d.source_indicator_code=c.source_indicator_code and d.action='remove' limit 1),'Explicit removal.')
      when lower(c.title) ~ '(yield|harvested area)' then 'Deliberately preserve the GeoStats anti-proliferation exclusion for crop/commodity yield and harvested-area variants.'
      when r.status='rejected' and coalesce(c.content_review_reason,'') ilike '%authoritative category review state: rejected%'
        then 'Inherited generic rejection; re-audit from current source/player evidence rather than treating the old label as permanent.'
      else coalesce(nullif(c.curation_reason,''),nullif(c.content_review_reason,''),nullif(r.notes,''),'Current catalog state.')
    end,
    now()
  from public.stat_categories c
  join public.category_review_state r on r.category_id=c.id;
end;
$$;
revoke all on function public.refresh_category_decision_provenance_v16_2_7() from public,anon,authenticated;
grant execute on function public.refresh_category_decision_provenance_v16_2_7() to service_role;

-- First-principles recovery of only strong, underrepresented, inherited rejects.
-- This intentionally excludes economy/trade/agriculture and never overrides a durable decision.
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
      and coalesce(c.player_quality_status,'approved')<>'blocked'
      and c.player_source_status in ('exact','general')
      and public.player_source_url_is_safe(c.player_source_url)
      and public.category_v16_2_6_hard_block_reason(c.id,c.source_organization,c.source_indicator_code,c.title,c.metadata) is null
      and lower(c.title) !~ '(yield|harvested area|carcass|slaughter|producing animals)'
  )
  update public.category_review_state r
    set status='approved', confusing=false,esoteric=false,subjective_or_composite=false,stale_data=false,
        poor_coverage=false,duplicate_of=null,
        notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.7 first-principles re-audit: inherited generic rejection cleared by strong current source, player-quality and integrity evidence.'),
        reviewed_at=coalesce(r.reviewed_at,now()),updated_at=now()
  from candidates x where r.category_id=x.id;
  get diagnostics reopened = row_count;

  update public.stat_categories c
    set review_status='approved',curation_status='approved',content_review_status='approved',
        curation_reason='v16.2.7 first-principles re-audit: inherited generic rejection cleared by strong current evidence.',
        content_review_reason='v16.2.7 current source integrity, clarity, interest, uniqueness and objective-status gates passed.',
        content_review_version='geostats-v16.2.7-first-principles-recovery-v1',updated_at=now()
  from public.category_review_state r
  join public.category_decision_provenance_v16_2_7 p on p.category_id=r.category_id
  where c.id=r.category_id and r.status='approved' and p.decision_class='legacy_generic_exclusion' and not p.durable;

  perform public.refresh_category_decision_provenance_v16_2_7();
  return reopened;
end;
$$;
revoke all on function public.apply_v16_2_7_legacy_reaudit() from public,anon,authenticated;
grant execute on function public.apply_v16_2_7_legacy_reaudit() to service_role;

-- Exact player-facing duplicate titles should not be distinct playable concepts.
create or replace function public.apply_v16_2_7_exact_title_deduplication()
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  with ranked as (
    select c.id,
      first_value(c.id) over(partition by regexp_replace(lower(trim(c.title)),'[^a-z0-9]+','','g'),coalesce(q.ranking_direction,'high')
        order by coalesce(c.quality_score,0) desc,case when c.validation_status='verified' then 0 else 1 end,c.id) preferred,
      count(*) over(partition by regexp_replace(lower(trim(c.title)),'[^a-z0-9]+','','g'),coalesce(q.ranking_direction,'high')) n
    from public.stat_categories c
    join public.category_review_queue_v15 q on q.id=c.id
    join public.category_review_state r on r.category_id=c.id
    where r.status='approved' and coalesce(c.content_review_status,'pending')='approved'
  ), losers as (select id,preferred from ranked where n>1 and id<>preferred)
  update public.category_review_state r set status='duplicate',duplicate_of=l.preferred,
    notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.7: exact normalized player-facing title duplicate; preferred category '||l.preferred||'.'),updated_at=now()
  from losers l where r.category_id=l.id;
  get diagnostics changed = row_count;
  update public.stat_categories c set review_status='rejected',curation_status='excluded',content_review_status='excluded',
    curation_reason='v16.2.7 exact player-facing duplicate.',content_review_reason='v16.2.7 exact player-facing duplicate.',enabled=false,eligible_daily=false,updated_at=now()
  from public.category_review_state r where c.id=r.category_id and r.status='duplicate';
  return changed;
end;
$$;
revoke all on function public.apply_v16_2_7_exact_title_deduplication() from public,anon,authenticated;
grant execute on function public.apply_v16_2_7_exact_title_deduplication() to service_role;

-- Defined-subset categories are complete when every explicitly eligible country is present.
-- The rule is direction-agnostic: a legitimate subset chronology can safely be lowest-wins.
create or replace function public.refresh_category_ranking_completeness_v16()
returns void language plpgsql security definer set search_path=public set statement_timeout='180s' as $$
begin
  delete from public.category_ranking_completeness_v16 where category_id is not null;
  insert into public.category_ranking_completeness_v16(
    category_id,status,reason,observation_count,distinct_value_count,top_value_distinct_count,top_value_feasible,assessed_year,assessed_at
  )
  with selected_year as (
    select q.id,q.source_organization,q.ranking_direction,coalesce(q.common_year,q.latest_available_year)::smallint assessed_year,
      coalesce(c.eligible_universe_type,'universal') universe_type,coalesce(c.eligible_country_count,195) eligible_count,
      c.eligible_country_iso3
    from public.category_review_queue_v15 q join public.stat_categories c on c.id=q.id
  ), ranked as (
    select y.id,y.ranking_direction,o.value,row_number() over(partition by y.id order by
      case when y.ranking_direction='high' then o.value end desc nulls last,
      case when y.ranking_direction='low' then o.value end asc nulls last,o.country_iso3) ranking_position
    from selected_year y join public.stat_observations o on o.category_id=y.id and o.data_year=y.assessed_year
  ), metrics as (
    select y.*,count(r.value)::integer observation_count,count(distinct r.value)::integer distinct_value_count,
      count(distinct r.value) filter(where r.ranking_position<=20)::integer top_value_distinct_count
    from selected_year y left join ranked r on r.id=y.id
    group by y.id,y.source_organization,y.ranking_direction,y.assessed_year,y.universe_type,y.eligible_count,y.eligible_country_iso3
  )
  select id,
    case
      when assessed_year is null then 'non_comprehensive'
      when universe_type='defined_subset' and eligible_count>=12 and observation_count>=eligible_count
        and (eligible_country_iso3 is null or cardinality(eligible_country_iso3)=eligible_count) then 'comprehensive'
      when observation_count<30 then 'non_comprehensive'
      when observation_count>=185 then 'comprehensive'
      when ranking_direction='low' then 'non_comprehensive'
      when observation_count>=100 and top_value_distinct_count>=10 then 'top_end_complete'
      when source_organization in ('FAOSTAT','FAOSTAT Food Balances','Natural Earth','Pew Research Center','Smithsonian GVP','USGS','UN Comtrade','UNHCR','United Nations','Constitute Project','Inter-Parliamentary Union') and top_value_distinct_count>=10 then 'top_end_complete'
      else 'non_comprehensive' end,
    case
      when assessed_year is null then 'No common comparison year is available.'
      when universe_type='defined_subset' and eligible_count>=12 and observation_count>=eligible_count and (eligible_country_iso3 is null or cardinality(eligible_country_iso3)=eligible_count)
        then 'The common-year snapshot covers the complete explicitly defined eligible universe.'
      when observation_count<30 then 'Fewer than 30 countries have comparable observations.'
      when observation_count>=185 then 'The common-year ranking covers nearly the full supported country universe.'
      when ranking_direction='low' then 'Incomplete universal coverage cannot safely support a lowest-wins ranking; define and fully cover a legitimate eligible subset instead of assigning synthetic values.'
      when observation_count>=100 and top_value_distinct_count>=10 then 'The winning end is sufficiently covered and distinct for the universal category.'
      when source_organization in ('FAOSTAT','FAOSTAT Food Balances','Natural Earth','Pew Research Center','Smithsonian GVP','USGS','UN Comtrade','UNHCR','United Nations','Constitute Project','Inter-Parliamentary Union') and top_value_distinct_count>=10
        then 'The source is structurally sparse, but the meaningful winning end contains enough distinct ranked values.'
      else 'One or more omitted countries could plausibly alter the meaningful winning end.' end,
    observation_count,distinct_value_count,top_value_distinct_count,(top_value_distinct_count>=10),assessed_year,now()
  from metrics;
end;
$$;
revoke all on function public.refresh_category_ranking_completeness_v16() from public,anon,authenticated;
grant execute on function public.refresh_category_ranking_completeness_v16() to service_role;

create table if not exists public.generator_reachability_v16_2_7 (
  category_id text not null references public.stat_categories(id) on delete cascade,
  difficulty text not null check(difficulty in ('easy','normal','expert')),
  reachable boolean not null,
  failure_stage text,
  detail text,
  audit_version text not null default 'geostats-v16.2.7-production-solver-v1',
  checked_at timestamptz not null default now(),
  primary key(category_id,difficulty)
);
revoke all on public.generator_reachability_v16_2_7 from public,anon,authenticated;
grant all on public.generator_reachability_v16_2_7 to service_role;

create or replace view public.catalog_macro_domain_summary_v16_2_7 with(security_invoker=true) as
select public.category_macro_domain_v16_2_7(c.family,c.source_organization,c.title,c.metadata) macro_domain,
  count(*)::integer categories,
  count(*) filter(where v.computed_playable_v16_2)::integer playable,
  count(*) filter(where v.editorial_status='approved')::integer approved,
  count(*) filter(where v.editorial_status in ('pending','needs_rewrite','needs_discussion'))::integer pending,
  count(*) filter(where v.editorial_status in ('rejected','duplicate'))::integer excluded
from public.stat_categories c join public.category_runtime_review_v16_2 v on v.id=c.id
group by 1 order by 2 desc;
revoke all on public.catalog_macro_domain_summary_v16_2_7 from public,anon,authenticated;
grant select on public.catalog_macro_domain_summary_v16_2_7 to service_role;

create or replace view public.generator_reachability_summary_v16_2_7 with(security_invoker=true) as
select count(distinct v.id) filter(where v.computed_playable_v16_2)::integer playable,
  count(distinct r.category_id) filter(where r.reachable)::integer categories_with_reachability_proof,
  count(*) filter(where not r.reachable)::integer failed_difficulty_checks,
  max(r.checked_at) last_checked_at
from public.category_runtime_review_v16_2 v left join public.generator_reachability_v16_2_7 r on r.category_id=v.id;
revoke all on public.generator_reachability_summary_v16_2_7 from public,anon,authenticated;
grant select on public.generator_reachability_summary_v16_2_7 to service_role;

-- Runtime refresh applies current curation and recomputes strict-pass status, but
-- it must never publish a newly recovered/imported category before v16.2.7
-- production-solver proof exists. Existing live categories may remain live while
-- they are still strict-pass; rows that cease to pass are disabled immediately.
create or replace function public.refresh_v16_2_runtime_catalog()
returns void language plpgsql security definer set search_path=public set statement_timeout='300s' as $$
begin
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_6_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  update public.stat_categories set measurement_type='total',updated_at=now() where source_organization='World Bank' and source_indicator_code='EN.URB.LCTY';
  update public.stat_categories set measurement_type='per_capita',updated_at=now() where source_organization='World Bank' and source_indicator_code in ('AG.LND.ARBL.HA.PC','FB.ATM.TOTL.P5','FB.CBK.BRCH.P5');
  perform public.apply_v16_2_7_legacy_reaudit();
  perform public.apply_v16_2_7_exact_title_deduplication();
  perform public.refresh_category_decision_provenance_v16_2_7();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();

  -- Fail closed immediately when a previously live category no longer passes.
  update public.stat_categories c
  set enabled=false,eligible_daily=false,updated_at=now()
  from public.category_runtime_review_v16_2 v
  where v.id=c.id and not v.computed_playable_v16_2 and (c.enabled or c.eligible_daily);

  -- A category that was not already live may be activated only after all three
  -- production difficulties have current successful reachability records. This
  -- keeps incremental imports/re-audits invisible until the guarded release.
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
end;
$$;
revoke all on function public.refresh_v16_2_runtime_catalog() from public,anon,authenticated;
grant execute on function public.refresh_v16_2_runtime_catalog() to service_role;

-- Stage strict-pass candidates for production-solver proof without changing
-- enabled/eligible_daily. This solves the release-order problem: newly imported
-- categories need an editorial approved state before the runtime view can expose
-- them to the reachability auditor, but publication must remain blocked until
-- that auditor and all breadth gates pass.
create or replace function public.stage_v16_2_7_candidate_catalog()
returns table(staged integer,playable_candidates integer,manual_review integer,data_repairs integer,rewrites integer)
language plpgsql
security definer
set search_path=public
set statement_timeout='300s'
as $$
declare staged_count integer;
begin
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_6_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  update public.stat_categories set measurement_type='total',updated_at=now()
    where source_organization='World Bank' and source_indicator_code='EN.URB.LCTY';
  update public.stat_categories set measurement_type='per_capita',updated_at=now()
    where source_organization='World Bank' and source_indicator_code in ('AG.LND.ARBL.HA.PC','FB.ATM.TOTL.P5','FB.CBK.BRCH.P5');
  perform public.apply_v16_2_7_legacy_reaudit();
  perform public.apply_v16_2_7_exact_title_deduplication();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();

  -- Same conservative automatic-promotion predicate as the established v16.2
  -- finalizer, but intentionally do not reconcile enabled/eligible_daily here.
  update public.category_review_state r
  set status='approved',
      political_self_reported=false,confusing=false,esoteric=false,subjective_or_composite=false,
      stale_data=false,poor_coverage=false,duplicate_of=null,
      notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.7 staged strict-pass candidate for production reachability proof.'),
      reviewed_at=coalesce(r.reviewed_at,now()),updated_at=now()
  from public.category_promotion_assessment_v16_2 a
  where a.category_id=r.category_id and a.proposed_status='auto_promote'
    and r.status in ('pending','needs_rewrite','needs_discussion');
  get diagnostics staged_count = row_count;

  update public.stat_categories c
  set review_status='approved',curation_status='approved',
      content_review_status=case when c.content_review_status='excluded' then c.content_review_status else 'approved' end,
      content_review_reason=case when c.content_review_status='excluded' then c.content_review_reason else 'v16.2.7 staged strict-pass candidate: source, semantics, rankings, clarity and board-feasibility gates passed; publication still requires production reachability proof.' end,
      metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object('stagedForReachabilityV16_2_7',true,'stagedForReachabilityVersion','geostats-v16.2.7-stage-v1'),
      updated_at=now()
  from public.category_promotion_assessment_v16_2 a
  where a.category_id=c.id and a.proposed_status='auto_promote'
    and coalesce(c.content_review_status,'pending')<>'excluded'
    and coalesce(c.curation_status,'pending')<>'excluded';

  perform public.apply_v16_2_7_exact_title_deduplication();
  perform public.refresh_category_decision_provenance_v16_2_7();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();

  return query
  select staged_count,
    count(*) filter(where proposed_status='playable')::integer,
    count(*) filter(where proposed_status='manual_review')::integer,
    count(*) filter(where proposed_status='data_repair_required')::integer,
    count(*) filter(where proposed_status='rewrite_required')::integer
  from public.category_promotion_assessment_v16_2;
end;
$$;
revoke all on function public.stage_v16_2_7_candidate_catalog() from public,anon,authenticated;
grant execute on function public.stage_v16_2_7_candidate_catalog() to service_role;

-- Strict publication assertion for the complete next build. It is deliberately
-- separate from routine refresh so source imports can run incrementally.
create or replace function public.assert_v16_2_7_release()
returns table(playable integer,unreachable_checks integer,unproved_categories integer,duplicate_titles integer) language plpgsql security definer set search_path=public as $$
declare p integer; bad integer; unproved integer; dups integer;
  history_n integer; sports_n integer; culture_n integer; physical_n integer; concentrated_n integer;
begin
  select count(*) into p from public.category_runtime_review_v16_2 where computed_playable_v16_2;
  select count(*) filter(where public.category_macro_domain_v16_2_7(c.family,c.source_organization,c.title,c.metadata)='history'),
         count(*) filter(where public.category_macro_domain_v16_2_7(c.family,c.source_organization,c.title,c.metadata)='sports'),
         count(*) filter(where public.category_macro_domain_v16_2_7(c.family,c.source_organization,c.title,c.metadata)='culture-language-religion'),
         count(*) filter(where public.category_macro_domain_v16_2_7(c.family,c.source_organization,c.title,c.metadata) in ('physical-geography','geology-natural-hazards')),
         count(*) filter(where public.category_macro_domain_v16_2_7(c.family,c.source_organization,c.title,c.metadata) in ('economy-finance','trade','food-agriculture'))
    into history_n,sports_n,culture_n,physical_n,concentrated_n
  from public.stat_categories c join public.category_runtime_review_v16_2 v on v.id=c.id
  where v.computed_playable_v16_2;
  select count(*) into bad from public.generator_reachability_v16_2_7 r join public.category_runtime_review_v16_2 v on v.id=r.category_id where v.computed_playable_v16_2 and not r.reachable;
  select count(*) into unproved from public.category_runtime_review_v16_2 v where v.computed_playable_v16_2 and not exists(
    select 1 from public.generator_reachability_v16_2_7 r where r.category_id=v.id group by r.category_id having bool_and(r.reachable) and count(*)=3
  );
  select count(*) into dups from (
    select regexp_replace(lower(trim(title)),'[^a-z0-9]+','','g') k,count(*) n
    from public.category_runtime_review_v16_2 where computed_playable_v16_2 group by 1 having count(*)>1
  ) q;
  if p<500 then raise exception 'v16.2.7 publication blocked: only % playable categories; 500 high-quality categories are required.',p; end if;
  if history_n<12 then raise exception 'v16.2.7 publication blocked: only % playable history categories; at least 12 are required.',history_n; end if;
  if sports_n<2 then raise exception 'v16.2.7 publication blocked: only % playable sports categories; FIFA and Olympic chronology must both be represented.',sports_n; end if;
  if culture_n<15 then raise exception 'v16.2.7 publication blocked: only % playable culture/language/religion categories; at least 15 are required.',culture_n; end if;
  if physical_n<20 then raise exception 'v16.2.7 publication blocked: only % playable physical-geography/geology/hazard categories; at least 20 are required.',physical_n; end if;
  if concentrated_n::numeric/nullif(p,0)>0.60 then raise exception 'v16.2.7 publication blocked: economy/trade/agriculture remain % of the playable catalog; maximum is 60%%.',round(100.0*concentrated_n/nullif(p,0),1); end if;
  if bad<>0 then raise exception 'v16.2.7 publication blocked: % production-solver reachability checks fail.',bad; end if;
  if unproved<>0 then raise exception 'v16.2.7 publication blocked: % playable categories lack all-mode production-solver reachability proof.',unproved; end if;
  if dups<>0 then raise exception 'v16.2.7 publication blocked: % exact playable title duplicates remain.',dups; end if;
  return query select p,bad,unproved,dups;
end;
$$;
revoke all on function public.assert_v16_2_7_release() from public,anon,authenticated;
grant execute on function public.assert_v16_2_7_release() to service_role;

-- Replace the inherited finalizer with a v16.2.7 atomic publication path. All
-- conservative promotions and audit refreshes occur before the release assertion;
-- enabled/eligible_daily are reconciled only after every staged playable category
-- has all-mode reachability proof and the catalog breadth gates pass.
create or replace function public.finalize_v16_2_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='360s'
as $$
begin
  perform pg_advisory_xact_lock(hashtext('geostats-v16.2.7-finalize-catalog'));
  perform public.apply_v16_1_copy_corrections();
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_6_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  update public.stat_categories set measurement_type='total',updated_at=now()
    where source_organization='World Bank' and source_indicator_code='EN.URB.LCTY';
  update public.stat_categories set measurement_type='per_capita',updated_at=now()
    where source_organization='World Bank' and source_indicator_code in ('AG.LND.ARBL.HA.PC','FB.ATM.TOTL.P5','FB.CBK.BRCH.P5');
  perform public.apply_v16_2_7_legacy_reaudit();
  perform public.apply_v16_2_7_exact_title_deduplication();
  perform public.refresh_category_decision_provenance_v16_2_7();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.apply_conservative_promotions_v16_2();
  perform public.apply_v16_2_7_exact_title_deduplication();
  perform public.refresh_category_decision_provenance_v16_2_7();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();

  -- No publication mutation is allowed above this assertion.
  perform public.assert_v16_2_7_release();

  update public.stat_categories c
  set enabled=v.computed_playable_v16_2,eligible_daily=v.computed_playable_v16_2,updated_at=now()
  from public.category_runtime_review_v16_2 v where v.id=c.id;

  perform public.assert_v16_2_6_release();
  perform public.assert_v16_2_7_release();
end;
$$;
revoke all on function public.finalize_v16_2_catalog() from public,anon,authenticated;
grant execute on function public.finalize_v16_2_catalog() to service_role;

-- Installation is safe to run against the existing live catalog: the refresh may
-- disable newly invalid rows but cannot publish new rows without reachability proof.
select public.refresh_v16_2_runtime_catalog();
commit;
