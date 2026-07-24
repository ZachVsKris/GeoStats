-- GeoStats v13.1
-- Activates the UNESCO UIS, ILOSTAT, and Natural Earth importers.
-- All imported categories remain quarantined until administrator approval.

begin;

insert into public.data_sources(id, name, description, status, display_order, metadata)
values
  (
    'unesco',
    'UNESCO UIS',
    'Curated education, science, research, and school-infrastructure indicators from the UNESCO Institute for Statistics Data API.',
    'active',
    40,
    jsonb_build_object(
      'dataset', 'UIS Data Browser',
      'workflow', 'import-unesco.yml',
      'api', 'https://api.uis.unesco.org/api/public',
      'documentation', 'https://databrowser.uis.unesco.org/resources',
      'intake_policy', 'geostats-v13.1-strict',
      'review_required', true,
      'canonical_layer', true
    )
  ),
  (
    'ilostat',
    'ILOSTAT',
    'Curated internationally harmonized labor-market, working-conditions, productivity, and social-protection indicators.',
    'active',
    80,
    jsonb_build_object(
      'dataset', 'ILOSTAT bulk download',
      'workflow', 'import-ilostat.yml',
      'api', 'https://rplumber.ilo.org',
      'documentation', 'https://ilostat.ilo.org/data/bulk/',
      'intake_policy', 'geostats-v13.1-strict',
      'review_required', true,
      'canonical_layer', true
    )
  ),
  (
    'climate',
    'Natural Earth geography',
    'Stable country-geography categories derived consistently from Natural Earth 1:10m country geometries.',
    'active',
    90,
    jsonb_build_object(
      'dataset', 'Natural Earth Admin 0 Countries 1:10m v5.1.1',
      'workflow', 'import-natural-earth.yml',
      'download', 'https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_countries.zip',
      'documentation', 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/',
      'intake_policy', 'geostats-v13.1-strict',
      'review_required', true,
      'canonical_layer', true,
      'static_geography', true,
      'boundary_model', 'de facto'
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
