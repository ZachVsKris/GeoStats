# GeoStats v16.2.3 validation record

Validation performed against the full v16.2.3 release tree assembled from the supplied v16.2.2 repository.

## Passed locally

- `npm run test-v16-2-3`
  - v16.2.3 static release checks
  - release SQL lexical validation
  - deterministic generator / Random / joint-search regression suite
  - World Bank importer fixtures
  - WHO importer fixtures
  - ILOSTAT importer fixtures
  - Natural Earth importer fixtures
  - UN Comtrade importer fixtures
  - EIA importer fixtures
  - UNHCR importer fixtures
  - FAOSTAT production/livestock importer fixtures
  - Pew religion importer fixtures
  - Smithsonian volcano importer fixtures
  - USGS earthquake importer fixtures
  - historical UN / Constitute / IPU importer fixtures
- `python scripts/test-source-integrity.py`
- `python scripts/test-player-source-links.py`
- `npm run test-expansion-importers`
  - Pew religion
  - FAOSTAT Food Balances
  - tourism/migration
  - existing UNESCO importer
  - expanded-catalog vetting
  - Supabase observation paging
- TypeScript/TSX syntax transpilation through the globally available TypeScript compiler for all `app/`, `components/`, and `lib/` source files.

## Release SQL validation

`node scripts/test-v16-2-3-sql.cjs` validates the corrected v16.2.2 migration, v16.2.3 migration, cumulative installer, verification SQL, and rollback SQL for:

- unterminated single/double quoted strings
- unterminated PostgreSQL dollar-quoted blocks
- unbalanced parentheses
- the exact unescaped `Project's Constitute service` regression
- the Workbench view-layout regression caused by appending `measurement_type` through `runtime.*`

This is a strong repository-level syntax guard but is not a substitute for running the installer against Supabase/PostgreSQL. `VERIFY_V16_2_3.sql` must still return PASS in the target database.

## Not runnable in this assembly environment

A trustworthy dependency tree could not be installed. The internal npm mirror returned 404 for required packages including `@playwright/test@1.55.0` and `@supabase/ssr@0.12.3`; direct access to the public npm registry timed out. Therefore these release gates were **not** validly run here:

- `npm run typecheck` with the repository's installed dependency types
- `npm run build`
- `npm run test-e2e`

The source tree therefore intentionally contains no fabricated `package-lock.json`. The GitHub **Verify GeoStats v16.2.3** workflow must be green in an environment with normal npm registry access before production deployment.

## Network-only test

`python scripts/test-natural-earth-real-data.py` could not retrieve the Natural Earth archive because DNS/network access is unavailable in this container. The fixture-based Natural Earth importer test passed.
