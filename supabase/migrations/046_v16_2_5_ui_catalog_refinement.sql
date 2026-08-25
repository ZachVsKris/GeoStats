-- GeoStats v16.2.5: UI/catalog refinement, date-ranking policy support,
-- curated catalog expansion targets, and fail-closed repair tracking.
begin;

create table if not exists public.category_release_targets_v16_2_5(
  target_key text primary key,
  track text not null check(track in ('promote','repair')),
  source_title text not null,
  source_indicator_code text,
  target_title text,
  category_id text references public.stat_categories(id) on delete set null,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.category_release_targets_v16_2_5(target_key,track,source_title,source_indicator_code,target_title) values
  ('promote:asylum-origin','promote','Most asylum applications by origin',null,'Most asylum applications by origin'),
  ('promote:asylum-received','promote','Most asylum applications received',null,'Most asylum applications received'),
  ('promote:refugees-hosted','promote','Most refugees hosted',null,'Most refugees hosted'),
  ('promote:refugees-originating','promote','Most refugees originating',null,'Most refugees originating'),
  ('promote:stateless','promote','Largest stateless population residing in the country',null,'Largest stateless population'),
  ('promote:agricultural-economy','promote','Largest agricultural economy','NV.AGR.TOTL.CD',null),
  ('promote:aquaculture','promote','Largest aquaculture production','ER.FSH.AQUA.MT',null),
  ('promote:permanent-cropland-share','promote','Largest permanent-cropland share of land','AG.LND.CROP.ZS',null),
  ('promote:ag-water-share','promote','Largest agriculture share of freshwater withdrawals','ER.H2O.FWAG.ZS','Largest share of freshwater withdrawals used by agriculture'),
  ('promote:renewable-freshwater','promote','Most renewable freshwater','ER.H2O.INTR.K3',null),
  ('promote:freshwater-withdrawals-total','promote','Highest annual freshwater withdrawals, total','ER.H2O.FWTL.K3','Largest total freshwater withdrawals'),
  ('promote:farmland-share','promote','Highest farmland share','AG.LND.AGRI.ZS','Largest share of land used for agriculture'),
  ('promote:chicken-pop','promote','Largest chicken population',null,null),
  ('promote:duck-pop','promote','Largest duck population',null,null),
  ('promote:turkey-pop','promote','Largest turkey population',null,null),
  ('promote:hindu-share','promote','Highest Hindu share',null,null),
  ('promote:hindu-pop','promote','Largest Hindu population',null,null),
  ('promote:volcano-count','promote','Most volcanoes',null,null),
  ('promote:highest-volcano','promote','Highest volcano',null,null),
  ('promote:methane','promote','Highest methane emissions','EN.GHG.CH4.MT.CE.AR5',null),
  ('promote:co2-power','promote','Highest carbon dioxide (CO2) emissions from Power Industry (Energy)','EN.GHG.CO2.PI.MT.CE.AR5','Highest CO₂ emissions from power generation'),
  ('promote:ghg-per-person','promote','Highest total greenhouse gas emissions excluding LULUCF per capita','EN.GHG.ALL.PC.CE.AR5','Highest greenhouse-gas emissions per person'),
  ('promote:oil-electricity-share','promote','Largest oil share of electricity generation','EG.ELC.PETR.ZS',null),
  ('promote:biomass-waste-share','promote','Largest combustible-renewables-and-waste share of energy use','EG.USE.CRNW.ZS','Largest share of energy from biomass and waste'),
  ('promote:threatened-birds','promote','Highest bird species, threatened','EN.BIR.THRD.NO','Most threatened bird species'),
  ('promote:threatened-fish','promote','Highest fish species, threatened','EN.FSH.THRD.NO','Most threatened fish species'),
  ('promote:health-spending-share','promote','Highest health spending share','SH.XPD.CHEX.GD.ZS','Highest health-spending share of GDP'),
  ('promote:sanitation','promote','Highest safely managed sanitation access','SH.STA.SMSS.ZS',null),
  ('promote:road-deaths-low','promote','Lowest road-traffic death rate',null,null),
  ('promote:new-business-density','promote','Highest new business density','IC.BUS.NDNS.ZS','Highest new-business density'),
  ('promote:international-students','promote','Most international students hosted','26637',null),
  ('promote:banana-exports','promote','Largest banana exports','0803',null),
  ('promote:wheat-exports','promote','Largest wheat exports','1001',null),
  ('repair:gdp-per-person','repair','Highest GDP per person','NY.GDP.PCAP.CD',null),
  ('repair:economic-growth','repair','Fastest economic growth','NY.GDP.MKTP.KD.ZG',null),
  ('repair:population-growth','repair','Fastest population growth','SP.POP.GROW',null),
  ('repair:inflation','repair','Highest inflation, consumer prices','FP.CPI.TOTL.ZG','Highest inflation'),
  ('repair:health-spending-person','repair','Highest health spending per person','SH.XPD.CHEX.PC.CD',null),
  ('repair:exports-gdp-share','repair','Highest exports share of GDP','NE.EXP.GNFS.ZS',null),
  ('repair:services-trade','repair','Highest trade in services','BG.GSR.NFSV.GD.ZS','Largest services trade as a share of GDP'),
  ('repair:domestic-water-share','repair','Highest annual freshwater withdrawals, domestic','ER.H2O.FWDM.ZS','Largest domestic share of freshwater withdrawals'),
  ('repair:life-expectancy','repair','Highest life expectancy','SP.DYN.LE00.IN',null),
  ('repair:rainfall','repair','Highest average rainfall','AG.LND.PRCP.MM',null),
  ('repair:air-freight','repair','Most air freight','IS.AIR.GOOD.MT.K1',null),
  ('repair:crude-oil','repair','Most crude oil produced',null,null),
  ('repair:natural-gas','repair','Most natural gas produced',null,null),
  ('repair:migrant-pop','repair','Largest international migrant population','SM.POP.TOTL',null),
  ('repair:unemployment-low','repair','Lowest unemployment rate','UNE_2EAP_SEX_AGE_RT_A',null),
  ('repair:working-poverty-low','repair','Lowest working-poverty rate','SDG_0111_SEX_AGE_RT_A',null),
  ('repair:internet-half','repair','Most recently reached 50% internet use',null,null),
  ('repair:oldest-constitution','repair','Oldest current constitution',null,null),
  ('repair:womens-suffrage','repair','Earliest universal women’s suffrage',null,null),
  ('repair:world-heritage','repair','Most World Heritage sites',null,null),
  ('repair:water-stress','repair','Highest level of water stress: freshwater withdrawal as a proportion of available freshwater resources','ER.H2O.FWST.ZS','Highest freshwater stress'),
  ('repair:education-spending','repair','Highest education spending share','SE.XPD.TOTL.GD.ZS','Highest education-spending share of GDP'),
  ('repair:stem-graduates','repair','Most graduates in STEM','FOSGP.5T8.F500600700',null),
  ('repair:vocational-students','repair','Most students in vocational education','GTVP.2T3.V',null),
  ('repair:camel-pop','repair','Largest camel population',null,null),
  ('repair:carbon-intensity','repair','Highest carbon intensity of GDP','EN.GHG.CO2.RT.GDP.KD','Most CO₂ emissions per unit of economic output'),
  ('repair:tourist-arrivals','repair','Most international tourist arrivals','ST.INT.ARVL',null),
  ('repair:tourist-arrivals-resident','repair','Most tourist arrivals per resident','ST.INT.ARVL/SP.POP.TOTL',null),
  ('repair:tourism-revenue','repair','Most international tourism revenue','ST.INT.RCPT.CD',null),
  ('repair:tourism-export-share','repair','Highest tourism revenue share of exports','ST.INT.RCPT.XP.ZS','Largest tourism-revenue share of exports')
on conflict(target_key) do update set
  track=excluded.track,source_title=excluded.source_title,source_indicator_code=excluded.source_indicator_code,
  target_title=excluded.target_title,updated_at=now();

-- Resolve by stable source indicator when supplied, otherwise by the reviewed
-- catalog title. Existing category ids are preserved on safe reruns.
update public.category_release_targets_v16_2_5 t
set category_id=c.id,updated_at=now()
from public.stat_categories c
where (t.category_id is null or t.category_id<>c.id)
  and (
    (t.source_indicator_code is not null and c.source_indicator_code=t.source_indicator_code
      and lower(c.title)=lower(t.source_title))
    or (t.source_indicator_code is null and lower(c.title)=lower(t.source_title))
  );

-- v16.2.5: source quality is evaluated row-by-row; do not permanently retire an entire
-- provider when a refreshed row can pass the same strict gates as every other source.
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
        and greatest(coalesce(v.common_year_coverage,0),coalesce(v.country_coverage,0))>=30
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
        -- v16.2.5 removes the old blanket UNESCO UIS / U.S. EIA source ban.
        -- Individual rows still must pass official-source validation, credibility,
        -- semantic, ranking, coverage, clarity, and board-feasibility gates.
        and lower(coalesce(v.effective_title,'')) !~ '(yield|harvested area|carcass|slaughter|producing animals|output per worker|employment.?to.?population|labor.?income share)'
      ) as strict_pass
    from public.category_runtime_review_v16 v
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
      when greatest(coalesce(common_year_coverage,0),coalesce(country_coverage,0))<30 then 'Fewer than 30 comparable country values are available.'
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

