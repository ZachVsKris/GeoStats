# GeoStats v16.2.2 installation

v16.2.2 is an upgrade from the verified v16.2.1 catalog. It cleans up the remaining editorial backlog, relaxes overly conservative **high-end** coverage blocking while keeping low-end rankings strict, adds measurement-type UI metadata, installs the first two historical categories, and permanently repairs the Daily publication RPC's pgcrypto dependency.

## Before you start

- Start from a working **v16.2.1** database.
- Take a Supabase backup/snapshot.
- Keep the existing GitHub secrets for `SUPABASE_URL` and the service-role key.
- No new API key is required for the two historical sources.
- Do **not** rerun the v16.2 or v16.2.1 installers.

## Install order

1. In Supabase SQL Editor, run **only** `RUN_THIS_IN_SUPABASE_FOR_V16_2_2.sql`.
   - This is an upgrade migration, not a fresh database installer.
   - It does not publish a partially expanded catalog. Existing playable flags remain authoritative until the guarded finalizer runs.
   - It immediately excludes the explicitly removed sports-equipment export category and resolves the old pending editorial backlog.

2. Replace/deploy the repository with the v16.2.2 repository, including the hidden `.github/workflows` folder, and push to `main`.

3. Wait for **Verify GeoStats v16.2.2** to pass.

4. In GitHub Actions, run **Import v16.2.2 historical categories and finalize**.
   - This imports and independently audits:
     - United Nations Member State admission dates
     - Constitute in-force constitution records
   - It then runs the guarded v16.2.2 catalog finalizer.
   - Do **not** rerun the large `Recover v16.2.2 audited catalog` workflow unless a major source actually needs full recovery.

5. Download the workflow artifacts:
   - `geostats-v16-2-2-source-audit-unmembership`
   - `geostats-v16-2-2-source-audit-constitute`
   - `geostats-v16-2-2-category-audit`

6. In Supabase SQL Editor, run `VERIFY_V16_2_2.sql`.
   - Every row in the final machine-readable check table should be `PASS`.
   - The guard requires at least 260 shared playable categories, no pending editorial backlog, at least two verified historical categories, and the established World Bank/FAOSTAT/WHO/Comtrade integrity floors.

7. After verification passes, test:
   - Scout Daily
   - Adventurer Daily
   - Expert Daily
   - Random at all three difficulties
   - category/result/source views for measurement accents
   - score/result persistence after refresh

## Daily boards

Do not overwrite an already-played Daily merely to install v16.2.2. Existing published Daily payloads are self-contained. The new catalog will be used for Random after publication and by the next normal Daily generation.

## Important release guards

v16.2.2 fails closed. Finalization will not publish the shared Daily/Random catalog if:

- fewer than 300 World Bank categories have usable audits;
- fewer than 25 FAOSTAT production/livestock categories are verified;
- fewer than 15 WHO categories have usable audits;
- fewer than 40 UN Comtrade categories are verified;
- the two initial historical categories are not verified;
- the resulting shared playable catalog is below 260 categories; or
- any editorial backlog remains pending.

If finalization stops, inspect the exact guard message and the audit artifacts rather than manually enabling categories.
