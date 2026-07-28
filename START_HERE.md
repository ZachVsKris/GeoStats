# GeoStats v15.3

v15.3 replaces the failed v15.2.1 patch. You do not need to revert that failed commit: copying this release over the repository replaces the affected files.

## Install order

1. Copy the contents of the v15.3 update package into the **root** of the GitHub repository and overwrite matching files.
2. Commit and push to `main`.
3. Wait for **Verify GeoStats v15** and the Vercel production deployment to succeed.
4. Only after the deployment succeeds, run `RUN_THIS_IN_SUPABASE_FOR_V15_3.sql` in the Supabase SQL Editor.
5. Open `/api/daily-trio/2026-07-28`, then `/daily`.
6. Do not run **Audit all source integrity** with enforcement enabled.

No hidden files change in v15.3, and there are no files to delete.

## Expected behavior

- An already saved Daily trio is returned without reloading hundreds of datasets.
- A successful Daily response is cached at Vercel and in the player’s browser.
- The browser never attempts to generate the Daily trio itself.
- No two countries on one board display the same value for a category.
- Board winners are globally top 30 or better.
- The adaptive generator can relax source caps when the strict profile is mathematically incapable of using the live catalog.
- Invalid unscored saved boards are regenerated automatically. Boards with saved scores remain locked for manual repair.

## Database outputs

The v15.3 SQL ends with:

- playable, approved, awaiting-review and integrity-ready counts by source;
- every approved-but-not-playable category and its blockers.

The pending-category promotion is intentionally conservative. It approves only categories already carrying strong objective, quality, coverage, comprehension, interest and uniqueness evidence. Ambiguous categories remain in the Workbench.
