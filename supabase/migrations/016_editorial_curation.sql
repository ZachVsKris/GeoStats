-- GeoStats v13.4.2
-- Complete editorial review of all 453 categories in the supplied approved export.
-- The registry is fail-closed: unreviewed/new indicator codes stay disabled until a future curated release adds them.

begin;

alter table public.stat_categories
  add column if not exists curation_status text not null default 'pending',
  add column if not exists curation_reason text,
  add column if not exists curation_version text not null default 'geostats-v13.4.2-editorial-v1';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='stat_categories_curation_status_check'
      and conrelid='public.stat_categories'::regclass
  ) then
    alter table public.stat_categories add constraint stat_categories_curation_status_check
      check (curation_status in ('pending','approved','excluded'));
  end if;
end $$;

create table if not exists public.stat_category_curation_rules (
  source_organization text not null,
  source_indicator_code text not null,
  decision text not null check (decision in ('approved','excluded')),
  player_title text,
  reason text not null,
  concept_group text,
  recognizability_score smallint check (recognizability_score is null or recognizability_score between 0 and 100),
  specificity_score smallint check (specificity_score is null or specificity_score between 0 and 100),
  version text not null default 'geostats-v13.4.2-editorial-v1',
  updated_at timestamptz not null default now(),
  primary key (source_organization,source_indicator_code)
);

delete from public.stat_category_curation_rules
where version='geostats-v13.4.2-editorial-v1';

