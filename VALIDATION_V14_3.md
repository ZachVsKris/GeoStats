# GeoStats v14.3 Validation

## Automated checks included

- `python scripts/test-v14-3-semantics.py`
  - verifies the labor-market and displacement examples are classified as conflicts
  - verifies dissimilar categories remain compatible
- `node scripts/test-v14-3-integration.mjs`
  - verifies semantic and global top-30 rules are wired into generation and validation
  - verifies the World Bank Admin importer stores a single common year
  - verifies audit activation defaults to off
- `python scripts/test-source-integrity.py`
  - verifies exact snapshot, ranking, checksum, metadata, and unit behavior against fixtures
- `npm run test-importers`
  - runs all source-importer fixture suites
- `npm test`
  - runs gameplay/category invariants
- `node scripts/test-ts-syntax.mjs`
  - transpiles all TypeScript/TSX files for syntax validation
- `python scripts/verify-v14-3-repository.py`
  - checks required release files, versions, SQL markers, and workflow presence

## What local tests prove

They prove that the release contains the intended rules and that deterministic fixtures behave correctly. They do not prove that every live Supabase category matches its current official source. That requires running the GitHub source audit against the live warehouse.

## Live acceptance criteria

A category may become playable only when:

- its official series identity and source query match,
- its common year and coverage match the official snapshot,
- all stored country values match,
- recalculated global ranks match,
- source and stored checksums match,
- it passes existing editorial, credibility, provenance, clarity, fun, and objectivity gates.

A Daily board is valid only when:

- every category is verified and has a complete global ranking,
- each board winner ranks #30 or better globally,
- no two categories have a semantic-family or cross-family similarity conflict,
- all configured source, continent, agriculture, FAOSTAT, dimension, and distinct-winner rules pass.

## Build limitation during packaging

The packaging environment could not install the pinned Next dependencies because the package registry returned HTTP 503. Therefore, the included local validation does not claim a completed `next build`. The full Vercel build should be checked immediately after repository upload.
