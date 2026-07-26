# GeoStats v13.5.0 — start here

This is a complete repository replacement.

1. Replace the GitHub repository contents with this build.
2. In Supabase SQL Editor, run `RUN_THIS_IN_SUPABASE_FOR_V13_5.sql` once.
3. Run `VERIFY_V13_5.sql`; every query marked “must return zero rows” should be empty.
4. Follow `AUTH_BRANDING_SETUP_V13_5.md` to configure the GeoStats sender, custom SMTP, and branded token-hash email links.
5. Deploy through Vercel.
6. Test all Daily and Random routes listed in `START_HERE_V13_5.md`.

No manual category approval is required. The trust policy applies immediately to the existing catalog and after future importer governance runs.
