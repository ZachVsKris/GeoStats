# GeoStats

GeoStats is a daily geography strategy game built with Next.js and Supabase. Players assign countries to statistical categories and score points according to each country’s rank among the countries on the board.

## Game modes

- **Scout:** 4 countries and 4 categories
- **Adventurer:** 6 countries and 4 categories
- **Expert:** 8 countries and 6 categories
- **Random QA:** reproducible, unranked boards available only to the owner/internal tester

Daily boards are generated as one validated trio, stored in Supabase, and served from self-contained board payloads. Internal Random QA uses the same approved playable catalog but is not a public game mode.

## Local development

Copy `env.example` to `.env.local`, configure the Supabase values, and run:

```bash
npm install
npm run dev
```

Full release validation:

```bash
npm run check-v16-3-0
```

## Current database release

GeoStats v16.3.0 is the current production release. It preserves Scout 4×4 / Adventurer 6×4 / Expert 8×6 scoring while strengthening same-day semantic-conflict protection, defining unfamiliar category terminology, balancing all-time ratings for small player cohorts, hardening account recovery, and polishing public presentation.

Run the release in this order:

1. Confirm all repository migrations, including the timestamped v16.3.0 migrations, are applied to the healthy Supabase project
2. Push the v16.3.0 repository and require **Verify GeoStats v16.3.0** to pass
3. Confirm Vercel deploys that exact commit to production
4. Verify the public Daily modes and all-time leaderboards, account-gated Expert flow, Admin analytics, and warehouse health
5. Complete the owner-only Google OAuth, leaked-password protection, and multi-inbox email acceptance checks

Additional catalog work is bounded by subject area and remains fail-closed unless a complete candidate bundle passes the existing source, semantic, coverage, uniqueness, Top-20, and board-generation gates. A source pass targets 20 or more distinct approved categories and never ships fewer than 10; an exhausted pass is documented instead of padded or searched repeatedly. Daily and internal Random QA continue to use one shared approved playable catalog. See `BOUNDED_EXPANSION_LEDGER_V16_2_9.md`, `RELEASE_NOTES_V16_3_0.md`, `VALIDATION_V16_3_0.md`, and `V16_3_0_OWNER_FINISH.md` for the current record.

See `LAUNCH_DOCKET_V16_2_8.md`, `RELEASE_NOTES_V16_2_8.md`, `VALIDATION_V16_2_8.md`, and `ROLLBACK_V16_2_8.sql` for details.

## Data governance

A category can enter play only when it has:

- an approved editorial decision;
- a completed semantic/source audit with no blocking title, unit, source-identity, or result-logic issue;
- no substantive value, unit, year, duplicate, or ranking mismatch;
- a comprehensive or defensibly top-end-complete ranking; and
- enough distinct top-ranked values to build a tie-free board.

Missing observations are never treated as zero. High-wins categories can qualify with incomplete global coverage when omissions cannot plausibly change the meaningful top end; low-wins categories remain stricter. Every playable category is eligible for Daily and internal Random QA, with the generator controlling repetition and diversity.
