# GeoStats v14.0 validation

Validated on July 26, 2026.

## Passed

- Generic importer framework tests
- World Bank catalog importer tests
- WHO importer tests
- UNESCO UIS importer tests
- ILOSTAT importer tests
- Natural Earth spatial importer tests
- UN Comtrade importer tests
- U.S. EIA importer tests
- UNHCR importer tests
- FAOSTAT adaptive importer tests
- v13.4 governance and integration tests
- v13.4.1 FAOSTAT and integration tests
- v13.4.2 editorial curation and integration tests
- v13.4.3 complete-catalog curation and integration tests
- v13.4.4 playability calibration tests
- v13.5 trust and runtime integration tests
- v14 transparency, objectivity, expansion, source-viewer, admin, and workflow integration tests
- Core invariant tests
- TypeScript/TSX syntax transpilation for all 63 files under `app/`, `components/`, and `lib/`
- Python bytecode compilation for all importer and governance scripts
- Top-level v14 Supabase SQL exactly matches migration `020_transparency_playability_spatial_expansion.sql`

## Safeguards verified

- Newly discovered categories enter a disabled review queue and cannot silently become playable.
- Subjective, perception-based, and composite country rankings fail the objective-data gate.
- Categories below the credibility, verifiability, clarity, or fun floors cannot enter runtime boards.
- Runtime category loading enforces the same player-quality gates as the database governance functions.
- Source details expose the stored all-country snapshot used for the ranking, even when the provider lacks a stable filtered deep link.
- Natural Earth candidates retain versioned input layers and derivation metadata.
- Resolution-sensitive coastline rankings remain quarantined.
- Offshore reefs, elevation, climate, and biome claims are not falsely derived from Natural Earth country polygons.

## Production-build limitation

A complete `next build` was not executed in this environment because local package installation did not complete within the available execution window. No partial `node_modules` or lockfile was retained. Vercel must perform the final dependency installation, Next.js type check, and production compilation.