insert into public.stat_category_curation_rules (
  source_organization,source_indicator_code,decision,player_title,reason,concept_group,recognizability_score,specificity_score
) values
  ('World Bank', 'SP.POP.TOTL', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'SP.RUR.TOTL', 'excluded', null, 'Near-duplicate of total population and rural population share.', null, null, null),
  ('World Bank', 'SP.URB.TOTL', 'excluded', null, 'Near-duplicate of total population and urbanization measures.', null, null, null),
  ('World Bank', 'TX.VAL.MRCH.CD.WT', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'TM.VAL.MRCH.CD.WT', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'NY.GDP.MKTP.CD', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'SP.POP.GROW', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'NY.GDP.PCAP.CD', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'SP.POP.65UP.TO.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'SP.RUR.TOTL.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'SP.POP.0014.TO.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'NY.GDP.MKTP.KD.ZG', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'NV.AGR.TOTL.CD', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'ER.LND.PTLD.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('UNHCR', 'asylum-applications:coo:applied', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('UNHCR', 'population:coo:asylum_seekers', 'excluded', null, 'Stock measure is too similar to refugees originating and asylum-application flows.', null, null, null),
  ('UNHCR', 'population:coo:refugees', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'NV.IND.MANF.CD', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('UNHCR', 'population:coa:refugees', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''01212:5412', 'approved', 'Highest cabbage yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01212-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01251:5412', 'approved', 'Highest carrots and turnips yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01251-yield', 92, 92),
  ('FAOSTAT', 'QCL:''0111:5412', 'approved', 'Highest wheat yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0111-yield', 92, 92),
  ('FAOSTAT', 'QCL:''0115:5510', 'approved', 'Largest barley production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0115-production', 92, 92),
  ('FAOSTAT', 'QCL:''0115:5412', 'approved', 'Highest barley yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0115-yield', 92, 92),
  ('World Bank', 'IT.MLT.MAIN.P2', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('WHO', 'WHS4_117', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('WHO', 'WHS8_110', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'SH.XPD.CHEX.PC.CD', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('UNESCO UIS', 'ROFST.MOD.3', 'excluded', null, 'Near-inverse of upper-secondary completion and too similar to other school-attainment categories.', null, null, null),
  ('UNESCO UIS', 'ROFST.MOD.2', 'excluded', null, 'Near-inverse of lower-secondary completion and too similar to other school-attainment categories.', null, null, null),
  ('FAOSTAT', 'QCL:''F1738:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('World Bank', 'NV.IND.TOTL.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''F1720:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''F1735:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('ILOSTAT', 'SDG_0821_NOC_RT_A', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('ILOSTAT', 'EMP_2WAP_SEX_AGE_RT_A', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('ILOSTAT', 'SDG_1041_NOC_RT_A', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('ILOSTAT', 'GDP_205U_NOC_NB_A', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('ILOSTAT', 'UNE_2EAP_SEX_AGE_RT_A', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''02211:5417', 'approved', 'Highest milk yield per cow', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-02211-yield', 92, 92),
  ('World Bank', 'NE.EXP.GNFS.CD', 'excluded', null, 'Superseded by the broader-coverage merchandise-exports category.', null, null, null),
  ('World Bank', 'NE.IMP.GNFS.CD', 'excluded', null, 'Superseded by the broader-coverage merchandise-imports category.', null, null, null),
  ('UNESCO UIS', 'CR.MOD.1', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('UNESCO UIS', 'CR.MOD.2', 'excluded', null, 'Middle-stage completion is redundant when primary and upper-secondary completion are retained.', null, null, null),
  ('UNESCO UIS', 'CR.MOD.3', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('UNHCR', 'population:coa:asylum_seekers', 'excluded', null, 'Stock measure is too similar to refugees hosted and asylum applications received.', null, null, null),
  ('FAOSTAT', 'QCL:''0112:5412', 'approved', 'Highest corn yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0112-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01510:5412', 'approved', 'Highest potatoes yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01510-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01253.02:5412', 'approved', 'Highest onions and shallots yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01253-02-yield', 92, 92),
  ('FAOSTAT', 'QCL:''F1723:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01232:5412', 'approved', 'Highest cucumbers and gherkins yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01232-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01231:5412', 'approved', 'Highest green chilies and peppers yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01231-yield', 92, 92),
  ('FAOSTAT', 'QCL:''0111:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''0111:5510', 'approved', 'Largest wheat production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0111-production', 92, 92),
  ('FAOSTAT', 'QCL:''0113:5412', 'approved', 'Highest rice yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0113-yield', 92, 92),
  ('FAOSTAT', 'QCL:''0115:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01252:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01322:5412', 'approved', 'Highest lemons and limes yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01322-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01214:5412', 'approved', 'Highest lettuce and chicory yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01214-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01241.90:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''0141:5412', 'approved', 'Highest soybeans yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0141-yield', 92, 92),
  ('World Bank', 'IT.NET.BBND.P2', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''F1720:5510', 'approved', 'Largest roots and tubers production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-f1720-production', 92, 92),
  ('FAOSTAT', 'QCL:''F1806:5417', 'excluded', null, 'Curated out: technical yield definition that is not intuitive enough for players.', null, null, null),
  ('FAOSTAT', 'QCL:''02111:5111', 'approved', 'Largest cattle population', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-02111-stocks', 92, 92),
  ('FAOSTAT', 'QCL:''21111.01:5417', 'excluded', null, 'Curated out: technical yield definition that is not intuitive enough for players.', null, null, null),
  ('FAOSTAT', 'QCL:''21121:5424', 'excluded', null, 'Curated out: technical yield definition that is not intuitive enough for players.', null, null, null),
  ('FAOSTAT', 'QCL:''F1808:5424', 'excluded', null, 'Curated out: technical yield definition that is not intuitive enough for players.', null, null, null),
  ('FAOSTAT', 'QCL:''F1780:5417', 'excluded', null, 'Curated out: technical yield definition that is not intuitive enough for players.', null, null, null),
  ('FAOSTAT', 'QCL:''02211:5510', 'approved', 'Largest cow''s milk production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-02211-production', 92, 92),
  ('FAOSTAT', 'QCL:''F1717:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''F1717:5510', 'approved', 'Largest cereals production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-f1717-production', 92, 92),
  ('FAOSTAT', 'QCL:''F1717:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''02122:5111', 'approved', 'Largest sheep population', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-02122-stocks', 92, 92),
  ('FAOSTAT', 'QCL:''01290.90:5412', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''0112:5510', 'approved', 'Largest corn production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0112-production', 92, 92),
  ('World Bank', 'NE.CON.GOVT.CD', 'excluded', null, 'Absolute consumption mostly repeats economy size and is weak for gameplay.', null, null, null),
  ('World Bank', 'NE.CON.PRVT.CD', 'excluded', null, 'Absolute consumption mostly repeats economy size and is weak for gameplay.', null, null, null),
  ('FAOSTAT', 'QCL:''01234:5510', 'approved', 'Largest tomatoes production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01234-production', 92, 92),
  ('FAOSTAT', 'QCL:''01234:5412', 'approved', 'Highest tomatoes yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01234-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01510:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01510:5510', 'approved', 'Largest potatoes production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01510-production', 92, 92),
  ('FAOSTAT', 'QCL:''01212:5510', 'approved', 'Largest cabbage production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01212-production', 92, 92),
  ('FAOSTAT', 'QCL:''01253.02:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01253.02:5510', 'approved', 'Largest onions and shallots production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01253-02-production', 92, 92),
  ('FAOSTAT', 'QCL:''01232:5510', 'approved', 'Largest cucumbers and gherkins production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01232-production', 92, 92),
  ('FAOSTAT', 'QCL:''01232:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''F1804:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01251:5510', 'approved', 'Largest carrots and turnips production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01251-production', 92, 92),
  ('FAOSTAT', 'QCL:''01231:5510', 'approved', 'Largest green chilies and peppers production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01231-production', 92, 92),
  ('FAOSTAT', 'QCL:''F1729:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01235:5510', 'approved', 'Largest pumpkins, squash, and gourds production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01235-production', 92, 92),
  ('FAOSTAT', 'QCL:''01235:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01235:5412', 'approved', 'Highest pumpkins, squash, and gourds yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01235-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01221:5412', 'approved', 'Highest watermelons yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01221-yield', 92, 92),
  ('FAOSTAT', 'QCL:''F1729:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''0114:5510', 'approved', 'Largest sorghum production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0114-production', 92, 92),
  ('FAOSTAT', 'QCL:''01312:5412', 'approved', 'Highest bananas yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01312-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01323:5412', 'approved', 'Highest oranges yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01323-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01709.90:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''0142:5412', 'approved', 'Highest peanuts yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0142-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01252:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01214:5510', 'approved', 'Largest lettuce and chicory production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01214-production', 92, 92),
  ('FAOSTAT', 'QCL:''02292:5417', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01252:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01705:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01705:5412', 'approved', 'Highest dry peas yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01705-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01213:5412', 'approved', 'Highest cauliflower and broccoli yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01213-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01341:5412', 'approved', 'Highest apples yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01341-yield', 92, 92),
  ('World Bank', 'NV.SRV.TOTL.ZS', 'excluded', null, 'Complementary near-duplicate of industry share of GDP.', null, null, null),
  ('FAOSTAT', 'QCL:''F1738:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''F1738:5510', 'approved', 'Largest fruit production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-f1738-production', 92, 92),
  ('FAOSTAT', 'QCL:''F1765:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''F1735:5510', 'approved', 'Largest vegetables production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-f1735-production', 92, 92),
  ('FAOSTAT', 'QCL:''F1720:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''F1735:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''F1806:5510', 'approved', 'Largest beef and buffalo meat production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-f1806-production', 92, 92),
  ('FAOSTAT', 'QCL:''F1746:5111', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''21121:5510', 'approved', 'Largest chicken meat production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-21121-production', 92, 92),
  ('FAOSTAT', 'QCL:''F1808:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''F1806:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''21111.01:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''21512:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''21151:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''21111.01:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''02951.01:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''F1807:5510', 'approved', 'Largest sheep and goat meat production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-f1807-production', 92, 92),
  ('FAOSTAT', 'QCL:''F1749:5111', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''F1780:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''F1780:5318', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''02211:5318', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''0231:5513', 'approved', 'Largest eggs production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0231-production', 92, 92),
  ('FAOSTAT', 'QCL:''02123:5111', 'approved', 'Largest goat population', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-02123-stocks', 92, 92),
  ('FAOSTAT', 'QCL:''21115:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''F1726:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''F1726:5510', 'approved', 'Largest pulses, total production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-f1726-production', 92, 92),
  ('FAOSTAT', 'QCL:''F1726:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''0112:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''02140:5111', 'approved', 'Largest pig population', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-02140-stocks', 92, 92),
  ('FAOSTAT', 'QCL:''21113.01:5510', 'approved', 'Largest pork production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-21113-01-production', 92, 92),
  ('FAOSTAT', 'QCL:''21153:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''21511.01:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''21113.01:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''F1783:5424', 'excluded', null, 'Curated out: technical yield definition that is not intuitive enough for players.', null, null, null),
  ('FAOSTAT', 'QCL:''0231:5424', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01234:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''F1732:5412', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''F1841:5412', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01212:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''F1723:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''F1723:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''02131:5111', 'approved', 'Largest horse population', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-02131-stocks', 92, 92),
  ('FAOSTAT', 'QCL:''0113:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''0113:5510', 'approved', 'Largest rice production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0113-production', 92, 92),
  ('FAOSTAT', 'QCL:''01221:5510', 'approved', 'Largest watermelons production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01221-production', 92, 92),
  ('FAOSTAT', 'QCL:''01221:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01251:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01231:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''F1729:5510', 'approved', 'Largest tree nuts production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-f1729-production', 92, 92),
  ('FAOSTAT', 'QCL:''01970:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''0114:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''02292:5510', 'approved', 'Largest goat milk production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-02292-production', 92, 92),
  ('FAOSTAT', 'QCL:''0142:5510', 'approved', 'Largest peanuts production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0142-production', 92, 92),
  ('FAOSTAT', 'QCL:''01709.90:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''0141:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''0114:5412', 'approved', 'Highest sorghum yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0114-yield', 92, 92),
  ('FAOSTAT', 'QCL:''0142:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''0141:5510', 'approved', 'Largest soybeans production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0141-production', 92, 92),
  ('FAOSTAT', 'QCL:''01530:5412', 'approved', 'Highest sweet potatoes yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01530-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01530:5510', 'approved', 'Largest sweet potatoes production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01530-production', 92, 92),
  ('FAOSTAT', 'QCL:''01701:5412', 'approved', 'Highest dry beans yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01701-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01701:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01701:5510', 'approved', 'Largest dry beans production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01701-production', 92, 92),
  ('FAOSTAT', 'QCL:''01241.90:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01229:5510', 'approved', 'Largest melons production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01229-production', 92, 92),
  ('FAOSTAT', 'QCL:''01241.90:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''02292:5318', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''01229:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01214:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01233:5510', 'approved', 'Largest eggplants production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01233-production', 92, 92),
  ('FAOSTAT', 'QCL:''01316:5412', 'approved', 'Highest mangoes, guavas, and mangosteens yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01316-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01213:5510', 'approved', 'Largest cauliflower and broccoli production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01213-production', 92, 92),
  ('FAOSTAT', 'QCL:''01330:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01705:5510', 'approved', 'Largest dry peas production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01705-production', 92, 92),
  ('FAOSTAT', 'QCL:''01330:5510', 'approved', 'Largest grapes production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01330-production', 92, 92),
  ('FAOSTAT', 'QCL:''01229:5412', 'approved', 'Highest melons yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01229-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01330:5412', 'approved', 'Highest grapes yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01330-yield', 92, 92),
  ('World Bank', 'SP.DYN.TFRT.IN', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'IP.JRN.ARTC.SC', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'IT.CEL.SETS.P2', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('Natural Earth', 'largest-geographic-span', 'excluded', null, 'Ambiguous diagonal extent; north-south span is clearer and retained.', null, null, null),
  ('Natural Earth', 'largest-north-south-span', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'SP.DYN.IMRT.IN', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('Natural Earth', 'northernmost-country', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('Natural Earth', 'southernmost-country', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'SH.XPD.CHEX.GD.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''21121:5321', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''F1808:5321', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('World Bank', 'SL.TLF.CACT.FE.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''F1807:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''01290.90:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01290.90:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''02151:5112', 'approved', 'Largest chicken population', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-02151-stocks', 92, 92),
  ('FAOSTAT', 'QCL:''F2029:5112', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''21155:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''21115:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''02953:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''21514:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('World Bank', 'NE.EXP.GNFS.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''21156:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''21515:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''21116:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''02954:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''21116:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''F1783:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''21113.01:5417', 'excluded', null, 'Curated out: technical yield definition that is not intuitive enough for players.', null, null, null),
  ('FAOSTAT', 'QCL:''F1804:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''F1804:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01312:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01312:5510', 'approved', 'Largest bananas production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01312-production', 92, 92),
  ('FAOSTAT', 'QCL:''01323:5510', 'approved', 'Largest oranges production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01323-production', 92, 92),
  ('FAOSTAT', 'QCL:''01359.90:5412', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01323:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01970:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01970:5510', 'approved', 'Largest tobacco production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01970-production', 92, 92),
  ('FAOSTAT', 'QCL:''01322:5510', 'approved', 'Largest lemons and limes production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01322-production', 92, 92),
  ('FAOSTAT', 'QCL:''01322:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''02910:5510', 'approved', 'Largest honey production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-02910-production', 92, 92),
  ('FAOSTAT', 'QCL:''01709.90:5412', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01530:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''02132:5111', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''F17530:5412', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01233:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01316:5510', 'approved', 'Largest mangoes, guavas, and mangosteens production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01316-production', 92, 92),
  ('FAOSTAT', 'QCL:''01213:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01341:5510', 'approved', 'Largest apples production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01341-production', 92, 92),
  ('FAOSTAT', 'QCL:''01802:5412', 'approved', 'Highest sugarcane yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01802-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01341:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01520.01:5412', 'approved', 'Highest cassava yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01520-01-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01233:5412', 'approved', 'Highest eggplants yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01233-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01520.01:5510', 'approved', 'Largest cassava production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01520-01-production', 92, 92),
  ('World Bank', 'AG.LND.FRST.K2', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'AG.LND.TOTL.K2', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'AG.LND.AGRI.K2', 'excluded', null, 'Near-duplicate of land area and arable-land totals.', null, null, null),
  ('Natural Earth', 'longest-coastline', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''F1783:5313', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''0231:5313', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''F1732:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''F1732:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''21512:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''21151:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''F1841:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''F1841:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''02951.01:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''21155:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''02953:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''21514:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''21156:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''21515:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''02954:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''21153:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''21511.01:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01359.90:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01359.90:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''F17530:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''22241.01:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''F17530:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''02196:5114', 'approved', 'Largest bee population', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-02196-stocks', 92, 92),
  ('FAOSTAT', 'QCL:''01316:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01802:5510', 'approved', 'Largest sugarcane production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01802-production', 92, 92),
  ('FAOSTAT', 'QCL:''01520.01:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01346:5510', 'approved', 'Largest plums and sloes production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01346-production', 92, 92),
  ('FAOSTAT', 'QCL:''01346:5412', 'approved', 'Highest plums and sloes yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01346-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01342.01:5412', 'approved', 'Highest pears yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01342-01-yield', 92, 92),
  ('World Bank', 'SP.DYN.LE00.IN', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'EN.POP.DNST', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'AG.LND.ARBL.HA', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''F1807:5417', 'excluded', null, 'Curated out: technical yield definition that is not intuitive enough for players.', null, null, null),
  ('FAOSTAT', 'QCL:''21115:5417', 'excluded', null, 'Curated out: technical yield definition that is not intuitive enough for players.', null, null, null),
  ('UNHCR', 'asylum-applications:coa:applied', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'TX.VAL.FOOD.ZS.UN', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''F1811:5510', 'approved', 'Largest butter and ghee production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-f1811-production', 92, 92),
  ('FAOSTAT', 'QCL:''F1745:5510', 'approved', 'Largest cheese production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-f1745-production', 92, 92),
  ('FAOSTAT', 'QCL:''22251.01:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01311:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01311:5510', 'approved', 'Largest avocado production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01311-production', 92, 92),
  ('FAOSTAT', 'QCL:''01319:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01802:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01345:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01345:5510', 'approved', 'Largest peaches and nectarines production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01345-production', 92, 92),
  ('FAOSTAT', 'QCL:''01346:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01342.01:5510', 'approved', 'Largest pears production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01342-01-production', 92, 92),
  ('FAOSTAT', 'QCL:''01342.01:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''02291:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01318:5412', 'approved', 'Highest pineapple yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01318-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01318:5510', 'approved', 'Largest pineapple production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01318-production', 92, 92),
  ('FAOSTAT', 'QCL:''01242:5412', 'approved', 'Highest green peas yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01242-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01354:5412', 'approved', 'Highest strawberries yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01354-yield', 92, 92),
  ('FAOSTAT', 'QCL:''0117:5510', 'approved', 'Largest oats production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0117-production', 92, 92),
  ('World Bank', 'AG.LND.FRST.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'AG.LND.AGRI.ZS', 'excluded', null, 'Near-duplicate of arable-land share.', null, null, null),
  ('Natural Earth', 'longest-land-border', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'AG.LND.ARBL.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'NE.GDI.TOTL.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''21116:5417', 'excluded', null, 'Curated out: technical yield definition that is not intuitive enough for players.', null, null, null),
  ('FAOSTAT', 'QCL:''24310.01:5510', 'approved', 'Largest beer production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-24310-01-production', 92, 92),
  ('World Bank', 'TX.VAL.TECH.CD', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('WHO', 'WHS4_543', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''F1809:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''02951.01:5417', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''22230.04:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''22110.02:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''2351f:5510', 'approved', 'Largest cane and beet sugar production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-2351f-production', 92, 92),
  ('FAOSTAT', 'QCL:''23540:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01319:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01321:5510', 'approved', 'Largest grapefruits and pomelos production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01321-production', 92, 92),
  ('FAOSTAT', 'QCL:''01321:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01324:5510', 'approved', 'Largest mandarins and tangerines production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01324-production', 92, 92),
  ('FAOSTAT', 'QCL:''01242:5510', 'approved', 'Largest green peas production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01242-production', 92, 92),
  ('FAOSTAT', 'QCL:''01921.01:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01242:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01318:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01354:5510', 'approved', 'Largest strawberries production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01354-production', 92, 92),
  ('FAOSTAT', 'QCL:''01445:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01354:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01445:5510', 'approved', 'Largest sunflower seeds production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01445-production', 92, 92),
  ('FAOSTAT', 'QCL:''01345:5412', 'approved', 'Highest peaches and nectarines yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01345-yield', 92, 92),
  ('FAOSTAT', 'QCL:''0117:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''0117:5412', 'approved', 'Highest oats yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0117-yield', 92, 92),
  ('World Bank', 'TM.VAL.FOOD.ZS.UN', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'NY.GNS.ICTR.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''23913:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''2161:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01324:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01921.01:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01921.01:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01460:5412', 'approved', 'Highest coconuts yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01460-yield', 92, 92),
  ('FAOSTAT', 'QCL:''02291:5318', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''01343:5510', 'approved', 'Largest apricot production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01343-production', 92, 92),
  ('FAOSTAT', 'QCL:''01319:5412', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01445:5412', 'approved', 'Highest sunflower seeds yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01445-yield', 92, 92),
  ('UN Comtrade', '85', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('UN Comtrade', '30', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''0143:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''21700.02:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01460:5510', 'approved', 'Largest coconuts production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01460-production', 92, 92),
  ('FAOSTAT', 'QCL:''01379.90:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01343:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''0118:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''0118:5510', 'approved', 'Largest millet production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0118-production', 92, 92),
  ('FAOSTAT', 'QCL:''01610:5412', 'approved', 'Highest coffee yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01610-yield', 92, 92),
  ('FAOSTAT', 'QCL:''02291:5417', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01610:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01311:5412', 'approved', 'Highest avocado yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01311-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01324:5412', 'approved', 'Highest mandarins and tangerines yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01324-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01215:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01443:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01443:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01443:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''0116:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('UNESCO UIS', 'GER.1', 'excluded', null, 'Gross enrollment can exceed 100 percent and is less intuitive than completion rates.', null, null, null),
  ('World Bank', 'SH.H2O.BASW.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('UN Comtrade', '88', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('UN Comtrade', '8703', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'MS.MIL.XPND.CD', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''01921.02:5510', 'approved', 'Largest cotton production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01921-02-production', 92, 92),
  ('FAOSTAT', 'QCL:''01379.90:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01460:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01610:5510', 'approved', 'Largest coffee production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01610-production', 92, 92),
  ('FAOSTAT', 'QCL:''01321:5412', 'approved', 'Highest grapefruits and pomelos yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01321-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01317:5510', 'approved', 'Largest papaya production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01317-production', 92, 92),
  ('FAOSTAT', 'QCL:''01444:5510', 'approved', 'Largest sesame seeds production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01444-production', 92, 92),
  ('FAOSTAT', 'QCL:''01215:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01344.02:5510', 'approved', 'Largest cherries production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01344-02-production', 92, 92),
  ('FAOSTAT', 'QCL:''01343:5412', 'approved', 'Highest apricot yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01343-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01344.02:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01702:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''0116:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''0116:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01801:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01801:5510', 'approved', 'Largest sugar beets production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01801-production', 92, 92),
  ('UN Comtrade', '0901', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''2162:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''2168:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''24212.02:5510', 'approved', 'Largest wine production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-24212-02-production', 92, 92),
  ('FAOSTAT', 'QCL:''21122:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''21122:5321', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''0118:5412', 'approved', 'Highest millet yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-0118-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01449.90:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''02941:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01444:5412', 'approved', 'Highest sesame seeds yield', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01444-yield', 92, 92),
  ('FAOSTAT', 'QCL:''01444:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''21122:5424', 'excluded', null, 'Curated out: technical yield definition that is not intuitive enough for players.', null, null, null),
  ('FAOSTAT', 'QCL:''01317:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01317:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01215:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01702:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01702:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01376:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('World Bank', 'EG.ELC.ACCS.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('UN Comtrade', '1006', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'MS.MIL.XPND.GD.ZS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'EG.USE.ELEC.KH.PC', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'EG.USE.PCAP.KG.OE', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''02154:5112', 'approved', 'Largest duck population', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-02154-stocks', 92, 92),
  ('FAOSTAT', 'QCL:''21631.01:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01329:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''F1816:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01329:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''22120:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01449.90:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01270:5510', 'approved', 'Largest mushrooms and truffles production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01270-production', 92, 92),
  ('FAOSTAT', 'QCL:''21159.01:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''21118.01:5320', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('FAOSTAT', 'QCL:''01449.90:5412', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01243:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01344.02:5412', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01243:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01199.90:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''21124:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01376:5510', 'approved', 'Largest walnuts production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01376-production', 92, 92),
  ('WHO', 'MDG_0000000026', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('WHO', 'PHE_HHAIR_POP_CLEAN_FUELS', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('UN Comtrade', '2204', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''02152:5112', 'approved', 'Largest turkey population', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-02152-stocks', 92, 92),
  ('FAOSTAT', 'QCL:''01379.90:5412', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01315:5510', 'approved', 'Largest figs production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01315-production', 92, 92),
  ('FAOSTAT', 'QCL:''01315:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01199.90:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''21124:5321', 'excluded', null, 'Curated out: technical animal-input count rather than a clear player-facing outcome.', null, null, null),
  ('World Bank', 'ER.H2O.INTR.K3', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('World Bank', 'IS.AIR.PSGR', 'approved', null, 'Retained after full editorial review of the supplied approved library; automated quality and provenance gates still apply.', null, null, null),
  ('FAOSTAT', 'QCL:''21521:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''21641.01:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''02133:5111', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01699:5412', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01699:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01699:5510', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01371:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null),
  ('FAOSTAT', 'QCL:''01371:5510', 'approved', 'Largest almonds production', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-01371-production', 92, 92),
  ('FAOSTAT', 'QCL:''21124:5424', 'excluded', null, 'Curated out: technical yield definition that is not intuitive enough for players.', null, null, null),
  ('FAOSTAT', 'QCL:''21118.01:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''22211:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''22212:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''02112:5111', 'approved', 'Largest buffalo population', 'Retained after full editorial review: recognizable country-comparison topic, clear measure, and no stronger duplicate in the approved library.', 'faostat-item-02112-stocks', 92, 92),
  ('FAOSTAT', 'QCL:''21523:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''22222.01:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''22221.01:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''2166:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''21691.07:5510', 'excluded', null, 'Curated out after full FAOSTAT editorial review because it was obscure, redundant, processed too narrowly, or weaker than a retained measure.', null, null, null),
  ('FAOSTAT', 'QCL:''01199.90:5412', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01599.10:5412', 'excluded', null, 'Curated out: obscure or technical commodity definition.', null, null, null),
  ('FAOSTAT', 'QCL:''01599.10:5312', 'excluded', null, 'Curated out: harvested-area variants are redundant with production and yield.', null, null, null);

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

  select * into rule_row from public.stat_category_curation_rules
    where source_organization=category_row.source_organization
      and source_indicator_code=category_row.source_indicator_code;

  if category_row.source_organization='ILOSTAT'
    and coalesce(category_row.common_year,category_row.latest_available_year,9999) > extract(year from current_date)::integer-1 then
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
    editorial_reason:='Curated out: this indicator was not part of the completed v13.4.2 editorial review. New indicators fail closed rather than entering Daily automatically.';
  end if;

  update public.stat_categories category
  set
    curation_status=editorial_decision,
    curation_reason=editorial_reason,
    curation_version='geostats-v13.4.2-editorial-v1',
    title=coalesce(rule_row.player_title,category.title),
    short_title=left(coalesce(rule_row.player_title,category.short_title,category.title),70),
    description=case when rule_row.player_title is not null then rule_row.player_title || ' according to ' || category.source_organization || '.' else category.description end,
    concept_group=coalesce(rule_row.concept_group,category.concept_group,category.id),
    recognizability_score=coalesce(rule_row.recognizability_score,category.recognizability_score),
    specificity_score=coalesce(rule_row.specificity_score,category.specificity_score),
    enabled=case when editorial_decision='excluded' then false else category.enabled end,
    eligible_daily=case when editorial_decision='excluded' then false else category.eligible_daily end,
    review_status=case when editorial_decision='excluded' and category.review_status<>'rejected' then 'candidate' else category.review_status end,
    duplicate_status=case when editorial_decision='excluded' then 'not_eligible' else category.duplicate_status end,
    superseded_by=case when editorial_decision='excluded' then null else category.superseded_by end,
    auto_decision_reason=case when editorial_decision='excluded' then editorial_reason else category.auto_decision_reason end,
    metadata=coalesce(category.metadata,'{}'::jsonb) || jsonb_build_object(
      'curationStatus',editorial_decision,
      'curationReason',editorial_reason,
      'curationVersion','geostats-v13.4.2-editorial-v1'
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
  order by category.governance_priority asc,category.quality_score desc,category.common_year_coverage desc,
           category.latest_available_year desc nulls last,category.id
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
      when category.id=chosen then 'Automatically selected after quality, provenance, editorial curation, and duplicate arbitration.'
      when chosen is not null and category.auto_qualified and category.provenance_status='approved' then 'Passed quality and provenance but was superseded by a stronger near-duplicate.'
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

-- Apply the completed editorial review to the full existing library immediately.
do $$ declare row record; begin
  for row in select id from public.stat_categories loop
    perform public.apply_category_curation(row.id);
  end loop;
  for row in select distinct concept_group from public.stat_categories where concept_group is not null loop
    perform public.refresh_stat_concept_group(row.concept_group);
  end loop;
end $$;

update public.data_sources
set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'curation_policy','geostats-v13.4.2-editorial-v1',
  'manual_review_required',false,
  'reviewed_category_count',453,
  'curated_approved_rule_count',205,
  'curated_excluded_rule_count',248,
  'faostat_editorial_allowlist_size',133,
  'future_or_projected_years_allowed',false,
  'unreviewed_indicator_behavior','fail_closed',
  'harvested_area_playable',false,
  'technical_animal_input_counts_playable',false,
  'narrow_nec_categories_playable',false
), updated_at=now()
where status in ('active','importing');

commit;
