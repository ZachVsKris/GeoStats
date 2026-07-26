# GeoStats v14.0.0 — start here

This is a complete repository replacement.

1. Replace the GitHub repository contents with this build.
2. Confirm the v13.5 database migration has already been applied.
3. In Supabase SQL Editor, run `RUN_THIS_IN_SUPABASE_FOR_V14.sql` once.
4. Run `VERIFY_V14.sql`; every query marked as a zero-row check should be empty.
5. Deploy through Vercel.
6. Run **GitHub Actions → Import all source data**.
7. Review new candidates in `/admin`; unseen categories remain disabled until manually approved.
8. Test the Daily, Random, Data, Admin, and **Source & all data** experiences listed in `START_HERE_V14.md`.

See `START_HERE_V14.md` for source secrets, importer coverage, and the complete deployment checklist.
