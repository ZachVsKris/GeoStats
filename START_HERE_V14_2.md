# GeoStats v14.2 — install in this order

Do not deploy v14.1 first. v14.2 already contains the v14.1 generator, simplified source screen, analytics, and Comtrade-resume changes.

## 1. Replace the GitHub repository

Upload the **entire contents** of this repository, including the hidden `.github` folder. The workflow file must appear at:

`.github/workflows/audit-source-integrity.yml`

A visible backup is also included at:

`GITHUB_ACTIONS_WORKFLOWS/audit-source-integrity.yml`

## 2. Apply the Supabase migration

Open Supabase → SQL Editor, paste the full contents of:

`RUN_THIS_IN_SUPABASE_FOR_V14_2.sql`

Run it once. It includes the skipped v14.1 analytics migration, then adds v14.2 audit tables and integrity statuses. It does not immediately shut off the existing catalog.

## 3. Run the full audit before deploying

Open GitHub → Actions → **Audit all source integrity** → Run workflow.

Use:

- Source: `all`
- Also audit disabled candidates: `false`
- Turn on fail-closed enforcement: `true`

The workflow downloads/refetches official source data, compares every country in each playable common-year snapshot, recalculates ranks, validates units/years/series identity, records checksums, and quarantines mismatches. FAOSTAT is audited directly from the official QCL bulk archive.

A red workflow means at least one source could not be accessed or identified. Do not treat the audit as complete until that is resolved. Definite data mismatches are quarantined and reported but do not crash the entire audit.

## 4. Verify in Supabase

Run:

`VERIFY_V14_2.sql`

Confirm:

- `enforcement_enabled` is `true`
- `unverified_playable` is `0`
- the final `unverified_playable_categories` count is `0`
- every playable source has verified categories
- failed or unable-to-verify categories are disabled

## 5. Deploy through Vercel

After the audit and SQL verification pass, deploy the repository. The v14.2 application refuses to serve unverified categories or incomplete global ranking tables.
