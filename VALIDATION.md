# GeoStats v15.7 validation

## Local or GitHub commands

```bash
npm run test-v15-7
npm run typecheck
npm run test-importers
npm run test-player-links
npm run test-source-integrity
npm run build
```

The combined release gate is:

```bash
npm run check-v15-7
```

GitHub Actions additionally installs all Python importer dependencies and runs the complete production build.

## Generator regression

`scripts/test-v15-7-generator.cjs` compiles the real generator modules and constructs a multi-source synthetic catalog. It verifies:

- complete Scout, Adventurer, and Expert generation
- all hard round/trio rules
- deterministic Daily output for one date and catalog snapshot
- deterministic Seeded output for one seed and difficulty
- successful profile diagnostics

## Static integration checks

`scripts/test-v15-7-clean.cjs` parses every TypeScript/TSX file and checks:

- one authoritative catalog
- no Random-only tier
- full warehouse loading
- bounded generator search
- secure Daily writes and public-date restriction
- shared per-date generation lock
- per-difficulty score locking
- immutable board snapshots
- server-generated Seeded boards
- secured scheduled pre-generation
- mobile layout and short board copy
- Workbench counts and board-description editing
- migration/installer parity

## Database verification

Run `VERIFY_V15_7.sql` after the migration and deployment. Queries explicitly marked “Must return zero” should return no rows or a count of zero.

## Production acceptance

A release is not complete until all of these pass:

- GitHub verification workflow
- Vercel production build
- all three Daily modes load
- repeated Seeded link is reproducible
- mobile first viewport reaches game/loading/error content without the former full-page header stack
- Workbench Playable count matches the authoritative Supabase count
