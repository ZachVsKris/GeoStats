-- GeoStats v13.4.4
-- Final playability calibration after complete editorial review and database diagnostics.
-- Keeps 33 high-value categories that were incorrectly blocked by the generic one-size-fits-all
-- quality score, removes 11 categories that are stale, too sparse, or too tie-heavy, and
-- preserves fail-closed behavior for unseen indicators.

begin;

alter table public.stat_categories
  alter column curation_version set default 'geostats-v13.4.4-final-playability-v1';

create table if not exists public.stat_category_playability_rules (
  source_organization text not null,
  source_indicator_code text not null,
  category_id text not null default '',
  decision text not null check (decision in ('approved')),
  minimum_common_year integer not null default 2022,
  minimum_common_year_coverage integer not null,
  minimum_quality_score integer not null,
  minimum_clustering_score integer,
  minimum_stability_score integer,
  reason text not null,
  version text not null default 'geostats-v13.4.4-final-playability-v1',
  updated_at timestamptz not null default now(),
  primary key (source_organization,source_indicator_code,category_id)
);

delete from public.stat_category_playability_rules;

insert into public.stat_category_playability_rules (
  source_organization,source_indicator_code,category_id,decision,
  minimum_common_year,minimum_common_year_coverage,minimum_quality_score,
  minimum_clustering_score,minimum_stability_score,reason,version
) values
  ('ILOSTAT', 'SDG_0111_SEX_AGE_RT_A', '', 'approved', 2022, 90, 70, 55, 80, 'Working-poverty rate has sufficient completed-year coverage, stable rankings, and transparent ILO modeled methodology.', 'geostats-v13.4.4-final-playability-v1'),
  ('ILOSTAT', 'EIP_NEET_SEX_RT_A', '', 'approved', 2022, 80, 60, 55, 80, 'Youth NEET rate has adequate coverage and stable, internationally harmonized labor statistics.', 'geostats-v13.4.4-final-playability-v1'),
  ('ILOSTAT', 'EMP_NIFL_SEX_RT_A', '', 'approved', 2022, 60, 58, 55, 80, 'Informal-employment rate meets the curated minimum coverage and stability thresholds.', 'geostats-v13.4.4-final-playability-v1'),
  ('ILOSTAT', 'SDG_0552_NOC_RT_A', '', 'approved', 2022, 60, 58, 55, 80, 'Women in management is clear, sufficiently broad, and stable across completed years.', 'geostats-v13.4.4-final-playability-v1'),
  ('ILOSTAT', 'HOW_UEES_SEX_NB_A', '', 'approved', 2022, 55, 58, 55, 80, 'Average working week is a clear comparison with adequate completed-year coverage and stability.', 'geostats-v13.4.4-final-playability-v1'),
  ('ILOSTAT', 'UNE_3EAP_SEX_AGE_DSB_RT_A', '', 'approved', 2022, 60, 55, 55, 80, 'Youth unemployment is retained with a lower category-specific coverage floor and stable rankings.', 'geostats-v13.4.4-final-playability-v1'),
  ('Natural Earth', 'most-land-neighbors', '', 'approved', 2022, 190, 80, 45, 60, 'Land-border neighbors is a static geometry measure; moderate ties are expected and acceptable.', 'geostats-v13.4.4-final-playability-v1'),
  ('U.S. EIA', '57:1', '', 'approved', 2022, 150, 75, 20, 80, 'Crude-oil production is independently documented; zero-heavy distributions are expected and do not invalidate top-country rankings.', 'geostats-v13.4.4-final-playability-v1'),
  ('U.S. EIA', '26:1', '', 'approved', 2022, 150, 75, 20, 80, 'Natural-gas production is independently documented; zero-heavy distributions are expected and do not invalidate top-country rankings.', 'geostats-v13.4.4-final-playability-v1'),
  ('UN Comtrade', '0803', '', 'approved', 2022, 100, 72, 80, 80, 'Banana exports have adequate customs-record coverage and stable rankings.', 'geostats-v13.4.4-final-playability-v1'),
  ('UN Comtrade', '7108', '', 'approved', 2022, 100, 72, 80, 80, 'Gold exports have adequate customs-record coverage and stable rankings.', 'geostats-v13.4.4-final-playability-v1'),
  ('UN Comtrade', '0902', '', 'approved', 2022, 120, 70, 80, 55, 'Tea exports have broad customs-record coverage; moderate year-to-year movement is acceptable.', 'geostats-v13.4.4-final-playability-v1'),
  ('UN Comtrade', '1801', '', 'approved', 2022, 90, 65, 80, 80, 'Cocoa-bean exports have sufficient customs-record coverage and stable rankings.', 'geostats-v13.4.4-final-playability-v1'),
  ('UN Comtrade', '2709', '', 'approved', 2022, 90, 65, 80, 80, 'Crude-oil exports have sufficient customs-record coverage and stable rankings.', 'geostats-v13.4.4-final-playability-v1'),
  ('UN Comtrade', '1001', '', 'approved', 2022, 90, 65, 80, 55, 'Wheat exports have sufficient customs-record coverage; moderate year-to-year movement is acceptable.', 'geostats-v13.4.4-final-playability-v1'),
  ('UNESCO UIS', 'XGDP.FSGOV', '', 'approved', 2022, 120, 75, 80, 80, 'Education spending share has broad harmonized coverage and stable rankings.', 'geostats-v13.4.4-final-playability-v1'),
  ('UNESCO UIS', 'GTVP.2T3.V', '', 'approved', 2022, 100, 72, 80, 80, 'Vocational enrollment share has sufficient coverage and stable harmonized data.', 'geostats-v13.4.4-final-playability-v1'),
  ('UNESCO UIS', '26637', '', 'approved', 2022, 80, 68, 80, 80, 'International students hosted has sufficient coverage and a clear player-facing meaning.', 'geostats-v13.4.4-final-playability-v1'),
  ('UNESCO UIS', 'MOR.5T8.40505', '', 'approved', 2022, 80, 68, 80, 80, 'Outbound student mobility is transparently modeled and sufficiently broad for play.', 'geostats-v13.4.4-final-playability-v1'),
  ('UNESCO UIS', 'SCHBSP.1.WCOMPUT', '', 'approved', 2022, 100, 68, 45, 80, 'School computer access is retained despite moderate ceiling ties because coverage and stability are strong.', 'geostats-v13.4.4-final-playability-v1'),
  ('UNESCO UIS', 'FOSGP.5T8.F500600700', '', 'approved', 2022, 80, 68, 80, 80, 'STEM graduate share has sufficient coverage and stable harmonized definitions.', 'geostats-v13.4.4-final-playability-v1'),
  ('UNESCO UIS', 'SCHBSP.1.WINTERN', '', 'approved', 2022, 90, 64, 40, 80, 'School internet access is retained with a tie-aware clustering floor and strong stability.', 'geostats-v13.4.4-final-playability-v1'),
  ('UNESCO UIS', 'RESDEN.INHAB.TFTE', '', 'approved', 2022, 70, 60, 80, 80, 'Researchers per million has adequate coverage, clear units, and stable rankings.', 'geostats-v13.4.4-final-playability-v1'),
  ('UNESCO UIS', 'READ.LOWERSEC', '', 'approved', 2022, 65, 56, 80, 80, 'Reading proficiency has sufficient assessment coverage and stable rankings.', 'geostats-v13.4.4-final-playability-v1'),
  ('UNESCO UIS', 'MATH.LOWERSEC', '', 'approved', 2022, 60, 55, 80, 80, 'Mathematics proficiency has sufficient assessment coverage and stable rankings.', 'geostats-v13.4.4-final-playability-v1'),
  ('UNHCR', 'population:coa:stateless', '', 'approved', 2022, 75, 75, 80, 80, 'Stateless-person counts have sufficient operational-record coverage and stable rankings.', 'geostats-v13.4.4-final-playability-v1'),
  ('UNHCR', 'solutions:coo:returned_refugees', '', 'approved', 2022, 60, 65, 60, 80, 'Refugee returns have adequate operational-record coverage and stable rankings.', 'geostats-v13.4.4-final-playability-v1'),
  ('WHO', 'WSH_WATER_SAFELY_MANAGED', '', 'approved', 2022, 110, 75, 80, 80, 'Safely managed drinking-water access has broad, recent, harmonized coverage.', 'geostats-v13.4.4-final-playability-v1'),
  ('WHO', 'WSH_SANITATION_SAFELY_MANAGED', '', 'approved', 2022, 110, 75, 80, 80, 'Safely managed sanitation access has broad, recent, harmonized coverage.', 'geostats-v13.4.4-final-playability-v1'),
  ('WHO', 'HWF_0006', '', 'approved', 2022, 120, 72, 80, 80, 'Nurse and midwife density has broad coverage and stable harmonized data.', 'geostats-v13.4.4-final-playability-v1'),
  ('WHO', 'MALARIA_EST_INCIDENCE', '', 'approved', 2022, 90, 65, 60, 80, 'Malaria incidence is a transparent WHO model with sufficient recent coverage and stability.', 'geostats-v13.4.4-final-playability-v1'),
  ('World Bank', 'AG.LND.PRCP.MM', 'rain', 'approved', 2022, 150, 74, null, null, 'Average rainfall is a broad physical-climate comparison; legacy World Bank rows lack clustering metadata but have strong coverage.', 'geostats-v13.4.4-final-playability-v1'),
  ('World Bank', 'IS.AIR.GOOD.MT.K1', '', 'approved', 2022, 120, 74, null, null, 'Air freight has adequate recent coverage; legacy World Bank rows lack clustering metadata.', 'geostats-v13.4.4-final-playability-v1');

