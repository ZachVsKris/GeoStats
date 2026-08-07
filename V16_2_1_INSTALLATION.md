# GeoStats v16.2.1 installation

## Before installing

1. Create a Supabase backup.
2. In GitHub, open **Settings → Secrets and variables → Actions**.
3. Confirm these repository secrets exist:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
   - `COMTRADE_API_KEY`

The recovery workflow intentionally fails before importing anything when the Comtrade key is missing.

## Install

1. Run `RUN_THIS_IN_SUPABASE_FOR_V16_2_1.sql` in the Supabase SQL editor.
2. Replace the GitHub repository with the v16.2.1 repository and commit to `main`.
3. Wait for **Verify GeoStats v16.2.1** and Vercel to finish successfully.
4. In GitHub Actions, manually run **Recover v16.2.1 audited catalog**.
5. Do not generate a Daily trio while recovery is running.
6. Confirm every job is green. Download the category-audit artifact and all source-audit artifacts.
7. Run `VERIFY_V16_2_1.sql` in Supabase. Every row in the final result must say `PASS`.
8. Open GeoStats Admin and generate the Daily trio once.
9. Test Scout, Adventurer, Expert, and several Random boards.

## Important behavior

The SQL installer does not publish the repaired catalog. Publication occurs only in the guarded workflow finalizer after every required source audit succeeds. A failed recovery leaves the current gameplay catalog unchanged.
