begin;

create temporary table owner_copy_updates (
  id text primary key,
  title text not null,
  description text not null
) on commit drop;

insert into owner_copy_updates (id, title, description) values
  ('gdpGrowth', 'Fastest GDP growth', 'Annual growth in inflation-adjusted economic output in 2025, compared with 2024'),
  ('worldbank-catalog:ag-lnd-crop-zs', 'Highest % of land in permanent crops', 'Share of land used for long-term crops that do not need replanting after each harvest, such as coffee, cocoa, rubber, olives, grapes, and fruit or nut trees'),
  ('faostat-fbs:pulses', 'Highest estimated pulse consumption per person', 'Estimated dried bean, lentil, pea and chickpea consumption per person from national food-balance data; not measured household intake'),
  ('worldbank-catalog:fp-cpi-totl-zg', 'Highest inflation', 'Increase in consumer prices in 2025 compared with 2024'),
  ('koppen-geiger:continental-share', 'Highest percentage of land with a continental climate', 'Non-arid land where the coldest month averages 0°C or below and the warmest month above 10°C'),
  ('koppen-geiger:desert-share', 'Highest percentage of land with a desert climate', 'Land receiving less than half the temperature- and season-adjusted rainfall limit for arid climates'),
  ('koppen-geiger:mediterranean-share', 'Highest percentage of land with a Mediterranean climate', 'Temperate land with dry summers and wetter winters; not limited to the Mediterranean region'),
  ('koppen-geiger:polar-share', 'Highest percentage of land with a polar climate', 'Non-arid land where even the warmest month averages 10°C or below'),
  ('koppen-geiger:temperate-share', 'Highest percentage of land with a temperate climate', 'Non-arid land where the coldest month averages above 0°C but below 18°C and the warmest month above 10°C'),
  ('koppen-geiger:tropical-monsoon-share', 'Highest percentage of land with a tropical monsoon climate', 'Land averaging at least 18°C year-round, with a short dry season and enough annual rain to be wetter than tropical savanna'),
  ('koppen-geiger:tundra-share', 'Highest percentage of land with a tundra climate', 'Non-arid land where the warmest month averages above 0°C but no more than 10°C'),
  ('koppen-geiger:arid-share', 'Highest percentage of land with an arid climate', 'Land where rainfall is below a temperature- and season-adjusted dryness threshold; includes deserts and steppes'),
  ('worldbank-catalog:er-fsh-aqua-mt', 'Largest aquaculture production', 'Farmed fish, shellfish and aquatic plants harvested during the year, measured in tonnes'),
  ('worldbank-catalog:er-fsh-capt-mt', 'Largest capture fisheries production', 'Wild fish, shellfish and other aquatic animals caught from natural waters during the year, measured in tonnes'),
  ('comtrade:most-electrical-equipment-exported', 'Largest electrical equipment exports', 'Annual export value of electrical machinery and equipment, including phones, electronic components, batteries, motors, generators, insulated wire and household electrical appliances'),
  ('worldbank-catalog:en-urb-lcty', 'Largest population in the largest city', 'Number of people living in each country''s largest urban area'),
  ('history:worldbank-infant-mortality-below-25', 'Latest to reach under 25 infant deaths per 1,000 births', 'Year infant mortality first fell below 25 deaths before age one per 1,000 live births; later milestone years rank higher'),
  ('history:worldbank-under-five-mortality-below-50', 'Latest to reach under 50 child deaths per 1,000 births', 'Year deaths before age five first fell below 50 per 1,000 live births; later milestone years rank higher'),
  ('airFreight', 'Most air freight by weight and distance', 'Air cargo carried in 2023, measured in millions of tonne-kilometers; one tonne carried one kilometer equals one tonne-kilometer'),
  ('worldbank-catalog:is-air-dprt', 'Most airline departures', 'Domestic and international takeoffs by airlines registered in each country in 2023'),
  ('arableHa', 'Most arable land', 'Land used for temporary crops, temporary pasture or short-term fallow in 2023, measured in hectares'),
  ('worldbank-catalog:er-h2o-fwtl-k3', 'Most freshwater taken from rivers, lakes and groundwater', 'Freshwater—not seawater—taken from rivers, lakes and groundwater in 2022 for agriculture, industry and households'),
  ('faostat-qcl-plums-and-sloes-production-01346-5510-t', 'Most plums and sloes produced', 'Total plums and sloes produced in 2024; sloes are small dark fruits related to plums, often used in jams and drinks'),
  ('faostat-qcl-roots-and-tubers-total-production-f1720-5510-t', 'Most roots and tubers produced', 'Total edible starchy roots and tubers produced in 2024, including potatoes, cassava, sweet potatoes and yams'),
  ('worldbank-catalog:en-hpt-thrd-no', 'Most threatened vascular plant species', 'Number of threatened native vascular plant species—plants with internal water-carrying tissues, such as flowering plants, trees and ferns—in 2022');

