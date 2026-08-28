begin;

-- v16.2.7 hotfix: do not classify "transport" as sports simply because it
-- contains the substring "sport". Release breadth gates must use semantic
-- whole-word sports concepts only.
create or replace function public.category_macro_domain_v16_2_7(
  p_family text,p_source text,p_title text,p_metadata jsonb default '{}'::jsonb
) returns text language sql immutable as $$
  select case
    when lower(coalesce(p_metadata->>'broadDomain',''))='sports'
      or lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(^|[^a-z])(sport|sports|world cup|fifa|olympic|paralympic|football|soccer)([^a-z]|$)' then 'sports'
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

-- Preserve explicit product removals as durable editorial exclusions. The
-- wording intentionally matches the v16.2.7 provenance classifier so later
-- first-principles re-audits cannot reopen these categories.
update public.category_review_state
set status='rejected', duplicate_of=null,
    notes=concat_ws(E'\n',nullif(notes,''),'v16.2.7 durable product exclusion.'),
    updated_at=now()
where category_id in (
  'unescoheritage:all-sites',
  'comtrade:most-sports-equipment-exported',
  'worldbank-catalog:er-ptd-totl-zs'
);

update public.stat_categories
set review_status='rejected',curation_status='excluded',content_review_status='excluded',
    curation_reason=case id
      when 'unescoheritage:all-sites' then 'v16.2.7: intentionally excluded because World Heritage categories are outside the curated GeoStats product mix.'
      when 'comtrade:most-sports-equipment-exported' then 'v16.2.7: intentionally excluded because sports-equipment exports are too niche/contrived for the curated GeoStats product mix.'
      when 'worldbank-catalog:er-ptd-totl-zs' then 'v16.2.7: intentionally excluded because the combined land-and-sea protected-share framing is ambiguous and overlaps clearer categories.'
      else curation_reason end,
    content_review_reason=case id
      when 'unescoheritage:all-sites' then 'v16.2.7 durable product decision: exclude UNESCO World Heritage categories.'
      when 'comtrade:most-sports-equipment-exported' then 'v16.2.7 durable product decision: exclude sports-equipment exports.'
      when 'worldbank-catalog:er-ptd-totl-zs' then 'v16.2.7 durable product decision: exclude ambiguous combined land-and-sea protected-share framing.'
      else content_review_reason end,
    enabled=false,eligible_daily=false,updated_at=now()
where id in (
  'unescoheritage:all-sites',
  'comtrade:most-sports-equipment-exported',
  'worldbank-catalog:er-ptd-totl-zs'
);

select public.refresh_category_decision_provenance_v16_2_7();

commit;
