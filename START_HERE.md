# GeoStats v15.8.0: Expansion Intake + Review

This is a complete repository release built on v15.7. It corrects the FAOSTAT policy, simplifies navigation, adds all prepared expansion importers, and creates an automated vetting layer before manual approval.

## What changes immediately

- **Seeded** is renamed **Random**. Seeded URLs and reproducibility remain.
- The redundant **Daily** navigation button is removed. Scout, Adventurer, and Expert are the Daily modes.
- World Bank `EN.URB.LCTY` becomes **Highest share living in largest city**.
- FAOSTAT yield/productivity categories are blocked at database, importer, and runtime levels.
- Clear national totals remain eligible, including production and livestock populations such as **Largest horse population**.
- Current/future unscored boards are regenerated so retired yield categories disappear. Scored historical boards are preserved.

## Expansion sources included

Existing prepared importers remain for Pew religion, Smithsonian volcanoes, USGS earthquakes, ESA WorldCover, HydroSHEDS, and elevation summaries. v15.8 adds importers for:

- UNESCO World Heritage
- FAO AQUASTAT
- USGS familiar mineral mine production
- FAO capture fisheries and aquaculture production

All imported expansion candidates start **Pending** and non-playable. Automated vetting makes recommendations only; it never activates a category.

## Installation order

1. Create a GitHub backup branch.
2. Upload this complete repository to `main`, replacing the previous tracked files.
3. Wait for **Verify GeoStats v15.8** and Vercel to pass.
4. In Supabase, run `RUN_THIS_IN_SUPABASE_FOR_V15_8.sql`.
5. Run `VERIFY_V15_8.sql`.
6. Test Scout, Adventurer, Expert, and Random with a new seed.
7. Run the GitHub Action **Import v15.8 expansion candidates**. It always imports Pew, Smithsonian volcanoes, USGS earthquakes, Natural Earth, and UNESCO World Heritage. The AQUASTAT, minerals, fisheries, WorldCover, HydroSHEDS, and elevation inputs are optional; provide them whenever those official/derived CSV URLs are ready.
8. Run **Vet expanded category catalog** if it was not run by the combined import workflow.
9. Use the Category Review Workbench or `MANUAL_CATEGORY_REVIEW_V15_8.sql` to approve, rewrite, duplicate, quarantine, or retire candidates.

## Important intake behavior

Import success does not equal approval. New categories remain out of all games until they pass source-integrity checks and a manual editorial decision. Approved categories are eligible for all modes; there is no Random-only tier.

See `EXPANSION_INPUTS_V15_8.md` and the templates in `data-templates/v15-8/`.

## Optional input formats

- AQUASTAT: official bulk CSV containing country, variable, year, and value columns.
- USGS minerals: official world-production CSV with country, commodity, year, production, and unit.
- Fisheries: normalized country CSV derived from official FishStat exports with `country_iso3,country_name,year,capture_tonnes,aquaculture_tonnes`.
- Physical summaries: the existing documented country-summary CSV formats for WorldCover, HydroSHEDS, and elevation.

## Rollback

Revert the Git commit and run `ROLLBACK_V15_8.sql`. Imported candidates remain in the warehouse as pending records rather than being destructively deleted.