create or replace function public.apply_v16_2_5_catalog_curation()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.apply_v16_2_4_catalog_curation();

  -- These 33 concepts were re-reviewed in v16.2.5 and are no longer
  -- editorially excluded. This clears only editorial/copy blockers. Official
  -- source validation, semantic audit, ranking completeness, coverage, ties,
  -- and all shared Daily/Random hard gates remain authoritative.
  update public.stat_categories c
  set title=coalesce(t.target_title,c.title),
      short_title=coalesce(t.target_title,c.short_title,c.title),
      review_status='approved',curation_status='approved',content_review_status='approved',
      curation_reason='v16.2.5 deep catalog review: concept approved; all source, ranking, semantic, coverage, and gameplay gates remain authoritative.',
      content_review_reason='v16.2.5 player-facing concept/copy approved.',updated_at=now()
  from public.category_release_targets_v16_2_5 t
  where t.track='promote' and t.category_id=c.id;

  update public.category_review_state r
  set status='approved',political_self_reported=false,confusing=false,esoteric=false,
      subjective_or_composite=false,duplicate_of=null,recommended_title=coalesce(t.target_title,c.title),
      notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.5 deep catalog review: editorial blocker cleared; hard data-quality gates still apply.'),
      reviewed_at=coalesce(r.reviewed_at,now()),updated_at=now()
  from public.category_release_targets_v16_2_5 t
  join public.stat_categories c on c.id=t.category_id
  where t.track='promote' and r.category_id=t.category_id;

  -- The 30 repair targets are concepts we affirmatively want, but they remain
  -- fail-closed until refreshed import/source/semantic/ranking audits pass.
  -- Clearing old editorial rejection lets the automated audit explain the real
  -- blocker instead of permanently hiding a repaired category.
  update public.stat_categories c
  set title=coalesce(t.target_title,c.title),
      short_title=coalesce(t.target_title,c.short_title,c.title),
      review_status='approved',curation_status='approved',content_review_status='approved',
      curation_reason='v16.2.5 repair target: concept approved, publication requires fresh source and ranking gates.',
      content_review_reason='v16.2.5 repair target: player-facing concept approved; data/source repair remains fail-closed.',updated_at=now()
  from public.category_release_targets_v16_2_5 t
  where t.track='repair' and t.category_id=c.id;

  update public.category_review_state r
  set status='approved',confusing=false,esoteric=false,subjective_or_composite=false,duplicate_of=null,
      recommended_title=coalesce(t.target_title,c.title),
      notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.5 repair target: re-audit after importer/source/metadata repair; never force playable.'),
      reviewed_at=coalesce(r.reviewed_at,now()),updated_at=now()
  from public.category_release_targets_v16_2_5 t
  join public.stat_categories c on c.id=t.category_id
  where t.track='repair' and r.category_id=t.category_id;

  -- Correct measurement semantics for the re-reviewed share/per-person rows.
  update public.stat_categories set measurement_type='share',updated_at=now()
  where source_indicator_code in (
    'AG.LND.CROP.ZS','ER.H2O.FWAG.ZS','AG.LND.AGRI.ZS','EG.ELC.PETR.ZS','EG.USE.CRNW.ZS',
    'SH.XPD.CHEX.GD.ZS','NE.EXP.GNFS.ZS','BG.GSR.NFSV.GD.ZS','ER.H2O.FWDM.ZS',
    'SE.XPD.TOTL.GD.ZS','ST.INT.RCPT.XP.ZS'
  );
  update public.stat_categories set measurement_type='per_capita',updated_at=now()
  where source_indicator_code in ('EN.GHG.ALL.PC.CE.AR5','NY.GDP.PCAP.CD','SH.XPD.CHEX.PC.CD');

  -- This old combined terrestrial/marine concept was explicitly rejected in
  -- product review. Keep the clearer land and territorial-waters concepts.
  update public.stat_categories
  set review_status='rejected',curation_status='excluded',content_review_status='excluded',
      curation_reason='v16.2.5: combined land-and-sea protected-share framing is ambiguous and overlaps clearer protected-land and territorial-waters categories.',
      content_review_reason='v16.2.5 product decision: remove ambiguous combined land-and-sea framing.',
      enabled=false,eligible_daily=false,updated_at=now()
  where source_indicator_code='ER.PTD.TOTL.ZS' or title='Largest protected share of land and sea';
  update public.category_review_state r
  set status='rejected',notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.5: combined land-and-sea protected-share category removed from gameplay.'),updated_at=now()
  from public.stat_categories c
  where c.id=r.category_id and (c.source_indicator_code='ER.PTD.TOTL.ZS' or c.title='Largest protected share of land and sea');
