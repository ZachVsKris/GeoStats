# GeoStats v13.2 — Start here

This is a complete repository snapshot, not a patch. It includes the existing game, authentication, leaderboards, Admin, Supabase migrations, FAOSTAT, WHO, UNESCO UIS, ILOSTAT, Natural Earth, and the Scout → Adventurer → Expert Daily progression.

## Install

1. Upload everything in this repository folder to the root of the GeoStats GitHub repository, replacing matching files.
2. Confirm `.github/workflows/main.yml` exists and contains five jobs: FAOSTAT, WHO, UNESCO UIS, ILOSTAT, and Natural Earth.
3. Confirm the GitHub Actions repository secrets exist: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
4. Commit and wait for Vercel to deploy.
5. Run **GitHub → Actions → Import all source data → Run workflow**.
6. Refresh `/admin` after all five jobs finish.

`RUN_THIS_IN_SUPABASE_FIRST.sql` is safe to rerun. A returned count of `0` means no additional canonical records needed to be inserted.

## Daily routes

- `/daily` — Scout, 5 countries and 4 categories; default
- `/daily/adventurer` — Adventurer, 8 countries and 6 categories
- `/daily/expert` — Expert, 10 countries and 8 categories
- `/daily/easy` redirects to `/daily`
- `/daily/normal` redirects to `/daily/adventurer`
