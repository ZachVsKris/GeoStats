# GeoStats v13.2 — Start here

This is a complete repository snapshot, not a patch. It includes the existing game plus FAOSTAT, WHO, UNESCO UIS, ILOSTAT, Natural Earth, the canonical warehouse, the corrected Admin interface, and the Scout → Adventurer → Expert Daily progression.

## Install

1. In Supabase SQL Editor, run `RUN_THIS_IN_SUPABASE_FIRST.sql`. It is safe to rerun.
2. Upload the contents of this repository folder to the root of the GeoStats GitHub repository, replacing matching files.
3. Confirm `.github/workflows/main.yml` exists and contains five jobs: FAOSTAT, WHO, UNESCO UIS, ILOSTAT, and Natural Earth.
4. If Finder hides `.github`, use the visible backup files in `VISIBLE_WORKFLOW_FILES` and upload them directly into GitHub's `.github/workflows` directory.
5. Commit and wait for Vercel to deploy.
6. Run **GitHub → Actions → Import all source data → Run workflow**.
7. Refresh `/admin` after all five jobs finish.

## Daily routes

- `/daily` — Scout, 5 countries and 4 categories; default
- `/daily/adventurer` — Adventurer, 8 countries and 6 categories
- `/daily/expert` — Expert, 10 countries and 8 categories
- Old `/daily/easy` and `/daily/normal` links redirect to the new routes.
