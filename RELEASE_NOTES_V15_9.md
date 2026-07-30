# GeoStats v15.9.2

## Everything retained from v15.9.1

- 15 Pew religious-composition candidates.
- 27 FAOSTAT Food Balance consumption candidates.
- 6 tourism and international-migration candidates.
- 1 total World Heritage-site candidate.
- Fully automatic official-source imports with no URL or CSV inputs.
- Pending-by-default intake, whole-catalog duplicate/correlation vetting, and no automatic activation.
- FAOSTAT total production and clear livestock populations retained; yield, area, slaughter/carcass, and productivity elements blocked by source semantics.
- UNESCO UIS removed from new play.
- Natural Earth span/position concepts retired, pinned dataset references, ISO/map-unit identity precedence, stable spatial rounding, and checksum-warning severity.
- Long Findex subgroup copy retired or held for rewrite.
- Reconciled Workbench totals, selective unplayed-board invalidation, Random UI cleanup, and the mobile Daily redesign.

## v15.9.2 corrective safeguards

### Daily-mode preservation

Automatic repair no longer releases a valid unscored Scout, Adventurer, or Expert board merely because another mode is difficult to generate. Every individually valid mode remains fixed. The generator retries only missing or invalid modes with deterministic alternate attempts, while scored and historical boards remain immutable.

### Legacy Random links

Legacy player routes under `/seeded` and `/test` now redirect to Random, map old difficulty names to Scout/Adventurer/Expert, and preserve query parameters such as `seed`.

### Static-source references and rank explanation

Static source labels such as `Natural Earth countries v5.1.1` are used consistently in result summaries, ranking rows, perfect-answer rows, and tooltips. Result tooltips now explicitly explain why the value produces the displayed global rank.

### Immutable scoring metadata

Every new Daily score records:

- scoring version
- board-difficulty normalization version
- leaderboard rating version
- board rules version
- category-set version
- dataset version

Historical rows are backfilled with their saved board versions where available. The API remains compatible during the brief period before the additive migration is run.

### Real browser and source regressions

GitHub verification now:

- builds the production application
- runs Chromium tests at 375×667, 390×844, 393×852, and 414×896 for Scout, Adventurer, and Expert
- verifies country-bank wrapping, one-column cards, no horizontal overflow, touch/click assignment, and in-flow Lock in Draft
- checks the Expert board at 1440×900
- verifies legacy Seeded redirects
- downloads the real pinned Natural Earth country layer and checks map-unit precedence and retained ranking sanity

### Repository hygiene

Runtime diagnostic/cache labels now use v15.9.2. Python caches and generated build artifacts are excluded from the release, manifest, and checksum set.
