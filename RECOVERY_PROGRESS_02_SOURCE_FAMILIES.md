# GeoStats v16.2.6 Recovery Progress 02 — Mature Source-Family Expansion

**Date:** 2026-08-26  
**Branch:** `v16.2.6-expansion-recovery`  
**Purpose:** preserve the second verified recovery checkpoint after `RECOVERY_PROGRESS_01_FOUNDATION.md`.

## What this checkpoint proves

This checkpoint reconstructs expansion catalog/configuration work for mature importer families that already existed in the surviving v16.2.6 repository. It deliberately distinguishes **importer-catalog representation** from **activation/playability certification**.

The machine-readable audit is `scripts/audit-v16-2-6-source-family-recovery.py`.

Latest audit result:

- 11 mapped source families
- 192 authoritative post-FINAL tracker rows mapped to those families
- 184 represented in actual importer catalogs
- 8 still missing
- all 8 missing rows are World Bank Climate Change Knowledge Portal extreme-climate concepts

Representation by family:

| Source family | Represented |
|---|---:|
| WHO Global Health Observatory | 61 / 61 |
| UNESCO Institute for Statistics | 32 / 32 |
| ILOSTAT | 23 / 23 |
| U.S. EIA International Energy Statistics | 13 / 13 |
| IMF World Economic Outlook | 11 / 11 |
| FAO AQUASTAT Main Database | 11 / 11 |
| WHO Global Health Expenditure Database | 10 / 10 |
| UN World Population Prospects 2024 | 9 / 9 |
| UNHCR Refugee Data Finder | 8 / 8 |
| FAOSTAT Food Balances | 2 / 2 |
| World Bank Climate Change Knowledge Portal | 4 / 12 |

## Code added/recovered in this checkpoint

- Expanded AQUASTAT catalog matching with explicit aliases and unit checks
- Expanded IMF WEO subject/unit matching, including nominal-vs-PPP distinctions and 2024 historical reference handling
- Expanded UN WPP concepts
- Expanded WHO GHED catalog and semantic unit/basis validation
- Added nine additional WHO GHO vaccination concepts
- Added a source-family recovery audit that compares authoritative tracker concepts against importer catalogs

## Verification run immediately before checkpoint

The following focused fixture tests passed:

- `scripts/test-aquastat-importer.py`
- `scripts/test-imf-weo-importer.py`
- `scripts/test-un-wpp-importer.py`
- `scripts/test-who-ghed-importer.py`
- `scripts/test-who-importer.py`

The recovery audit also completed successfully and reported the 184/192 representation result above.

## Critical caveat

**Do not mark these 184 rows playable merely because they are represented in importer catalogs.** Final activation still requires the source-validation, coverage/ranking, comparability, provenance/licensing, editorial quality, anti-duplication, SQL/catalog and release gates required by the frozen master specification.

## What remains next

1. Resolve or explicitly disposition the 8 missing World Bank CCKP concepts without inventing unsupported indicator mappings.
2. Reconstruct the remaining 200 post-FINAL source-family rows across the other 15 families, including Global Findex, FAO FRA, UNICEF, UNDP HDR, V-Dem, FAOSTAT Food Security, Köppen-Geiger, WUP Cities, WBL, JMP, WDI Infrastructure, WUP country urbanization, Natural Earth, FAOSTAT Land Use, and WorldCover.
3. Merge/reconcile the authoritative 925-row tracker into the live tracker without trusting stale `implemented` labels as proof of code.
4. Perform genuine category-by-category Understand / Interest / Uniqueness review and anti-proliferation pruning.
5. Complete provenance/licensing and all-importer year/denominator/unit validation.
6. Finish full propensity metrics, UI-fit/mobile, backward compatibility, dependency-backed TypeScript/Next/Playwright, SQL verification and final packaging.

## Release status

This is a **recovery checkpoint**, not `FINAL` and not a deployment recommendation.
