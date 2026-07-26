# GeoStats v14.0.1 — start here

This is a complete repository replacement.

1. Replace the GitHub repository contents with this build.
2. Confirm the v13.5 and v14.0 database migrations were already applied.
3. In Supabase SQL Editor, run `RUN_THIS_IN_SUPABASE_FOR_V14_0_1.sql` once.
4. Deploy through Vercel.
5. Run **GitHub Actions → Repair and expand v14 imports**.
6. Run `VERIFY_V14_0_1.sql` in Supabase.
7. Review the new `curation_status='pending'` candidates at `/admin`.

See `START_HERE_V14.md` for the full checklist and expected counts.
