-- GeoStats v13.3
-- Activates curated UN Comtrade, U.S. EIA, and UNHCR importers.
-- Imported categories remain disabled and quarantined until administrator review.

begin;

insert into public.data_sources(id, name, description, status, display_order, metadata)
values
  (
    'comtrade',
    'UN Comtrade',
    'Curated country merchandise-export categories from official UN Comtrade annual trade statistics.',
    'active',
    100,
    jsonb_build_object(
      'dataset', 'UN Comtrade International Merchandise Trade Statistics',
      'workflow', 'import-comtrade.yml',
      'api', 'https://comtradeapi.un.org',
      'documentation', 'https://comtradedeveloper.un.org',
      'intake_policy', 'geostats-v13.3-strict',
      'review_required', true,
      'canonical_layer', true,
      'optional_secret', 'COMTRADE_API_KEY',
      'default_access_mode', 'public-preview'
    )
  ),
  (
    'eia',
    'U.S. EIA',
    'Curated global energy production, consumption, generation, import, and export categories from EIA International Energy Data.',
    'active',
    110,
    jsonb_build_object(
      'dataset', 'EIA International Energy Data',
      'workflow', 'import-eia.yml',
      'api', 'https://api.eia.gov/v2/international/data',
      'documentation', 'https://www.eia.gov/opendata/documentation.php',
      'intake_policy', 'geostats-v13.3-strict',
      'review_required', true,
      'canonical_layer', true,
      'required_secret', 'EIA_API_KEY'
    )
  ),
  (
    'unhcr',
    'UNHCR',
    'Curated refugee, asylum, displacement, statelessness, and durable-solutions categories from the UNHCR Refugee Data Finder API.',
    'active',
    120,
    jsonb_build_object(
      'dataset', 'UNHCR Refugee Data Finder',
      'workflow', 'import-unhcr.yml',
      'api', 'https://api.unhcr.org/population/v1',
      'documentation', 'https://www.unhcr.org/refugee-statistics/insights/explainers/forcibly-displaced-api.html',
      'intake_policy', 'geostats-v13.3-strict',
      'review_required', true,
      'canonical_layer', true,
      'credentials_required', false
    )
  )
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  display_order = excluded.display_order,
  metadata = coalesce(public.data_sources.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

commit;
