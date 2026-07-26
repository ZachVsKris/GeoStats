-- GeoStats v14.0
-- Exact-value source snapshots, plain-language descriptions, objective-only
-- player-quality governance, and reproducible derived-data metadata.

begin;

alter table public.stat_categories
  add column if not exists plain_language_description text,
  add column if not exists technical_definition text,
  add column if not exists unit_explanation text,
  add column if not exists source_page_url text,
  add column if not exists exact_query_url text,
  add column if not exists download_url text,
  add column if not exists api_url text,
  add column if not exists dataset_release text,
  add column if not exists retrieved_at timestamptz,
  add column if not exists license_name text,
  add column if not exists license_url text,
  add column if not exists source_query jsonb not null default '{}'::jsonb,
  add column if not exists derivation_method text,
  add column if not exists derivation_version text,
  add column if not exists input_datasets jsonb not null default '[]'::jsonb,
  add column if not exists verifiability_score smallint,
  add column if not exists verifiability_status text,
  add column if not exists understandability_score smallint,
  add column if not exists fun_score smallint,
  add column if not exists objective_status text,
  add column if not exists player_quality_status text,
  add column if not exists player_quality_reason text;

alter table public.stat_categories drop constraint if exists stat_categories_player_scores_check;
alter table public.stat_categories add constraint stat_categories_player_scores_check
  check (
    (verifiability_score is null or verifiability_score between 0 and 100)
    and (understandability_score is null or understandability_score between 0 and 100)
    and (fun_score is null or fun_score between 0 and 100)
  );
alter table public.stat_categories drop constraint if exists stat_categories_verifiability_status_check;
alter table public.stat_categories add constraint stat_categories_verifiability_status_check
  check (verifiability_status is null or verifiability_status in (
    'direct_query','downloadable_table','reproducible_derivation','geostats_snapshot','general_source_only','unverifiable'
  ));
alter table public.stat_categories drop constraint if exists stat_categories_objective_status_check;
alter table public.stat_categories add constraint stat_categories_objective_status_check
  check (objective_status is null or objective_status in ('objective','composite','subjective','uncertain'));
alter table public.stat_categories drop constraint if exists stat_categories_player_quality_status_check;
alter table public.stat_categories add constraint stat_categories_player_quality_status_check
  check (player_quality_status is null or player_quality_status in ('approved','caution','blocked'));

create index if not exists stat_categories_player_quality_idx
  on public.stat_categories (player_quality_status, objective_status, verifiability_score desc, understandability_score desc, fun_score desc);

update public.stat_categories
set
  plain_language_description=coalesce(nullif(plain_language_description,''),nullif(description,''),title),
  technical_definition=coalesce(nullif(technical_definition,''),nullif(metadata->>'source_indicator_name',''),nullif(description,''),title),
  unit_explanation=coalesce(nullif(unit_explanation,''),unit),
  source_page_url=coalesce(nullif(source_page_url,''),nullif(source_url,'')),
  retrieved_at=coalesce(retrieved_at,updated_at,created_at,now()),
  objective_status=coalesce(objective_status,'objective'),
  understandability_score=coalesce(understandability_score,recognizability_score,85),
  fun_score=coalesce(fun_score,round((coalesce(recognizability_score,80)+coalesce(specificity_score,80))/2.0)::smallint)
where true;

-- Clear, visible subtitles for common technical terms. The official indicator
-- code and technical definition are preserved for the source panel.
update public.stat_categories set
  plain_language_description='Deaths related to pregnancy or childbirth per 100,000 live births.',
  description='Deaths related to pregnancy or childbirth per 100,000 live births.',
  technical_definition='Maternal mortality ratio: maternal deaths per 100,000 live births.',
  unit_explanation='Deaths per 100,000 live births',
  understandability_score=96,
  fun_score=78
where source_organization='WHO' and source_indicator_code='MDG_0000000026';

update public.stat_categories set
  plain_language_description='Deaths of children before age five per 1,000 live births.',
  description='Deaths of children before age five per 1,000 live births.',
  unit_explanation='Deaths per 1,000 live births',
  understandability_score=97
where lower(title) like '%under-5 mortality%';

update public.stat_categories set
  plain_language_description='Share of working-age people who are employed or actively looking for work.',
  description='Share of working-age people who are employed or actively looking for work.',
  understandability_score=94
