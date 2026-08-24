-- GeoStats v14.3
-- Board-quality semantics and globally meaningful winners.
-- Every playable category receives a hard semantic family. Daily boards may use
-- at most one category from each family, and the board winner for every category
-- must rank within the global top 30 among the verified country snapshot.

begin;

alter table public.stat_categories
  add column if not exists semantic_family text,
  add column if not exists semantic_topic text;

with category_text as (
  select
    id,
    lower(concat_ws(' ',id,title,short_title,description,family,source_organization,source_indicator_code,concept_group,
      metadata->>'element',metadata->>'source_indicator_name')) as searchable
  from public.stat_categories
), classified as (
  select
    id,
    case
      when searchable ~ '(refugee|asylum|displacement)' and searchable ~ '(origin|originating|by origin|by-origin)'
        then 'forced-displacement-origin'
      when searchable ~ '(refugee|asylum|displacement)' and searchable ~ '(hosted|received|destination|receiving)'
        then 'forced-displacement-destination'
      when searchable ~ '(refugee|asylum|displacement)'
        then 'forced-displacement'
      when searchable ~ '(employment.to.population|employment-to-population|unemployment|labor.force.participation|labour.force.participation)'
        then 'labor-market-utilization'
      when searchable ~ '(labor.productivity|labour.productivity|productivity.growth)'
        then 'labor-productivity'
      when searchable ~ '(self.employment|wage.employment|employment.status)'
        then 'employment-status'
      when searchable ~ '(^|[^a-z])yield([^a-z]|$)' and searchable ~ '(faostat|qcl)'
        then 'crop-yield'
      when searchable ~ '(^|[^a-z])production([^a-z]|$)' and searchable ~ '(faostat|qcl)'
        then 'crop-production'
      when searchable ~ '(area.harvested|harvested.area)' and searchable ~ '(faostat|qcl)'
        then 'crop-harvested-area'
      when searchable ~ '(gdp|gross.domestic.product|economic.output)'
        then 'economic-output'
      when searchable ~ '(forest.area|forest.cover|forest.percent|forest.share|least.forest)'
        then 'forest-cover'
      when searchable ~ '(urban.population|rural.population|urbanization|settlement.share)'
        then 'settlement-share'
      when searchable ~ 'life.expectancy' then 'life-expectancy'
      when searchable ~ 'infant.mortality' then 'infant-mortality'
      when searchable ~ 'maternal.mortality' then 'maternal-mortality'
      when searchable ~ '(vaccination|immunization|measles.vaccine)' then 'immunization-coverage'
      when searchable ~ '(merchandise.export|general.export|exports.share)' then 'general-exports'
      when searchable ~ '(merchandise.import|general.import)' then 'general-imports'
      else null
    end as inferred_family
  from category_text
)
update public.stat_categories category
set
  semantic_family=coalesce(
    classified.inferred_family,
    nullif(category.metadata->>'semanticFamily',''),
    nullif(category.concept_group,''),
    category.id
  ),
  semantic_topic=coalesce(
    nullif(category.metadata->>'semanticTopic',''),
    nullif(category.concept_group,''),
    category.id
  ),
  metadata=coalesce(category.metadata,'{}'::jsonb)||jsonb_build_object(
    'semanticFamily',coalesce(classified.inferred_family,nullif(category.metadata->>'semanticFamily',''),nullif(category.concept_group,''),category.id),
    'semanticTopic',coalesce(nullif(category.metadata->>'semanticTopic',''),nullif(category.concept_group,''),category.id),
    'semanticRulesVersion','v14.3'
  ),
  updated_at=now()
from classified
where classified.id=category.id;

alter table public.stat_categories alter column semantic_family set not null;
alter table public.stat_categories alter column semantic_topic set not null;

create index if not exists stat_categories_semantic_family_idx
  on public.stat_categories(semantic_family,enabled,eligible_daily);
create index if not exists stat_categories_semantic_topic_idx
  on public.stat_categories(semantic_topic,source_organization);

create or replace view public.board_semantic_conflicts
with (security_invoker=true)
as
select
  first.id as first_category_id,
  first.title as first_title,
  second.id as second_category_id,
  second.title as second_title,
  first.semantic_family,
  first.family as first_domain,
  second.family as second_domain
from public.stat_categories first
join public.stat_categories second
  on first.id < second.id
 and first.semantic_family=second.semantic_family
where first.enabled and first.eligible_daily
  and second.enabled and second.eligible_daily
order by first.semantic_family,first.title,second.title;

create or replace view public.board_quality_category_status
with (security_invoker=true)
as
select
  category.id,
  category.title,
  category.source_organization,
  category.family as broad_domain,
  category.semantic_family,
  category.semantic_topic,
  category.enabled,
  category.eligible_daily,
  category.validation_status,
  category.common_year,
  category.common_year_coverage,
  count(conflict.second_category_id)::bigint as same_family_playable_conflicts
