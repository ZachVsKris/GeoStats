-- GeoStats v13.4.3
-- Complete editorial review of all 726 categories present in the supplied catalog export.
-- No current category is left pending. Future unseen indicators continue to fail closed.

begin;

alter table public.stat_categories
  add column if not exists curation_status text not null default 'pending',
  add column if not exists curation_reason text,
  add column if not exists curation_version text not null default 'geostats-v13.4.3-complete-catalog-v1';

alter table public.stat_categories
  alter column curation_version set default 'geostats-v13.4.3-complete-catalog-v1';

alter table public.stat_category_curation_rules
  add column if not exists category_id text not null default '';

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname='stat_category_curation_rules_pkey'
      and conrelid='public.stat_category_curation_rules'::regclass
  ) then
    alter table public.stat_category_curation_rules
      drop constraint stat_category_curation_rules_pkey;
  end if;
end $$;

alter table public.stat_category_curation_rules
  add constraint stat_category_curation_rules_pkey
  primary key (source_organization,source_indicator_code,category_id);

alter table public.stat_category_curation_rules
  alter column version set default 'geostats-v13.4.3-complete-catalog-v1';

delete from public.stat_category_curation_rules;

insert into public.stat_category_curation_rules (
  source_organization,source_indicator_code,category_id,decision,player_title,reason,
  concept_group,recognizability_score,specificity_score,version
) values
  ('World Bank', 'SP.POP.TOTL', '', 'approved', 'Largest population', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SP.RUR.TOTL', '', 'excluded', null, 'Near-duplicate of total population and rural population share.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SP.URB.TOTL', '', 'excluded', null, 'Near-duplicate of total population and urbanization measures.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'TX.VAL.MRCH.CD.WT', '', 'approved', 'Largest merchandise exports', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'TM.VAL.MRCH.CD.WT', '', 'approved', 'Largest merchandise imports', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NY.GDP.MKTP.CD', '', 'approved', 'Largest economy', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SP.POP.GROW', '', 'approved', 'Fastest population growth', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NY.GDP.PCAP.CD', '', 'approved', 'Highest GDP per person', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SP.POP.65UP.TO.ZS', '', 'approved', 'Oldest population', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SP.RUR.TOTL.ZS', '', 'approved', 'Highest rural population share', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SP.POP.0014.TO.ZS', '', 'approved', 'Youngest population', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NY.GDP.MKTP.KD.ZG', '', 'approved', 'Fastest economic growth', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NV.AGR.TOTL.CD', '', 'approved', 'Largest agricultural economy', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'ER.LND.PTLD.ZS', '', 'approved', 'Highest protected-land share', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNHCR', 'asylum-applications:coo:applied', '', 'approved', 'Most asylum applications by origin', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNHCR', 'population:coo:asylum_seekers', '', 'excluded', null, 'Stock measure is too similar to refugees originating and asylum-application flows.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNHCR', 'population:coo:refugees', '', 'approved', 'Most refugees originating', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NV.IND.MANF.CD', '', 'approved', 'Largest manufacturing output', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNHCR', 'population:coa:refugees', '', 'approved', 'Most refugees hosted', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01212:5412', '', 'approved', 'Highest cabbage yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01212-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01251:5412', '', 'approved', 'Highest carrots and turnips yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01251-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0111:5412', '', 'approved', 'Highest wheat yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0111-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0115:5510', '', 'approved', 'Largest barley production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0115-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0115:5412', '', 'approved', 'Highest barley yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0115-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'IT.MLT.MAIN.P2', '', 'approved', 'Highest fixed telephone subscriptions per 100 people', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'WHS4_117', '', 'approved', 'Highest hepatitis B vaccination rate', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'WHS8_110', '', 'approved', 'Highest measles vaccination rate', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SH.XPD.CHEX.PC.CD', '', 'approved', 'Highest health spending per person', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'ROFST.MOD.3', '', 'excluded', null, 'Near-inverse of upper-secondary completion and too similar to other school-attainment categories.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'ROFST.MOD.2', '', 'excluded', null, 'Near-inverse of lower-secondary completion and too similar to other school-attainment categories.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1738:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NV.IND.TOTL.ZS', '', 'approved', 'Highest industry share of GDP', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1720:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1735:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('ILOSTAT', 'SDG_0821_NOC_RT_A', '', 'approved', 'Fastest labor-productivity growth', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('ILOSTAT', 'EMP_2WAP_SEX_AGE_RT_A', '', 'approved', 'Highest employment-to-population ratio', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('ILOSTAT', 'SDG_1041_NOC_RT_A', '', 'approved', 'Highest labor-income share of GDP', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('ILOSTAT', 'GDP_205U_NOC_NB_A', '', 'approved', 'Highest output per worker', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('ILOSTAT', 'UNE_2EAP_SEX_AGE_RT_A', '', 'approved', 'Lowest unemployment rate', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02211:5417', '', 'approved', 'Highest milk yield per cow', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-02211-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NE.EXP.GNFS.CD', '', 'excluded', null, 'Superseded by the broader-coverage merchandise-exports category.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NE.IMP.GNFS.CD', '', 'excluded', null, 'Superseded by the broader-coverage merchandise-imports category.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'CR.MOD.1', '', 'approved', 'Highest primary-school completion rate', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'CR.MOD.2', '', 'excluded', null, 'Middle-stage completion is redundant when primary and upper-secondary completion are retained.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'CR.MOD.3', '', 'approved', 'Highest upper-secondary completion rate', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNHCR', 'population:coa:asylum_seekers', '', 'excluded', null, 'Stock measure is too similar to refugees hosted and asylum applications received.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0112:5412', '', 'approved', 'Highest corn yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0112-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01510:5412', '', 'approved', 'Highest potatoes yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01510-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01253.02:5412', '', 'approved', 'Highest onions and shallots yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01253-02-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1723:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01232:5412', '', 'approved', 'Highest cucumbers and gherkins yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01232-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01231:5412', '', 'approved', 'Highest green chilies and peppers yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01231-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0111:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0111:5510', '', 'approved', 'Largest wheat production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0111-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0113:5412', '', 'approved', 'Highest rice yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0113-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0115:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01252:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01322:5412', '', 'approved', 'Highest lemons and limes yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01322-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01214:5412', '', 'approved', 'Highest lettuce and chicory yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01214-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01241.90:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0141:5412', '', 'approved', 'Highest soybeans yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0141-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'IT.NET.BBND.P2', '', 'approved', 'Highest fixed broadband subscriptions per 100 people', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1720:5510', '', 'approved', 'Largest roots and tubers production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-f1720-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1806:5417', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02111:5111', '', 'approved', 'Largest cattle population', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-02111-stocks', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21111.01:5417', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21121:5424', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1808:5424', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1780:5417', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02211:5510', '', 'approved', 'Largest cow''s milk production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-02211-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1717:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1717:5510', '', 'approved', 'Largest cereals production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-f1717-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1717:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02122:5111', '', 'approved', 'Largest sheep population', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-02122-stocks', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01290.90:5412', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0112:5510', '', 'approved', 'Largest corn production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0112-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NE.CON.GOVT.CD', '', 'excluded', null, 'Absolute consumption mostly repeats economy size and is weak for gameplay.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NE.CON.PRVT.CD', '', 'excluded', null, 'Absolute consumption mostly repeats economy size and is weak for gameplay.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01234:5510', '', 'approved', 'Largest tomatoes production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01234-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01234:5412', '', 'approved', 'Highest tomatoes yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01234-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01510:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01510:5510', '', 'approved', 'Largest potatoes production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01510-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01212:5510', '', 'approved', 'Largest cabbage production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01212-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01253.02:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01253.02:5510', '', 'approved', 'Largest onions and shallots production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01253-02-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01232:5510', '', 'approved', 'Largest cucumbers and gherkins production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01232-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01232:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1804:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01251:5510', '', 'approved', 'Largest carrots and turnips production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01251-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01231:5510', '', 'approved', 'Largest green chilies and peppers production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01231-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1729:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01235:5510', '', 'approved', 'Largest pumpkins, squash, and gourds production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01235-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01235:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01235:5412', '', 'approved', 'Highest pumpkins, squash, and gourds yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01235-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01221:5412', '', 'approved', 'Highest watermelons yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01221-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1729:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0114:5510', '', 'approved', 'Largest sorghum production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0114-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01312:5412', '', 'approved', 'Highest bananas yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01312-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01323:5412', '', 'approved', 'Highest oranges yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01323-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01709.90:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0142:5412', '', 'approved', 'Highest peanuts yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0142-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01252:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01214:5510', '', 'approved', 'Largest lettuce and chicory production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01214-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02292:5417', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01252:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01705:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01705:5412', '', 'approved', 'Highest dry peas yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01705-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01213:5412', '', 'approved', 'Highest cauliflower and broccoli yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01213-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01341:5412', '', 'approved', 'Highest apples yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01341-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NV.SRV.TOTL.ZS', '', 'excluded', null, 'Complementary near-duplicate of industry share of GDP.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1738:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1738:5510', '', 'approved', 'Largest fruit production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-f1738-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1765:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1735:5510', '', 'approved', 'Largest vegetables production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-f1735-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1720:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1735:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1806:5510', '', 'approved', 'Largest beef and buffalo meat production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-f1806-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1746:5111', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21121:5510', '', 'approved', 'Largest chicken meat production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-21121-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1808:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1806:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21111.01:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21512:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21151:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21111.01:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02951.01:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1807:5510', '', 'approved', 'Largest sheep and goat meat production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-f1807-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1749:5111', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1780:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1780:5318', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02211:5318', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0231:5513', '', 'approved', 'Largest eggs production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0231-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02123:5111', '', 'approved', 'Largest goat population', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-02123-stocks', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21115:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1726:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1726:5510', '', 'approved', 'Largest pulses, total production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-f1726-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1726:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0112:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02140:5111', '', 'approved', 'Largest pig population', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-02140-stocks', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21113.01:5510', '', 'approved', 'Largest pork production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-21113-01-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21153:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21511.01:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21113.01:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1783:5424', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0231:5424', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01234:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1732:5412', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1841:5412', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01212:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1723:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1723:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02131:5111', '', 'approved', 'Largest horse population', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-02131-stocks', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0113:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0113:5510', '', 'approved', 'Largest rice production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0113-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01221:5510', '', 'approved', 'Largest watermelons production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01221-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01221:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01251:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01231:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1729:5510', '', 'approved', 'Largest tree nuts production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-f1729-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01970:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0114:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02292:5510', '', 'approved', 'Largest goat milk production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-02292-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0142:5510', '', 'approved', 'Largest peanuts production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0142-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01709.90:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0141:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0114:5412', '', 'approved', 'Highest sorghum yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0114-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0142:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0141:5510', '', 'approved', 'Largest soybeans production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0141-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01530:5412', '', 'approved', 'Highest sweet potatoes yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01530-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01530:5510', '', 'approved', 'Largest sweet potatoes production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01530-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01701:5412', '', 'approved', 'Highest dry beans yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01701-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01701:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01701:5510', '', 'approved', 'Largest dry beans production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01701-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01241.90:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01229:5510', '', 'approved', 'Largest melons production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01229-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01241.90:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02292:5318', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01229:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01214:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01233:5510', '', 'approved', 'Largest eggplants production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01233-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01316:5412', '', 'approved', 'Highest mangoes, guavas, and mangosteens yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01316-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01213:5510', '', 'approved', 'Largest cauliflower and broccoli production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01213-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01330:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01705:5510', '', 'approved', 'Largest dry peas production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01705-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01330:5510', '', 'approved', 'Largest grapes production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01330-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01229:5412', '', 'approved', 'Highest melons yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01229-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01330:5412', '', 'approved', 'Highest grapes yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01330-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SP.DYN.TFRT.IN', '', 'approved', 'Highest fertility rate', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'IP.JRN.ARTC.SC', '', 'approved', 'Most scientific journal articles', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'IT.CEL.SETS.P2', '', 'approved', 'Highest mobile subscriptions per 100 people', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('Natural Earth', 'largest-geographic-span', '', 'excluded', null, 'Ambiguous diagonal extent; north-south span is clearer and retained.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('Natural Earth', 'largest-north-south-span', '', 'approved', 'Largest north-south span', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SP.DYN.IMRT.IN', '', 'approved', 'Lowest infant mortality', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('Natural Earth', 'northernmost-country', '', 'approved', 'Northernmost country', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('Natural Earth', 'southernmost-country', '', 'approved', 'Southernmost country', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SH.XPD.CHEX.GD.ZS', '', 'approved', 'Highest health spending share', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21121:5321', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1808:5321', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SL.TLF.CACT.FE.ZS', '', 'approved', 'Highest female labor participation', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1807:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01290.90:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01290.90:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02151:5112', '', 'approved', 'Largest chicken population', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-02151-stocks', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F2029:5112', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21155:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21115:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02953:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21514:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NE.EXP.GNFS.ZS', '', 'approved', 'Highest exports share of GDP', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21156:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21515:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21116:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02954:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21116:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1783:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21113.01:5417', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1804:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1804:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01312:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01312:5510', '', 'approved', 'Largest bananas production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01312-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01323:5510', '', 'approved', 'Largest oranges production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01323-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01359.90:5412', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01323:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01970:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01970:5510', '', 'approved', 'Largest tobacco production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01970-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01322:5510', '', 'approved', 'Largest lemons and limes production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01322-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01322:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02910:5510', '', 'approved', 'Largest honey production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-02910-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01709.90:5412', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01530:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02132:5111', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F17530:5412', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01233:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01316:5510', '', 'approved', 'Largest mangoes, guavas, and mangosteens production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01316-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01213:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01341:5510', '', 'approved', 'Largest apples production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01341-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01802:5412', '', 'approved', 'Highest sugarcane yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01802-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01341:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01520.01:5412', '', 'approved', 'Highest cassava yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01520-01-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01233:5412', '', 'approved', 'Highest eggplants yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01233-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01520.01:5510', '', 'approved', 'Largest cassava production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01520-01-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'AG.LND.FRST.K2', '', 'approved', 'Largest forest area', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'AG.LND.TOTL.K2', '', 'approved', 'Largest land area', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'AG.LND.AGRI.K2', '', 'excluded', null, 'Near-duplicate of land area and arable-land totals.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('Natural Earth', 'longest-coastline', '', 'approved', 'Longest coastline', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1783:5313', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0231:5313', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1732:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1732:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21512:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21151:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1841:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1841:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02951.01:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21155:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02953:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21514:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21156:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21515:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02954:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21153:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21511.01:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01359.90:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01359.90:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F17530:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22241.01:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F17530:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02196:5114', '', 'approved', 'Largest bee population', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-02196-stocks', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01316:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01802:5510', '', 'approved', 'Largest sugarcane production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01802-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01520.01:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01346:5510', '', 'approved', 'Largest plums and sloes production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01346-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01346:5412', '', 'approved', 'Highest plums and sloes yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01346-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01342.01:5412', '', 'approved', 'Highest pears yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01342-01-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SP.DYN.LE00.IN', '', 'approved', 'Highest life expectancy', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'EN.POP.DNST', '', 'approved', 'Highest population density', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'AG.LND.ARBL.HA', '', 'approved', 'Most arable land', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1807:5417', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21115:5417', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNHCR', 'asylum-applications:coa:applied', '', 'approved', 'Most asylum applications received', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'TX.VAL.FOOD.ZS.UN', '', 'approved', 'Highest food share of exports', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1811:5510', '', 'approved', 'Largest butter and ghee production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-f1811-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1745:5510', '', 'approved', 'Largest cheese production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-f1745-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22251.01:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01311:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01311:5510', '', 'approved', 'Largest avocado production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01311-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01319:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01802:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01345:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01345:5510', '', 'approved', 'Largest peaches and nectarines production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01345-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01346:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01342.01:5510', '', 'approved', 'Largest pears production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01342-01-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01342.01:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02291:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01318:5412', '', 'approved', 'Highest pineapple yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01318-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01318:5510', '', 'approved', 'Largest pineapple production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01318-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01242:5412', '', 'approved', 'Highest green peas yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01242-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01354:5412', '', 'approved', 'Highest strawberries yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01354-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0117:5510', '', 'approved', 'Largest oats production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0117-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'AG.LND.FRST.ZS', '', 'approved', 'Highest forest coverage', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'AG.LND.AGRI.ZS', '', 'excluded', null, 'Near-duplicate of arable-land share.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('Natural Earth', 'longest-land-border', '', 'approved', 'Longest total land border', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'AG.LND.ARBL.ZS', '', 'approved', 'Highest arable-land share', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NE.GDI.TOTL.ZS', '', 'approved', 'Highest investment share', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21116:5417', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''24310.01:5510', '', 'approved', 'Largest beer production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-24310-01-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'TX.VAL.TECH.CD', '', 'approved', 'Largest high-tech exports', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'WHS4_543', '', 'approved', 'Highest tuberculosis vaccination rate', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1809:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02951.01:5417', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22230.04:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22110.02:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''2351f:5510', '', 'approved', 'Largest cane and beet sugar production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-2351f-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''23540:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01319:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01321:5510', '', 'approved', 'Largest grapefruits and pomelos production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01321-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01321:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01324:5510', '', 'approved', 'Largest mandarins and tangerines production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01324-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01242:5510', '', 'approved', 'Largest green peas production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01242-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01921.01:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01242:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01318:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01354:5510', '', 'approved', 'Largest strawberries production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01354-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01445:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01354:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01445:5510', '', 'approved', 'Largest sunflower seeds production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01445-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01345:5412', '', 'approved', 'Highest peaches and nectarines yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01345-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0117:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0117:5412', '', 'approved', 'Highest oats yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0117-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'TM.VAL.FOOD.ZS.UN', '', 'approved', 'Highest food share of imports', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NY.GNS.ICTR.ZS', '', 'approved', 'Highest gross savings rate', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''23913:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''2161:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01324:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01921.01:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01921.01:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01460:5412', '', 'approved', 'Highest coconuts yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01460-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02291:5318', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01343:5510', '', 'approved', 'Largest apricot production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01343-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01319:5412', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01445:5412', '', 'approved', 'Highest sunflower seeds yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01445-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UN Comtrade', '85', '', 'approved', 'Largest electrical-equipment exports', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UN Comtrade', '30', '', 'approved', 'Largest pharmaceutical exports', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0143:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21700.02:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01460:5510', '', 'approved', 'Largest coconuts production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01460-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01379.90:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01343:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0118:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0118:5510', '', 'approved', 'Largest millet production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0118-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01610:5412', '', 'approved', 'Highest coffee yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01610-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02291:5417', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01610:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01311:5412', '', 'approved', 'Highest avocado yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01311-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01324:5412', '', 'approved', 'Highest mandarins and tangerines yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01324-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01215:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01443:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01443:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01443:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0116:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'GER.1', '', 'excluded', null, 'Gross enrollment can exceed 100 percent and is less intuitive than completion rates.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SH.H2O.BASW.ZS', '', 'approved', 'Highest basic drinking-water access', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UN Comtrade', '88', '', 'approved', 'Largest aircraft exports', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UN Comtrade', '8703', '', 'approved', 'Largest car exports', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'MS.MIL.XPND.CD', '', 'approved', 'Highest military spending', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01921.02:5510', '', 'approved', 'Largest cotton production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01921-02-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01379.90:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01460:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01610:5510', '', 'approved', 'Largest coffee production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01610-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01321:5412', '', 'approved', 'Highest grapefruits and pomelos yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01321-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01317:5510', '', 'approved', 'Largest papaya production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01317-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01444:5510', '', 'approved', 'Largest sesame seeds production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01444-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01215:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01344.02:5510', '', 'approved', 'Largest cherries production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01344-02-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01343:5412', '', 'approved', 'Highest apricot yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01343-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01344.02:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01702:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0116:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0116:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01801:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01801:5510', '', 'approved', 'Largest sugar beets production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01801-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UN Comtrade', '0901', '', 'approved', 'Largest coffee exports', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''2162:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''2168:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''24212.02:5510', '', 'approved', 'Largest wine production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-24212-02-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21122:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21122:5321', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0118:5412', '', 'approved', 'Highest millet yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-0118-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01449.90:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02941:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01444:5412', '', 'approved', 'Highest sesame seeds yield', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01444-yield', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01444:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21122:5424', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01317:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01317:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01215:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01702:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01702:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01376:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'EG.ELC.ACCS.ZS', '', 'approved', 'Highest electricity access', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UN Comtrade', '1006', '', 'approved', 'Largest rice exports', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'MS.MIL.XPND.GD.ZS', '', 'approved', 'Highest military spending share', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'EG.USE.ELEC.KH.PC', '', 'approved', 'Highest electricity use per person', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'EG.USE.PCAP.KG.OE', '', 'approved', 'Highest energy use per person', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02154:5112', '', 'approved', 'Largest duck population', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-02154-stocks', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21631.01:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01329:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''F1816:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01329:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22120:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01449.90:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01270:5510', '', 'approved', 'Largest mushrooms and truffles production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01270-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21159.01:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21118.01:5320', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01449.90:5412', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01243:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01344.02:5412', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01243:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01199.90:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21124:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01376:5510', '', 'approved', 'Largest walnuts production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01376-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'MDG_0000000026', '', 'approved', 'Lowest maternal mortality', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'PHE_HHAIR_POP_CLEAN_FUELS', '', 'approved', 'Highest clean-cooking-fuel access', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UN Comtrade', '2204', '', 'approved', 'Largest wine exports', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02152:5112', '', 'approved', 'Largest turkey population', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-02152-stocks', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01379.90:5412', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01315:5510', '', 'approved', 'Largest figs production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01315-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01315:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01199.90:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21124:5321', '', 'excluded', null, 'Technical animal-input count removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'ER.H2O.INTR.K3', '', 'approved', 'Most renewable freshwater', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'IS.AIR.PSGR', '', 'approved', 'Most airline passengers', 'Retained after full editorial review; quality and provenance gates still apply.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21521:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21641.01:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02133:5111', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01699:5412', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01699:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01699:5510', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01371:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01371:5510', '', 'approved', 'Largest almonds production', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-01371-production', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21124:5424', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21118.01:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22211:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22212:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02112:5111', '', 'approved', 'Largest buffalo population', 'Recognizable, clear measure, and no stronger duplicate.', 'faostat-item-02112-stocks', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21523:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22222.01:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22221.01:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''2166:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21691.07:5510', '', 'excluded', null, 'Obscure, redundant, narrowly processed, or weaker than a retained measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01199.90:5412', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01599.10:5412', '', 'excluded', null, 'Obscure or technical commodity definition removed.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01599.10:5312', '', 'excluded', null, 'Harvested-area variant removed in favor of production or yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0231:5413', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0231:5510', '', 'excluded', null, 'Curated out: duplicate of the retained hen-eggs production series QCL:''0231:5513.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02953:5417', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01801:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01355.90:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01243:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01254:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01355.90:5412', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02954:5417', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01376:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01254:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01355.90:5510', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01353.01:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01441:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01353.01:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01191:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01540:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01353.01:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01191:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01652:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01640:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01239.01:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01640:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01640:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01254:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01441:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01441:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01239.01:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01239.01:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01450:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01344.01:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01344.01:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01191:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01371:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01211:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01351.01:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01315:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21118.01:5417', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01704:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01620:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01355.01:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01652:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01652:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01313:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01540:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01540:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01355.01:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01703:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01657:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01290.01:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01253.01:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01313:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01211:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01211:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01355.01:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02121.01:5111', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01290.01:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01290.01:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01704:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01704:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01450:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01253.01:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01253.01:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01651:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01491.01:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01450:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01651:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01344.01:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01550:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01372:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01703:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01703:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01351.01:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01351.01:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21159.01:5510', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21170.02:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01657:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01657:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01651:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01313:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01342.02:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02191:5112', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01550:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01620:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01620:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01372:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01706:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01314:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01374:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21117.01:5417', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21114:5424', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01342.02:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02960.01:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01372:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01706:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01314:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01314:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01374:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01374:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21117.01:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21114:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21691.12:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01349.20:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01349.20:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01550:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21159.02:5320', '', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21519.02:5320', '', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21117.01:5320', '', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01950.01:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01349.20:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01216:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01216:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01706:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21159.02:5510', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21519.02:5510', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01709.02:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01709.02:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01950.01:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01950.01:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21691.02:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01491.01:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01491.01:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01342.02:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22130.02:5510', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22230.01:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21114:5321', '', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01447:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22254:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22253:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01373:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01373:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0232:5513', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01352:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01352:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21119.90:5510', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''2165:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01654:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01329:5412', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01447:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22251.02:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01599.10:5510', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''0232:5510', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01199.02:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01199.02:5510', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02293:5318', '', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01654:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01654:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01447:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01659:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01659:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21691.14:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''2167:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01491.02:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01709.02:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02212:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21123:5321', '', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01373:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01929.02:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22130.03:5510', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01659:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01352:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02153:5112', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02293:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21513:5320', '', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21152:5320', '', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21112:5320', '', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02951.03:5320', '', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01216:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21112:5417', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01707:5412', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02293:5417', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21112:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01707:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01707:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01929.02:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21123:5424', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02951.03:5417', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21513:5510', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21152:5510', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''02951.03:5510', '', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01929.01:5312', '', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''21123:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''01929.01:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('FAOSTAT', 'QCL:''22252:5510', '', 'excluded', null, 'Curated out: current coverage or quality is below the specialty-category standard, or the commodity is too narrow relative to the retained FAOSTAT library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('ILOSTAT', 'SDG_0111_SEX_AGE_RT_A', '', 'approved', 'Lowest working-poverty rate', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'working-poverty-rate', 88, 90, 'geostats-v13.4.3-complete-catalog-v1'),
  ('ILOSTAT', 'EIP_NEET_SEX_RT_A', '', 'approved', 'Lowest youth NEET rate', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'youth-neet-rate', 88, 90, 'geostats-v13.4.3-complete-catalog-v1'),
  ('ILOSTAT', 'LUU_XLU2_SEX_RT_A', '', 'excluded', null, 'Curated out: technical composite labor-underutilization measure is not intuitive enough for general players.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('ILOSTAT', 'EMP_XTRU_SEX_RT_A', '', 'excluded', null, 'Curated out: narrow technical underemployment measure is too similar to broader labor-market categories.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('ILOSTAT', 'EMP_NIFL_SEX_RT_A', '', 'approved', 'Lowest informal-employment rate', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'informal-employment-rate', 86, 88, 'geostats-v13.4.3-complete-catalog-v1'),
  ('ILOSTAT', 'SDG_0552_NOC_RT_A', '', 'approved', 'Highest share of women in management', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'women-in-management-share', 90, 90, 'geostats-v13.4.3-complete-catalog-v1'),
  ('ILOSTAT', 'HOW_UEES_SEX_NB_A', '', 'approved', 'Longest average working week', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'average-working-week', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('ILOSTAT', 'UNE_3EAP_SEX_AGE_DSB_RT_A', '', 'approved', 'Lowest youth unemployment rate', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'youth-unemployment-rate', 90, 90, 'geostats-v13.4.3-complete-catalog-v1'),
  ('ILOSTAT', 'ILR_CBCT_NOC_RT_A', '', 'excluded', null, 'Curated out: 2016 common year is too stale.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('Natural Earth', 'most-land-neighbors', '', 'approved', 'Most land-border neighbors', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'land-border-neighbor-count', 96, 96, 'geostats-v13.4.3-complete-catalog-v1'),
  ('Natural Earth', 'most-separate-land-areas', '', 'excluded', null, 'Curated out: multipart-area count is sensitive to geometry treatment and is not intuitive enough for players.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('U.S. EIA', '57:1', '', 'approved', 'Most crude oil produced', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'crude-oil-production', 95, 96, 'geostats-v13.4.3-complete-catalog-v1'),
  ('U.S. EIA', '26:1', '', 'approved', 'Most natural gas produced', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'natural-gas-production', 95, 96, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UN Comtrade', '0803', '', 'approved', 'Largest banana exports', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'banana-exports', 94, 96, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UN Comtrade', '7108', '', 'approved', 'Largest gold exports', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'gold-exports', 95, 96, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UN Comtrade', '0902', '', 'approved', 'Largest tea exports', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'tea-exports', 94, 96, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UN Comtrade', '1801', '', 'approved', 'Largest cocoa-bean exports', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'cocoa-bean-exports', 94, 96, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UN Comtrade', '2709', '', 'approved', 'Largest crude-oil exports', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'crude-oil-exports', 95, 96, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UN Comtrade', '1001', '', 'approved', 'Largest wheat exports', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'wheat-exports', 94, 96, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'XGDP.FSGOV', '', 'approved', 'Highest education spending share of GDP', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'education-spending-share-gdp', 92, 94, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'GER.2T3', '', 'excluded', null, 'Curated out: gross-enrollment ratios can exceed 100 percent and are less intuitive than completion measures.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'GTVP.2T3.V', '', 'approved', 'Highest vocational enrollment share', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'vocational-enrollment-share', 88, 90, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'ROFST.1.CP', '', 'excluded', null, 'Curated out: near-inverse of the retained primary-school completion category.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'GER.5T8', '', 'excluded', null, 'Curated out: gross-enrollment ratios can exceed 100 percent and are less intuitive than completion measures.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', '26637', '', 'approved', 'Most international students hosted', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'international-students-hosted', 94, 94, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'MOR.5T8.40505', '', 'approved', 'Highest outbound student mobility', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'outbound-student-mobility', 88, 88, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'SCHBSP.1.WCOMPUT', '', 'approved', 'Highest school computer access', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'school-computer-access', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'FOSGP.5T8.F500600700', '', 'approved', 'Highest STEM graduate share', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'stem-graduate-share', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'SCHBSP.1.WINTERN', '', 'approved', 'Highest school internet access', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'school-internet-access', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'REPR.1.G1.CP', '', 'excluded', null, 'Curated out: 2016 comparison year is too stale.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'SCHBSP.1.WELEC', '', 'approved', 'Highest school electricity access', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'school-electricity-access', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'SR.1.GLAST.CP', '', 'excluded', null, 'Curated out: too similar to the retained primary-school completion category.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'RESDEN.INHAB.TFTE', '', 'approved', 'Most researchers per million people', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'researchers-per-million', 92, 94, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'SCHBSP.1.WWASH', '', 'excluded', null, 'Curated out: redundant with school sanitation and drinking-water access.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'READ.LOWERSEC', '', 'approved', 'Highest lower-secondary reading proficiency', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'lower-secondary-reading-proficiency', 88, 90, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'SCHBSP.1.WTOILA', '', 'approved', 'Highest school sanitation access', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'school-sanitation-access', 90, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'SCHBSP.1.WWATA', '', 'approved', 'Highest school drinking-water access', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'school-water-access', 90, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'LR.AG15T24', '', 'approved', 'Highest youth literacy rate', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'youth-literacy-rate', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'MATH.LOWERSEC', '', 'approved', 'Highest lower-secondary mathematics proficiency', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'lower-secondary-math-proficiency', 88, 90, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'MATH.PRIMARY', '', 'excluded', null, 'Curated out: older and too similar to the retained lower-secondary mathematics category.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'LR.AG15T99', '', 'excluded', null, 'Curated out: older and lower-coverage than youth literacy.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNESCO UIS', 'READ.PRIMARY', '', 'excluded', null, 'Curated out: lower coverage and too similar to the retained lower-secondary reading category.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNHCR', 'population:coa:stateless', '', 'approved', 'Most stateless people', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'stateless-population', 94, 96, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNHCR', 'solutions:coo:returned_refugees', '', 'approved', 'Most refugees returned home', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'returned-refugees', 92, 94, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNHCR', 'population:coa:idps', '', 'approved', 'Most internally displaced people', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'internally-displaced-population', 94, 96, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNHCR', 'population:coa:oip', '', 'excluded', null, 'Curated out: broad residual protection category is not sufficiently intuitive or comparable.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('UNHCR', 'solutions:coa:returned_idps', '', 'excluded', null, 'Curated out: very low coverage and a narrow flow measure.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'WSH_WATER_SAFELY_MANAGED', '', 'approved', 'Highest safely managed drinking-water access', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'safely-managed-drinking-water', 94, 94, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'WSH_SANITATION_SAFELY_MANAGED', '', 'approved', 'Highest safely managed sanitation access', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'safely-managed-sanitation', 94, 94, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'WHOSIS_000001', '', 'excluded', null, 'Curated out: duplicate of the retained higher-coverage World Bank life-expectancy category.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'HWF_0006', '', 'approved', 'Highest nurse and midwife density', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'nurse-midwife-density', 92, 94, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'HWF_0001', '', 'approved', 'Highest doctor density', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'doctor-density', 94, 94, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'WHOSIS_000002', '', 'excluded', null, 'Curated out: too similar to life expectancy and less intuitive for general players.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'HWF_0014', '', 'excluded', null, 'Curated out: narrower and less recognizable than retained doctor and nurse-density measures.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'UHC_AVAILABILITY_SCORE', '', 'excluded', null, 'Curated out: composite score is less transparent and interpretable than direct health-access measures.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'NCD_HYP_PREVALENCE_A', '', 'approved', 'Lowest high-blood-pressure rate', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'high-blood-pressure-rate', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'MH_12', '', 'excluded', null, 'Curated out: international suicide-rate comparisons remain vulnerable to uneven registration and underreporting.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'SA_0000001438', '', 'excluded', null, 'Curated out: 2004 comparison year is too stale.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'MALARIA_EST_INCIDENCE', '', 'approved', 'Lowest malaria incidence', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'malaria-incidence', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'SA_0000001807_AA', '', 'excluded', null, 'Curated out: model-heavy attributable-mortality measure is too indirect for gameplay.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'SA_0000001440', '', 'excluded', null, 'Curated out: 2004 comparison year is too stale.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'RS_198', '', 'approved', 'Lowest road-traffic death rate', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'road-fatality-rate', 94, 94, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'MDG_0000000025', '', 'approved', 'Highest skilled birth-attendance rate', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'skilled-birth-attendance', 92, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'WSH_HYGIENE_BASIC', '', 'approved', 'Highest handwashing access', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'basic-handwashing-access', 90, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'WHS4_154', '', 'approved', 'Highest antenatal-care coverage', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'antenatal-care-coverage', 90, 92, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'Yth_curr_cig_smoking', '', 'excluded', null, 'Curated out: low coverage and survey self-reporting make cross-country comparisons too uneven.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('WHO', 'GDO_q9x1_3', '', 'excluded', null, 'Curated out: low coverage and stale reporting year.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SP.URB.TOTL.IN.ZS', '', 'excluded', null, 'Curated out: exact complement of the retained rural-population-share category.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'EN.GHG.CH4.MT.CE.AR5', '', 'approved', 'Highest methane emissions', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'methane-emissions-total', 94, 94, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'EN.GHG.CO2.MT.CE.AR5', '', 'approved', 'Highest total CO₂ emissions', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'co2-emissions-total', 96, 96, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SL.UEM.TOTL.ZS', '', 'excluded', null, 'Curated out: superseded by the direct ILOSTAT unemployment-rate category.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'EN.GHG.CO2.PC.CE.AR5', '', 'approved', 'Highest CO₂ emissions per person', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'co2-emissions-per-person', 96, 96, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'IT.NET.USER.ZS', '', 'excluded', null, 'Curated out: indicator relies heavily on uneven survey and national-estimation practices and does not meet the project’s provenance standard.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'AG.PRD.CREL.MT', '', 'excluded', null, 'Curated out: superseded by the direct FAOSTAT cereals-production category.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'AG.YLD.CREL.KG', '', 'excluded', null, 'Curated out: superseded by the direct FAOSTAT agricultural-yield library.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SE.XPD.TOTL.GD.ZS', '', 'excluded', null, 'Curated out: superseded by the direct UNESCO UIS education-spending category.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'AG.LND.PRCP.MM', 'rain', 'approved', 'Highest average rainfall', 'Retained after complete catalog review: clear, stable physical-climate comparison; the inverse low-rainfall variant is excluded.', 'average-rainfall', 94, 94, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SH.STA.SMSS.ZS', '', 'excluded', null, 'Curated out: superseded by the direct WHO safely managed sanitation category.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'AG.LND.PRCP.MM', 'dry', 'excluded', null, 'Curated out: exact inverse of the retained highest-average-rainfall category.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'IS.AIR.GOOD.MT.K1', '', 'approved', 'Most air freight', 'Retained after complete catalog review: authoritative methodology, clear player-facing meaning, and no stronger duplicate in the curated library. Numerical quality gates still apply.', 'air-freight', 92, 94, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NY.GDP.MINR.RT.ZS', '', 'excluded', null, 'Curated out: no usable current country observations.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NY.GDP.NGAS.RT.ZS', '', 'excluded', null, 'Curated out: no usable current country observations.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'NY.GDP.PETR.RT.ZS', '', 'excluded', null, 'Curated out: no usable current country observations.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'EG.ELC.RNEW.ZS', '', 'excluded', null, 'Curated out: no usable current country observations.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'EG.FEC.RNEW.ZS', '', 'excluded', null, 'Curated out: no usable current country observations.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'SH.STA.TRAF.P5', '', 'excluded', null, 'Curated out: no usable current observations and superseded by the direct WHO road-traffic mortality category.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'IS.RRS.GOOD.MT.K6', '', 'excluded', null, 'Curated out: no usable current country observations.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'IS.RRS.PASG.KM', '', 'excluded', null, 'Curated out: no usable current country observations.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1'),
  ('World Bank', 'IP.PAT.RESD', '', 'excluded', null, 'Curated out: no usable current country observations.', null, null, null, 'geostats-v13.4.3-complete-catalog-v1');

-- The three WDI emissions indicators were numerically strong but had been left
-- unclassified in v13.4. They are harmonized inventory/model series, not bare
-- assertions from national political leadership.
update public.stat_categories category
set
  provenance_status='approved',
  provenance_class='internationally_harmonized_emissions_inventory_or_model',
  provenance_reason='Internationally harmonized greenhouse-gas inventory and modeled-estimate series with published definitions and cross-country quality controls; not accepted as a bare political assertion.',
  methodology_url='https://databank.worldbank.org/metadataglossary/world-development-indicators/series/' || category.source_indicator_code,
  independent_validation=true,
  government_assertion_risk='low',
  concept_group=case category.id
    when 'methane' then 'methane-emissions-total'
    when 'co2Total' then 'co2-emissions-total'
    when 'co2PerCapita' then 'co2-emissions-per-person'
    else category.concept_group
  end,
  governance_priority=30,
  governance_version='geostats-v13.4.3-complete-catalog-v1',
  auto_qualified=case
    when category.review_status='rejected' then false
    else (
      category.quality_score >= 80
      and category.country_coverage >= coalesce(nullif(category.metadata->>'coverageFloor','')::integer,100)
      and category.latest_available_year >= extract(year from now())::integer - 5
    )
  end,
  updated_at=now()
where category.id in ('methane','co2Total','co2PerCapita');

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
  else
    editorial_decision:='excluded';
    editorial_reason:='Curated out: this indicator was not part of the completed v13.4.3 catalog review. New indicators fail closed rather than entering Daily automatically.';
  end if;

  update public.stat_categories category
  set
    curation_status=editorial_decision,
    curation_reason=editorial_reason,
    curation_version='geostats-v13.4.3-complete-catalog-v1',
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
    enabled=case when editorial_decision='excluded' then false else category.enabled end,
    eligible_daily=case when editorial_decision='excluded' then false else category.eligible_daily end,
    review_status=case
      when editorial_decision='excluded' and category.review_status<>'rejected' then 'candidate'
      else category.review_status
    end,
    duplicate_status=case when editorial_decision='excluded' then 'not_eligible' else category.duplicate_status end,
    superseded_by=case when editorial_decision='excluded' then null else category.superseded_by end,
    auto_decision_reason=case when editorial_decision='excluded' then editorial_reason else category.auto_decision_reason end,
    metadata=coalesce(category.metadata,'{}'::jsonb) || jsonb_build_object(
      'curationStatus',editorial_decision,
      'curationReason',editorial_reason,
      'curationVersion','geostats-v13.4.3-complete-catalog-v1'
    ),
    updated_at=now()
  where category.id=p_category_id;

  return editorial_decision;
end;
$$;

-- Duplicate arbitration cannot re-enable an editorially excluded category.
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
      when category.id=chosen then 'Automatically selected after quality, provenance, complete editorial curation, and duplicate arbitration.'
      when chosen is not null and category.auto_qualified and category.provenance_status='approved'
        then 'Passed quality and provenance but was superseded by a stronger near-duplicate.'
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

-- Apply the complete review to the full existing library immediately.
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
  'curation_policy','geostats-v13.4.3-complete-catalog-v1',
  'manual_review_required',false,
  'reviewed_category_count',726,
  'curated_approved_rule_count',252,
  'curated_excluded_rule_count',474,
  'current_catalog_unreviewed_count',0,
  'future_or_projected_years_allowed',false,
  'unreviewed_indicator_behavior','fail_closed',
  'duplicate_direction_rules_supported',true,
  'country_leadership_self_report_only_allowed',false
), updated_at=now()
where status in ('active','importing');

commit;