where lower(title) like '%labor force participation%';

update public.stat_categories set
  plain_language_description='Fresh water naturally replenished by rainfall, rivers, and groundwater each year.',
  description='Fresh water naturally replenished by rainfall, rivers, and groundwater each year.',
  understandability_score=92
where lower(title) like '%renewable%freshwater%';

update public.stat_categories set
  plain_language_description='Deaths before age one per 1,000 live births.',
  description='Deaths before age one per 1,000 live births.',
  unit_explanation='Deaths per 1,000 live births',
  understandability_score=97
where lower(title) like '%infant mortality%' and lower(title) not like '%under%';

update public.stat_categories set
  plain_language_description='Share of children who complete primary school.',
  description='Share of children who complete primary school.',
  understandability_score=96
where lower(title) like '%primary-school completion%';

update public.stat_categories set
  plain_language_description='Share of young people who complete upper-secondary school.',
  description='Share of young people who complete upper-secondary school.',
  understandability_score=96
where lower(title) like '%upper-secondary completion%';

update public.stat_categories set
  plain_language_description='Amount of the crop harvested per hectare of land.',
  description='Amount of the crop harvested per hectare of land.',
  understandability_score=95
where lower(title) like '% yield%';

update public.stat_categories set
  plain_language_description='Number of nurses and midwives per 1,000 people.',
  description='Number of nurses and midwives per 1,000 people.',
  understandability_score=96
where lower(title) like '%nurse%midwife%density%';

update public.stat_categories set
  plain_language_description='Share of employed people living below the international poverty line.',
  description='Share of employed people living below the international poverty line.',
  understandability_score=94
where lower(title) like '%working-poverty%';

update public.stat_categories set
  plain_language_description='Share of young people not in employment, education, or training.',
  description='Share of young people not in employment, education, or training.',
  understandability_score=97
where lower(title) like '%neet%';

update public.stat_categories set
  plain_language_description='Share of workers whose jobs are not formally registered or protected.',
  description='Share of workers whose jobs are not formally registered or protected.',
  understandability_score=92
where lower(title) like '%informal-employment%';

update public.stat_categories set
  plain_language_description='Students studying abroad as a share of all students from that country.',
  description='Students studying abroad as a share of all students from that country.',
  understandability_score=91
where lower(title) like '%outbound student mobility%';

update public.stat_categories set
  plain_language_description='Share of graduates whose field is science, technology, engineering, or mathematics.',
  description='Share of graduates whose field is science, technology, engineering, or mathematics.',
  understandability_score=96
where lower(title) like '%stem graduate share%';

update public.stat_categories set
  plain_language_description='New estimated malaria cases per 1,000 people at risk during the year.',
  description='New estimated malaria cases per 1,000 people at risk during the year.',
  understandability_score=96
where lower(title) like '%malaria incidence%';

update public.stat_categories set
  plain_language_description='Share of students who reach the minimum international reading proficiency level.',
  description='Share of students who reach the minimum international reading proficiency level.',
  understandability_score=94
where lower(title) like '%reading proficiency%';

update public.stat_categories set
  plain_language_description='Share of students who reach the minimum international mathematics proficiency level.',
  description='Share of students who reach the minimum international mathematics proficiency level.',
  understandability_score=94
where lower(title) like '%mathematics proficiency%';

update public.stat_categories set
  plain_language_description='Share of people using sanitation services that safely contain and treat waste.',
  description='Share of people using sanitation services that safely contain and treat waste.',
  understandability_score=94
where lower(title) like '%safely managed sanitation%';