-- The completed review supersedes the earlier provisional approval of these 11 categories.
update public.stat_category_curation_rules rule
set
  decision='excluded',
  player_title=null,
  reason=changes.reason,
  concept_group=null,
  recognizability_score=null,
  specificity_score=null,
  version='geostats-v13.4.4-final-playability-v1',
  updated_at=now()
from (values
  ('UNHCR', 'population:coa:idps', '', 'Excluded after final playability review: only 38 countries have a common-year observation, and missing countries cannot safely be treated as zero.'),
  ('UNESCO UIS', 'SCHBSP.1.WELEC', '', 'Excluded after final playability review: severe ceiling clustering creates too many tied countries for a useful ranking.'),
  ('UNESCO UIS', 'SCHBSP.1.WTOILA', '', 'Excluded after final playability review: severe ceiling clustering creates too many tied countries for a useful ranking.'),
  ('UNESCO UIS', 'SCHBSP.1.WWATA', '', 'Excluded after final playability review: the best broad common year is 2019 and the distribution is heavily tied.'),
  ('UNESCO UIS', 'LR.AG15T24', '', 'Excluded after final playability review: common-year coverage is below the curated 60-country minimum.'),
  ('WHO', 'HWF_0001', '', 'Excluded after final playability review: the broad common year is 2018, outside GeoStats'' 2022-current data policy.'),
  ('WHO', 'NCD_HYP_PREVALENCE_A', '', 'Excluded after final playability review: the broad common year is 2019, outside GeoStats'' 2022-current data policy.'),
  ('WHO', 'RS_198', '', 'Excluded after final playability review: the broad common year is 2021, outside GeoStats'' 2022-current data policy.'),
  ('WHO', 'MDG_0000000025', '', 'Excluded after final playability review: the broad common year is 2019, outside GeoStats'' 2022-current data policy.'),
  ('WHO', 'WSH_HYGIENE_BASIC', '', 'Excluded after final playability review: the broad common year is 2019, outside GeoStats'' 2022-current data policy.'),
  ('WHO', 'WHS4_154', '', 'Excluded after final playability review: the broad common year is 2019, outside GeoStats'' 2022-current data policy.')
) as changes(source_organization,source_indicator_code,category_id,reason)
where rule.source_organization=changes.source_organization
  and rule.source_indicator_code=changes.source_indicator_code
  and rule.category_id=changes.category_id;

