# GeoStats v14.1 — deploy this build

This is the smart-generation, simplified-data, resilient-import, and analytics build.

## 1. Replace the repository contents

Upload the complete contents of this folder to the GeoStats GitHub repository.

**Mac users:** press **Command + Shift + .** so the hidden `.github` folder is visible before uploading. The workflows will not appear in GitHub Actions if that folder is omitted.

## 2. Apply the v14.1 Supabase update

In Supabase SQL Editor, run:

`RUN_THIS_IN_SUPABASE_FOR_V14_1.sql`

This creates first-party analytics and Daily-generator health tables. It is additive and does not delete existing accounts, scores, categories, observations, or boards.

## 3. Deploy through Vercel

Commit the files to the default branch and allow Vercel to deploy them.

## 4. Continue the UN Comtrade expansion

Open **GitHub → Actions → Repair and expand v14 imports → Run workflow**.

The importer now resumes instead of restarting:

- categories already imported are skipped
- 429 responses are retried with backoff
- a quota-exhausted 403 saves progress and ends gracefully
- later runs continue with the remaining categories
- the workflow reports progress toward all 55 categories without turning quota exhaustion into a false code failure

The prior run imported 25 of 55 candidates, so the next run should begin with the missing candidates after the API quota is available again.

## 5. Verify

Run `VERIFY_V14_1.sql` in Supabase, then open `/admin`.

Admin should show:

- total customized usernames
- 30-day visitors and game activity
- warehouse health by source
- recent Daily-generator runs
- existing category and import controls

Analytics begin at zero and accumulate only after this build is deployed.