end;
$$;
revoke all on function public.apply_v16_2_5_catalog_curation() from public,anon,authenticated;
grant execute on function public.apply_v16_2_5_catalog_curation() to service_role;

create or replace view public.category_release_targets_status_v16_2_5 as
select t.target_key,t.track,t.source_title,t.target_title,t.category_id,
       r.effective_title,r.validation_status,r.ranking_completeness_status,
       r.computed_playable_v16_2,r.primary_blocker_v16_2
from public.category_release_targets_v16_2_5 t
left join public.category_runtime_review_v16_2 r on r.id=t.category_id;

create or replace function public.assert_v16_2_5_release()
returns table(
  target_rows integer,unresolved_targets integer,promotion_editorial_ready integer,
  repair_targets_tracked integer,repair_targets_playable integer,proposed_playable integer,
  daily_random_mismatches integer,protected_land_sea_disabled boolean
)
language plpgsql
security definer
set search_path=public
set statement_timeout='120s'
as $$
declare
  target_count integer; unresolved_count integer; promote_count integer; repair_count integer;
  repaired_count integer; playable_count integer; mismatch_count integer; protected_disabled boolean;
begin
  perform public.assert_v16_2_4_release();

  select count(*)::integer,count(*) filter(where category_id is null)::integer
    into target_count,unresolved_count from public.category_release_targets_v16_2_5;
  select count(*)::integer into promote_count
    from public.category_release_targets_v16_2_5 t join public.category_review_state r on r.category_id=t.category_id
    where t.track='promote' and r.status='approved';
  select count(*)::integer into repair_count from public.category_release_targets_v16_2_5 where track='repair';
  select count(*)::integer into repaired_count
    from public.category_release_targets_status_v16_2_5 where track='repair' and computed_playable_v16_2;
  select count(*)::integer into playable_count
    from public.category_promotion_assessment_v16_2 where proposed_status in ('playable','auto_promote') and strict_pass;
  select coalesce(consistency.daily_random_mismatches,0)::integer into mismatch_count
    from public.category_catalog_consistency_v16_2 as consistency;
  select count(*)=0 into protected_disabled
    from public.category_runtime_review_v16_2
    where (id in (select id from public.stat_categories where source_indicator_code='ER.PTD.TOTL.ZS')
           or effective_title='Largest protected share of land and sea')
      and computed_playable_v16_2;

  if target_count<>63 then raise exception 'v16.2.5 publication blocked: %/63 catalog targets are registered.',target_count; end if;
  if unresolved_count<>0 then raise exception 'v16.2.5 publication blocked: % catalog targets could not be resolved.',unresolved_count; end if;
  if promote_count<>33 then raise exception 'v16.2.5 publication blocked: %/33 promotion candidates have editorial approval.',promote_count; end if;
  if repair_count<>30 then raise exception 'v16.2.5 publication blocked: %/30 repair candidates are tracked.',repair_count; end if;
  if playable_count<260 then raise exception 'v16.2.5 publication blocked: only % categories pass the shared Daily/Random gate.',playable_count; end if;
  if mismatch_count<>0 then raise exception 'v16.2.5 publication blocked: % Daily/Random catalog flag mismatches exist.',mismatch_count; end if;
  if not protected_disabled then raise exception 'v16.2.5 publication blocked: ambiguous protected land-and-sea category is still playable.'; end if;

  return query select target_count,unresolved_count,promote_count,repair_count,repaired_count,playable_count,mismatch_count,protected_disabled;
