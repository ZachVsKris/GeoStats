# GeoStats v15.9.2 deployment

This is the complete revised v15.9 release. It retains the automatic category expansion, Natural Earth correction, FAOSTAT semantic safeguards, Workbench reconciliation, Random redesign, and mobile Daily redesign from v15.9.1, then closes the remaining release-audit gaps.

It does not require manually prepared CSV files or URL inputs.

## Before deployment

1. Create a backup branch from the current production commit.
2. Export or otherwise back up Supabase.
3. Confirm GitHub still has `SUPABASE_URL` and either `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
4. Keep existing Vercel variables, including `CRON_SECRET`.
5. Do not run an older v15.8/v15.9 import or audit while replacing the repository.

## Install

1. Replace the tracked repository contents with this complete release, including `.github/workflows` and `.gitignore`.
2. Commit and push to `main`.
3. Wait for **Verify GeoStats v15.9.2** and the Vercel deployment to succeed. The workflow now runs real Chromium viewport tests and a network-backed regression against the pinned Natural Earth layer.
4. Run `RUN_THIS_IN_SUPABASE_FOR_V15_9_2.sql` in the Supabase SQL editor. It contains the v15.9 base migration, v15.9.1 safeguards, and the additive v15.9.2 score-version migration. It is safe to rerun.
5. Run `VERIFY_V15_9_2.sql`. Zero-row checks must be empty, overview reconciliation booleans must be true, and all score-version fields must be populated.
6. Test Scout, Adventurer, Expert, and Random on desktop and phone before importing candidates.
7. In GitHub Actions, run **Import v15.9.2 automatic expansion**. It has no inputs.
8. Run `VERIFY_V15_9_2.sql` again. The target inventory is 15 Pew, 27 Food Balance, 6 tourism/migration, and 1 World Heritage candidate.
9. Review recommendations in the Category Review Workbench or with `MANUAL_CATEGORY_REVIEW_V15_9_2.sql`. New candidates remain Pending until you approve them.

## Important behavior

- The 49 automatic candidates are imported from official sources without user-hosted files.
- New candidates are Pending and non-playable by default.
- UNESCO UIS is removed from new gameplay; only total World Heritage sites is retained.
- FAOSTAT total production and clear livestock populations remain eligible. Yield, harvested area, slaughter/carcass, and productivity measures are blocked by source element as well as wording.
- Misleading Natural Earth span/position concepts, including Largest east-west span, are retired from new play.
- Static geography uses pinned source references everywhere results are shown rather than displaying an importer year as an observation year.
- Long Findex subgroup cards are retired or held for rewrite; the clear all-adults account-ownership category remains.
- Only unscored current/future boards containing a newly invalid category are archived and regenerated. Scored boards, scores, and immutable historical snapshots remain intact.
- Every individually valid Daily mode is preserved during automatic repair. Only missing or invalid modes are retried, using deterministic alternate attempts when needed.
- Legacy `/seeded` and `/test` player links redirect to the corresponding Random route while retaining the seed query.
- Each score stores its scoring, board-normalization, leaderboard-rating, board-rules, category-set, and dataset versions.
- Mobile Scout, Adventurer, and Expert use a compact header, wrapping country bank, one-column measure cards, and an in-flow Lock in Draft action.

## Authentication deployment check

The repository contains GeoStats-branded authentication and username flows, but Supabase configuration remains external. Confirm the production Site URL, callback URL, custom SMTP configuration, and sender domain before final launch.

## Rollback

Revert GitHub/Vercel to the backup branch, then run `ROLLBACK_V15_9_2.sql`. The additive score-version columns are intentionally preserved because older application versions safely ignore them and the metadata remains useful.
