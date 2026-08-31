begin;

-- Bounded player-copy audit: replace generic or misleading icons, repair the
-- small set of labels whose displayed measure did not match the stored unit,
-- and keep the corrected copy available when older saved boards are replayed.
with fixes(id, title, short_title, description, icon, unit, value_type, measurement_type) as (
  values
    ('pew-religion:other-religions-population','Largest population following other religions','Largest population following other religions','Estimated 2020 population following religions that Pew groups as “other religions”; religiously unaffiliated people are a separate category.','🕯️',null,null,null),
    ('worldbank-catalog:en-urb-mcty-tl-zs','Largest share of population in million-plus urban areas','Largest share in million-plus urban areas','Share of the population living in urban areas with more than one million people.','🏙️',null,null,null),
    ('worldbank-catalog:er-h2o-fwdm-zs','Largest domestic share of freshwater withdrawals','Largest domestic share of freshwater use','Household and municipal use as a percentage of all freshwater withdrawn.','🚰',null,null,null),
    ('worldbank-catalog:er-h2o-fwin-zs','Largest industrial share of freshwater withdrawals','Largest industrial share of freshwater use','Industrial use as a percentage of all freshwater withdrawn.','🏭',null,null,null),
    ('worldbank-catalog:er-h2o-fwtl-k3','Largest total freshwater withdrawals','Largest total freshwater withdrawals','Total freshwater withdrawn during the year, excluding evaporation losses from storage basins.','💧',null,null,null),
    ('worldbank-catalog:er-h2o-fwtl-zs','Highest freshwater use relative to internal resources','Highest freshwater use vs. internal resources','Annual freshwater withdrawals as a percentage of renewable internal freshwater resources.','💧','%',null,null),
    ('worldbank-catalog:er-h2o-intr-pc','Most renewable freshwater per person','Most renewable freshwater per person','Fresh water naturally replenished each year, divided by the population.','💧','per person',null,null),
    ('worldbank-catalog:er-mrn-ptmr-zs','Largest protected share of territorial waters','Largest protected share of territorial waters','Share of territorial waters designated as marine protected areas.','🌊',null,null,null),
    ('worldbank-catalog:is-air-dprt','Most airline departures','Most airline departures','Number of domestic and international takeoffs by airlines registered in each country during the year.','✈️',null,null,null),
    ('worldbank-catalog:it-cel-sets','Most mobile phone subscriptions','Most mobile phone subscriptions','Total active mobile phone subscriptions in the country.','📱',null,null,null),
    ('worldbank-catalog:it-mlt-main','Most fixed telephone subscriptions','Most fixed telephone subscriptions','Total active fixed telephone subscriptions in the country.','☎️',null,null,null),
    ('worldbank-catalog:it-net-bbnd','Most fixed broadband subscriptions','Most fixed broadband subscriptions','Total fixed high-speed Internet subscriptions in the country.','🌐',null,null,null),
    ('worldbank-catalog:it-net-secr','Most trusted website security certificates','Most website security certificates','Publicly trusted website security certificates, grouped by hosting country.','🔒',null,null,null),
    ('worldbank-catalog:it-net-secr-p6','Most secure Internet servers per million people','Most secure servers per million people','Secure Internet servers per one million people.','🔒','per million people','per_capita','per_capita'),
    ('worldbank-catalog:bx-klt-dinv-wd-gd-zs','Highest net foreign investment inflows as % of GDP','Highest net foreign investment inflows','Net foreign direct investment entering the country during the year, as a percentage of GDP.','💰','%',null,null),
    ('worldbank-catalog:ne-exp-gnfs-kd-zg','Fastest export growth','Fastest export growth','Annual percentage growth in the volume of goods and services exported.','📈','%',null,'other'),
    ('worldbank-catalog:fs-ast-cgov-gd-zs','Highest bank claims on central government as % of GDP','Highest bank claims on central government','Loans and other claims on central government, net of government deposits, as a percentage of GDP.','🏦','%',null,null),
    ('worldbank-catalog:bx-gsr-ccis-cd','Largest ICT service exports','Largest ICT service exports','Value of telecom, computer and information services sold abroad.','💻',null,null,null),
    ('worldbank-catalog:bx-gsr-ccis-zs','Highest ICT share of service exports','Highest ICT share of service exports','Share of commercial service exports made up of information and communication technology services.','💻',null,null,null),
    ('worldbank-catalog:fx-own-totl-zs','Highest share of adults with a financial account','Highest share with a financial account','Share of adults with an account at a financial institution or mobile-money provider.','🏦',null,null,null)
)
update public.stat_categories c
set title = f.title,
    short_title = f.short_title,
    description = f.description,
    plain_language_description = f.description,
    icon = f.icon,
    unit = coalesce(f.unit, c.unit),
    value_type = coalesce(f.value_type, c.value_type),
    measurement_type = coalesce(f.measurement_type, c.measurement_type),
    content_review_status = 'approved',
    content_review_reason = 'v16.2.9 bounded player-copy and icon audit',
    content_review_version = 'geostats-v16.2.9.3',
    metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
      'boardDescription', f.description,
      'plainLanguageDescription', f.description,
      'playerCopyVersion', 'geostats-v16.2.9.3',
      'iconAuditVersion', 'geostats-v16.2.9.3'
    ),
    updated_at = now()
from fixes f
where c.id = f.id;

notify pgrst, 'reload schema';

commit;
