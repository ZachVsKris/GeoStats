# GeoStats v15.4 installation

v15.4 is a consolidated replacement for the failed fast-Daily patch. You do not need to revert that failed commit: overwrite the matching repository files with this release.

## Install order

1. Extract the v15.4 update-only package.
2. Copy the **contents** of its folder into the root of the GitHub repository and overwrite matching files.
3. Commit and push to `main`.
4. Wait for **Verify GeoStats v15** and the Vercel production deployment to succeed.
5. Only after both succeed, run `RUN_THIS_IN_SUPABASE_FOR_V15_4.sql` in the Supabase SQL Editor.
6. Open `/api/daily-trio/2026-07-28?rules=11.0`, then test `/daily`, `/daily/adventurer`, `/daily/expert`, and `/random`.
7. Do not run the source-integrity workflow with enforcement enabled.

No hidden files change in v15.4.

## What the SQL does

- reviews every category against Daily and Random minimum qualifications;
- assigns `daily`, `random`, or `quarantined` runtime tiers;
- approves only deterministic clear passes while preserving explicit rejections and duplicates;
- measures tie concentration at the same precision players see;
- keeps genuine value, country-set, duplicate, unit, year, and ranking failures blocked;
- cleans up selected player-facing titles and source descriptions;
- removes only unscored saved boards created under older rules.

The SQL is safe to rerun. A rollback file is included for catalog metadata and review decisions. Deleted unscored boards are not restored by rollback because they can be regenerated.
