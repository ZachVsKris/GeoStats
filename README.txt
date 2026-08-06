GeoStats v16.2.1 FAOSTAT timeout hotfix

Problem fixed:
The FAOSTAT recovery attempted to delete the entire FAOSTAT observation snapshot
in one Supabase statement. With more than 100,000 rows, that statement exceeded
the database statement timeout.

Changes:
- scripts/import-faostat.py now replaces observations atomically one category at a time.
- scripts/test-v16-2-1-static.cjs now guards against reintroducing the source-wide delete.

Install:
1. In GitHub, replace the two files at the exact paths shown above.
2. Commit to main.
3. Wait for Verify GeoStats v16.2.1 to pass.
4. Rerun Recover v16.2.1 audited catalog from the beginning.

No Supabase SQL is required. Do not rerun RUN_THIS_IN_SUPABASE_FOR_V16_2_1.sql.
