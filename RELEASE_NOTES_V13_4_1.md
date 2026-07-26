# GeoStats v13.4.1 — FAOSTAT adaptive governance

## Fixed

- Replaced the incorrect 175-country FAOSTAT floor with a 60-country common-year floor
- Scores coverage against 100 countries, allowing specialized but still broadly comparable commodities to qualify
- Uses the common year, not a sparsely reported latest year, for freshness validation
- Finds the nearest comparable prior year for ranking-stability checks
- Counts both official records and transparent FAO estimates/imputations as documented evidence
- Continues to reject unknown or unclassified provenance and never treats missing reports as zero
- Recalculates all existing FAOSTAT categories immediately through an idempotent SQL migration
- Groups exact semantic duplicates and aligns direct FAOSTAT cereal production/yield with World Bank equivalents
- Preserves manual rejections

## Automatic gate

A FAOSTAT category is automatically eligible only when all of these pass:

- Quality score at least 75
- At least 60 countries in the common year
- Common year no more than four years old
- Common-year coverage at least 85% of the category's best recent coverage
- At least 75% documented observations, counting official and transparent estimated/imputed records
- Clustering/distribution score at least 65
- Stability score at least 50
- Preferred category within its semantic concept group

## Upgrade

Run `RUN_THIS_IN_SUPABASE_FOR_V13_4_1.sql`, verify with `VERIFY_V13_4_1.sql`, then run the standalone **Import FAOSTAT candidates** GitHub workflow once.