-- v14 changes the completed-catalog fail-closed rule into an explicit review
-- queue. New indicators still cannot enter play automatically, but they remain
-- visible as pending candidates so an administrator can review and approve them.
create or replace function public.apply_category_curation(p_category_id text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  category_row public.stat_categories%rowtype;
  rule_row public.stat_category_curation_rules%rowtype;
  editorial_decision text;
  editorial_reason text;
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

  if category_row.source_organization='ILOSTAT'
    and coalesce(category_row.common_year,category_row.latest_available_year,9999)
        > extract(year from current_date)::integer-1 then
    editorial_decision:='excluded';
    editorial_reason:='Curated out until the importer supplies a completed, non-projected calendar year.';
  elsif rule_row.decision='approved' then
    editorial_decision:='approved';
    editorial_reason:=rule_row.reason;
  elsif rule_row.decision='excluded' then
    editorial_decision:='excluded';
    editorial_reason:=rule_row.reason;
  elsif category_row.curation_status='approved' and category_row.review_status='approved' then
    editorial_decision:='approved';
    editorial_reason:=coalesce(category_row.curation_reason,'Approved through the v14 editorial review queue.');
  else
    editorial_decision:='pending';
    editorial_reason:='Awaiting v14 editorial review. New objective candidates remain disabled until a reviewer confirms clarity, fun, uniqueness, and source traceability.';
  end if;

  update public.stat_categories category
  set
    curation_status=editorial_decision,
    curation_reason=editorial_reason,
    curation_version='geostats-v14-candidate-review-v1',
    title=coalesce(rule_row.player_title,category.title),
    short_title=left(coalesce(rule_row.player_title,category.short_title,category.title),70),
    plain_language_description=coalesce(nullif(category.plain_language_description,''),nullif(category.description,''),category.title),
    description=coalesce(nullif(category.plain_language_description,''),nullif(category.description,''),category.title),
    concept_group=coalesce(rule_row.concept_group,category.concept_group,category.id),
    recognizability_score=coalesce(rule_row.recognizability_score,category.recognizability_score),
    specificity_score=coalesce(rule_row.specificity_score,category.specificity_score),
    enabled=case when editorial_decision='approved' then category.enabled else false end,
    eligible_daily=case when editorial_decision='approved' then category.eligible_daily else false end,
    review_status=case
      when category.review_status='rejected' then 'rejected'
      when editorial_decision='excluded' then 'candidate'
      when editorial_decision='pending' and category.auto_qualified then 'needs_review'
      when editorial_decision='pending' then 'candidate'
      else category.review_status
    end,
    duplicate_status=case when editorial_decision='approved' then category.duplicate_status else 'not_eligible' end,
    superseded_by=case when editorial_decision='approved' then category.superseded_by else null end,
    auto_decision_reason=case when editorial_decision<>'approved' then editorial_reason else category.auto_decision_reason end,
    metadata=coalesce(category.metadata,'{}'::jsonb) || jsonb_build_object(
      'curationStatus',editorial_decision,
      'curationReason',editorial_reason,
      'curationVersion','geostats-v14-candidate-review-v1'
    ),
    updated_at=now()
  where category.id=p_category_id;

  return editorial_decision;
end;
$$;

create or replace function public.apply_category_player_quality(p_category_id text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  category_row public.stat_categories%rowtype;
  next_verifiability smallint;
  next_verifiability_status text;
  next_understandability smallint;
  next_fun smallint;
  next_objective text;
  next_status text;
  next_reason text;
  observation_exists boolean;
  description_text text;
begin
  select * into category_row from public.stat_categories where id=p_category_id;
  if not found then raise exception 'Unknown stat category %',p_category_id; end if;

  select exists(select 1 from public.stat_observations where category_id=p_category_id limit 1)
    into observation_exists;

  description_text:=coalesce(nullif(category_row.plain_language_description,''),nullif(category_row.description,''),category_row.title);
  next_understandability:=coalesce(category_row.understandability_score,category_row.recognizability_score,85);
  next_fun:=coalesce(category_row.fun_score,round((coalesce(category_row.recognizability_score,80)+coalesce(category_row.specificity_score,80))/2.0)::smallint);
  next_objective:=coalesce(category_row.objective_status,'objective');

  if lower(category_row.title || ' ' || description_text) ~
    '(happiness|corruption perception|democracy index|freedom index|global peace|prosperity index|competitiveness index|best countr|quality of government|expert assessment|subjective ranking|human development index)' then
    next_objective:='subjective';
  elsif lower(category_row.title || ' ' || description_text) ~
    '(composite score|composite index|weighted index|multiple indicators combined)' then
    next_objective:='composite';
  end if;

  if category_row.api_url is not null or category_row.exact_query_url is not null then
    next_verifiability:=100; next_verifiability_status:='direct_query';
  elsif category_row.download_url is not null then
    next_verifiability:=95; next_verifiability_status:='downloadable_table';
  elsif category_row.derivation_method is not null and jsonb_array_length(coalesce(category_row.input_datasets,'[]'::jsonb))>0 then
    next_verifiability:=92; next_verifiability_status:='reproducible_derivation';
  elsif observation_exists and category_row.source_indicator_code is not null and category_row.source_url is not null then
    -- Even when a provider only offers a dashboard/home page, GeoStats preserves
    -- the exact imported country rows, year, indicator code, and retrieval record.
    next_verifiability:=88; next_verifiability_status:='geostats_snapshot';
  elsif category_row.source_url is not null then
    next_verifiability:=60; next_verifiability_status:='general_source_only';
  else
    next_verifiability:=20; next_verifiability_status:='unverifiable';
  end if;

  if length(btrim(description_text))<12 then
    next_understandability:=least(next_understandability,55);
  end if;
  if length(description_text)>220 then
    next_understandability:=least(next_understandability,65);
  end if;
  if lower(btrim(description_text))=lower(btrim(category_row.title)) then
    next_understandability:=least(next_understandability,55);
  end if;
  if lower(description_text) like 'countries ranked by %'
     and lower(description_text) !~ '(measured|means|share|number|deaths|cases|per [0-9]|percent|percentage|years|kilometers|tonnes|dollars)' then
    next_understandability:=least(next_understandability,65);
  end if;
  if lower(category_row.title) like '%maternal mortality%'
     and lower(description_text) !~ '(pregnancy|childbirth)' then
    next_understandability:=least(next_understandability,60);
  end if;
  if lower(category_row.title) ~ '(mortality|death rate)'
     and lower(description_text) !~ '(death|dying)' then
    next_understandability:=least(next_understandability,65);
  end if;
  if lower(category_row.title) like '%incidence%'
     and lower(description_text) !~ '(new|cases)' then
    next_understandability:=least(next_understandability,65);
  end if;
  if lower(category_row.title) like '%prevalence%'
     and lower(description_text) !~ '(share|percent|percentage|people with|population with)' then
    next_understandability:=least(next_understandability,65);
  end if;
  if lower(category_row.title) like '%labor-force participation%'
     and lower(description_text) !~ '(employed|looking for work)' then
    next_understandability:=least(next_understandability,65);
  end if;
  if lower(category_row.title) ~ '(dalys?|hale|net barter|dependency ratio|labor underutilization|ppp conversion factor)' then
    next_understandability:=least(next_understandability,65);
  end if;

  if next_objective<>'objective' then
    next_status:='blocked';
    next_reason:='Blocked because GeoStats only uses objective, directly measurable country characteristics—not perception rankings, subjective judgments, or composite scores.';
  elsif next_verifiability<80 then
    next_status:='blocked';
    next_reason:='Blocked because the exact country values cannot yet be reproduced from a direct query, downloadable table, documented derivation, or preserved GeoStats source snapshot.';
  elsif next_understandability<70 then
    next_status:='blocked';
    next_reason:='Blocked because the category is not yet understandable from its title and plain-language description.';
  elsif next_fun<55 then
    next_status:='blocked';
    next_reason:='Blocked because the category is too technical or narrow for ordinary GeoStats play.';
  elsif next_verifiability<90 or next_understandability<80 or next_fun<70 then
    next_status:='caution';
    next_reason:='Eligible only after review: objective and reproducible, but one player-quality score is below the preferred threshold.';
  else
    next_status:='approved';
    next_reason:='Objective, reproducible, clearly explained, and suitable for GeoStats play.';
  end if;

  update public.stat_categories
  set
    plain_language_description=description_text,
    verifiability_score=next_verifiability,
    verifiability_status=next_verifiability_status,
    understandability_score=greatest(0,least(100,next_understandability)),
    fun_score=greatest(0,least(100,next_fun)),
    objective_status=next_objective,
    player_quality_status=next_status,
    player_quality_reason=next_reason,
    enabled=case when next_status='blocked' then false else enabled end,
    eligible_daily=case when next_status='blocked' then false else eligible_daily end,
    review_status=case when next_status='blocked' and review_status<>'rejected' then 'candidate' else review_status end,
    auto_decision_reason=case when next_status='blocked' then next_reason else auto_decision_reason end,
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'plainLanguageDescription',description_text,
      'technicalDefinition',coalesce(technical_definition,description_text),
      'unitExplanation',coalesce(unit_explanation,unit),
      'verifiabilityScore',next_verifiability,
      'verifiabilityStatus',next_verifiability_status,
      'understandabilityScore',greatest(0,least(100,next_understandability)),
      'funScore',greatest(0,least(100,next_fun)),
      'objectiveStatus',next_objective,
      'playerQualityStatus',next_status,
      'playerQualityReason',next_reason,
      'playerQualityPolicyVersion','geostats-v14-player-quality-v1'
    ),
    updated_at=now()
  where id=p_category_id;

  return next_status;
end;
$$;

-- Duplicate arbitration now also requires objective, reproducible, understandable,
-- fun-enough categories. All imports still enter the same fail-closed pipeline.
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
    and coalesce(category.objective_status,'uncertain')='objective'
    and coalesce(category.player_quality_status,'blocked')<>'blocked'
    and coalesce(category.verifiability_score,0)>=80
    and coalesce(category.understandability_score,0)>=70
    and coalesce(category.fun_score,0)>=55
  order by
    category.governance_priority asc,
    category.player_quality_status='approved' desc,
    category.verifiability_score desc,
    category.understandability_score desc,
    category.fun_score desc,
    category.credibility_score desc,
    category.quality_score desc,
    category.common_year_coverage desc,
    category.latest_available_year desc nulls last,
    category.id
  limit 1;

  update public.stat_categories category
  set
    enabled=case when category.id=chosen then true else false end,
    eligible_daily=case when category.id=chosen then true else false end,
    review_status=case
      when category.review_status='rejected' then 'rejected'
      when category.curation_status='excluded' then 'candidate'
      when category.credibility_status='quarantined' or coalesce(category.credibility_score,0)<75 then 'candidate'
      when category.player_quality_status='blocked' then 'candidate'
      when category.id=chosen then 'approved'
      when category.auto_qualified and category.provenance_status='approved' then 'candidate'
      when category.auto_qualified then 'needs_review'
      else 'candidate'
    end,
    duplicate_status=case
      when category.curation_status='excluded'
        or category.credibility_status='quarantined'
        or coalesce(category.credibility_score,0)<75
        or category.player_quality_status='blocked' then 'not_eligible'
      when category.id=chosen then 'preferred'
      when chosen is not null and category.auto_qualified and category.provenance_status='approved' then 'superseded'
      else 'not_eligible'
    end,
    superseded_by=case when category.id<>chosen and chosen is not null then chosen else null end,
    auto_decision_reason=case
      when category.curation_status='excluded' then category.curation_reason
      when category.credibility_status='quarantined' or coalesce(category.credibility_score,0)<75 then category.credibility_reason
      when category.player_quality_status='blocked' then category.player_quality_reason
      when category.id=chosen then 'Selected after quality, provenance, credibility, objective-data, verifiability, clarity, fun, and duplicate review.'
      when chosen is not null and category.auto_qualified and category.provenance_status='approved'
        then 'Passed the gates but was superseded by a stronger near-duplicate.'
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
  perform public.apply_category_player_quality(p_category_id);
  select concept_group into group_name from public.stat_categories where id=p_category_id;
  if group_name is null then
    update public.stat_categories set concept_group=id where id=p_category_id;
    group_name:=p_category_id;
  end if;
  return public.refresh_stat_concept_group(group_name);
end;
$$;

revoke all on function public.apply_category_player_quality(text) from public,anon,authenticated;
revoke all on function public.refresh_stat_concept_group(text) from public,anon,authenticated;
revoke all on function public.apply_category_governance(text) from public,anon,authenticated;
grant execute on function public.apply_category_player_quality(text) to service_role;
grant execute on function public.refresh_stat_concept_group(text) to service_role;
grant execute on function public.apply_category_governance(text) to service_role;

-- Apply player-quality governance to the existing catalog and rerun duplicate arbitration.
do $$
declare row record;
begin
  for row in select id from public.stat_categories loop
    perform public.apply_category_player_quality(row.id);
  end loop;
  for row in select distinct concept_group from public.stat_categories where concept_group is not null loop
    perform public.refresh_stat_concept_group(row.concept_group);
  end loop;
end $$;

update public.data_sources
set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'exact_value_snapshots',true,
  'plain_language_descriptions',true,
  'objective_only',true,
  'verifiability_gate',80,
  'understandability_gate',70,
  'fun_gate',55,
  'player_quality_policy','geostats-v14-player-quality-v1'
), updated_at=now()
where status in ('active','importing','planned');

commit;
