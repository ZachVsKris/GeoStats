# GeoStats v16.2.5 installation

v16.2.5 upgrades a verified v16.2.4 database/application. It keeps the v16.2.4 game sizes and scoring, while tightening mobile/desktop presentation, fixing touch interactions, removing measurement-color remnants, and expanding the catalog through fail-closed promotion/repair tracks.

## Before installation

1. Confirm the final v16.2.4 production smoke test is clean.
2. Take a Supabase snapshot.
3. Preserve the final v16.2.4 repository/commit as the rollback baseline.
4. Confirm the committed root `package-lock.json` is present; v16.2.5 workflows require `npm ci`.

## Install

1. Run `RUN_THIS_IN_SUPABASE_FOR_V16_2_5.sql` in the Supabase SQL Editor.
2. Push the v16.2.5 repository to GitHub.
3. Require **Verify GeoStats v16.2.5** to pass before catalog publication.
4. Run **Recover v16.2.5 audited catalog**. This refreshes/re-audits the selected World Bank, FAOSTAT, WHO, Comtrade, UNHCR, Natural Earth, Pew, Smithsonian, USGS, ILOSTAT, U.S. EIA, UNESCO UIS, tourism/migration, World Heritage, and historical-source rows. Publication occurs only if every required recovery/audit job succeeds.
5. If only the historical-source refresh must be rerun, **Import v16.2.5 historical categories and finalize** is the narrower guarded workflow.
6. Download/review the source-integrity and category-audit artifacts. The 33 promotion targets have only their editorial blocker cleared; the 30 repair targets remain blocked until fresh source/semantic/ranking gates pass.
7. Run `VERIFY_V16_2_5.sql` in Supabase. Require every check to report `PASS`, and require the release-blocker query immediately above the check table to return zero rows.
8. Redeploy/promote the verified v16.2.5 GitHub commit in Vercel after final catalog publication.
9. Run the production smoke test below.

## Catalog policy in this release

- Daily and Random still use one shared playable catalog.
- `historical_date` categories bypass only the normal top-winner prominence heuristic. They still require trustworthy source identity, sufficient coverage, safe ranking completeness, distinct values, and all other hard integrity gates.
- The 33 promotion/reconsideration targets are not forced playable. They become playable only if the shared computed gate passes.
- The 30 repair/re-source targets are concepts approved for continued work, not guaranteed additions. Failed repairs remain non-playable.
- The ambiguous combined **Largest protected share of land and sea** category is fail-closed; the clearer land and territorial-waters concepts remain separate.

## Production smoke test

- Daily Scout: 4 countries / 4 categories; max 400.
- Daily Adventurer: 6 countries / 4 categories; max 400.
- Daily Expert: 8 countries / 6 categories; max 600.
- Random Scout/Adventurer/Expert reproduce exactly from the same seed.
- Switching difficulty from Random Results remains in Random and preserves the seed.
- Results difficulty tabs appear before Final Score.
- Results uses **Best Possible**, not the misleading **Perfect Round** label for the reference allocation.
- Measurement badges are neutral text labels; no old category/result measurement-color lines remain anywhere.
- Category cards have no redundant top-right information icon.
- At 375×667, 390×844, 393×852, and 414×896, active gameplay requires no page scrolling, no horizontal overflow, and every country/category plus Lock in draft is visible at once.
- On a touch device, **Lock in draft** submits on one intentional tap.
- The Rules modal scrolls normally on a phone.
- Selected Scout / Adventurer / Expert tabs stay high-contrast and readable.
- Long country names remain readable on desktop and phone.
- Account magic-link sign-in, username onboarding, pending-score save, Daily score submission, Today leaderboard, and All-time leaderboard all remain functional.
- Legacy v16.2.3 scores remain normalized against their historical maxima; v16.2.4 and v16.2.5 use the same scoring era.

## Rollback

Preferred rollback is the pre-install Supabase snapshot plus the preserved v16.2.4 repository. `ROLLBACK_V16_2_5.sql` provides a conservative database rollback for the v16.2.5-only catalog-policy layer; it does not delete imported provenance/source data.
## Recovery credential and timeout notes

`COMTRADE_API_KEY` remains required by the audited catalog recovery preflight. `EIA_API_KEY` is optional: when present, the EIA repair/audit runs; when absent, EIA repair candidates remain blocked and the release continues through the independent audit/finalization gates.

The cumulative installer also installs the Random observation lookup index and function-level statement-timeout headroom used by source validation/reconciliation. Run the latest `RUN_THIS_IN_SUPABASE_FOR_V16_2_5.sql` before rerunning catalog recovery.

