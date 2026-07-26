# GeoStats v14.0.2 — verified workflow package

This is the complete v14 repository with the source-transparency, plain-language descriptions, objective-data gates, bulk candidate importers, Natural Earth spatial candidates, and import-repair workflow.

## v14.0.2 fixes

- Verified that `.github/workflows/repair-v14-expansion.yml` is present in the repository
- Added visible workflow backup copies and macOS upload instructions so the hidden `.github` directory is not accidentally omitted
- Updated all official GitHub Actions references to `actions/checkout@v5` and `actions/setup-python@v6`
- Added an automated repository-integrity test that checks workflow presence, importer candidate counts, exact-source viewer behavior, and plain-language descriptions
- Preserved strict completeness gates: 24 Natural Earth candidates, a target-based World Bank scan, and 55 Comtrade candidates when the API key is configured

## Database

No new schema migration is required beyond v14.0 and v14.0.1. For an existing v14 database, deploy the repository and run the repair workflow. For a database still on v13.5, apply `RUN_THIS_IN_SUPABASE_FOR_V14.sql`, then `RUN_THIS_IN_SUPABASE_FOR_V14_0_1.sql`.
