# GeoStats v15.1.0

This release consolidates the v15 review workbench, the v15.0.1 Daily-generation fix, and a safer source-integrity policy.

## Fixed

- Metadata drift, source API failures, pending verification, and unavailable source responses no longer automatically block categories.
- Only direct value mismatches, country-set mismatches, duplicate snapshots, and ranking mismatches are hard integrity failures.
- Source-integrity enforcement is off by default in every workflow copy.
- Audits with unavailable sources produce reports without failing the workflow unless enforcement or reconciliation itself fails.
- Daily generation uses adaptive source-balance profiles while retaining strict per-board semantic diversity, top-30 winners, complete observations, continent limits, and cross-mode country-overlap limits.
- The `/admin/review` route is included and covered by repository verification.

## Database

Existing v15 installations should run `RUN_THIS_IN_SUPABASE_FOR_V15_1.sql` once. It restores playability according to the revised integrity policy without mass-approving pending editorial categories.
