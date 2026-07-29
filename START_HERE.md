# GeoStats v15.7.0 clean repository replacement

This ZIP is a **complete repository replacement**, not a patch. Keep the existing GitHub repository itself so its Vercel connection, Actions secrets, environment variables, and history remain intact.

## What this release fixes

- One authoritative approved catalog for Daily and Seeded play
- Removal of every Random-only code path
- Full approved-catalog loading instead of the old 180-category sample that could exclude all FAOSTAT categories
- Source-aware observation loading without exact-count rejection for minor reporting gaps
- Bounded category backtracking and joint Scout/Adventurer/Expert combination
- Physical-geography quantity treated as a preference rather than a fatal board requirement
- Per-mode score locks and repair behavior
- Immutable stored-board snapshots that survive later catalog changes
- Admin-protected official board writes and public date restrictions
- One generation lock per date
- Server-generated deterministic Seeded boards
- Scheduled Daily pre-generation through Vercel Cron
- Correct Workbench Playable and Approved-but-blocked counts
- Dedicated short board descriptions and a full manual-copy review view
- Compact mobile loading, error, and gameplay layouts
- Quarantine of four physical datasets that currently contain zero observations

## Before replacing `main`

1. In GitHub, create a branch named something like `backup-pre-v15-7` from the current `main`.
2. Back up the Supabase database or at minimum export the affected catalog and Daily tables.
3. In Vercel, add a Production environment variable named `CRON_SECRET` with a random value of at least 16 characters. The game still works without the cron, but scheduled pre-generation will return 401 until this is configured.
4. Do not delete the GitHub repository, Vercel project, or Supabase project.

## Safest deployment sequence

### 1. Verify the clean code before production

Upload this repository to a temporary Git branch if possible. Confirm **Verify GeoStats v15.7** passes. A preview deployment can also be used, but its Daily API will require the v15.7 database schema before runtime testing.

### 2. Run the additive Supabase migration

In a new Supabase SQL Editor query, run the complete contents of:

`RUN_THIS_IN_SUPABASE_FOR_V15_7.sql`

The migration is backward-compatible with the prior app: it adds the snapshot column and lock table, creates backups, updates catalog metadata and copy, quarantines known zero-row datasets, and removes only unscored current/future boards from older versions.

Do not run the rollback file unless the installation must be undone.

### 3. Replace the contents of the existing GitHub repository

On the deployment branch or `main`:

1. Delete the existing tracked project files.
2. Upload **all** files and folders from this repository, including hidden folders such as `.github` and files such as `.gitignore`.
3. Do not delete or recreate the repository itself.
4. Commit and push.

### 4. Confirm production deployment

Wait for:

- **Verify GeoStats v15.7** to pass in GitHub Actions
- Vercel production deployment to show **Ready**

The verification workflow performs the complete TypeScript check, importer fixtures, source-policy tests, generator regression, and production build.

### 5. Verify Supabase

Run:

`VERIFY_V15_7.sql`

Important expectations:

- all required infrastructure exists
- Random editorial outcomes = 0
- Random metadata tiers = 0
- enabled-but-not-Daily-eligible = 0
- runtime flags match `computed_playable_v15`
- curated titles are editorially approved
- the mapped Natural Earth land-area duplicate is blocked
- no playable title contains `etc.` or `n.e.c.`
- zero-observation physical categories are blocked

### 6. Test the application

Hard-refresh the production site, then test:

1. Scout Daily
2. Adventurer Daily
3. Expert Daily
4. One Seeded board twice with the same seed in separate/private windows
5. Mobile layout at a narrow phone width
6. Admin Category Review Workbench counts
7. One category source/details panel

Suggested Seeded test:

`ATLAS-TEST-261`

The same seed and difficulty should return the same board for the same dataset/category-set version.

## Scheduled Daily generation

`vercel.json` schedules `/api/cron/daily` at 05:05 UTC each day, safely after midnight in New York year-round. The endpoint uses `CRON_SECRET` and delegates to the same locked and validated Daily generator used by the public game.

On plans with approximate cron timing, the job may run later within the scheduled hour. If it has not run yet, the first player request can still generate and cache the board.

## Manual review after stabilization

The release creates `public.category_manual_review_v15_7` and includes:

`MANUAL_CATEGORY_REVIEW_V15_7.sql`

That export is the basis for the later category-by-category title, description, and removal review. New category imports should enter quarantine before joining this review.

## Rollback

If the release must be undone:

1. Restore or revert to the `backup-pre-v15-7` Git branch.
2. Run `ROLLBACK_V15_7.sql` in Supabase.
3. Redeploy the restored Git commit.

The rollback restores backed-up category, review, and editorial states and restores only the unscored Daily boards removed by v15.7. Additive snapshot/lock/archive infrastructure is intentionally retained.
