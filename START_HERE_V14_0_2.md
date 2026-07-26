# GeoStats v14.0.2 — deploy this build

## 1. Upload the complete repository

Replace the repository contents with everything in this folder.

**Mac users:** press **Command + Shift + .** before uploading so the hidden `.github` folder is visible and included. See `INSTALL_GITHUB_WORKFLOWS.md`.

## 2. Database

If v14 SQL has not already been applied, run in this order:

1. `RUN_THIS_IN_SUPABASE_FOR_V14.sql`
2. `RUN_THIS_IN_SUPABASE_FOR_V14_0_1.sql`

Do not rerun older full migrations unless your database is actually missing them.

## 3. Deploy

Deploy the committed default branch through Vercel.

## 4. Run the expansion

Open **GitHub → Actions → Repair and expand v14 imports → Run workflow**.

Use the defaults:

- World Bank target: `500`
- World Bank scan limit: `2000`

Required secrets:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `COMTRADE_API_KEY` for the complete 55-category Comtrade batch

## 5. Verify

After the workflow completes, run `VERIFY_V14_0_1.sql` in Supabase and check `/admin` for pending candidate categories.

The workflow fails rather than silently succeeding when Natural Earth returns fewer than 24 candidates, the World Bank run does not reach its minimum, or a configured Comtrade run returns fewer than 55 candidates.
