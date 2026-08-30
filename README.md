# GeoStats

GeoStats is a daily geography strategy game built with Next.js and Supabase. Players assign countries to statistical categories and score points according to each country’s rank among the countries on the board.

## Game modes

- **Scout:** 4 countries and 4 categories
- **Adventurer:** 6 countries and 4 categories
- **Expert:** 8 countries and 6 categories
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
npm run check-v16-2-8
```

## Current database release

GeoStats v16.2.8 is the launch-readiness release for the reviewed 316-category catalog. It preserves Scout 4×4 / Adventurer 6×4 / Expert 8×6 scoring while adding account-gated Expert play and leaderboards, automatic standings, first-party analytics, resilient Admin reporting, and cross-browser presentation safeguards.

Run the release in this order:

1. Confirm migrations 069 through 077 are applied to the healthy Supabase project
2. Push the v16.2.8 repository and require **Verify GeoStats v16.2.8** to pass
3. Confirm Vercel deploys that exact commit to production
4. Verify the public Daily modes, account-gated Expert/leaderboard flow, Admin analytics, and warehouse health
5. Configure and externally test GeoStats custom SMTP before advertising branded account email

Additional catalog work is bounded by subject area and remains fail-closed unless a complete candidate bundle passes the existing source, semantic, coverage, uniqueness, Top-20, and board-generation gates. Daily and internal Random QA continue to use one shared approved playable catalog.

See `LAUNCH_DOCKET_V16_2_8.md`, `RELEASE_NOTES_V16_2_8.md`, `VALIDATION_V16_2_8.md`, and `ROLLBACK_V16_2_8.sql` for details.

## Data governance

A category can enter play only when it has:

- an approved editorial decision;
- a completed semantic/source audit with no blocking title, unit, source-identity, or result-logic issue;
- no substantive value, unit, year, duplicate, or ranking mismatch;
- a comprehensive or defensibly top-end-complete ranking; and
- enough distinct top-ranked values to build a tie-free board.

Missing observations are never treated as zero. High-wins categories can qualify with incomplete global coverage when omissions cannot plausibly change the meaningful top end; low-wins categories remain stricter. Every playable category is eligible for both Daily and Random, with the generator controlling repetition and diversity.
