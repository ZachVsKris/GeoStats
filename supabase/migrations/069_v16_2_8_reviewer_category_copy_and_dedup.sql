begin;

-- GeoStats v16.2.8: apply the owner's playable-category review as a durable
-- catalog decision. Keep the source's technical definition intact while making
-- the player-facing title and description understandable without specialist
-- economic/statistical vocabulary.
create temporary table v069_copy (
  id text primary key,
  title text not null,
  description text
) on commit drop;

insert into v069_copy (id,title,description) values
  ('worldbank-catalog:en-ghg-co2-pi-mt-ce-ar5','Most CO₂ emissions from power generation','Annual carbon dioxide emissions from producing electricity and heat.'),
  ('electricUse','Highest electricity use per person','Electricity used per person during the year, measured in kilowatt-hours.'),
  ('energyUse','Highest energy use per person','Energy used per person, converted to kilograms of oil equivalent.'),
  ('unsdg:pm25-exposure','Highest fine particle air pollution','Average exposure to fine airborne particles small enough to enter the lungs.'),
  ('worldbank-catalog:eg-gdp-puse-ko-pp','Highest economic output per unit of energy','Economic output generated for each kilogram of oil-equivalent energy used, adjusted for differences in countries’ purchasing power.'),
  ('worldbank-catalog:en-ghg-all-pc-ce-ar5','Most greenhouse gas emissions per person','Annual greenhouse gas emissions per person, excluding land use and forestry.'),
  ('worldbank-catalog:en-mam-thrd-no','Most threatened mammal species','Number of mammal species classified as threatened with extinction.'),
  ('worldbank-catalog:en-hpt-thrd-no','Most threatened higher plant species','Number of higher plant species classified as threatened with extinction.'),
  ('worldbank-catalog:er-h2o-intr-pc','Most renewable freshwater per person','Fresh water naturally replenished each year, divided by the population.'),
  ('unescoich:most-elements','Most living cultural traditions recognized by UNESCO','Living traditions such as festivals, music, dance, rituals and crafts. These are different from monuments and World Heritage sites.'),
  ('worldbank-catalog:bn-klt-dinv-cd','Largest net foreign direct investment','Net cross-border investment in which an investor owns at least 10% of a business and therefore has lasting influence over it.'),
  ('gdpPc','Highest GDP per person','The country’s total economic output divided by its population.'),
  ('worldbank-catalog:dt-oda-alld-cd','Largest net development aid received','Official development aid received from abroad after subtracting repayments, in current US dollars.'),
  ('worldbank-catalog:dt-oda-odat-cd','Largest net official development assistance received','Official development assistance received from abroad after subtracting repayments, in current US dollars.'),
  ('worldbank-catalog:bn-gsr-fcty-cd','Largest net work and investment income from abroad','Income residents receive from work and investments abroad minus the equivalent income paid to nonresidents.'),
  ('worldbank-catalog:bn-trf-curr-cd','Largest net transfers received from abroad','Transfers received from abroad minus transfers sent abroad when no repayment is required, including aid, pensions and personal transfers.'),
  ('worldbank-catalog:ic-bus-ndns-zs','Most new companies per 1,000 people ages 15–64','New limited liability companies registered during the year per 1,000 people ages 15–64.'),
  ('worldbank-catalog:bx-trf-pwkr-dt-gd-zs','Highest money sent home from abroad as % of GDP','Money sent home by people working or living abroad as a percentage of GDP.'),
  ('worldbank-catalog:ic-bus-nreg','Most businesses registered in 2024','New limited-liability companies registered during 2024.'),
  ('gdp','Largest economy','Total value of goods and services produced in the country during the year.'),
  ('manufacturing','Largest manufacturing output','Value created by manufacturing in the country during the year.'),
  ('worldbank-catalog:fi-res-totl-cd','Largest central bank reserves including gold','Foreign currency and gold held by the country’s central bank and monetary authorities.'),
  ('worldbank-catalog:fb-atm-totl-p5','Most ATMs per 100,000 adults','Cash machines available for every 100,000 adults.'),
  ('worldbank-catalog:fb-cbk-brch-p5','Most bank branches per 100,000 adults','Commercial bank branches available for every 100,000 adults.'),
  ('journalArticles','Most scientific journal articles','Scientific and technical journal articles published during the year.'),
  ('worldbank-catalog:ag-lnd-arbl-ha-pc','Most arable land per person','Farmable land available per person, measured in hectares.'),
  ('faostat-fbs:pulses','Highest dried bean, lentil, pea and chickpea consumption per person','Estimated dried bean, lentil, pea and chickpea consumption per person. This is based on national food supplies, not measured household diets.'),
  ('militarySpend','Largest military spending','Total military spending in current US dollars.'),
  ('militaryShare','Highest military spending as % of GDP','Military spending as a percentage of the country’s total economic output.'),
  ('worldbank-catalog:ms-mil-xpnd-zs','Highest military spending as % of government spending','Military spending as a percentage of all general government spending. This is different from military spending as a percentage of GDP.'),
  ('worldbank-catalog:ms-mil-mprt-kd','Largest major arms imports','Estimated volume of major weapons imported through purchases, gifts or licensed production.'),
  ('fertility','Highest fertility rate','Average number of children a woman would have under current birth rates.'),
  ('healthSpend','Highest health spending per person','Average health spending per person in current US dollars.'),
  ('density','Highest population density','People living in each square kilometer of land.'),
  ('population','Largest population','Total number of people living in the country.'),
  ('worldbank-catalog:en-urb-mcty','Largest population in cities over one million','People living in metropolitan areas with over one million residents.'),
  ('unhcr:most-stateless-people','Most stateless people living in the country','People living in the country who are not legally recognized as citizens by any country. Unlike refugees, stateless people may never have crossed a border.'),
  ('unsdg:urban-slum-share','Highest % of urban residents living in slums','Percentage of urban residents in households that lack one or more basic conditions such as safe water, sanitation, sufficient living space, durable housing or secure tenure.'),
  ('unwpp:lowest-death-rate','Fewest annual deaths per 1,000 people','Deaths during the year for every 1,000 people in the population; this is an annual rate, not a daily count.'),
  ('history:worldbank-infant-mortality-below-25','Latest to reach under 25 infant deaths per 1,000 births','Year infant mortality first fell below 25 deaths before age one per 1,000 births.'),
  ('worldbank-catalog:it-net-secr','Most trusted website security certificates','Publicly trusted website security certificates, grouped by hosting country.'),
  ('airPassengers','Most passengers carried by airlines based in the country','Domestic and international passengers carried by airlines based in each country.'),
  ('worldbank-catalog:bx-gsr-cmcp-zs','Highest telecom and computer services as % of service exports','Telecommunications, computer, information and related services as a percentage of all services sold abroad.'),
  ('worldbank-catalog:bm-gsr-cmcp-zs','Highest telecom and computer services as % of service imports','Telecommunications, computer, information and related services as a percentage of all services bought from abroad.'),
  ('worldbank-catalog:bn-gsr-mrch-cd','Largest goods trade surplus','Value of physical goods exported minus physical goods imported, in current US dollars.'),
  ('worldbank-catalog:bn-gsr-gnfs-cd','Largest trade surplus in products and services','Value of products and services exported minus products and services imported, in current US dollars.'),
  ('worldbank-catalog:bx-gsr-trvl-zs','Highest foreign visitor spending as % of service exports','Money spent in the country by foreign visitors as a percentage of all service exports.'),
  ('worldbank-catalog:bm-gsr-trvl-zs','Highest residents’ foreign travel spending as % of service imports','Money residents spend while traveling abroad as a percentage of all service imports.'),
  ('worldbank-catalog:bx-gsr-gnfs-cd','Largest exports of products and services','Total value sold abroad: physical products plus services such as travel, transport, finance and communications.'),
  ('worldbank-catalog:bx-gsr-totl-cd','Largest receipts from exports and overseas income','Money received from exporting products and services plus residents’ work and investment income from abroad.'),
  ('worldbank-catalog:bx-gsr-mrch-cd','Largest physical goods exports','Value of physical products whose ownership moved from residents to buyers abroad, in current US dollars.'),
  ('worldbank-catalog:bm-gsr-mrch-cd','Largest physical goods imports','Value of physical products whose ownership moved from sellers abroad to residents, in current US dollars.'),
  ('highTechExports','Largest advanced technology exports','Export value of products with high research-and-development intensity, including aerospace, computers, electronics, pharmaceuticals and scientific instruments.'),
  ('worldbank-catalog:bm-gsr-gnfs-cd','Largest imports of products and services','Total value bought from abroad: physical products plus services such as travel, transport, finance and communications.'),
  ('worldbank-catalog:bx-gsr-nfsv-cd','Largest services exports','Value of services provided to people and businesses in other countries.'),
  ('worldbank-catalog:bm-gsr-nfsv-cd','Largest services imports','Value of services bought from people and businesses in other countries.'),
  ('comtrade:most-iron-steel-exported','Largest iron and steel exports',null),
  ('merchExports','Largest goods exports recorded by customs','Physical products exported across national borders as recorded by customs. This differs from balance-of-payments goods data, which follows changes in ownership.'),
  ('merchImports','Largest goods imports recorded by customs','Physical products imported across national borders as recorded by customs. This differs from balance-of-payments goods data, which follows changes in ownership.'),
  ('worldbank-catalog:bg-gsr-nfsv-gd-zs','Highest international services trade as % of GDP','Services sold to and bought from other countries as a percentage of GDP.'),
  ('worldbank-catalog:eg-use-comm-cl-zs','Highest % of energy from alternative and nuclear sources',null),
  ('worldbank-catalog:eg-elc-fosl-zs','Highest % of electricity from fossil fuels',null),
  ('worldbank-catalog:en-urb-mcty-tl-zs','Highest % of people in cities over one million',null),
  ('worldbank-catalog:eg-elc-hyro-zs','Highest % of electricity from hydropower',null),
  ('worldbank-catalog:eg-elc-ngas-zs','Highest % of electricity from natural gas',null),
  ('worldbank-catalog:eg-elc-petr-zs','Highest % of electricity from oil',null),
  ('worldbank-catalog:er-mrn-ptmr-zs','Highest % of territorial waters protected',null),
  ('worldbank-catalog:eg-use-crnw-zs','Highest % of energy from biomass and waste',null),
  ('pew-religion:buddhist-share','Highest % of population that is Buddhist',null),
  ('pew-religion:christian-share','Highest % of population that is Christian',null),
  ('pew-religion:hindu-share','Highest % of population that is Hindu',null),
  ('pew-religion:muslim-share','Highest % of population that is Muslim',null),
  ('pew-religion:unaffiliated-share','Highest % of population with no religious affiliation',null),
  ('pew-religion:other-religions-share','Highest % of population following other religions',null),
  ('worldbank-catalog:fx-own-totl-zs','Highest % of adults with a financial or mobile money account',null),
  ('education','Highest education spending as % of GDP',null),
  ('foodExportsShare','Highest % of goods exports that are food','Food products as a percentage of all physical goods exported.'),
  ('foodImportsShare','Highest % of goods imports that are food','Food products as a percentage of all physical goods imported.'),
  ('arablePct','Highest % of land that is arable','Percentage of land suitable for temporary crops or pasture.'),
  ('agValue','Largest agricultural output','Value created by agriculture, forestry and fishing during the year.'),
  ('comtrade:most-citrus-exported','Largest citrus fruit exports','Annual value of citrus fruit exported from the country.'),
  ('worldbank-catalog:ag-lnd-crop-zs','Highest % of land in permanent crops',null),
  ('worldbank-catalog:er-h2o-fwag-zs','Highest % of freshwater withdrawals used by agriculture',null),
  ('agLand','Highest % of land used for agriculture',null),
  ('unsdg:unsentenced-detainees','Highest % of prisoners awaiting trial','Prisoners awaiting trial or sentencing as a percentage of all prisoners.'),
  ('worldbank-catalog:gc-tax-totl-gd-zs','Highest tax revenue as % of GDP',null),
  ('healthSpendShare','Highest health spending as % of GDP',null),
  ('unwpp:highest-male-share','Highest % of population that is male',null),
  ('rural','Highest % of population living in rural areas','Percentage of people living in areas classified as rural.'),
  ('worldbank-catalog:en-urb-lcty-ur-zs','Highest % of urban residents living in the largest city',null),
  ('worldbank-catalog:bx-gsr-ccis-zs','Highest IT and telecom services as % of service exports',null),
  ('worldbank-catalog:bx-gsr-tran-zs','Highest transport services as % of service exports',null),
  ('worldbank-catalog:bm-gsr-tran-zs','Highest transport services as % of service imports',null),
  ('worldbank-catalog:er-h2o-fwdm-zs','Highest % of freshwater withdrawals used by households','Household and municipal use as a percentage of all freshwater withdrawn.'),
  ('worldbank-catalog:er-h2o-fwin-zs','Highest % of freshwater withdrawals used by industry','Industrial use as a percentage of all freshwater withdrawn.'),
  ('protected','Highest % of land protected',null),
  ('forestPct','Highest % of land covered by forest',null),
  ('natural-earth:highest-mapped-glaciated-share','Highest % of land covered by glaciers','Percentage of country land covered by glaciers and ice caps.'),
  ('exportsShare','Highest exports as % of GDP',null),
  ('history:worldbank-life-expectancy-70','Most recently reached life expectancy of 70 years',null),
  ('natural-earth:largest-single-mapped-lake','Largest lake or reservoir','Area of the largest single lake or reservoir inside the country.'),
  ('natural-earth:largest-mapped-lake-area','Largest total lake and reservoir area','Combined area of lakes and reservoirs inside the country.'),
  ('natural-earth:highest-mapped-lake-share','Highest % of land covered by lakes and reservoirs','Percentage of country land covered by lakes and reservoirs.'),
  ('natural-earth:largest-mapped-glaciated-area','Largest area covered by glaciers','Combined area of glaciers and ice caps inside each country.'),
  ('comtrade:most-railway-equipment-exported','Largest railway equipment exports',null),
  ('comtrade:most-apples-pears-exported','Largest apple and pear exports','Annual value of apples and pears exported from the country.'),
  ('comtrade:most-cocoa-beans-exported','Largest cocoa bean exports','Annual value of cocoa beans exported from the country.'),
  ('comtrade:most-integrated-circuits-exported','Largest computer chip exports','Annual value of computer chips exported from the country.'),
  ('comtrade:most-electrical-equipment-exported','Largest electrical equipment exports','Annual value of electrical equipment exported from the country.'),
  ('comtrade:most-medical-optical-exported','Largest medical and optical equipment exports','Annual value of medical and optical equipment exported from the country.'),
  ('comtrade:most-rubber-products-exported','Largest rubber product exports','Annual value of rubber products exported from the country.'),
  ('worldbank-catalog:is-air-dprt','Most airline departures','Number of domestic and international takeoffs by airlines registered in each country during the year.'),
  ('worldbank-catalog:it-net-bbnd','Most fixed broadband subscriptions','Total fixed high-speed Internet subscriptions in the country.'),
  ('worldbank-catalog:it-mlt-main','Most fixed telephone subscriptions','Total active fixed telephone subscriptions in the country.'),
  ('worldbank-catalog:it-cel-sets','Most mobile cellular subscriptions','Total active mobile phone subscriptions in the country.'),
  ('fixedBroadband','Highest fixed broadband subscriptions per 100 people','Fixed broadband subscriptions for every 100 people.'),
  ('mobile','Highest mobile subscriptions per 100 people','Mobile phone subscriptions for every 100 people.'),
  ('worldbank-catalog:bx-gsr-ccis-cd','Largest telecom and computer service exports','Value of telecom, computer and information services sold abroad.'),
  ('natural-earth:highest-mapped-river-density','Highest river density','Length of major rivers per 1,000 square kilometers of land.'),
  ('natural-earth:longest-average-land-border','Longest average land border','Average border length per neighboring country.'),
  ('natural-earth:longest-land-border','Longest combined land borders','Combined length of all international land borders.'),
  ('natural-earth:highest-land-border-density','Most land border for its size','Land border length per 1,000 square kilometers of country area.'),
  ('natural-earth:northernmost-country','Northernmost country','Latitude of the country’s northernmost land point.'),
  ('natural-earth:southernmost-country','Southernmost country','Latitude of the country’s southernmost land point.'),
  ('faostat-qcl-mules-and-hinnies-stocks-02133-5111-an','Largest mule and hinny population','Total mules and hinnies. A hinny is the offspring of a stallion and a female donkey.'),
  ('worldbank-catalog:ag-srf-totl-k2','Largest total country area','Total country area, including land and inland water.'),
  ('faostat-qcl-pulses-total-production-f1726-5510-t','Most dried beans, lentils, peas and chickpeas produced','Total dried beans, lentils, peas and chickpeas produced during the year.');

