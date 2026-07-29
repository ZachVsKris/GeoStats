# GeoStats v15.5 installation

GeoStats v15.5 simplifies the active catalog before expanding it with religion, geology, natural hazards, land cover, waterways, and terrain.

## Install order

1. Upload the v15.5 repository files to GitHub and overwrite matching files.
2. Include the new hidden workflow files under `.github/workflows/`.
3. Commit and push to `main`.
4. Wait for **Verify GeoStats v15** and the Vercel production deployment to succeed.
5. Run `RUN_THIS_IN_SUPABASE_FOR_V15_5.sql` in a new Supabase SQL Editor query.
6. Run `VERIFY_V15_5.sql`.
7. Test `/api/daily-trio/<today>?rules=12.0`, then Scout, Adventurer, Expert, and Random.
8. Run new-source import workflows only after the base migration and deployment pass.

Do not run the source-integrity workflow with enforcement enabled while new sources remain under review.

## Important agriculture policy

FAOSTAT contributes only absolute national production totals. The importer and migration retire yield per hectare, yield per animal, harvested area, livestock stocks, slaughter counts, producing-animal counts, and agricultural production per person.

Allowed product concepts are:

- total amount produced;
- total amount imported;
- total amount exported;
- clear composition or specialization percentages whose numerator and denominator genuinely match.

Examples of accepted percentages include sector value added as a share of GDP, one product's export value as a share of total merchandise exports, one product's production value as a share of total agricultural production value, electricity-source share of generation, and land-cover share of land area.

Gross product value divided by GDP is not labeled a GDP share. A product-specific GDP-share category requires genuine product-specific value-added data.

## New-source workflows

- Pew religion downloads the official 2010/2020 estimates directly.
- Smithsonian volcanoes and USGS earthquakes query official public sources.
- WorldCover, HydroSHEDS, and elevation use reviewed, precomputed country-summary CSV inputs because global raster/vector aggregation is too large for a normal GitHub Actions job.
- Every new category enters quarantine until integrity and editorial review pass.
