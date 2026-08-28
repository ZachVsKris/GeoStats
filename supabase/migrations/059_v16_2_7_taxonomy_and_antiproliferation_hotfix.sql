begin;

-- Whole-word macro-domain matching prevents Agriculture from being counted as
-- culture merely because it contains the substring "culture". Agriculture is
-- also classified before generic physical-land concepts so the release gate
-- measures the intended subject balance rather than flattering the catalog.
create or replace function public.category_macro_domain_v16_2_7(
  p_family text,p_source text,p_title text,p_metadata jsonb default '{}'::jsonb
) returns text language sql immutable as $$
  select case
    when lower(coalesce(p_metadata->>'broadDomain',''))='sports'
      or lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(^|[^a-z])(sport|sports|world cup|fifa|olympic|paralympic|football|soccer)([^a-z]|$)' then 'sports'
    when lower(coalesce(p_metadata->>'broadDomain',''))='history'
      or lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(history|historical|suffrage|independence|admitted to the un|constitution.*year|milestone)' then 'history'
    when lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(^|[^a-z])(government|parliament|election|constitution|politic|politics|political|democracy|civic|civics)([^a-z]|$)' then 'government-civics'
    when lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(^|[^a-z])(religion|religious|culture|cultural|language|languages|heritage|christian|muslim|hindu|buddhist|jewish)([^a-z]|$)' then 'culture-language-religion'
    when lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(^|[^a-z])(geology|geological|hazard|hazards|volcano|volcanoes|earthquake|earthquakes|tsunami|seismic|tectonic)([^a-z]|$)' then 'geology-natural-hazards'
    when lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(^|[^a-z])(agriculture|agricultural|crop|crops|fruit|fruits|vegetable|vegetables|livestock|dairy|food|foods)([^a-z]|$)'
      or lower(coalesce(p_source,'')) like 'faostat%' then 'food-agriculture'
    when lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(^|[^a-z])(geography|geographic|land|terrain|coast|coastline|river|rivers|lake|lakes|border|borders|neighbor|neighbors|neighbour|neighbours|glaciat|elevation|landlocked|arctic|tropical)([^a-z]|$)' then 'physical-geography'
    when lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(^|[^a-z])(climate|environment|environmental|energy|water|resource|resources|temperature|rain|rainfall|precipitation|forest|forests|emission|emissions|protected)([^a-z]|$)' then 'climate-environment-resources'
    when lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(^|[^a-z])(health|population|demography|demographic|migration|migrant|displacement|life expectancy|mortality|fertility|refugee|refugees|asylum)([^a-z]|$)' then 'health-demographics'
    when lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(^|[^a-z])(education|school|schools|literacy|labor|labour|employment|society|social)([^a-z]|$)' then 'education-labor-society'
    when lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(^|[^a-z])(infrastructure|transport|technology|science|internet|rail|railway|road|roads|patent|research|telecom|telecommunications)([^a-z]|$)' then 'infrastructure-technology-science'
    when lower(coalesce(p_family,'')||' '||coalesce(p_title,'')) ~ '(^|[^a-z])(trade|export|exports|import|imports)([^a-z]|$)' then 'trade'
    else 'economy-finance'
  end
$$;

-- Preserve the runtime's explicitly retired Natural Earth span/fragmentation
-- concepts. Valid source data does not make these good gameplay categories.
update public.category_review_state r
set status='rejected',duplicate_of=null,
    notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.7 durable product exclusion: retired Natural Earth span/fragmentation concept.'),
    updated_at=now()
where r.category_id in (
  'natural-earth:largest-geographic-span',
  'natural-earth:largest-north-south-span',
  'natural-earth:largest-east-west-span',
  'natural-earth:farthest-from-equator',
  'natural-earth:most-separate-land-areas',
  'natural-earth:most-large-land-areas'
);

update public.stat_categories c
set review_status='rejected',curation_status='excluded',content_review_status='excluded',
    curation_reason='v16.2.7: intentionally excluded because this retired Natural Earth span/fragmentation concept is outside the curated product mix.',
    content_review_reason='v16.2.7 durable product decision: retain clearer, more intuitive physical-geography concepts instead.',
    enabled=false,eligible_daily=false,updated_at=now()
where c.id in (
  'natural-earth:largest-geographic-span',
  'natural-earth:largest-north-south-span',
  'natural-earth:largest-east-west-span',
  'natural-earth:farthest-from-equator',
  'natural-earth:most-separate-land-areas',
  'natural-earth:most-large-land-areas'
);

-- Anti-proliferation: keep only a small, intuitive greenhouse-gas family:
-- total GHG, GHG per person, total methane (legacy category), and CO2 from power
-- generation. The many gas-by-sector variants remain auditable but non-playable.
update public.category_review_state r
set status='rejected',duplicate_of=null,
    notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.7 durable anti-proliferation exclusion: excessive greenhouse-gas subcomponent variant.'),
    updated_at=now()
from public.stat_categories c
where c.id=r.category_id
  and c.source_organization='World Bank'
  and upper(coalesce(c.source_indicator_code,'')) like 'EN.GHG.%'
  and c.id not in (
    'worldbank-catalog:en-ghg-all-mt-ce-ar5',
    'worldbank-catalog:en-ghg-all-pc-ce-ar5',
    'worldbank-catalog:en-ghg-co2-pi-mt-ce-ar5'
  );

update public.stat_categories c
set review_status='rejected',curation_status='excluded',content_review_status='excluded',
    curation_reason='v16.2.7: intentionally excluded because the greenhouse-gas family is capped to a small set of intuitive, meaningfully distinct concepts.',
    content_review_reason='v16.2.7 durable anti-proliferation decision: exclude repetitive gas-by-sector and near-duplicate GHG variants.',
    enabled=false,eligible_daily=false,updated_at=now()
where c.source_organization='World Bank'
  and upper(coalesce(c.source_indicator_code,'')) like 'EN.GHG.%'
  and c.id not in (
    'worldbank-catalog:en-ghg-all-mt-ce-ar5',
    'worldbank-catalog:en-ghg-all-pc-ce-ar5',
    'worldbank-catalog:en-ghg-co2-pi-mt-ce-ar5'
  );

select public.refresh_category_decision_provenance_v16_2_7();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

commit;
