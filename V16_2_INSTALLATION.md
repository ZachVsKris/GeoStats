# GeoStats v16.2 installation

## Purpose

v16.2 repairs the Daily-trio search, recovers trustworthy categories that were held back by stale or source-inappropriate gates, and makes Daily and Random use one identical approved catalog. It does not create a lower-quality “Random only” tier.

## Prerequisite

GeoStats v16.1 must already be installed. The installer stops before making changes when the v16.1 runtime and semantic-audit objects are missing.

## Installation order

1. Back up Supabase or confirm point-in-time recovery is available.
2. Run `RUN_THIS_IN_SUPABASE_FOR_V16_2.sql` in the Supabase SQL Editor.
3. Confirm `category_review_overview_v16_2`, `category_promotion_dry_run_v16_2`, and `category_catalog_consistency_v16_2` return without errors. The installer calculates proposed decisions but does not auto-promote categories.
4. Replace the GitHub repository contents with the v16.2 repository and deploy it through Vercel.
5. Confirm the Vercel production build succeeds.
6. In GitHub Actions, run **Recover v16.2 audited catalog** as a new workflow run.
7. Wait for all source-recovery jobs and official-source audits to finish. Only then does the finalization job apply conservative automatic promotions and publish the shared catalog. The World Bank recovery is intentionally broad and may take substantially longer than the v16.1 workflow.
8. Download the `geostats-v16-2-category-audit` artifact. It contains both the decisions proposed before promotion and the final catalog after promotion:
   - `category-audit-pre-promotion-v16-2.csv`
   - `category-promotion-dry-run-v16-2.csv`
   - `category-audit-pre-promotion-v16-2-summary.json`
   - `category-audit-v16-2.csv`
   - `category-promotion-final-v16-2.csv`
   - `category-audit-v16-2-summary.json`
9. Run `VERIFY_V16_2.sql` in Supabase.
10. In `/admin`, generate the Daily trio once. The interactive request is bounded; scheduled generation has a longer search budget.
11. Test Scout, Adventurer, and Expert on desktop and mobile, then confirm Daily and Random both draw only from the same playable catalog.

## Expected verification conditions

These values should be zero:

- `daily_random_mismatches`
- `enabled_without_v16_2_pass`
- `daily_without_v16_2_pass`
- `categories_missing_assessment`
- `playable_without_semantic_pass`
- `playable_with_substantive_integrity_failure`
- `playable_without_v16_2_pass`
- `playable_percent_out_of_bounds`
- `wrong_clean_cooking_series_playable`

The query listing playable categories with zero stored observations should return no rows.

The final playable count is intentionally not predetermined. v16.2 automatically promotes only categories that pass the source-specific, semantic, ranking, clarity, coverage, and board-feasibility gates. Ambiguous categories remain in manual review; substantive mismatches remain blocked for repair.

## Daily generator behavior

- The admin button performs one bounded attempt rather than several five-minute attempts.
- Pool combination uses compatibility indexing.
- A reserved portion of the request is dedicated to joint, constraint-aware construction.
- Scout, Adventurer, and Expert are built with cross-mode category, family, country-overlap, and forced-displacement constraints already in scope.
- Scheduled generation receives a longer budget and a fresh attempt nonce.
- Core rules such as no ties and global top-30 winners remain hard requirements.

## Rerunning

The installer is rerunnable. Backup tables retain the state captured before the first v16.2 installation using `ON CONFLICT DO NOTHING`. The source-recovery workflow uses upserts or transactional category-level replacement and can be rerun after a transient source outage.

Always start a new workflow run after changing workflow or importer code. “Re-run failed jobs” uses the commit from the original run.

## Rollback

`ROLLBACK_V16_2.sql` restores the category copy, review decisions, curation states, and gameplay flags captured before v16.2; returns runtime playability to the v16.1 policy; and removes v16.2-only runtime objects. Refreshed official-source observations and metadata remain in place. It preserves:

- historical Daily boards and scores;
- source-import history;
- refreshed observations;
- v16.1 semantic-audit infrastructure;
- the v16.2 backup tables for inspection.

Pair a database rollback with deployment of the prior v16.1 application repository.
