# GeoStats v15.3.0 release notes

## Daily reliability and speed

- Bulk-loads common-year observations from Supabase instead of issuing requests category by category.
- Uses a static playable-country catalog during game load; World Bank API access remains available for import and audit workflows.
- Stores successful Daily trios in browser storage under the dataset version.
- Returns saved Daily trios with public cache headers.
- Removes browser-side Daily generation. Random Test remains client-generated and unranked.
- Adds bounded generation budgets, candidate limits and memoized semantic, quality and display-value calculations.

## Gameplay integrity without impossible constraints

- Requires each category’s board winner to rank in the global top 30.
- Prohibits ties between any two countries on the same board at the exact precision shown to players.
- Rejects tie-heavy datasets before board composition.
- Preserves distinct winners, complete observations, category diversity, continent caps, different categories across modes and at most one shared country between modes.
- Retains strict, catalog-balanced and catalog-recovery source profiles.
- Adds a synthetic 4 + 6 + 8 Daily-trio feasibility stress test using the production composer.

## Source clarity

- Rebuilds the Data & Source modal with a responsive title, separate definition, reproducible source-specification chips and a less crowded ranking section.
- Shows exact FAOSTAT item, element, item code, element code, unit and year when available.
- Shows UN Comtrade HS/flow/partner metadata and Natural Earth layer/scale metadata.
- Uses compact player-facing currency values while preserving full precision in tooltips.

## Catalog policy

- Quarantines UNESCO `CR.MOD.1`, `CR.MOD.2` and `CR.MOD.3` completion-rate categories because the previous copy was misleading, the series is modeled and the linked browser does not provide an easy exact reproducible view.
- Promotes reproducible, hard-gate-ready Natural Earth physical-geography categories derived from fixed 1:10m layers.
- Conservatively promotes high-confidence pending categories based on existing review evidence; political, subjective, confusing, esoteric, stale, poor-coverage, duplicate, modeled and true integrity failures remain blocked.
- Does not fabricate elevation, desert or savannah categories. Those require separate global raster pipelines and methodology.

## FAOSTAT safeguards

- Keeps official QCL item and element codes separate.
- Stores exact item, element, unit and common year in `source_query` and metadata.
- The FAOSTAT importer validates stored country values and competition rankings against the official normalized QCL bulk snapshot.
- Production and yield remain distinct measures; source panels explicitly show which element is being ranked.