update public.stat_categories c
set title=v.title,
    description=coalesce(v.description,c.description),
    plain_language_description=coalesce(v.description,c.plain_language_description,c.description),
    content_review_status='approved',
    content_review_reason='v16.2.8 owner review: revised for immediate comprehension and consistent Most/Largest/Highest wording.',
    content_review_version='geostats-v16.2.8-owner-review',
    immediate_comprehension_score=greatest(coalesce(c.immediate_comprehension_score,0),94),
    understandability_score=greatest(coalesce(c.understandability_score,0),94),
    updated_at=now()
from v069_copy v
where c.id=v.id;

-- This energy-efficiency indicator is a ratio, not a total. Its old generic
-- unit caused both the title and the measurement badge to mislead players.
update public.stat_categories
set unit='PPP $ per kg oil equivalent',value_type='rate',measurement_type='other',
    unit_explanation='Purchasing-power-adjusted GDP per kilogram of oil equivalent of energy used.',updated_at=now()
where id='worldbank-catalog:eg-gdp-puse-ko-pp';

-- These two legacy rows store per-person values even though their old type was
-- "total". Correct the type so the badge and editorial prefix agree.
update public.stat_categories
set value_type='per_capita',measurement_type='per_capita',updated_at=now()
where id in ('gdpPc','healthSpend');

