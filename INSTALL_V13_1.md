# GeoStats v13.1 installation

This ZIP is an overlay for an existing GeoStats v13.0/v13.0.1 repository.

1. In Supabase SQL Editor, run `RUN_THIS_IN_SUPABASE_FIRST.sql` once.
2. Upload everything inside this folder to the root of the GitHub repository, replacing matching files.
3. Include the hidden `.github` folder. On macOS Finder, press `Command + Shift + .` to reveal hidden files.
4. Commit the changes and wait for Vercel to deploy.
5. In GitHub Actions, run one or more of:
   - Import UNESCO candidates
   - Import ILOSTAT candidates
   - Import Natural Earth geography
   - Import all source data
6. Refresh `/admin`. New categories will appear as candidates or needs-review and remain disabled until approved.
7. Optionally run `VERIFY_AFTER_IMPORT.sql` in Supabase to see category, observation, and import-run totals for all three new sources.

`Import all source data` runs World Bank's existing heavy-source set (FAOSTAT and WHO) plus UNESCO UIS, ILOSTAT, and Natural Earth in separate jobs. No existing World Bank, FAOSTAT, or WHO observations are deleted by the v13.1 migration itself.
