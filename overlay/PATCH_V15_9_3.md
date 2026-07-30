# GeoStats v15.9.3 deployment hotfix

This patch is designed for the exact `Geohunter-main (15).zip` repository.

## What it fixes

- Resolves the Vercel TypeScript failure in `app/api/scores/route.ts` by preventing new-schema and legacy-schema Supabase results from being assigned to the same inferred row type.
- Applies the same safe fallback to all four score-query paths, not only the first line reported by Vercel.
- Returns a database error if duplicate-score recovery cannot reload the saved score.
- Corrects the Category Review Workbench instruction to reference `RUN_THIS_IN_SUPABASE_FOR_V15_9_2.sql`.
- Makes `ROLLBACK_V15_9_2.sql` compatible with an older application that omits the additive score-version columns.
- Advances the application version to `15.9.3`.
- Adds static regression checks for these failures.

## Apply

Copy the contents of this patch over the repository root, preserving folders and replacing existing files. Commit all changed files, then deploy the resulting repository.

Alternatively, from the repository root:

```bash
git apply GeoStats-v15.9.3-deployment-hotfix.patch
```

## SQL and Actions

No new Supabase SQL is required for this deployment hotfix. Do not run the rollback during a normal upgrade. The rollback file is included only to repair the safety of the existing v15.9.2 rollback procedure.

The existing verification workflow remains the correct workflow to run after applying the patch. It uses `npm install` because the source repository does not contain a `package-lock.json`; do not switch it to `npm ci` until a real lockfile has been generated and committed from a normal npm registry.

## Required validation

Run or confirm in GitHub Actions/Vercel:

```bash
npm install --no-audit --no-fund
npm run test-v15-9
npm run typecheck
npm run build
```

Then run the Playwright checks through the verification workflow.
