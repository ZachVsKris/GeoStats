# GeoStats v15.9.2 validation

## Passed locally in this build environment

- v15.9.2 static release and policy checks
- Daily generator and partial-mode repair regressions
- deterministic Random generator regression
- generic data-pipeline fixtures
- World Bank, WHO, ILOSTAT, Natural Earth synthetic, UN Comtrade, EIA, UNHCR, and FAOSTAT importer fixtures
- Pew 15-category importer fixtures
- FAOSTAT Food Balances 27-category fixtures
- tourism/migration 6-category fixtures
- UNESCO World Heritage total-category fixture
- Smithsonian and USGS fixtures
- expanded-catalog duplicate/vetting fixtures
- common-year batched Supabase paging and split/retry fixtures
- player-source link policy fixtures
- v15.9.2 source-integrity fixtures, including FAOSTAT `An`/animals normalization
- Python syntax compilation
- JavaScript syntax checks
- SQL installer/migration parity checks
- package/application version consistency
- no `__pycache__`, `.pyc`, `node_modules`, `.next`, or TypeScript build-info files in the packaged repository

## Authoritative GitHub verification

**Verify GeoStats v15.9.2** installs the declared JavaScript and Python dependencies, reruns the full unit/importer/source-policy suite, performs TypeScript checking, downloads the pinned real Natural Earth country layer, builds the production Next.js application, installs Chromium, and runs the responsive browser suite.

The browser suite covers:

- Scout, Adventurer, and Expert at 375×667, 390×844, 393×852, and 414×896
- no horizontal overflow
- wrapping country banks with all 5, 8, or 10 choices reachable
- one-column mobile measure cards
- completed assignments and enabled Lock in Draft
- Lock in Draft remaining after the cards and outside an overlay
- Expert at 1440×900
- legacy Seeded-to-Random redirects with query preservation

A full local Next.js build is not claimed from this container because its package registry mirror does not provide the pinned `@supabase/ssr@0.12.3` dependency. GitHub/Vercel remain the authoritative dependency-resolved build environments.
