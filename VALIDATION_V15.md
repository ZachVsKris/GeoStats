# GeoStats v15.0.0 validation

Validated on July 27, 2026.

## Passed locally

- v15 category-review integration checks
- TypeScript/TSX syntax transpilation for 77 files
- 76 gameplay invariants
- Generic importer framework
- World Bank catalog importer
- WHO, UNESCO UIS, ILOSTAT, Natural Earth, UN Comtrade, EIA, UNHCR, and FAOSTAT importer tests
- Player-source URL policy fixtures
- Source-integrity fixtures
- Python bytecode compilation
- Root v15 SQL and migration copy match exactly

## Production-build limitation

A complete local `next build` was not run because package installation could not complete in this execution environment. `.github/workflows/verify-v15.yml` installs dependencies, runs the v15 tests and importer tests, and performs the production build after upload to GitHub.