-- "Mapped" is a source-methodology qualifier, not a useful game label. Keep
-- that limitation in the descriptions while exposing the correct measure type.
update public.stat_categories
set value_type=case
      when id='natural-earth:highest-mapped-lake-share' then 'percentage'
      else 'total'
    end,
    measurement_type=case
      when id='natural-earth:highest-mapped-lake-share' then 'share'
      else 'total'
    end,
    updated_at=now()
where id in (
  'natural-earth:largest-single-mapped-lake',
  'natural-earth:largest-mapped-lake-area',
  'natural-earth:highest-mapped-lake-share',
  'natural-earth:largest-mapped-glaciated-area'
);

create temporary table v069_remove (
  id text primary key,
  reason text not null,
  replacement_id text
) on commit drop;

insert into v069_remove (id,reason,replacement_id) values
  ('worldbank-catalog:eg-elc-loss-zs','Owner review: remove this low-interest grid-loss measure from gameplay.',null),
  ('worldbank-catalog:bm-gsr-royl-cd','Owner review: remove this technical intellectual-property payments measure from gameplay.',null),
  ('worldbank-catalog:bx-gsr-royl-cd','Owner review: remove this technical intellectual-property receipts measure from gameplay.',null),
  ('worldbank-catalog:bx-gsr-insf-zs','Owner review: remove this narrow insurance-and-financial-services export share from gameplay.',null),
  ('worldbank-catalog:bm-gsr-insf-zs','Owner review: remove this narrow insurance-and-financial-services import share from gameplay.',null),
  ('worldbank-catalog:fi-res-totl-mo','Owner review: remove this technical reserves-in-months-of-imports measure from gameplay.',null),
  ('worldbankinfra:air-passengers','Exact duplicate of airPassengers: same World Bank indicator, reference year, 147-country set and values.','airPassengers'),
  ('worldbank-catalog:en-pop-slum-ur-zs','Older duplicate of the same urban-slum-share concept; keep the newer 2024 UN SDG release.','unsdg:urban-slum-share');

