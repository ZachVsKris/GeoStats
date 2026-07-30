# GeoStats v15.8 validation

## Release commands

```bash
npm run test-v15-8
npm run typecheck
npm run test-importers
npm run test-player-links
npm run test-source-integrity
npm run build
```

The combined JavaScript release gate is:

```bash
npm run check-v15-8
```

## What the v15.8 tests cover

- complete Scout, Adventurer, and Expert generator regression
- deterministic server-generated Random boards
- one approved runtime catalog with no Random-only tier
- Seeded navigation renamed Random and redundant Daily navigation removed
- FAOSTAT yield/productivity rejection at importer and runtime layers
- preservation of clear crop-production and livestock-population totals
- expansion-source registry, importers, workflows, and source links
- new candidates forced into Pending/manual review
- duplicate comparison against the full viable catalog
- title similarity, semantic grouping, ranking correlation, coverage, and tie checks
- Category Review Workbench automated recommendation and board-description editing
- root installer and migration parity

## Database verification

After deployment, run `VERIFY_V15_8.sql`. Queries marked as zero-row or zero-count checks must pass. In particular:

- no playable yield/productivity category
- at least one playable livestock-population category when valid source rows exist
- no expansion category becomes playable without manual approval
- no Random-only editorial or metadata tier

## Production acceptance

A release is complete only after:

- GitHub **Verify GeoStats v15.8** passes
- Vercel production build succeeds
- Scout, Adventurer, Expert, and Random load
- a repeated Random seed reproduces the same board
- no new board includes a FAOSTAT yield/productivity category
- Workbench shows imported expansion candidates as Pending with automated recommendations
- manually approved candidates become eligible for every game mode after reconciliation
