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
npm run check-v16-2-5
```

## Current database release

GeoStats v16.2.5 upgrades a verified v16.2.4 database/application. It preserves the v16.2.4 Scout 4×4 / Adventurer 6×4 / Expert 8×6 scoring model while refining mobile/desktop layout, touch behavior, Results presentation, and catalog policy.

Run the release in this order:

1. Take a Supabase snapshot, then run `RUN_THIS_IN_SUPABASE_FOR_V16_2_5.sql`
2. Push the v16.2.5 repository and require **Verify GeoStats v16.2.5** to pass
3. Run **Recover v16.2.5 audited catalog** (or the narrower historical workflow when only historical sources need rerunning)
4. Review/download the source and category audit artifacts
5. Run `VERIFY_V16_2_5.sql` and confirm every final check is `PASS`
6. Redeploy/promote the verified v16.2.5 commit after catalog finalization

The 33 catalog promotion candidates are never forced through data-quality gates, and the 30 repair candidates remain fail-closed until fresh source, semantic, coverage, and ranking audits pass. Daily and Random continue to use one shared approved playable catalog.

See `V16_2_5_INSTALLATION.md`, `RELEASE_NOTES_V16_2_5.md`, and `VALIDATION_V16_2_5.md` for details.

## Data governance

A category can enter play only when it has:

- an approved editorial decision;
- a completed semantic/source audit with no blocking title, unit, source-identity, or result-logic issue;
- no substantive value, unit, year, duplicate, or ranking mismatch;
- a comprehensive or defensibly top-end-complete ranking; and
- enough distinct top-ranked values to build a tie-free board.

Missing observations are never treated as zero. High-wins categories can qualify with incomplete global coverage when omissions cannot plausibly change the meaningful top end; low-wins categories remain stricter. Every playable category is eligible for both Daily and Random, with the generator controlling repetition and diversity.
