# GeoStats v16.1 installation

## Prerequisite

GeoStats v16.0 must already be installed. The v16.1 installer checks for the v16 review and ranking-completeness infrastructure and stops without modifying the database if it is missing.

## Installation order

1. Back up the current Supabase project or confirm point-in-time recovery is available.
2. Run `RUN_THIS_IN_SUPABASE_FOR_V16_1.sql` in the Supabase SQL Editor.
3. Confirm the returned `category_review_overview_v16` row appears without an error.
4. Replace the GitHub repository contents with the v16.1 repository and deploy it through Vercel.
5. Confirm the Vercel production build succeeds.
6. Run the GitHub Action **Import v16.1 audited catalog**.
7. Confirm all importer jobs and the final catalog/audit job are green.
8. Download the `geostats-v16-1-category-audit` workflow artifact for the complete category-by-category audit CSV and summary.
9. Run `VERIFY_V16_1.sql` in Supabase.
10. Generate a Daily trio from the Admin control center and test Scout, Adventurer, and Expert on desktop and mobile.

## Expected verification conditions

- The semantic-audit table and full-audit view are installed.
- `audited_categories` equals the current `stat_categories` count.
- `categories_missing_audit` is `0`.
- `playable_without_semantic_pass` is `0`.
- `playable_with_semantic_issues` is `0`.
- `playable_percent_out_of_bounds` is `0`.
- `wrong_clean_cooking_series_playable` is `0`.

The number of playable categories can fall after installation. That is expected when previously approved categories are blocked by semantic, source-validation, ranking-completeness, or result-logic findings.

## Rerunning

The installer is designed to be rerunnable. Backups use `ON CONFLICT DO NOTHING`, so they retain the state captured before the first v16.1 installation. The import workflow uses upserts and can also be rerun.

## Rollback scope

`ROLLBACK_V16_1.sql` restores category copy and editorial fields captured before the first v16.1 run while preserving historical Daily boards and scores. It intentionally retains the audit infrastructure so findings remain inspectable. Pair a rollback with the corresponding previous application deployment.