update public.stat_categories c
set review_status='rejected',
    curation_status='excluded',
    content_review_status='excluded',
    curation_reason=r.reason,
    content_review_reason=r.reason,
    curation_version='geostats-v16.2.8-owner-review',
    content_review_version='geostats-v16.2.8-owner-review',
    duplicate_status=case when r.replacement_id is null then c.duplicate_status else 'superseded' end,
    superseded_by=coalesce(r.replacement_id,c.superseded_by),
    enabled=false,
    eligible_daily=false,
    updated_at=now()
from v069_remove r
where c.id=r.id;

update public.category_review_state r
set status='rejected',
    duplicate_of=x.replacement_id,
    notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.8 owner review: '||x.reason),
    updated_at=now()
from v069_remove x
where r.category_id=x.id;

-- Normalize the two large, repetitive source families once instead of leaving
-- dozens of technically worded descriptions for players to decode.
update public.stat_categories c
set description=regexp_replace(c.title,'^Most (.+) produced$','Total \1 produced during the year.','i'),
    plain_language_description=regexp_replace(c.title,'^Most (.+) produced$','Total \1 produced during the year.','i'),
    updated_at=now()
where c.id like 'faostat-qcl-%'
  and c.title ~* '^Most .+ produced$';

update public.stat_categories c
set description=regexp_replace(c.title,'^Largest (.+) exports$','Annual value of \1 exported from the country.','i'),
    plain_language_description=regexp_replace(c.title,'^Largest (.+) exports$','Annual value of \1 exported from the country.','i'),
    updated_at=now()