from public.stat_categories category
left join public.board_semantic_conflicts conflict
  on conflict.first_category_id=category.id or conflict.second_category_id=category.id
where category.review_status<>'rejected'
group by category.id,category.title,category.source_organization,category.family,
  category.semantic_family,category.semantic_topic,category.enabled,category.eligible_daily,
  category.validation_status,category.common_year,category.common_year_coverage;

grant select on public.board_semantic_conflicts to service_role;
grant select on public.board_quality_category_status to service_role;

-- v14.3 makes source integrity fail-closed permanently, not only after the
-- feature flag is activated. Imports and failed audits may preserve editorial
-- approval, but a category cannot become enabled until it is verified.
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
    and category.validation_status='verified'
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
      when category.validation_status in ('failed','unable_to_verify') then 'candidate'
      when category.validation_status<>'verified' then 'needs_review'
      when category.curation_status='excluded' then 'candidate'
      when category.credibility_status='quarantined' or coalesce(category.credibility_score,0)<75 then 'candidate'
      when category.player_quality_status='blocked' then 'candidate'
      when category.id=chosen then 'approved'
      when category.auto_qualified and category.provenance_status='approved' then 'candidate'
      when category.auto_qualified then 'needs_review'
      else 'candidate'
    end,
    duplicate_status=case
      when category.validation_status<>'verified'
        or category.curation_status='excluded'
        or category.credibility_status='quarantined'
        or coalesce(category.credibility_score,0)<75
        or category.player_quality_status='blocked' then 'not_eligible'
      when category.id=chosen then 'preferred'
      when chosen is not null and category.auto_qualified and category.provenance_status='approved' then 'superseded'
      else 'not_eligible'
    end,
    superseded_by=case when category.id<>chosen and chosen is not null then chosen else null end,
    auto_decision_reason=case
      when category.validation_status in ('failed','unable_to_verify') then 'Source integrity quarantine: '||coalesce(category.validation_reason,'validation did not pass')
      when category.validation_status<>'verified' then 'Awaiting official-source integrity validation.'
      when category.curation_status='excluded' then category.curation_reason
      when category.credibility_status='quarantined' or coalesce(category.credibility_score,0)<75 then category.credibility_reason
      when category.player_quality_status='blocked' then category.player_quality_reason
      when category.id=chosen then 'Selected after source integrity, quality, provenance, credibility, objectivity, clarity, fun, and duplicate review.'
      when chosen is not null and category.auto_qualified and category.provenance_status='approved' then 'Passed the gates but was superseded by a stronger near-duplicate.'
      else category.auto_decision_reason
    end,
    updated_at=now()
  where category.concept_group=p_concept_group
    and category.review_status<>'rejected';

  return chosen;
end;
$$;

-- Re-evaluate all existing concept groups under the permanent verified-only gate.
do $$
declare row record;
begin
  for row in select distinct concept_group from public.stat_categories where concept_group is not null loop
    perform public.refresh_stat_concept_group(row.concept_group);
  end loop;
end;
$$;

-- Keep activation fail-closed, but record that the semantic/top-30 release performed it.
create or replace function public.activate_source_integrity_enforcement()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare pending_enabled integer;
declare verified_count integer;
declare quarantined_count integer;
declare row record;
begin
  select count(*) into pending_enabled from public.stat_categories
  where (enabled or eligible_daily)
    and coalesce(validation_status,'pending')<>'verified';
  if pending_enabled>0 then
    raise exception 'Cannot activate source integrity enforcement: % currently playable categories are not verified.',pending_enabled;
  end if;
  update public.geostats_feature_flags
    set enabled=true,updated_at=now(),details=coalesce(details,'{}'::jsonb)||jsonb_build_object(
      'activatedAt',now(),
      'activatedBy','v14.3 source-integrity and semantic-quality audit',
      'boardWinnerGlobalRankLimit',30,
      'semanticFamilyUniqueness',true
    )
    where id='source_integrity_enforced';
  for row in select distinct concept_group from public.stat_categories where concept_group is not null loop
    perform public.refresh_stat_concept_group(row.concept_group);
  end loop;
  select count(*) into verified_count from public.stat_categories where validation_status='verified';
  select count(*) into quarantined_count from public.stat_categories where validation_status in ('failed','unable_to_verify');
  return jsonb_build_object(
    'enforced',true,
    'verified',verified_count,
    'quarantined',quarantined_count,
    'boardWinnerGlobalRankLimit',30,
    'semanticFamilyUniqueness',true
  );
end;
$$;

commit;
