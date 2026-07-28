# GeoStats v15.1.0 — Start here

1. Replace the GitHub repository contents with this release and commit.
2. In Supabase SQL Editor, run `RUN_THIS_IN_SUPABASE_FOR_V15_1.sql` once.
3. Redeploy the resulting commit in Vercel.
4. Confirm `/admin/review` loads.
5. Confirm the SQL result shows a recovered playable pool.
6. Generate or reload the current Daily trio.

Do not run the source-integrity workflow with enforcement enabled until its report has been reviewed. The workflow now defaults enforcement to `false`.
