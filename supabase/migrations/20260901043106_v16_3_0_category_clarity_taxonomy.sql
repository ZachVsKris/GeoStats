begin;

-- Repair legacy metadata spelling damage before the runtime sees it. Domain
-- values are subject labels, not measurement buckets, and must be canonical.
update public.stat_categories c
set metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
  'broadDomain',
  case lower(coalesce(c.metadata->>'broadDomain',''))
    when '-conomy' then 'economy'
    when '-nvironment' then 'environment'
    when '-nergy' then 'energy'
    when '-ransport' then 'transport'
    when '-echnology' then 'technology'
    when '-overnment' then 'government'
    when '-rade' then 'trade'
    when '-emographics' then 'demographics'
    when '-ealth' then 'health'
    when '-griculture' then 'agriculture'
    when '-ulture' then 'culture'
    when '-limate' then 'climate'
    else case public.category_macro_domain_v16_2_7(c.family,c.source_organization,c.title,c.metadata)
      when 'government-civics' then 'government'
      when 'culture-language-religion' then 'culture'
      when 'geology-natural-hazards' then 'geology'
      when 'food-agriculture' then 'agriculture'
      when 'climate-environment-resources' then 'environment'
      when 'health-demographics' then 'demographics'
      when 'education-labor-society' then 'education'
      when 'infrastructure-technology-science' then 'technology'
      when 'economy-finance' then 'economy'
      else public.category_macro_domain_v16_2_7(c.family,c.source_organization,c.title,c.metadata)
    end
  end,
  'taxonomyVersion', 'geostats-v16.3.0'
), updated_at=now()
where nullif(trim(coalesce(c.metadata->>'broadDomain','')),'') is null
   or coalesce(c.metadata->>'broadDomain','') like '-%';

-- Table 1 of Beck et al. (2023) is the definition contract for the public
-- Köppen-Geiger cards. Copy is intentionally exact enough to teach the term
-- while remaining readable on a game card.
with definitions(id,description,technical_definition,strategy_family) as (values
  ('koppen-geiger:desert-share','Share of land where annual rainfall is below half the Köppen–Geiger aridity limit, a temperature- and rainfall-season threshold','Area-weighted share in BWh or BWk: MAP < 5 × Pthreshold','koppen-climate:desert'),
  ('koppen-geiger:arid-share','Share of land where annual rainfall is below the Köppen–Geiger aridity limit: 20× mean annual °C, plus 280 mm for summer rain, 0 mm for winter rain, or 140 mm otherwise','Area-weighted share in BWh, BWk, BSh, or BSk: MAP < 10 × Pthreshold','koppen-climate:arid'),
  ('koppen-geiger:steppe-share','Share of land receiving at least half, but less than all, of the Köppen–Geiger aridity-limit rainfall','Area-weighted share in BSh or BSk: 5 × Pthreshold ≤ MAP < 10 × Pthreshold','koppen-climate:steppe'),
  ('koppen-geiger:tropical-rainforest-share','Share of land where every month averages at least 18°C and the driest month receives at least 60 mm of rain','Area-weighted share in Af: not B, Tcold ≥ 18°C, and Pdry ≥ 60 mm/month','koppen-climate:tropical-rainforest'),
  ('koppen-geiger:tropical-monsoon-share','Share of land where every month averages at least 18°C and the driest month receives under 60 mm but at least 100 minus annual rainfall divided by 25','Area-weighted share in Am: not B or Af, Tcold ≥ 18°C, and Pdry ≥ 100 − MAP/25','koppen-climate:tropical-monsoon'),
  ('koppen-geiger:tropical-savanna-share','Share of land where every month averages at least 18°C and the driest month receives under 60 mm and less than 100 minus annual rainfall divided by 25','Area-weighted share in Aw: not B or Af, Tcold ≥ 18°C, and Pdry < 100 − MAP/25','koppen-climate:tropical-savanna'),
  ('koppen-geiger:temperate-share','Share of non-arid land where the coldest month averages above 0°C but below 18°C and the warmest month averages above 10°C','Area-weighted share in C classes: not B, Thot > 10°C, and 0°C < Tcold < 18°C','koppen-climate:temperate'),
  ('koppen-geiger:mediterranean-share','Share of temperate land where the driest summer month receives under 40 mm and less than one-third the rain of the wettest winter month','Area-weighted share in Csa, Csb, or Csc: C-class criteria plus Psdry < 40 mm/month and Psdry < Pwwet/3','koppen-climate:mediterranean'),
  ('koppen-geiger:continental-share','Share of non-arid land where the coldest month averages 0°C or below and the warmest month averages above 10°C','Area-weighted share in D classes: not B, Thot > 10°C, and Tcold ≤ 0°C','koppen-climate:continental'),
  ('koppen-geiger:polar-share','Share of non-arid land where the warmest month averages 10°C or below','Area-weighted share in E classes: not B and Thot ≤ 10°C','koppen-climate:polar'),
  ('koppen-geiger:tundra-share','Share of non-arid land where the warmest month averages above 0°C but no more than 10°C','Area-weighted share in ET: not B and 0°C < Thot ≤ 10°C','koppen-climate:tundra'),
  ('koppen-geiger:ice-cap-share','Share of non-arid land where even the warmest month averages 0°C or below','Area-weighted share in EF: not B and Thot ≤ 0°C','koppen-climate:ice-cap')
)
update public.stat_categories c
set description=d.description,
    plain_language_description=d.description,
    technical_definition=d.technical_definition,
    unit_explanation='% of classified land',
    measurement_type='share',
    immediate_comprehension_score=98,
    understandability_score=98,
    content_review_status='approved',
    content_review_reason='v16.3.0 source-matched terminology audit: the player copy defines the climate using Beck et al. (2023) Table 1 thresholds.',
    content_review_version='geostats-v16.3.0-definition-audit',
    metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object(
      'plainLanguageDescription',d.description,
      'boardDescription',d.description,
      'technicalDefinition',d.technical_definition,
      'unitExplanation','% of classified land',
      'measurementType','share',
      'broadDomain','climate',
      'knowledgeCluster','climate-classification',
      'strategyFamily',d.strategy_family,
      'definitionStandard','Beck et al. 2023 Table 1',
      'contentReviewVersion','geostats-v16.3.0-definition-audit'
    ),
    updated_at=now()
from definitions d
where c.id=d.id;

-- Make sure every currently playable card has a concrete description after
-- the taxonomy repair. Definition-heavy climate copy is deliberately allowed
-- to run longer than the normal generated one-line summary.
update public.stat_categories c
set metadata=jsonb_set(
      coalesce(c.metadata,'{}'::jsonb),
      '{boardDescription}',
      to_jsonb(public.category_board_description_v16_2_8(
        c.title,
        coalesce(c.plain_language_description,c.description),
        c.unit,
        c.metadata->>'boardDescription'
      )),
      true
    ),
    updated_at=now()
where c.enabled and c.eligible_daily
  and nullif(trim(coalesce(c.metadata->>'boardDescription','')),'') is null;

-- These are internal audit stores. Existing grants already limit them to the
-- service role; RLS supplies defense in depth for exposed-schema linting.
alter table public.category_decision_provenance_v16_2_7 enable row level security;
alter table public.generator_reachability_v16_2_7 enable row level security;

select public.refresh_category_decision_provenance_v16_2_7();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

commit;
