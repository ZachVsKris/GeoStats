-- GeoStats v13.4
-- Canonical country names, fail-closed provenance validation, automatic approval,
-- World Bank re-review, and one-playable-category-per-concept duplicate control.

begin;

alter table public.stat_categories
  add column if not exists provenance_status text not null default 'uncertain',
  add column if not exists provenance_class text,
  add column if not exists provenance_reason text,
  add column if not exists methodology_url text,
  add column if not exists independent_validation boolean not null default false,
  add column if not exists government_assertion_risk text not null default 'unknown',
  add column if not exists concept_group text,
  add column if not exists governance_priority integer not null default 100,
  add column if not exists governance_version text not null default 'geostats-v13.4-provenance-v1',
  add column if not exists duplicate_status text not null default 'pending',
  add column if not exists superseded_by text,
  add column if not exists auto_decision_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='stat_categories_provenance_status_check'
      and conrelid='public.stat_categories'::regclass
  ) then
    alter table public.stat_categories add constraint stat_categories_provenance_status_check
      check (provenance_status in ('approved','uncertain','blocked'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname='stat_categories_government_assertion_risk_check'
      and conrelid='public.stat_categories'::regclass
  ) then
    alter table public.stat_categories add constraint stat_categories_government_assertion_risk_check
      check (government_assertion_risk in ('none','low','medium','high','unknown'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname='stat_categories_duplicate_status_check'
      and conrelid='public.stat_categories'::regclass
  ) then
    alter table public.stat_categories add constraint stat_categories_duplicate_status_check
      check (duplicate_status in ('pending','preferred','superseded','not_eligible'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname='stat_categories_superseded_by_fkey'
      and conrelid='public.stat_categories'::regclass
  ) then
    alter table public.stat_categories add constraint stat_categories_superseded_by_fkey
      foreign key (superseded_by) references public.stat_categories(id) on delete set null;
  end if;
end $$;

create index if not exists stat_categories_concept_governance_idx
  on public.stat_categories(concept_group, provenance_status, auto_qualified, governance_priority, quality_score desc);

-- Fixed player-facing country names. Importers retain source labels only in metadata.
with canonical(iso3,name) as (
  values
    ('AFG', 'Afghanistan'),
    ('AGO', 'Angola'),
    ('ALB', 'Albania'),
    ('AND', 'Andorra'),
    ('ARE', 'United Arab Emirates'),
    ('ARG', 'Argentina'),
    ('ARM', 'Armenia'),
    ('ATG', 'Antigua and Barbuda'),
    ('AUS', 'Australia'),
    ('AUT', 'Austria'),
    ('AZE', 'Azerbaijan'),
    ('BDI', 'Burundi'),
    ('BEL', 'Belgium'),
    ('BEN', 'Benin'),
    ('BFA', 'Burkina Faso'),
    ('BGD', 'Bangladesh'),
    ('BGR', 'Bulgaria'),
    ('BHR', 'Bahrain'),
    ('BHS', 'The Bahamas'),
    ('BIH', 'Bosnia and Herzegovina'),
    ('BLR', 'Belarus'),
    ('BLZ', 'Belize'),
    ('BOL', 'Bolivia'),
    ('BRA', 'Brazil'),
    ('BRB', 'Barbados'),
    ('BRN', 'Brunei'),
    ('BTN', 'Bhutan'),
    ('BWA', 'Botswana'),
    ('CAF', 'Central African Republic'),
    ('CAN', 'Canada'),
    ('CHE', 'Switzerland'),
    ('CHL', 'Chile'),
    ('CHN', 'China'),
    ('CIV', 'Côte d’Ivoire'),
    ('CMR', 'Cameroon'),
    ('COD', 'Democratic Republic of the Congo'),
    ('COG', 'Republic of the Congo'),
    ('COL', 'Colombia'),
    ('COM', 'Comoros'),
    ('CPV', 'Cabo Verde'),
    ('CRI', 'Costa Rica'),
    ('CUB', 'Cuba'),
    ('CYP', 'Cyprus'),
    ('CZE', 'Czechia'),
    ('DEU', 'Germany'),
    ('DJI', 'Djibouti'),
    ('DMA', 'Dominica'),
    ('DNK', 'Denmark'),
    ('DOM', 'Dominican Republic'),
    ('DZA', 'Algeria'),
    ('ECU', 'Ecuador'),
    ('EGY', 'Egypt'),
    ('ERI', 'Eritrea'),
    ('ESP', 'Spain'),
    ('EST', 'Estonia'),
    ('ETH', 'Ethiopia'),
    ('FIN', 'Finland'),
    ('FJI', 'Fiji'),
    ('FRA', 'France'),
    ('FSM', 'Micronesia'),
    ('GAB', 'Gabon'),
    ('GBR', 'United Kingdom'),
    ('GEO', 'Georgia'),
    ('GHA', 'Ghana'),
    ('GIN', 'Guinea'),
    ('GMB', 'The Gambia'),
    ('GNB', 'Guinea-Bissau'),
    ('GNQ', 'Equatorial Guinea'),
    ('GRC', 'Greece'),
    ('GRD', 'Grenada'),
    ('GTM', 'Guatemala'),
    ('GUY', 'Guyana'),
    ('HND', 'Honduras'),
    ('HRV', 'Croatia'),
    ('HTI', 'Haiti'),
    ('HUN', 'Hungary'),
    ('IDN', 'Indonesia'),
    ('IND', 'India'),
    ('IRL', 'Ireland'),
    ('IRN', 'Iran'),
    ('IRQ', 'Iraq'),
    ('ISL', 'Iceland'),
    ('ISR', 'Israel'),
    ('ITA', 'Italy'),
    ('JAM', 'Jamaica'),
    ('JOR', 'Jordan'),
    ('JPN', 'Japan'),
    ('KAZ', 'Kazakhstan'),
    ('KEN', 'Kenya'),
    ('KGZ', 'Kyrgyzstan'),
    ('KHM', 'Cambodia'),
    ('KIR', 'Kiribati'),
    ('KNA', 'Saint Kitts and Nevis'),
    ('KOR', 'South Korea'),
    ('KWT', 'Kuwait'),
    ('LAO', 'Laos'),
    ('LBN', 'Lebanon'),
    ('LBR', 'Liberia'),
    ('LBY', 'Libya'),
    ('LCA', 'Saint Lucia'),
    ('LIE', 'Liechtenstein'),
    ('LKA', 'Sri Lanka'),
    ('LSO', 'Lesotho'),
    ('LTU', 'Lithuania'),
    ('LUX', 'Luxembourg'),
    ('LVA', 'Latvia'),
    ('MAR', 'Morocco'),
    ('MCO', 'Monaco'),
    ('MDA', 'Moldova'),
    ('MDG', 'Madagascar'),
    ('MDV', 'Maldives'),
    ('MEX', 'Mexico'),
    ('MHL', 'Marshall Islands'),
    ('MKD', 'North Macedonia'),
    ('MLI', 'Mali'),
    ('MLT', 'Malta'),
    ('MMR', 'Myanmar'),
    ('MNE', 'Montenegro'),
    ('MNG', 'Mongolia'),
    ('MOZ', 'Mozambique'),
    ('MRT', 'Mauritania'),
    ('MUS', 'Mauritius'),
    ('MWI', 'Malawi'),
    ('MYS', 'Malaysia'),
    ('NAM', 'Namibia'),
    ('NER', 'Niger'),
    ('NGA', 'Nigeria'),
    ('NIC', 'Nicaragua'),
    ('NLD', 'Netherlands'),
    ('NOR', 'Norway'),
    ('NPL', 'Nepal'),
    ('NRU', 'Nauru'),
    ('NZL', 'New Zealand'),
    ('OMN', 'Oman'),
    ('PAK', 'Pakistan'),
    ('PAN', 'Panama'),
    ('PER', 'Peru'),
    ('PHL', 'Philippines'),
    ('PLW', 'Palau'),
    ('PNG', 'Papua New Guinea'),
    ('POL', 'Poland'),
    ('PRK', 'North Korea'),
    ('PRT', 'Portugal'),
    ('PRY', 'Paraguay'),
    ('PSE', 'Palestine'),
    ('QAT', 'Qatar'),
    ('ROU', 'Romania'),
    ('RUS', 'Russia'),
    ('RWA', 'Rwanda'),
    ('SAU', 'Saudi Arabia'),
    ('SDN', 'Sudan'),
    ('SEN', 'Senegal'),
    ('SGP', 'Singapore'),
    ('SLB', 'Solomon Islands'),
    ('SLE', 'Sierra Leone'),
    ('SLV', 'El Salvador'),
    ('SMR', 'San Marino'),
    ('SOM', 'Somalia'),
    ('SRB', 'Serbia'),
    ('SSD', 'South Sudan'),
    ('STP', 'São Tomé and Príncipe'),
    ('SUR', 'Suriname'),
    ('SVK', 'Slovakia'),
    ('SVN', 'Slovenia'),
    ('SWE', 'Sweden'),
    ('SWZ', 'Eswatini'),
    ('SYC', 'Seychelles'),
    ('SYR', 'Syria'),
    ('TCD', 'Chad'),
    ('TGO', 'Togo'),
    ('THA', 'Thailand'),
    ('TJK', 'Tajikistan'),
    ('TKM', 'Turkmenistan'),
    ('TLS', 'Timor-Leste'),
    ('TON', 'Tonga'),
    ('TTO', 'Trinidad and Tobago'),
    ('TUN', 'Tunisia'),
    ('TUR', 'Türkiye'),
    ('TUV', 'Tuvalu'),
    ('TZA', 'Tanzania'),
    ('UGA', 'Uganda'),
    ('UKR', 'Ukraine'),
    ('URY', 'Uruguay'),
    ('USA', 'United States'),
    ('UZB', 'Uzbekistan'),
    ('VAT', 'Vatican City'),
    ('VCT', 'Saint Vincent and the Grenadines'),
    ('VEN', 'Venezuela'),
    ('VNM', 'Vietnam'),
    ('VUT', 'Vanuatu'),
    ('WSM', 'Samoa'),
    ('YEM', 'Yemen'),
    ('ZAF', 'South Africa'),
    ('ZMB', 'Zambia'),
    ('ZWE', 'Zimbabwe'))
insert into public.countries(iso3,name,playable,updated_at)
select iso3,name,true,now() from canonical
on conflict(iso3) do update set name=excluded.name, playable=true, updated_at=now();

update public.stat_observations observation
set country_name = country.name
from public.countries country
where country.iso3 = observation.country_iso3
  and observation.country_name is distinct from country.name;

create or replace function public.force_canonical_observation_country_name()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.country_name := coalesce(
    (select country.name from public.countries country where country.iso3 = new.country_iso3 and country.playable=true),
    new.country_name,
    new.country_iso3
  );
  return new;
end;
$$;

drop trigger if exists force_canonical_observation_country_name on public.stat_observations;
create trigger force_canonical_observation_country_name
before insert or update of country_iso3,country_name on public.stat_observations
for each row execute function public.force_canonical_observation_country_name();

-- Re-review every World Bank category. No legacy approval is grandfathered.
with policy(id,indicator,provenance_status,provenance_class,provenance_reason,concept_group,priority) as (
  values
    ('population','SP.POP.TOTL','approved','internationally_harmonized_demographic_estimate','UN and national statistical-system demographic data harmonized through WDI.','population',40),
    ('populationGrowth','SP.POP.GROW','approved','internationally_harmonized_demographic_estimate','UN and national statistical-system demographic data harmonized through WDI.','populationGrowth',40),
    ('density','EN.POP.DNST','approved','internationally_harmonized_demographic_estimate','UN and national statistical-system demographic data harmonized through WDI.','density',40),
    ('urban','SP.URB.TOTL.IN.ZS','approved','internationally_harmonized_demographic_estimate','UN and national statistical-system demographic data harmonized through WDI.','urbanization-share',40),
    ('rural','SP.RUR.TOTL.ZS','approved','internationally_harmonized_demographic_estimate','UN and national statistical-system demographic data harmonized through WDI.','urbanization-share',40),
    ('life','SP.DYN.LE00.IN','approved','internationally_harmonized_demographic_estimate','UN and national statistical-system demographic data harmonized through WDI.','life-expectancy',40),
    ('fertility','SP.DYN.TFRT.IN','approved','internationally_harmonized_demographic_estimate','UN and national statistical-system demographic data harmonized through WDI.','fertility',40),
    ('infantMortality','SP.DYN.IMRT.IN','approved','internationally_harmonized_demographic_estimate','UN and national statistical-system demographic data harmonized through WDI.','infant-mortality',40),
    ('older','SP.POP.65UP.TO.ZS','approved','internationally_harmonized_demographic_estimate','UN and national statistical-system demographic data harmonized through WDI.','older',40),
    ('young','SP.POP.0014.TO.ZS','approved','internationally_harmonized_demographic_estimate','UN and national statistical-system demographic data harmonized through WDI.','young',40),
    ('gdp','NY.GDP.MKTP.CD','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','gdp',40),
    ('gdpPc','NY.GDP.PCAP.CD','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','gdpPc',40),
    ('gdpGrowth','NY.GDP.MKTP.KD.ZG','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','gdpGrowth',40),
    ('exports','NE.EXP.GNFS.CD','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','exports',40),
    ('imports','NE.IMP.GNFS.CD','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','imports',40),
    ('manufacturing','NV.IND.MANF.CD','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','manufacturing',40),
    ('agValue','NV.AGR.TOTL.CD','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','agValue',40),
    ('land','AG.LND.TOTL.K2','approved','internationally_harmonized_fao_statistics','FAO land and agriculture statistics with standardized definitions and validation.','land',40),
    ('forestArea','AG.LND.FRST.K2','approved','internationally_harmonized_fao_statistics','FAO land and agriculture statistics with standardized definitions and validation.','forestArea',40),
    ('forestPct','AG.LND.FRST.ZS','approved','internationally_harmonized_fao_statistics','FAO land and agriculture statistics with standardized definitions and validation.','forest-cover-share',40),
    ('leastForest','AG.LND.FRST.ZS','approved','internationally_harmonized_fao_statistics','FAO land and agriculture statistics with standardized definitions and validation.','forest-cover-share',40),
    ('agLand','AG.LND.AGRI.ZS','approved','internationally_harmonized_fao_statistics','FAO land and agriculture statistics with standardized definitions and validation.','agLand',40),
    ('arablePct','AG.LND.ARBL.ZS','approved','internationally_harmonized_fao_statistics','FAO land and agriculture statistics with standardized definitions and validation.','arablePct',40),
    ('arableHa','AG.LND.ARBL.HA','approved','internationally_harmonized_fao_statistics','FAO land and agriculture statistics with standardized definitions and validation.','arableHa',40),
    ('rain','AG.LND.PRCP.MM','approved','internationally_harmonized_fao_statistics','FAO land and agriculture statistics with standardized definitions and validation.','average-precipitation',40),
    ('dry','AG.LND.PRCP.MM','approved','internationally_harmonized_fao_statistics','FAO land and agriculture statistics with standardized definitions and validation.','average-precipitation',40),
    ('renewable','EG.ELC.RNEW.ZS','approved','internationally_harmonized_energy_statistics','International energy statistics and modeled access estimates with published methods.','renewable',40),
    ('energyUse','EG.USE.PCAP.KG.OE','approved','internationally_harmonized_energy_statistics','International energy statistics and modeled access estimates with published methods.','energyUse',40),
    ('electricUse','EG.USE.ELEC.KH.PC','approved','internationally_harmonized_energy_statistics','International energy statistics and modeled access estimates with published methods.','electricUse',40),
    ('internet','IT.NET.USER.ZS','uncertain','internationally_harmonized_telecommunications_statistics','Internet-use estimates can mix household surveys, administrative reporting, and imputation; indicator-specific review is required before play.','internet',40),
    ('mobile','IT.CEL.SETS.P2','approved','internationally_harmonized_telecommunications_statistics','ITU statistics from surveys, operators, and regulators under standardized definitions.','mobile',40),
    ('airPassengers','IS.AIR.PSGR','approved','international_transport_administrative_statistics','International transport administrative and operator statistics.','airPassengers',40),
    ('rail','IS.RRS.PASG.KM','approved','international_transport_administrative_statistics','International transport administrative and operator statistics.','rail',40),
    ('protected','ER.LND.PTLD.ZS','approved','international_environmental_inventory','International environmental inventories and standardized resource estimates.','protected',40),
    ('freshwater','ER.H2O.INTR.K3','approved','international_environmental_inventory','International environmental inventories and standardized resource estimates.','freshwater',40),
    ('healthSpend','SH.XPD.CHEX.PC.CD','approved','international_health_estimate_or_accounts','WHO and partner health estimates, surveys, and health-account statistics with published methods.','health-spending-per-person',40),
    ('education','SE.XPD.TOTL.GD.ZS','uncertain','unclassified','No indicator-level provenance classification is available.','education-spending-share-gdp',40),
    ('femaleLabor','SL.TLF.CACT.FE.ZS','approved','internationally_harmonized_labor_estimate','ILO harmonized labor-force surveys and modeled estimates.','femaleLabor',40),
    ('unemploymentLow','SL.UEM.TOTL.ZS','approved','internationally_harmonized_labor_estimate','ILO harmonized labor-force surveys and modeled estimates.','unemployment-rate',40),
    ('cerealProduction','AG.PRD.CREL.MT','approved','internationally_harmonized_fao_statistics','FAO land and agriculture statistics with standardized definitions and validation.','cerealProduction',40),
    ('cerealYield','AG.YLD.CREL.KG','approved','internationally_harmonized_fao_statistics','FAO land and agriculture statistics with standardized definitions and validation.','cerealYield',40),
    ('foodExportsShare','TX.VAL.FOOD.ZS.UN','approved','transactional_customs_records','Customs transaction records harmonized through UN trade statistics.','foodExportsShare',40),
    ('foodImportsShare','TM.VAL.FOOD.ZS.UN','approved','transactional_customs_records','Customs transaction records harmonized through UN trade statistics.','foodImportsShare',40),
    ('merchExports','TX.VAL.MRCH.CD.WT','approved','transactional_customs_records','Customs transaction records harmonized through UN trade statistics.','merchExports',40),
    ('highTechExports','TX.VAL.TECH.CD','approved','transactional_customs_records','Customs transaction records harmonized through UN trade statistics.','highTechExports',40),
    ('co2Total','EN.GHG.CO2.MT.CE.AR5','uncertain','unclassified','No indicator-level provenance classification is available.','co2Total',40),
    ('co2PerCapita','EN.GHG.CO2.PC.CE.AR5','uncertain','unclassified','No indicator-level provenance classification is available.','co2PerCapita',40),
    ('electricityAccess','EG.ELC.ACCS.ZS','approved','internationally_harmonized_energy_statistics','International energy statistics and modeled access estimates with published methods.','electricityAccess',40),
    ('sanitation','SH.STA.SMSS.ZS','approved','international_health_estimate_or_accounts','WHO and partner health estimates, surveys, and health-account statistics with published methods.','safely-managed-sanitation-access',40),
    ('journalArticles','IP.JRN.ARTC.SC','approved','bibliometric_or_ip_administrative_records','Bibliometric databases or intellectual-property filing records.','journalArticles',40),
    ('patents','IP.PAT.RESD','approved','bibliometric_or_ip_administrative_records','Bibliometric databases or intellectual-property filing records.','patents',40),
    ('militarySpend','MS.MIL.XPND.CD','approved','independent_defense_expenditure_estimate','SIPRI defense-expenditure series using official documents, budgets, and independent estimation.','militarySpend',40),
    ('urbanAbsolute','SP.URB.TOTL','approved','internationally_harmonized_demographic_estimate','UN and national statistical-system demographic data harmonized through WDI.','urbanAbsolute',40),
    ('ruralAbsolute','SP.RUR.TOTL','approved','internationally_harmonized_demographic_estimate','UN and national statistical-system demographic data harmonized through WDI.','ruralAbsolute',40),
    ('healthSpendShare','SH.XPD.CHEX.GD.ZS','approved','international_health_estimate_or_accounts','WHO and partner health estimates, surveys, and health-account statistics with published methods.','healthSpendShare',40),
    ('servicesShare','NV.SRV.TOTL.ZS','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','servicesShare',40),
    ('industryShare','NV.IND.TOTL.ZS','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','industryShare',40),
    ('exportsShare','NE.EXP.GNFS.ZS','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','exportsShare',40),
    ('grossSavings','NY.GNS.ICTR.ZS','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','grossSavings',40),
    ('investmentShare','NE.GDI.TOTL.ZS','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','investmentShare',40),
    ('householdConsumption','NE.CON.PRVT.CD','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','householdConsumption',40),
    ('governmentConsumption','NE.CON.GOVT.CD','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','governmentConsumption',40),
    ('merchImports','TM.VAL.MRCH.CD.WT','approved','transactional_customs_records','Customs transaction records harmonized through UN trade statistics.','merchImports',40),
    ('fixedBroadband','IT.NET.BBND.P2','approved','internationally_harmonized_telecommunications_statistics','ITU statistics from surveys, operators, and regulators under standardized definitions.','fixedBroadband',40),
    ('fixedTelephone','IT.MLT.MAIN.P2','approved','internationally_harmonized_telecommunications_statistics','ITU statistics from surveys, operators, and regulators under standardized definitions.','fixedTelephone',40),
    ('basicWater','SH.H2O.BASW.ZS','approved','international_health_estimate_or_accounts','WHO and partner health estimates, surveys, and health-account statistics with published methods.','drinking-water-access',40),
    ('renewableConsumption','EG.FEC.RNEW.ZS','approved','internationally_harmonized_energy_statistics','International energy statistics and modeled access estimates with published methods.','renewableConsumption',40),
    ('agLandArea','AG.LND.AGRI.K2','approved','internationally_harmonized_fao_statistics','FAO land and agriculture statistics with standardized definitions and validation.','agLandArea',40),
    ('airFreight','IS.AIR.GOOD.MT.K1','approved','international_transport_administrative_statistics','International transport administrative and operator statistics.','airFreight',40),
    ('railFreight','IS.RRS.GOOD.MT.K6','approved','international_transport_administrative_statistics','International transport administrative and operator statistics.','railFreight',40),
    ('methane','EN.GHG.CH4.MT.CE.AR5','uncertain','unclassified','No indicator-level provenance classification is available.','methane',40),
    ('roadFatalities','SH.STA.TRAF.P5','approved','international_health_estimate_or_accounts','WHO and partner health estimates, surveys, and health-account statistics with published methods.','road-fatality-rate',40),
    ('oilRents','NY.GDP.PETR.RT.ZS','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','oilRents',40),
    ('gasRents','NY.GDP.NGAS.RT.ZS','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','gasRents',40),
    ('mineralRents','NY.GDP.MINR.RT.ZS','approved','internationally_harmonized_national_accounts','National accounts compiled under international statistical standards and harmonized through WDI.','mineralRents',40),
    ('militaryShare','MS.MIL.XPND.GD.ZS','approved','independent_defense_expenditure_estimate','SIPRI defense-expenditure series using official documents, budgets, and independent estimation.','militaryShare',40)), evaluated as (
  select
    category.id,
    policy.indicator,
    policy.provenance_status,
    policy.provenance_class,
    policy.provenance_reason,
    policy.concept_group,
    policy.priority,
    (
      policy.provenance_status='approved'
      and category.quality_score >= 80
      and category.country_coverage >= coalesce(nullif(category.metadata->>'coverageFloor','')::integer,100)
      and category.latest_available_year >= extract(year from now())::integer - 5
    ) as passes
  from public.stat_categories category
  join policy on policy.id=category.id
  where category.source_organization='World Bank'
)
update public.stat_categories category
set
  provenance_status=evaluated.provenance_status,
  provenance_class=evaluated.provenance_class,
  provenance_reason=evaluated.provenance_reason || ' The measure is not accepted as a bare assertion from national political leadership.',
  methodology_url='https://databank.worldbank.org/metadataglossary/world-development-indicators/series/' || evaluated.indicator,
  independent_validation=(evaluated.provenance_status='approved'),
  government_assertion_risk=case when evaluated.provenance_status='approved' then 'low' else 'medium' end,
  concept_group=evaluated.concept_group,
  governance_priority=evaluated.priority,
  governance_version='geostats-v13.4-provenance-v1',
  auto_qualified=case when category.review_status='rejected' then false else evaluated.passes end,
  review_status=case
    when category.review_status='rejected' then 'rejected'
    when evaluated.passes then 'approved'
    when evaluated.provenance_status<>'approved' and category.quality_score>=80 then 'needs_review'
    else 'candidate'
  end,
  enabled=case when category.review_status='rejected' then false else evaluated.passes end,
  eligible_daily=case when category.review_status='rejected' then false else evaluated.passes end,
  duplicate_status='pending',
  superseded_by=null,
  auto_decision_reason=case
    when evaluated.passes then 'Automatically approved after World Bank numerical and indicator-level provenance re-review; duplicate arbitration may still supersede it.'
    when evaluated.provenance_status<>'approved' then 'Quarantined by indicator-level provenance policy.'
    else 'Quarantined because the numerical quality gate did not pass.'
  end,
  metadata=coalesce(category.metadata,'{}'::jsonb) || jsonb_build_object(
    'governanceVersion','geostats-v13.4-provenance-v1',
    'conceptGroup',evaluated.concept_group,
    'provenanceClass',evaluated.provenance_class,
    'provenanceStatus',evaluated.provenance_status
  ),
  updated_at=now()
from evaluated
where category.id=evaluated.id;

-- Reclassify already-imported direct-source categories. The old strict numerical
-- gate is retained, then provenance and source documentation determine auto-approval.
with source_policy(source_organization,provenance_class,reason,methodology_url,risk,priority) as (
  values
    ('WHO','internationally_harmonized_model_or_health_system_measure','WHO GHO uses documented international methods, surveys, standardized health-system inputs, and transparent modeled estimates.','https://www.who.int/data/gho/info/gho-odata-api','low',10),
    ('UNESCO UIS','internationally_harmonized_education_statistics','UNESCO UIS applies documented definitions, validation, and comparability controls to administrative and survey-based education statistics.','https://databrowser.uis.unesco.org/resources','low',12),
    ('ILOSTAT','internationally_harmonized_labor_survey_or_model','ILOSTAT harmonizes labor-force surveys, administrative records, and modeled estimates using published standards.','https://ilostat.ilo.org/resources/concepts-and-definitions/','low',10),
    ('Natural Earth','independent_geospatial_measurement','Natural Earth categories are calculated consistently from one global geometry dataset rather than country-submitted claims.','https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/','none',15),
    ('UN Comtrade','transactional_customs_records_with_un_harmonization','UN Comtrade uses customs transaction records standardized by the United Nations.','https://unstats.un.org/unsd/trade/eg-imts/IMTS%202010%20(English).pdf','low',8),
    ('U.S. EIA','measured_energy_administrative_statistics','EIA international series use documented production, generation, trade, and consumption statistics with standardized units.','https://www.eia.gov/opendata/documentation.php','low',9),
    ('UNHCR','operational_registration_and_case_records','UNHCR statistics are compiled from operational registration, asylum, and protection systems with published definitions.','https://www.unhcr.org/refugee-statistics/methodology/','low',7),
    ('FAOSTAT','internationally_harmonized_fao_production_statistics','FAOSTAT QCL uses standardized definitions, validation flags, and national statistical or administrative production records.','https://www.fao.org/faostat/en/#definitions','low',11)
), evaluated as (
  select
    category.id,
    policy.*,
    coalesce(nullif(category.metadata->>'concept_group',''),nullif(category.metadata->>'conceptGroup',''),nullif(category.metadata->>'canonical_slug',''),category.id) as resolved_group,
    (
      category.auto_qualified=true
      and coalesce(category.evidence_tier,'C') in ('A','B')
      and (category.source_organization<>'FAOSTAT' or coalesce(category.official_observation_share,0)>=0.60)
    ) as passes
  from public.stat_categories category
  join source_policy policy using(source_organization)
  where category.source_organization<>'World Bank'
)
update public.stat_categories category
set
  provenance_status='approved',
  provenance_class=evaluated.provenance_class,
  provenance_reason=evaluated.reason || ' Unsupported political assertions alone do not satisfy this gate.',
  methodology_url=evaluated.methodology_url,
  independent_validation=true,
  government_assertion_risk=evaluated.risk,
  concept_group=evaluated.resolved_group,
  governance_priority=evaluated.priority,
  governance_version='geostats-v13.4-provenance-v1',
  auto_qualified=case when category.review_status='rejected' then false else evaluated.passes end,
  review_status=case when category.review_status='rejected' then 'rejected' when evaluated.passes then 'approved' when category.auto_qualified then 'needs_review' else 'candidate' end,
  enabled=case when category.review_status='rejected' then false else evaluated.passes end,
  eligible_daily=case when category.review_status='rejected' then false else evaluated.passes end,
  duplicate_status='pending',
  superseded_by=null,
  auto_decision_reason=case when evaluated.passes then 'Automatically approved because numerical quality and provenance gates passed; duplicate arbitration may still supersede it.' else 'Quarantined because quality or evidence did not satisfy automatic approval.' end,
  metadata=coalesce(category.metadata,'{}'::jsonb) || jsonb_build_object('governanceVersion','geostats-v13.4-provenance-v1','conceptGroup',evaluated.resolved_group),
  updated_at=now()
from evaluated
where category.id=evaluated.id;

-- Indicator-specific exception retained from the source policy.
update public.stat_categories
set provenance_status='uncertain', independent_validation=false, government_assertion_risk='medium',
    auto_qualified=false, review_status=case when review_status='rejected' then 'rejected' else 'needs_review' end,
    enabled=false, eligible_daily=false, duplicate_status='not_eligible',
    provenance_reason='Birth-registration completeness can depend heavily on uneven national administrative systems and is not auto-approved without an indicator-specific audit.',
    auto_decision_reason='Quarantined by indicator-specific provenance policy.'
where coalesce(metadata->>'canonical_slug','')='highest-birth-registration';

-- Cross-source and inverse-direction duplicates share a single concept group.
update public.stat_categories set concept_group='life-expectancy' where concept_group in ('life','highest-life-expectancy');
update public.stat_categories set concept_group='infant-mortality' where concept_group in ('infantMortality','lowest-infant-mortality');
update public.stat_categories set concept_group='road-fatality-rate' where concept_group in ('roadFatalities','lowest-road-traffic-death-rate');
update public.stat_categories set concept_group='health-spending-per-person' where concept_group in ('healthSpend','highest-health-spending-per-person');
update public.stat_categories set concept_group='unemployment-rate' where concept_group in ('unemploymentLow','lowest-unemployment');
update public.stat_categories set concept_group='education-spending-share-gdp' where concept_group in ('education','highest-education-spending-gdp');
update public.stat_categories set concept_group='drinking-water-access' where concept_group in ('basicWater','safely-managed-drinking-water-access','highest-safe-drinking-water');
update public.stat_categories set concept_group='urbanization-share' where concept_group in ('urban','rural');
update public.stat_categories set concept_group='employment-status-share' where concept_group in ('highest-wage-employment-share','highest-self-employment-share');
update public.stat_categories set concept_group='safely-managed-sanitation-access' where concept_group in ('sanitation','highest-safe-sanitation');
update public.stat_categories set concept_group='forest-cover-share' where id in ('forestPct','leastForest');
update public.stat_categories set concept_group='average-precipitation' where id in ('rain','dry');

create or replace function public.refresh_stat_concept_group(p_concept_group text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  chosen text;
begin
  if p_concept_group is null or btrim(p_concept_group)='' then return null; end if;

  select category.id into chosen
  from public.stat_categories category
  where category.concept_group=p_concept_group
    and category.review_status<>'rejected'
    and category.auto_qualified=true
    and category.provenance_status='approved'
    and category.independent_validation=true
  order by
    category.governance_priority asc,
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
      when category.id=chosen then 'approved'
      when category.auto_qualified and category.provenance_status='approved' then 'candidate'
      when category.auto_qualified then 'needs_review'
      else 'candidate'
    end,
    duplicate_status=case
      when category.id=chosen then 'preferred'
      when chosen is not null and category.auto_qualified and category.provenance_status='approved' then 'superseded'
      else 'not_eligible'
    end,
    superseded_by=case when category.id<>chosen then chosen else null end,
    auto_decision_reason=case
      when category.id=chosen then 'Automatically selected as the strongest playable category in its concept group.'
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
declare
  group_name text;
begin
  select concept_group into group_name from public.stat_categories where id=p_category_id;
  if group_name is null then
    update public.stat_categories set concept_group=id where id=p_category_id;
    group_name:=p_category_id;
  end if;
  return public.refresh_stat_concept_group(group_name);
end;
$$;

revoke all on function public.refresh_stat_concept_group(text) from public,anon,authenticated;
revoke all on function public.apply_category_governance(text) from public,anon,authenticated;
grant execute on function public.refresh_stat_concept_group(text) to service_role;
grant execute on function public.apply_category_governance(text) to service_role;

do $$
declare row record;
begin
  for row in select distinct concept_group from public.stat_categories where concept_group is not null loop
    perform public.refresh_stat_concept_group(row.concept_group);
  end loop;
end $$;

update public.data_sources
set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'intake_policy','geostats-v13.4-provenance-v1',
  'review_required',false,
  'automatic_approval',true,
  'bare_government_assertions_allowed',false,
  'duplicate_policy','one preferred category per concept group'
), updated_at=now()
where status in ('active','importing');

commit;
