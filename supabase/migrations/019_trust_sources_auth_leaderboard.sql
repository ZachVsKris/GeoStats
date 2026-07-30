-- GeoStats v13.5.0
-- Trust, exact-source attribution, GeoStats username onboarding, and future-proof
-- credibility governance. Random mode and board-relative leaderboard rating are
-- application changes and require no additional score table columns.

begin;

-- ---------------------------------------------------------------------------
-- Category-level evidence and credibility metadata
-- ---------------------------------------------------------------------------
alter table public.stat_categories
  add column if not exists credibility_score smallint,
  add column if not exists credibility_status text,
  add column if not exists credibility_reason text,
  add column if not exists evidence_label text,
  add column if not exists comparability_risk text,
  add column if not exists corroboration_status text;

alter table public.stat_categories drop constraint if exists stat_categories_credibility_score_check;
alter table public.stat_categories add constraint stat_categories_credibility_score_check
  check (credibility_score is null or credibility_score between 0 and 100);
alter table public.stat_categories drop constraint if exists stat_categories_credibility_status_check;
alter table public.stat_categories add constraint stat_categories_credibility_status_check
  check (credibility_status is null or credibility_status in ('approved','caution','quarantined'));
alter table public.stat_categories drop constraint if exists stat_categories_comparability_risk_check;
alter table public.stat_categories add constraint stat_categories_comparability_risk_check
  check (comparability_risk is null or comparability_risk in ('low','medium','high'));
alter table public.stat_categories drop constraint if exists stat_categories_corroboration_status_check;
alter table public.stat_categories add constraint stat_categories_corroboration_status_check
  check (corroboration_status is null or corroboration_status in ('independent','internationally_reconciled','single_system','needs_corroboration'));

create index if not exists stat_categories_credibility_idx
  on public.stat_categories (credibility_status, credibility_score desc);

