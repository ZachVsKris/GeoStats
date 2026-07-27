# GeoStats v14.4 build validation

## Passed in the release environment

- v14.4 repository and integration assertions
- TypeScript/TSX syntax transpilation across 73 files
- 76 game and catalog invariants
- Player-source URL policy tests
- Source-integrity fixture tests
- World Bank, WHO, UNESCO, ILOSTAT, Natural Earth, UN Comtrade, EIA, UNHCR, FAOSTAT, and generic importer unit tests
- Visible `GITHUB_ACTIONS/workflows` parity with `.github/workflows`
- Python syntax compilation for modified audit and importer files

## Production build

The artifact environment could not access the npm registry, so dependencies were unavailable and `next build` could not be executed locally. The included `Verify GeoStats v14.4` GitHub Action installs dependencies, runs the full test suite, and performs the production Next.js build on every push to `main`, pull request, or manual run.

## Database validation

The Supabase migration was statically checked by repository assertions but was not executed against the live database. After installation, run `VERIFY_V14_4.sql`; all sections marked `MUST return zero rows` must be empty.
