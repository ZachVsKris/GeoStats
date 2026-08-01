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

Validation for the v16 release:

```bash
npm run test-v16
npm run typecheck
npm run build
npm run test-e2e
```

## Database release

For v16.0, run the files in this order:

1. `RUN_THIS_IN_SUPABASE_FOR_V16_0.sql`
2. Run the GitHub workflow **Import v16 automatic expansion**
3. `VERIFY_V16_0.sql`

The import workflow reruns the repaired Pew and Food Balance importers, vets the imported categories, and calls the v16 catalog finalizer. The installer is rerunnable. `ROLLBACK_V16_0.sql` restores the catalog fields captured before the first v16 installer run while preserving historical Daily boards and scores.

## Data governance

A category can enter play only when it has:

- an approved editorial decision;
- an official, human-readable source link;
- no substantive value, unit, year, coverage, or ranking mismatch;
- a comprehensive or top-end-complete ranking;
- enough distinct top-ranked values to build a tie-free board.

Missing observations are never treated as zero. Sparse sources can still qualify when omitted countries cannot plausibly change the meaningful high end of the ranking.