where c.id like 'comtrade:%'
  and c.title ~* '^Largest .+ exports$';

-- Produce an actual card-sized explanation for every playable category. Keep a
-- good hand-written board description when one exists; otherwise prefer the
-- first short plain-language sentence, then generate a concise unit-aware line.
create or replace function public.category_board_description_v16_2_8(
  p_title text,
  p_description text,
  p_unit text,
  p_existing text default null
) returns text
language plpgsql
immutable
as $$
declare
  v_existing text := trim(regexp_replace(coalesce(p_existing,''),'\s+',' ','g'));
  v_description text := trim(regexp_replace(coalesce(p_description,''),'\s+',' ','g'));
  v_sentence text;
  v_measure text := trim(regexp_replace(coalesce(p_title,''),'^(Highest|Lowest|Largest|Most|Fewest|Fastest|Longest|Shortest|Oldest|Youngest|Latest)\s+','','i'));
  v_generated text;
begin
  if length(v_existing) between 20 and 82
     and v_existing !~* '^(compare countries|compare the official|official country value)'
     and v_existing !~* '(^|[^a-z])(mapped|reported value|exact series|indicator code|source-family)([^a-z]|$)'
  then
    return v_existing;
  end if;

  v_sentence := trim(split_part(v_description,'.',1));
  if length(v_sentence) between 20 and 81
     and v_sentence !~* '^(compare countries|compare the official|official country value)'
     and v_sentence !~* 'according to|using the (exact|official)'
     and v_sentence !~* '(^|[^a-z])(mapped|reported value|indicator code|source-family)([^a-z]|$)'
  then
    return v_sentence||'.';
  end if;

  if coalesce(p_title,'') ~* '^Most .+ produced$' then
    v_generated := regexp_replace(p_title,'^Most (.+) produced$','Total \1 produced during the year.','i');
  elsif coalesce(p_title,'') ~* '^Largest .+ exports$' then
    v_generated := regexp_replace(p_title,'^Largest (.+) exports$','Annual value of \1 exported from the country.','i');
  elsif coalesce(p_unit,'') !~* '^(|other|reported value|value)$' then
    v_generated := upper(left(v_measure,1))||substr(v_measure,2)||', measured as '||p_unit||'.';
  else
    v_generated := upper(left(v_measure,1))||substr(v_measure,2)||' for the reference year.';
  end if;

  if length(v_generated) <= 82 then
    return v_generated;
  end if;

  if coalesce(p_unit,'') !~* '^(|other|reported value|value)$' then
    return 'Measured as '||left(p_unit,40)||' for the reference year.';
  end if;
  return 'Country total for the reference year.';
