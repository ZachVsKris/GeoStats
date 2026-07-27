# GeoStats v14.2 Source Integrity Audit Patch

This patch contains the missing GitHub Actions workflow and every Python/SQL file it directly needs.

## Add the files

Upload the contents of this patch into the matching folders in the root of your GeoStats repository. Preserve the folders exactly, especially the hidden `.github` folder.

The workflow file must end up at:

`.github/workflows/audit-source-integrity.yml`

## Database setup

If you have already run `RUN_THIS_IN_SUPABASE_FOR_V14_2.sql`, do not run it again.

If you have not run it, run `RUN_THIS_IN_SUPABASE_FOR_V14_2.sql` in the Supabase SQL Editor before starting the audit.

## Run the audit

After GitHub finishes processing the upload:

1. Open **Actions**.
2. Select **Audit all source integrity**.
3. Click **Run workflow**.
4. Choose `all`.
5. Leave **Also audit disabled candidate categories** off for the first run.
6. Leave **Turn on fail-closed enforcement** on.

The workflow requires these repository secrets:

- `SUPABASE_URL`
- either `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `COMTRADE_API_KEY` for Comtrade
- `EIA_API_KEY` for EIA

## Verify

After the workflow completes, run `VERIFY_V14_2.sql` in Supabase.

Do not enable or rely on fail-closed enforcement unless the audit finishes without categories marked unable to verify.