-- All other completed editorial decisions remain in force under the new release version.
update public.stat_category_curation_rules
set version='geostats-v13.4.4-final-playability-v1', updated_at=now()
where version<>'geostats-v13.4.4-final-playability-v1';

create or replace function public.apply_category_curation(p_category_id text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  category_row public.stat_categories%rowtype;
  rule_row public.stat_category_curation_rules%rowtype;
  play_row public.stat_category_playability_rules%rowtype;
  editorial_decision text;
  editorial_reason text;
  effective_auto_qualified boolean;
  calibrated_pass boolean := false;
  data_year integer;
  max_allowed_year integer;
begin
  select * into category_row from public.stat_categories where id=p_category_id;
  if not found then return null; end if;

  select * into rule_row
  from public.stat_category_curation_rules rule
  where rule.source_organization=category_row.source_organization
    and rule.source_indicator_code=category_row.source_indicator_code
    and rule.category_id in ('',category_row.id)
  order by case when rule.category_id=category_row.id then 0 else 1 end
  limit 1;

  select * into play_row
  from public.stat_category_playability_rules play
  where play.source_organization=category_row.source_organization
    and play.source_indicator_code=category_row.source_indicator_code
    and play.category_id in ('',category_row.id)
  order by case when play.category_id=category_row.id then 0 else 1 end
  limit 1;

  data_year:=coalesce(category_row.common_year,category_row.latest_available_year);
  max_allowed_year:=case
    when category_row.source_organization='ILOSTAT'
      then extract(year from current_date)::integer-1
    else extract(year from current_date)::integer
  end;

  if category_row.source_organization='ILOSTAT'
    and coalesce(data_year,9999)>max_allowed_year then
    editorial_decision:='excluded';
    editorial_reason:='Curated out until the importer supplies a completed, non-projected calendar year.';
  elsif rule_row.decision='approved' then
    editorial_decision:='approved';
    editorial_reason:=rule_row.reason;
  elsif rule_row.decision='excluded' then
    editorial_decision:='excluded';
    editorial_reason:=rule_row.reason;
  else
    editorial_decision:='excluded';
    editorial_reason:='Curated out: this indicator was not part of the completed v13.4.4 catalog review. New indicators fail closed rather than entering Daily automatically.';
  end if;

  if play_row.decision='approved' then
    calibrated_pass:=(
      editorial_decision='approved'
      and category_row.review_status<>'rejected'
      and category_row.provenance_status='approved'
      and category_row.independent_validation=true
      and data_year is not null
      and data_year>=play_row.minimum_common_year
      and data_year<=max_allowed_year
      and coalesce(category_row.common_year_coverage,0)>=play_row.minimum_common_year_coverage
      and coalesce(category_row.quality_score,0)>=play_row.minimum_quality_score
      and (
        play_row.minimum_clustering_score is null
        or coalesce(category_row.clustering_score,0)>=play_row.minimum_clustering_score
      )
      and (
        play_row.minimum_stability_score is null
        or coalesce(category_row.stability_score,0)>=play_row.minimum_stability_score
      )
    );
  end if;

  effective_auto_qualified:=case
    when editorial_decision='excluded' then false
    when play_row.decision='approved' then calibrated_pass
    else category_row.auto_qualified
  end;

  update public.stat_categories category
  set
    curation_status=editorial_decision,
    curation_reason=editorial_reason,
    curation_version='geostats-v13.4.4-final-playability-v1',
    title=coalesce(rule_row.player_title,category.title),
    short_title=left(coalesce(rule_row.player_title,category.short_title,category.title),70),
    description=case
      when rule_row.player_title is not null
      then rule_row.player_title || ' according to ' || category.source_organization || '.'
      else category.description
    end,
    concept_group=coalesce(rule_row.concept_group,category.concept_group,category.id),
    recognizability_score=coalesce(rule_row.recognizability_score,category.recognizability_score),
    specificity_score=coalesce(rule_row.specificity_score,category.specificity_score),
    auto_qualified=effective_auto_qualified,
    enabled=case when editorial_decision='excluded' then false else category.enabled end,
    eligible_daily=case when editorial_decision='excluded' then false else category.eligible_daily end,
    review_status=case
      when category.review_status='rejected' then 'rejected'
      when editorial_decision='excluded' then 'candidate'
      else category.review_status
    end,
    duplicate_status=case when editorial_decision='excluded' then 'not_eligible' else category.duplicate_status end,
    superseded_by=case when editorial_decision='excluded' then null else category.superseded_by end,
    auto_decision_reason=case
      when editorial_decision='excluded' then editorial_reason
      when play_row.decision='approved' and calibrated_pass
        then 'Automatically approved after category-specific numerical calibration, provenance validation, complete editorial review, and duplicate arbitration.'
      when play_row.decision='approved'
        then 'Editorially retained but disabled because the current observations no longer meet the category-specific coverage, freshness, distribution, or stability floor.'
      else category.auto_decision_reason
    end,
    metadata=coalesce(category.metadata,'{}'::jsonb) || jsonb_build_object(
      'curationStatus',editorial_decision,
      'curationReason',editorial_reason,
      'curationVersion','geostats-v13.4.4-final-playability-v1',
      'playabilityCalibration',case when play_row.decision='approved' then calibrated_pass else null end,
      'playabilityCalibrationVersion',case when play_row.decision='approved' then play_row.version else null end
    ),
    updated_at=now()
  where category.id=p_category_id;

  return editorial_decision;
end;
$$;

-- Duplicate arbitration remains fail-closed and uses the recalibrated auto_qualified value.
create or replace function public.refresh_stat_concept_group(p_concept_group text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare chosen text;
begin
  if p_concept_group is null or btrim(p_concept_group)='' then return null; end if;

  select category.id into chosen
  from public.stat_categories category
  where category.concept_group=p_concept_group
    and category.review_status<>'rejected'
    and category.auto_qualified=true
    and category.provenance_status='approved'
    and category.independent_validation=true
    and category.curation_status='approved'
  order by
    category.governance_priority asc,
    category.quality_score desc,
    category.common_year_coverage desc,
    category.latest_available_year desc nulls last,
    category.id
  limit 1;

  update public.stat_categories category
  set
    enabled=case when category.id=chosen and category.curation_status='approved' then true else false end,
    eligible_daily=case when category.id=chosen and category.curation_status='approved' then true else false end,
    review_status=case
      when category.review_status='rejected' then 'rejected'
      when category.curation_status='excluded' then 'candidate'
      when category.id=chosen then 'approved'
      when category.auto_qualified and category.provenance_status='approved' then 'candidate'
      when category.auto_qualified then 'needs_review'
      else 'candidate'
    end,
    duplicate_status=case
      when category.curation_status='excluded' then 'not_eligible'
      when category.id=chosen then 'preferred'
      when chosen is not null and category.auto_qualified and category.provenance_status='approved' then 'superseded'
      else 'not_eligible'
    end,
    superseded_by=case when category.curation_status='approved' and category.id<>chosen then chosen else null end,
    auto_decision_reason=case
      when category.curation_status='excluded' then category.curation_reason
      when category.id=chosen then 'Automatically selected after category-specific quality calibration, provenance validation, complete editorial curation, and duplicate arbitration.'
      when chosen is not null and category.auto_qualified and category.provenance_status='approved'
        then 'Passed the calibrated quality and provenance gates but was superseded by a stronger near-duplicate.'
      else category.auto_decision_reason
    end,
    updated_at=now()
  where category.concept_group=p_concept_group
    and category.review_status<>'rejected';

  return chosen;
end;
$$;

create or replace function public.apply_category_governance(p_category_id text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare group_name text;
begin
  perform public.apply_category_curation(p_category_id);
  select concept_group into group_name from public.stat_categories where id=p_category_id;
  if group_name is null then
    update public.stat_categories set concept_group=id where id=p_category_id;
    group_name:=p_category_id;
  end if;
  return public.refresh_stat_concept_group(group_name);
end;
$$;

revoke all on function public.apply_category_curation(text) from public,anon,authenticated;
revoke all on function public.refresh_stat_concept_group(text) from public,anon,authenticated;
revoke all on function public.apply_category_governance(text) from public,anon,authenticated;
grant execute on function public.apply_category_curation(text) to service_role;
grant execute on function public.refresh_stat_concept_group(text) to service_role;
grant execute on function public.apply_category_governance(text) to service_role;

do $$
declare row record;
begin
  for row in select id from public.stat_categories loop
    perform public.apply_category_curation(row.id);
  end loop;
  for row in select distinct concept_group from public.stat_categories where concept_group is not null loop
    perform public.refresh_stat_concept_group(row.concept_group);
  end loop;
end $$;

update public.data_sources
set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'curation_policy','geostats-v13.4.4-final-playability-v1',
  'manual_review_required',false,
  'reviewed_category_count',726,
  'curated_approved_rule_count',241,
  'curated_excluded_rule_count',485,
  'category_specific_playability_rules',33,
  'current_catalog_unreviewed_count',0,
  'minimum_playable_common_year',2022,
  'future_or_projected_years_allowed',false,
  'unreviewed_indicator_behavior','fail_closed',
  'country_leadership_self_report_only_allowed',false
), updated_at=now()
where status in ('active','importing');

commit;
