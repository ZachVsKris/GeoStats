# GeoStats v15.5.1 hotfix

This replaces the v15.5 files that caused the importer-test failure and tightens the category-quality rules shown in the July 29 boards.

## Upload order

1. Extract `GeoStats-v15.5.1-update.zip`.
2. Upload the extracted contents to the root of the existing GitHub repository, preserving the folders and replacing files with the same names.
3. GitHub's web uploader may skip the hidden `.github` folder. Upload `verify-v15.yml` separately to:

   `.github/workflows/verify-v15.yml`

4. Commit the changes.
5. In GitHub Actions, manually run **Verify GeoStats v15**.
6. Confirm the newest Vercel deployment is **Ready**.
7. Only then run `RUN_THIS_IN_SUPABASE_FOR_V15_5_1.sql` in the Supabase SQL Editor.
8. Reload the Daily pages. Unscored boards created under rules 12.0 are removed and regenerated under rules 12.1.

## What changed

- GitHub Actions now installs Shapely and the other Python importer dependencies before running importer tests.
- The runtime and SQL both retire the following concepts even when they exist under duplicate category IDs:
  - total reserves excluding gold
  - population in urban agglomerations over one million
  - stocks traded, total value
  - largest continuous land area
  - selected technical labor/productivity ratios
- Scout, Adventurer and Expert cannot repeat the same source indicator or normalized title.
- Near-identical demographic concepts are rejected across modes.
- The entire Daily trio is capped at two demographic categories.
- Clear but stiff titles are simplified.

## Validation completed here

Passed:

- Core invariant tests
- v15 integration and gameplay tests
- Synthetic 4 + 6 + 8 Daily-trio feasibility test
- TypeScript/TSX syntax transpilation
- All importer unit tests, including Natural Earth and USGS with Shapely
- Player-source policy fixtures
- Source-integrity fixtures

A literal `next build` could not be run in this environment because its internal npm registry did not contain `@supabase/ssr@0.12.3`. GitHub Actions will perform the real production build after installing from GitHub's npm environment.
