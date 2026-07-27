# GeoStats v14.1 validation report

Validated on July 27, 2026 in the build environment used to package this release.

## Passed checks

- Python compilation passed for the modified data-pipeline, Comtrade, verification, and test scripts
- Core invariant suite passed: 76 category definitions
- Full importer fixture suite passed for the generic pipeline, World Bank, WHO, UNESCO, ILOSTAT, Natural Earth, UN Comtrade, EIA, UNHCR, and FAOSTAT
- v13.5 regression and trust checks passed
- v14.1 repository, generation-rule, source-panel, analytics, workflow, and release checks passed
- TypeScript/TSX syntax transpilation passed for 67 files
- UN Comtrade tests confirmed resumable quota handling, 429 backoff behavior, partial-progress preservation, and API-key redaction
- The deployable SQL file is byte-for-byte identical to migration 021

## Commands run successfully

```bash
python -m py_compile scripts/data_pipeline/http.py scripts/data_pipeline/base.py scripts/import-comtrade.py scripts/verify-v14-import-expansion.py scripts/test-comtrade-importer.py scripts/verify-v14-1-repository.py
npm test
npm run test-importers
npm run test-v13-5
npm run test-v14-1
```

## Build-environment limitation

A complete `next build` could not be run in this environment because the project dependencies were not already installed and repeated package-registry requests timed out or returned temporary service errors. No `node_modules` folder or generated dependency files are included in the release.

This limitation is environmental rather than a passing build claim: Vercel still needs to install the pinned dependencies and run the production Next.js build when the repository is deployed. The repository's source-level, integration, importer, regression, and syntax checks listed above all passed.

## Required deployment step

Run `RUN_THIS_IN_SUPABASE_FOR_V14_1.sql` before relying on the new analytics and Daily-generator health panels. The application is designed to remain functional before the migration, but those new admin statistics will remain empty until it is applied and traffic begins accumulating.
