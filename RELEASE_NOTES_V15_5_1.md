# GeoStats v15.5.1

This hotfix addresses the first v15.5 verification failure and tightens the category-quality rules visible in the July 29 Daily boards.

## Fixes

- Installs `shapely`, `pyproj`, `pyshp`, `pycountry`, and `openpyxl` before importer tests in GitHub Actions
- Retires all catalog copies of:
  - total reserves excluding gold
  - population in urban agglomerations over one million
  - stocks traded, total value
  - largest continuous land area
  - selected technical labor/productivity ratios
- Adds a runtime hard gate so those concepts cannot reappear even before the database cleanup is applied
- Simplifies clear-but-stiff titles such as safe drinking-water access and STEM graduate share
- Rejects duplicate source indicators, identical normalized titles, and near-identical population concepts across Scout, Adventurer, and Expert
- Caps the full Daily trio at two demographic categories
- Bumps Daily rules to 12.1 and regenerates unscored stale boards

## Required order

1. Upload the v15.5.1 update files
2. Run **Verify GeoStats v15** and confirm it is green
3. Confirm the Vercel deployment is Ready
4. Run `RUN_THIS_IN_SUPABASE_FOR_V15_5_1.sql`
5. Reload the Daily pages
