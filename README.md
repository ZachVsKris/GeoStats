# GeoStats

GeoStats is a daily geography strategy game built with Next.js and Supabase. Players assign countries to statistical categories and score points according to each country’s rank among the countries on the board.

## Game modes

- **Scout:** 5 countries and 4 categories
- **Adventurer:** 8 countries and 6 categories
- **Expert:** 10 countries and 8 categories
- **Random:** reproducible, unranked boards generated from a shareable seed

Daily boards are generated as one validated trio, stored in Supabase, and served from self-contained board payloads. Public game requests never generate a board while the player waits.

## Local development

Copy `env.example` to `.env.local`, configure the Supabase values, and run:

```bash
npm install
npm run dev
```

Full release validation:

```bash
npm run test-v16-1
npm run typecheck
npm run build
npm run test-e2e
```

## Current database release

GeoStats v16.1 requires v16.0. Run the current release in this order:

1. `RUN_THIS_IN_SUPABASE_FOR_V16_1.sql`
2. Deploy the v16.1 repository
3. Run the GitHub workflow **Import v16.1 audited catalog**
4. Download the generated category-audit artifact
5. Run `VERIFY_V16_1.sql`

See `V16_1_INSTALLATION.md` and `RELEASE_NOTES_V16_1.md` for details. `ROLLBACK_V16_1.sql` is a scoped category-copy/editorial rollback that preserves historical boards and scores.

## Data governance

A category can enter play only when it has:

- an approved editorial decision;
- a completed semantic audit with no blocking title, unit, source-identity, or result-logic issue;
- no substantive value, unit, year, coverage, duplicate, or ranking mismatch;
- a comprehensive or top-end-complete ranking;
- enough distinct top-ranked values to build a tie-free board.

Missing observations are never treated as zero. Sparse sources can qualify when omissions cannot plausibly change the meaningful high end of the ranking. The complete audit export includes every category’s source identity, top and bottom values, findings, editorial state, and runtime decision for continued human review.