end;
$$;
revoke all on function public.assert_v16_2_5_release() from public,anon,authenticated;
grant execute on function public.assert_v16_2_5_release() to service_role;

create or replace function public.refresh_v16_2_runtime_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_5_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.assert_v16_2_5_release();
  update public.stat_categories c set enabled=v.computed_playable_v16_2,eligible_daily=v.computed_playable_v16_2,updated_at=now()
  from public.category_runtime_review_v16_2 v where v.id=c.id;
  update public.stat_categories set enabled=false,eligible_daily=false,updated_at=now()
  where id='history:newest-current-constitution' or source_indicator_code='ER.PTD.TOTL.ZS';
end;
$$;
revoke all on function public.refresh_v16_2_runtime_catalog() from public,anon,authenticated;
grant execute on function public.refresh_v16_2_runtime_catalog() to service_role;

create or replace function public.finalize_v16_2_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='300s'
as $$
begin
  perform pg_advisory_xact_lock(hashtext('geostats-v16.2.5-finalize-catalog'));
  perform public.apply_v16_1_copy_corrections();
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_5_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.assert_v16_2_5_release();
  perform public.apply_conservative_promotions_v16_2();
  perform public.refresh_v16_2_runtime_catalog();
end;
$$;
revoke all on function public.finalize_v16_2_catalog() from public,anon,authenticated;
grant execute on function public.finalize_v16_2_catalog() to service_role;

select public.apply_v16_2_5_catalog_curation();
select public.refresh_measurement_types_v16_2_2();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

commit;