-- Reusable fail-closed trust policy. It is called after every importer governance
-- pass so a later import cannot silently re-enable a quarantined indicator.
create or replace function public.apply_category_credibility(p_category_id text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  category_row public.stat_categories%rowtype;
  next_score smallint;
  next_status text;
  next_reason text;
  next_evidence text;
  next_risk text;
  next_corroboration text;
  modeled_share numeric;
  official_share numeric;
begin
  select * into category_row from public.stat_categories where id=p_category_id;
  if not found then raise exception 'Unknown stat category %',p_category_id; end if;

  modeled_share:=coalesce(category_row.modeled_observation_share,0);
  official_share:=coalesce(category_row.official_observation_share,0);

  -- Default source policy. "Official" does not automatically mean trusted:
  -- the category-specific exceptions below take precedence.
  case category_row.source_organization
    when 'UN Comtrade' then
      next_score:=96; next_status:='approved'; next_risk:='low'; next_corroboration:='internationally_reconciled';
      next_reason:='Customs transaction records standardized by the United Nations and cross-checkable against trading-partner records.';
      next_evidence:='Observed/administrative';
    when 'FAOSTAT' then
      next_score:=88; next_status:='approved'; next_risk:='medium'; next_corroboration:='internationally_reconciled';
      next_reason:='FAO-standardized agricultural statistics; country submissions are checked and documented, with estimates used for some gaps.';
      next_evidence:='Mixed observed and modeled';
    when 'U.S. EIA' then
      next_score:=82; next_status:='caution'; next_risk:='medium'; next_corroboration:='internationally_reconciled';
      next_reason:='Physical energy statistics compiled by the U.S. EIA. Boards must additionally pass nonzero and tie-concentration checks.';
      next_evidence:='Internationally harmonized';
    when 'UNHCR' then
      next_score:=86; next_status:='approved'; next_risk:='medium'; next_corroboration:='single_system';
      next_reason:='Operational registration and asylum records standardized by UNHCR; registration-system differences remain possible.';
      next_evidence:='Internationally harmonized';
    when 'WHO' then
      next_score:=84; next_status:='approved'; next_risk:='medium'; next_corroboration:='internationally_reconciled';
      next_reason:='WHO-standardized health, survey, administrative, and modeled estimates with published methods.';
      next_evidence:='Mixed observed and modeled';
    when 'UNESCO UIS' then
      next_score:=80; next_status:='caution'; next_risk:='medium'; next_corroboration:='internationally_reconciled';
      next_reason:='UIS harmonizes national administrative and survey data, but definitions and measurement capacity can vary across countries.';
      next_evidence:='Mixed observed and modeled';
    when 'ILOSTAT' then
      next_score:=83; next_status:='approved'; next_risk:='medium'; next_corroboration:='internationally_reconciled';
      next_reason:='ILO-harmonized labor-force surveys and modeled estimates under international statistical standards.';
      next_evidence:='Modeled estimate';
    when 'Natural Earth' then
      next_score:=90; next_status:='approved'; next_risk:='low'; next_corroboration:='independent';
      next_reason:='Calculated consistently from one global geometry dataset rather than national claims.';
      next_evidence:='Geospatially derived';
    when 'World Bank' then
      next_score:=86; next_status:='approved'; next_risk:='medium'; next_corroboration:='internationally_reconciled';
      next_reason:='World Development Indicators compiled from recognized international sources with documented metadata.';
      next_evidence:='Internationally harmonized';
    else
      next_score:=75; next_status:='caution'; next_risk:='medium'; next_corroboration:='single_system';
      next_reason:='Retained only with documented source and methodology; additional corroboration may be appropriate.';
      next_evidence:='Internationally harmonized';
  end case;

  -- Use observation provenance when the importer supplied it.
  if modeled_share>=0.80 then next_evidence:='Modeled estimate';
  elsif modeled_share>=0.20 and official_share>=0.20 then next_evidence:='Mixed observed and modeled';
  elsif official_share>=0.80 then next_evidence:='Observed/administrative';
  end if;

  -- Indicator-specific review. Surprising rankings are not removed merely for
  -- being surprising; they are removed when definitions/reporting are too uneven
  -- to support a defensible country comparison.
  if category_row.source_indicator_code='IT.NET.USER.ZS'
     or lower(category_row.title) like '%internet usage%'
     or lower(category_row.title) like '%individuals using the internet%' then
    next_score:=55; next_status:='quarantined'; next_risk:='high'; next_corroboration:='needs_corroboration';
    next_reason:='Internet-use estimates combine surveys, regulator/operator reporting, and imputation with uneven national definitions. Excluded from Daily play until independently corroborated.';
    next_evidence:='Mixed observed and modeled';
  elsif category_row.source_organization='World Bank' and category_row.source_indicator_code='IP.JRN.ARTC.SC' then
    next_score:=86; next_status:='approved'; next_risk:='medium'; next_corroboration:='independent';
    next_reason:='Independent Scopus/NSF bibliometric count based on author affiliations, not a number supplied by national governments. It measures article volume, not research quality.';
    next_evidence:='Independent bibliometric';
  elsif category_row.source_organization='World Bank' and category_row.source_indicator_code like 'IT.%' then
    next_score:=76; next_status:='caution'; next_risk:='medium'; next_corroboration:='internationally_reconciled';
    next_reason:='ITU-standardized telecommunications administrative data; subscription definitions and national reporting practices can still differ.';
    next_evidence:='Mixed observed and modeled';
  elsif category_row.source_organization='World Bank' and category_row.source_indicator_code like 'MS.%' then
    next_score:=85; next_status:='approved'; next_risk:='medium'; next_corroboration:='independent';
    next_reason:='SIPRI series uses budgets, official documents, and independent estimation rather than accepting a single government assertion.';
    next_evidence:='Internationally harmonized';
  elsif category_row.source_organization='World Bank' and category_row.source_indicator_code like 'SL.%' then
    next_score:=80; next_status:='caution'; next_risk:='medium'; next_corroboration:='internationally_reconciled';
    next_reason:='Labor-force surveys and ILO harmonization improve comparability, although survey definitions and modeled values remain relevant.';
    next_evidence:='Mixed observed and modeled';
  elsif category_row.source_organization='World Bank' and
        (category_row.source_indicator_code like 'TX.%' or category_row.source_indicator_code like 'TM.%') then
    next_score:=95; next_status:='approved'; next_risk:='low'; next_corroboration:='internationally_reconciled';
    next_reason:='Customs and trade records harmonized through international statistical systems.';
    next_evidence:='Observed/administrative';
  elsif category_row.source_organization='World Bank' and
        (category_row.source_indicator_code like 'NY.%' or category_row.source_indicator_code like 'NE.%' or category_row.source_indicator_code like 'NV.%') then
    next_score:=91; next_status:='approved'; next_risk:='low'; next_corroboration:='internationally_reconciled';
    next_reason:='National accounts reconciled under international accounting standards and cross-checked across related aggregates.';
    next_evidence:='Internationally harmonized';
  elsif category_row.source_organization='WHO' and category_row.source_indicator_code in ('WHS4_117','WHS8_110','WHS4_543') then
    next_score:=82; next_status:='caution'; next_risk:='medium'; next_corroboration:='internationally_reconciled';
    next_reason:='WHO immunization coverage series. Retained as standardized reported/estimated coverage, not represented as an independently measured census.';
    next_evidence:='Mixed observed and modeled';
  elsif category_row.source_organization='Natural Earth' and
        (category_row.source_indicator_code='longest-coastline' or lower(category_row.title) like '%coastline%') then
    next_score:=45; next_status:='quarantined'; next_risk:='high'; next_corroboration:='needs_corroboration';
    next_reason:='Coastline length changes materially with map resolution. Natural Earth generalized geometry is unsuitable for a definitive country ranking.';
    next_evidence:='Geospatially derived';
  elsif lower(category_row.title) ~ '(school internet access|lower-secondary.*(reading|mathematics).*proficiency|informal-employment|women in management|average working week|youth neet)' then
    next_score:=least(next_score,55); next_status:='quarantined'; next_risk:='high'; next_corroboration:='needs_corroboration';
    next_reason:='Excluded because cross-country definition, coverage, or face-validity risk is too high without additional corroboration.';
  elsif category_row.government_assertion_risk='high'
        and next_corroboration not in ('independent','internationally_reconciled') then
    next_score:=least(next_score,60); next_status:='quarantined'; next_risk:='high'; next_corroboration:='needs_corroboration';
    next_reason:='Excluded because the source is highly exposed to unilateral government assertion and no independent or internationally reconciled corroboration is documented.';
  elsif coalesce(category_row.quality_score,0)<70 then
    next_score:=least(next_score,60); next_status:='quarantined'; next_risk:='high'; next_corroboration:='needs_corroboration';
    next_reason:='Excluded because the current category quality, coverage, stability, or clustering score is below the v13.5 trust floor.';
  end if;

  update public.stat_categories category
  set
    credibility_score=next_score,
    credibility_status=next_status,
    credibility_reason=next_reason,
    evidence_label=next_evidence,
    comparability_risk=next_risk,
    corroboration_status=next_corroboration,
    enabled=case when next_status='quarantined' or next_score<75 then false else category.enabled end,
    eligible_daily=case when next_status='quarantined' or next_score<75 then false else category.eligible_daily end,
    auto_decision_reason=case
      when next_status='quarantined' then next_reason
      else category.auto_decision_reason
    end,
    metadata=coalesce(category.metadata,'{}'::jsonb) || jsonb_build_object(
      'credibilityScore',next_score,
      'credibilityStatus',next_status,
      'credibilityReason',next_reason,
      'evidenceLabel',next_evidence,
      'comparabilityRisk',next_risk,
      'corroborationStatus',next_corroboration,
      'credibilityPolicyVersion','geostats-v13.5-trust-v1'
    ),
    updated_at=now()
  where category.id=p_category_id;

  return next_status;
end;
$$;

-- Clearer player-facing vaccine labels. The exact WHO series code remains intact.
update public.stat_categories set
  title='Highest HepB3 vaccination coverage',
  short_title='HepB3 vaccination coverage',
  description='WHO estimate of the share of one-year-olds who received three doses of hepatitis B vaccine.'
where source_organization='WHO' and source_indicator_code='WHS4_117';

update public.stat_categories set
  title='Highest MCV1 vaccination coverage',
  short_title='MCV1 vaccination coverage',
  description='WHO estimate of the share of one-year-olds who received at least one measles-containing vaccine dose.'
where source_organization='WHO' and source_indicator_code='WHS8_110';

update public.stat_categories set
  title='Highest BCG vaccination coverage',
  short_title='BCG vaccination coverage',
  description='WHO estimate of BCG vaccination coverage among one-year-olds.'
where source_organization='WHO' and source_indicator_code='WHS4_543';

-- World Bank metadata URLs are indicator-specific. Existing source URLs from all
-- importers are preserved and remain the first-choice result link.
update public.stat_categories
set methodology_url=coalesce(nullif(methodology_url,''),
  'https://databank.worldbank.org/metadataglossary/world-development-indicators/series/' || source_indicator_code)
where source_organization='World Bank';

-- Duplicate arbitration now includes the trust gate. This prevents an importer
-- or later curation pass from re-enabling a quarantined category.
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
    and coalesce(category.credibility_status,'quarantined')<>'quarantined'
    and coalesce(category.credibility_score,0)>=75
  order by
    category.governance_priority asc,
    category.credibility_score desc,
    category.quality_score desc,
    category.common_year_coverage desc,
    category.latest_available_year desc nulls last,
    category.id
  limit 1;

  update public.stat_categories category
  set
    enabled=case when category.id=chosen and category.curation_status='approved' and category.credibility_status<>'quarantined' and category.credibility_score>=75 then true else false end,
    eligible_daily=case when category.id=chosen and category.curation_status='approved' and category.credibility_status<>'quarantined' and category.credibility_score>=75 then true else false end,
    review_status=case
      when category.review_status='rejected' then 'rejected'
      when category.curation_status='excluded' then 'candidate'
      when category.credibility_status='quarantined' or coalesce(category.credibility_score,0)<75 then 'candidate'
      when category.id=chosen then 'approved'
      when category.auto_qualified and category.provenance_status='approved' then 'candidate'
      when category.auto_qualified then 'needs_review'
      else 'candidate'
    end,
    duplicate_status=case
      when category.curation_status='excluded' or category.credibility_status='quarantined' or coalesce(category.credibility_score,0)<75 then 'not_eligible'
      when category.id=chosen then 'preferred'
      when chosen is not null and category.auto_qualified and category.provenance_status='approved' then 'superseded'
      else 'not_eligible'
    end,
    superseded_by=case when category.curation_status='approved' and category.credibility_status<>'quarantined' and category.id<>chosen then chosen else null end,
    auto_decision_reason=case
      when category.curation_status='excluded' then category.curation_reason
      when category.credibility_status='quarantined' or coalesce(category.credibility_score,0)<75 then category.credibility_reason
      when category.id=chosen then 'Automatically selected after numerical calibration, provenance validation, editorial curation, credibility review, and duplicate arbitration.'
      when chosen is not null and category.auto_qualified and category.provenance_status='approved'
        then 'Passed quality, provenance, and credibility gates but was superseded by a stronger near-duplicate.'
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
  perform public.apply_category_credibility(p_category_id);
  select concept_group into group_name from public.stat_categories where id=p_category_id;
  if group_name is null then
    update public.stat_categories set concept_group=id where id=p_category_id;
    group_name:=p_category_id;
  end if;
  return public.refresh_stat_concept_group(group_name);
end;
$$;

revoke all on function public.apply_category_credibility(text) from public,anon,authenticated;
revoke all on function public.refresh_stat_concept_group(text) from public,anon,authenticated;
revoke all on function public.apply_category_governance(text) from public,anon,authenticated;
grant execute on function public.apply_category_credibility(text) to service_role;
grant execute on function public.refresh_stat_concept_group(text) to service_role;
grant execute on function public.apply_category_governance(text) to service_role;

-- ---------------------------------------------------------------------------
-- GeoStats-owned username onboarding
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists username_customized boolean not null default false;

-- Existing accounts with clearly generated suffixes are prompted once. Existing
-- custom-looking names are preserved as already chosen.
update public.profiles
set username_customized = not (username ~ '^[a-z0-9_]{1,15}_[0-9a-f]{4}$' or username ~ '^[a-z0-9_]{1,11}_[0-9a-f]{8}$');

-- Resolve any historical case-only collisions before enforcing the public-name
-- uniqueness rule case-insensitively.
with duplicates as (
  select id,username,row_number() over (partition by lower(username) order by created_at,id) as duplicate_number
  from public.profiles
)
update public.profiles profile
set username=left(profile.username,11) || '_' || substr(replace(profile.id::text,'-',''),1,8),
    username_customized=false,
    updated_at=now()
from duplicates
where profile.id=duplicates.id and duplicates.duplicate_number>1;

create unique index if not exists profiles_username_lower_unique_idx
  on public.profiles (lower(username));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_name text;
  candidate text;
begin
  base_name := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'player'), '[^a-zA-Z0-9_]', '', 'g'));
  if length(base_name) < 3 then base_name := 'player'; end if;
  candidate := left(base_name, 11) || '_' || substr(replace(new.id::text, '-', ''), 1, 8);
  insert into public.profiles (id, username, display_name, username_customized)
  values (new.id, candidate, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), false)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Apply trust policy to the entire catalog, then rerun concept arbitration.
do $$
declare row record;
begin
  for row in select id from public.stat_categories loop
    perform public.apply_category_credibility(row.id);
  end loop;
  for row in select distinct concept_group from public.stat_categories where concept_group is not null loop
    perform public.refresh_stat_concept_group(row.concept_group);
  end loop;
end $$;

update public.data_sources
set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'credibility_policy','geostats-v13.5-trust-v1',
  'credibility_floor',75,
  'internet_use_indicator_behavior','quarantined_pending_independent_corroboration',
  'surprising_but_independent_data_behavior','retain_with_explanation',
  'exact_source_links',true,
  'methodology_links',true,
  'modeled_estimate_labels',true,
  'manual_review_required',false
), updated_at=now()
where status in ('active','importing');

commit;