do $guard$
begin
  if (select count(*) from owner_copy_updates) <> 25 then
    raise exception 'Expected exactly 25 owner copy updates';
  end if;
  if exists (
    select 1 from owner_copy_updates u
    left join public.stat_categories c on c.id=u.id
    where c.id is null
  ) then
    raise exception 'An owner copy update references a missing category';
  end if;
end
$guard$;

update public.category_review_contracts_v16_3_4 c
set presentation_patch=(c.presentation_patch-'metadata') || jsonb_build_object(
      'title',u.title,
      'short_title',u.title,
      'plain_language_description',u.description || '.',
      'metadata',coalesce(c.presentation_patch->'metadata','{}'::jsonb) || jsonb_build_object(
        'ownerReviewDate','2026-09-22',
        'ownerReviewTitle',u.title,
        'ownerReviewDescription',u.description,
        'boardDescription',u.description
      )
    ),
    revision=c.revision+1,
    updated_at=now()
from owner_copy_updates u
where c.category_id=u.id;

update public.stat_categories c
set title=u.title,
    short_title=u.title,
    description=u.description || '.',
    plain_language_description=u.description || '.',
    metadata=jsonb_set(
      jsonb_set(
        jsonb_set(coalesce(c.metadata,'{}'::jsonb),'{ownerReviewTitle}',to_jsonb(u.title),true),
        '{ownerReviewDescription}',to_jsonb(u.description),true
      ),
      '{boardDescription}',to_jsonb(u.description),true
    ),
    content_review_status='approved',
    content_review_reason='Owner workbook comments addressed and wording approved.',
    content_review_version='geostats-owner-comments-2026-09-22-v1',
    updated_at=now()
from owner_copy_updates u
where c.id=u.id;


create or replace function public.category_v16_2_6_hard_block_reason(
  p_category_id text,
  p_source_organization text,
  p_source_indicator_code text,
  p_effective_title text,
  p_metadata jsonb
) returns text
language sql
stable
set search_path to 'public'
as $function$
  select case
    when coalesce((p_metadata->>'ownerRetired')::boolean,false)
      then 'Owner decision: removed from future generation.'
    when p_source_organization='World Bank'
      and coalesce(p_source_indicator_code,'') ~ '\.(CN|KN)$'
      then 'Cross-country absolute values in local currency are not comparable.'
    when coalesce(p_source_indicator_code,'') in (
      'EN.GHG.CO2.IC.MT.CE.AR5','EN.GHG.CO2.IP.MT.CE.AR5','EN.GHG.FGAS.IP.MT.CE.AR5',
      'BX.KLT.DINV.CD.WD','BM.KLT.DINV.CD.WD','DT.DOD.MWBG.CD','DT.TDS.DIMF.CD','DT.NFL.MOTH.CD',
      'EN.GHG.N2O.AG.MT.CE.AR5','EN.GHG.N2O.IP.MT.CE.AR5','EN.GHG.N2O.WA.MT.CE.AR5',
      'BM.TRF.PWKR.CD.DT','BX.TRF.PWKR.CD.DT','BX.TRF.PWKR.CD','BX.TRF.CURR.CD','BM.TRF.PRVT.CD',
      'DT.DOD.DSTC.ZS','BX.GRT.TECH.CD.WD','FI.RES.XGLD.CD','BM.GSR.TOTL.CD',
      'NE.GDI.STKB.CD','BX.GRT.EXTA.CD.WD','BN.TRF.KOGT.CD','BN.KAC.EOMS.CD','BN.FIN.TOTL.CD',
      'DT.NFL.BLAT.CD','BX.PEF.TOTL.CD.WD','BN.KLT.PTXL.CD','DT.DOD.PVLX.CD','BM.GSR.FCTY.CD',
      'BX.GSR.FCTY.CD','BN.RES.INCL.CD'
    ) then 'v16.2.6 editorial decision: removed from future generation.'
    when coalesce((p_metadata->>'v16_2_6_same_source_retry')::boolean,false)
      and nullif(trim(coalesce(p_metadata->>'v16_2_6_repair_evidence','')),'') is null
      then 'Previously rejected source/method retry has no documented changed blocker or methodology.'
    when p_category_id='history:newest-current-constitution'
      then 'Known historical integrity issue remains fail-closed pending a validated chronology.'
    else null
  end