end $$;

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
where c.enabled
  and c.eligible_daily;

create or replace view public.category_copy_clarity_v16_2_8 as
select
  c.id,
  c.title,
  c.metadata->>'boardDescription' as board_description,
  array_remove(array[
    case when length(c.title)>82 then 'title_too_long' end,
    case when c.title ~* '(^|[^a-z])(mapped|reported value|indicator code|source-family|merchandise|intangible cultural heritage|SNA|BoP)([^a-z]|$)' then 'internal_or_specialist_title' end,
    case when c.title ~* '(^|[^a-z])share([^a-z]|$)' then 'share_instead_of_percent' end,
    case when position('-' in c.title)>0 then 'unnecessary_title_hyphen' end,
    case when c.value_type='total' and c.title ~* '^Highest ' then 'highest_used_for_total' end,
    case when c.value_type='percentage' and c.title ~* '^(Most|Largest) ' then 'most_or_largest_used_for_percentage' end,
    case when nullif(trim(c.metadata->>'boardDescription'),'') is null then 'missing_board_description' end,
    case when length(c.metadata->>'boardDescription')>82 then 'board_description_too_long' end,
    case when c.metadata->>'boardDescription' ~* '^(compare countries|compare the official|official country value)' then 'generic_board_description' end,
    case when c.metadata->>'boardDescription' ~* '(^|[^a-z])(mapped|reported value|indicator code|source-family)([^a-z]|$)' then 'internal_board_description' end
  ],null) as issues
from public.stat_categories c
where c.enabled
  and c.eligible_daily;

do $$
begin
  if exists (select 1 from public.category_copy_clarity_v16_2_8 where cardinality(issues)>0) then
    raise exception 'v16.2.8 playable-category clarity gate failed';
  end if;
end $$;

select public.refresh_category_decision_provenance_v16_2_7();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

do $$
begin
  if exists (
    select 1 from public.stat_categories c
    join v069_remove r on r.id=c.id
    where c.enabled or c.eligible_daily or c.curation_status<>'excluded'
  ) then
    raise exception 'v16.2.8 owner-review removals did not remain fail-closed';
  end if;

  if (select count(*) from public.stat_categories c join v069_copy v on v.id=c.id where c.title=v.title) <> (select count(*) from v069_copy) then
    raise exception 'v16.2.8 owner-review copy update was incomplete';
  end if;
end $$;

commit;
