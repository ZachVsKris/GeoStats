# GeoStats v13.5 validation

Validated on July 26, 2026.

## Passed

- All importer test suites
- v13.4 governance and integration tests
- v13.4.1 FAOSTAT and integration tests
- v13.4.2 editorial curation tests
- v13.4.3 complete-catalog curation tests
- v13.4.4 playability calibration tests
- v13.5 trust/runtime integration tests
- Core invariant tests
- TypeScript/TSX syntax transpilation for all files under `app/`, `components/`, and `lib/`
- Python bytecode compilation for all importer and governance scripts
- Supabase v13.5 top-level SQL matches migration `019_trust_sources_auth_leaderboard.sql`

## Catalog simulation

The supplied 241-row approved export produced 229 trusted runtime categories after the v13.5 credibility rules excluded 12 quarantined categories. No duplicate runtime IDs or quarantined escapes were detected.

## Production-build limitation

A complete `next build` was not executed in this environment because repository dependencies were not available locally and package installation did not complete. Vercel must perform the final dependency installation, type check, and production compilation. The deployment checklist in `START_HERE_V13_5.md` includes the required post-deployment tests.
