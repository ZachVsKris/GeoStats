# GeoStats

GeoStats is a daily geography strategy game built with Next.js and Supabase. Players assign countries to statistical categories and score points according to each country’s rank among the countries on the board.

## Game modes

- **Scout:** 5 countries and 4 categories
- **Adventurer:** 8 countries and 6 categories
- **Expert:** 10 countries and 8 categories
- **Random:** reproducible, unranked boards generated from a shareable seed

Daily boards are generated as one validated trio, stored in Supabase, and served from self-contained board payloads. Daily and Random use the same approved playable catalog.

## Local development

Copy `env.example` to `.env.local`, configure the Supabase values, and run:

```bash
npm install
npm run dev
```

Full release validation:

```bash
npm run check-v16-2-2
```

## Current database release

GeoStats v16.2.2 upgrades a verified v16.2.1 database. Run the release in this order:

1. `RUN_THIS_IN_SUPABASE_FOR_V16_2_2.sql`
2. Deploy the v16.2.2 repository
3. Pass **Verify GeoStats v16.2.2**
4. Run **Import v16.2.2 historical categories and finalize**
5. Review/download the source and category audit artifacts
6. Run `VERIFY_V16_2_2.sql`

Do not rerun older installers during the upgrade. See `V16_2_2_INSTALLATION.md` and `RELEASE_NOTES_V16_2_2.md` for details.

## Data governance

A category can enter play only when it has:

- an approved editorial decision;
- a completed semantic/source audit with no blocking title, unit, source-identity, or result-logic issue;
- no substantive value, unit, year, duplicate, or ranking mismatch;
- a comprehensive or defensibly top-end-complete ranking; and
- enough distinct top-ranked values to build a tie-free board.

Missing observations are never treated as zero. High-wins categories can qualify with incomplete global coverage when omissions cannot plausibly change the meaningful top end; low-wins categories remain stricter. Every playable category is eligible for both Daily and Random, with the generator controlling repetition and diversity.
