begin;

-- Reapply the reviewed percentage titles after later source installers restored
-- older source-facing labels. Player titles use % consistently; source fields
-- and technical definitions remain unchanged.
with copy(id,title) as (values
  ('agLand','Highest % of land used for agriculture'),
  ('arablePct','Highest % of land that is arable'),
  ('education','Highest education spending as % of GDP'),
  ('forestPct','Highest % of land covered by forest'),
  ('healthSpendShare','Highest health spending as % of GDP'),
  ('natural-earth:highest-mapped-glaciated-share','Highest % of land covered by glaciers'),
  ('natural-earth:highest-mapped-lake-share','Highest % of land covered by lakes and reservoirs'),
  ('pew-religion:hindu-share','Highest % of population that is Hindu'),
  ('protected','Highest % of land protected'),
  ('worldbank-catalog:ag-lnd-crop-zs','Highest % of land in permanent crops'),
  ('worldbank-catalog:bm-gsr-cmcp-zs','Highest telecom and computer services as % of service imports'),
  ('worldbank-catalog:bm-gsr-tran-zs','Highest transport services as % of service imports'),
  ('worldbank-catalog:bm-gsr-trvl-zs','Highest residents’ foreign travel spending as % of service imports'),
  ('worldbank-catalog:bx-gsr-ccis-zs','Highest IT and telecom services as % of service exports'),
  ('worldbank-catalog:bx-gsr-cmcp-zs','Highest telecom and computer services as % of service exports'),
  ('worldbank-catalog:bx-gsr-trvl-zs','Highest foreign visitor spending as % of service exports'),
  ('worldbank-catalog:bx-trf-pwkr-dt-gd-zs','Highest money sent home from abroad as % of GDP'),
  ('worldbank-catalog:eg-elc-fosl-zs','Highest % of electricity from fossil fuels'),
  ('worldbank-catalog:eg-elc-hyro-zs','Highest % of electricity from hydropower'),
  ('worldbank-catalog:eg-elc-ngas-zs','Highest % of electricity from natural gas'),
  ('worldbank-catalog:eg-elc-petr-zs','Highest % of electricity from oil'),
  ('worldbank-catalog:eg-use-comm-cl-zs','Highest % of energy from alternative and nuclear sources'),
  ('worldbank-catalog:eg-use-crnw-zs','Highest % of energy from biomass and waste'),
  ('worldbank-catalog:en-ghg-all-pc-ce-ar5','Most greenhouse gas emissions per person'),
  ('worldbank-catalog:en-ghg-co2-pi-mt-ce-ar5','Most CO₂ emissions from power generation'),
  ('worldbank-catalog:en-urb-lcty-ur-zs','Highest % of urban residents living in the largest city'),
  ('worldbank-catalog:en-urb-mcty-tl-zs','Highest % of people in cities over one million'),
  ('worldbank-catalog:er-h2o-fwag-zs','Highest % of freshwater withdrawals used by agriculture'),
  ('worldbank-catalog:er-h2o-fwdm-zs','Highest % of freshwater withdrawals used by households'),
  ('worldbank-catalog:er-h2o-fwin-zs','Highest % of freshwater withdrawals used by industry'),
  ('worldbank-catalog:er-mrn-ptmr-zs','Highest % of territorial waters protected'),
  ('worldbank-catalog:fx-own-totl-zs','Highest % of adults with a financial or mobile money account'),
  ('worldbank-catalog:gc-tax-totl-gd-zs','Highest tax revenue as % of GDP'),
  ('worldbank-catalog:ms-mil-xpnd-zs','Highest military spending as % of government spending')
)
update public.stat_categories c
set title=copy.title,
    content_review_status='approved',
    content_review_reason='v16.3.0 catalog-wide player-copy normalization.',
    content_review_version='geostats-v16.3.0-definition-audit',
    updated_at=now()
from copy where c.id=copy.id;

-- Spell out the aridity formula on the card, not only in the technical audit.
with definitions(id,description) as (values
 ('koppen-geiger:desert-share','Share of land where annual rainfall is below half the Köppen–Geiger aridity limit: 20× mean annual °C, plus 280 mm for summer rain, 0 mm for winter rain, or 140 mm otherwise'),
 ('koppen-geiger:steppe-share','Share of land receiving at least half, but less than all, of the Köppen–Geiger aridity limit: 20× mean annual °C, plus 280 mm for summer rain, 0 mm for winter rain, or 140 mm otherwise')
)
update public.stat_categories c
set description=d.description,
    plain_language_description=d.description,
    metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object(
      'plainLanguageDescription',d.description,
      'boardDescription',d.description
    ),updated_at=now()
from definitions d where c.id=d.id;

-- The computed review view is the single playability authority. Keep legacy
-- flags in sync so every server path sees the same 321-category catalog.
update public.stat_categories c
set enabled=v.computed_playable_v16_2,
    eligible_daily=v.computed_playable_v16_2,
    updated_at=now()
from public.category_runtime_review_v16_2 v
where c.id=v.id
  and (c.enabled is distinct from v.computed_playable_v16_2
    or c.eligible_daily is distinct from v.computed_playable_v16_2);

update public.stat_categories c
set metadata=jsonb_set(
      coalesce(c.metadata,'{}'::jsonb),'{boardDescription}',
      to_jsonb(public.category_board_description_v16_2_8(
        c.title,coalesce(c.plain_language_description,c.description),c.unit,
        c.metadata->>'boardDescription'
      )),true
    ),updated_at=now()
where c.enabled and c.eligible_daily
  and nullif(trim(coalesce(c.metadata->>'boardDescription','')),'') is null;

-- The prior 82-character lint treated a source-matched definition as a defect.
-- Definitions may be longer, while generic/internal copy remains forbidden.
create or replace view public.category_copy_clarity_v16_2_8
with (security_invoker=true) as
select c.id,c.title,c.metadata->>'boardDescription' as board_description,
  array_remove(array[
    case when length(c.title)>96 then 'title_too_long' end,
    case when c.title ~* '(^|[^a-z])(mapped|reported value|indicator code|source-family|merchandise|intangible cultural heritage|SNA|BoP)([^a-z]|$)' then 'internal_or_specialist_title' end,
    case when c.title ~* '(^|[^a-z])share([^a-z]|$)' then 'share_instead_of_percent' end,
    case when c.value_type='total' and c.title ~* '^Highest ' then 'highest_used_for_total' end,
    case when c.value_type='percentage' and c.title ~* '^(Most|Largest) ' then 'most_or_largest_used_for_percentage' end,
    case when nullif(trim(c.metadata->>'boardDescription'),'') is null then 'missing_board_description' end,
    case when length(c.metadata->>'boardDescription')>200 then 'board_description_too_long' end,
    case when c.metadata->>'boardDescription' ~* '^(compare countries|compare the official|official country value)' then 'generic_board_description' end,
    case when c.metadata->>'boardDescription' ~* '(^|[^a-z])(mapped|reported value|indicator code|source-family)([^a-z]|$)' then 'internal_board_description' end
  ],null) as issues
from public.stat_categories c where c.enabled and c.eligible_daily;

do $$ begin
 if exists(select 1 from public.category_copy_clarity_v16_2_8 where cardinality(issues)>0) then
   raise exception 'v16.3.0 playable-category clarity gate failed';
 end if;
end $$;

select public.refresh_category_decision_provenance_v16_2_7();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

commit;