$function$;

update public.stat_categories
set metadata=jsonb_set(jsonb_set(coalesce(metadata,'{}'::jsonb),'{ownerRetired}','true'::jsonb,true),'{ownerRetirementReason}',to_jsonb('Removed from future play at the owner''s request on 2026-09-22.'::text),true),
updated_at=now()
where id=any(array['global-findex:account-ownership','worldbank-catalog:dt-tds-dect-ex-zs','worldbank-catalog:dt-tds-dect-gn-zs','worldbank-catalog:eg-gdp-puse-ko-pp','worldbank-catalog:fs-ast-cgov-gd-zs','koppen-geiger:steppe-share','worldbank-catalog:bn-cab-xoka-gd-zs','worldbank-catalog:dt-oda-odat-cd','worldbank-catalog:ag-con-fert-zs']);

update public.stat_categories
set enabled=false,
eligible_daily=false,
review_status='rejected',
curation_status='excluded',
curation_reason='Removed from future play at the owner''s request on 2026-09-22.',
curation_version='geostats-owner-comments-2026-09-22-v1',
content_review_status='excluded',
content_review_reason='Removed from future play at the owner''s request on 2026-09-22.',
content_review_version='geostats-owner-comments-2026-09-22-v1',
player_quality_status='blocked',
player_quality_reason='Removed from future play at the owner''s request.',
updated_at=now()
where id=any(array['global-findex:account-ownership','worldbank-catalog:dt-tds-dect-ex-zs','worldbank-catalog:dt-tds-dect-gn-zs','worldbank-catalog:eg-gdp-puse-ko-pp','worldbank-catalog:fs-ast-cgov-gd-zs','koppen-geiger:steppe-share','worldbank-catalog:bn-cab-xoka-gd-zs','worldbank-catalog:dt-oda-odat-cd','worldbank-catalog:ag-con-fert-zs']);

do $verify$
begin
 if (select count(*) from public.stat_categories where enabled and eligible_daily) <> 345 then raise exception 'Owner review should leave exactly 345 enabled Daily categories'; end if;
 if (select count(*) from public.stat_categories where id=any(array['global-findex:account-ownership','worldbank-catalog:dt-tds-dect-ex-zs','worldbank-catalog:dt-tds-dect-gn-zs','worldbank-catalog:eg-gdp-puse-ko-pp','worldbank-catalog:fs-ast-cgov-gd-zs','koppen-geiger:steppe-share','worldbank-catalog:bn-cab-xoka-gd-zs','worldbank-catalog:dt-oda-odat-cd','worldbank-catalog:ag-con-fert-zs']) and not enabled and not eligible_daily) <> 9 then raise exception 'Expected exactly nine owner retirements'; end if;
 if exists (select 1 from public.category_runtime_review_v16_2 where id=any(array['global-findex:account-ownership','worldbank-catalog:dt-tds-dect-ex-zs','worldbank-catalog:dt-tds-dect-gn-zs','worldbank-catalog:eg-gdp-puse-ko-pp','worldbank-catalog:fs-ast-cgov-gd-zs','koppen-geiger:steppe-share','worldbank-catalog:bn-cab-xoka-gd-zs','worldbank-catalog:dt-oda-odat-cd','worldbank-catalog:ag-con-fert-zs']) and computed_playable_v16_2) then raise exception 'An owner-retired category remains computed playable'; end if;
end
$verify$;

update public.category_recovery_evidence_v16_3_4 e
set snapshot_fingerprint=public.category_recovery_fingerprint_v16_3_4(e.category_id),
    dependency_fingerprints=(
      select jsonb_object_agg(d.id,public.category_recovery_fingerprint_v16_3_4(d.id))
      from (
        select distinct jsonb_array_elements_text(p->'witness'->'categories') id
        from jsonb_array_elements(e.proofs) p
      ) d
    ),
    assessed_at=now()
where e.approved;

select public.apply_category_recovery_credibility_v16_3_4();
select public.refresh_category_promotion_assessment_v16_2();

do $final_verify$
begin
  if (select count(*) from public.stat_categories where enabled and eligible_daily) <> 345
    or (select count(*) from public.category_runtime_review_v16_2 where computed_playable_v16_2 and enabled and eligible_daily) <> 345 then
    raise exception 'Owner-reviewed catalog must contain exactly 345 playable categories';
  end if;
end
$final_verify$;

commit;
