# GeoStats v16.2.4

v16.2.4 is a game-design, variety, historical-content, and mobile-playability release built on the verified v16.2.3 baseline.

## Difficulty redesign

- **Scout:** 4 countries × 4 categories; placement points **100 / 75 / 50 / 25**; max **400**. All four countries are used.
- **Adventurer:** 6 countries × 4 categories; placement points **100 / 80 / 60 / 40 / 20 / 0**; max **400**. Two countries remain unused.
- **Expert:** 8 countries × 6 categories; preserves the former Adventurer placement curve **100 / 85 / 70 / 55 / 40 / 25 / 10 / 0**; max **600**. Two countries remain unused.
- The former 10-country × 8-category Expert format is retired for new boards.

The dimensions, score curves, maximums, top-finish rules, and generation constraints are centralized in `lib/gameRules.ts`. Previously stored v16.2.3 Daily boards remain readable and score with their original dimensions and point curves; v16.2.4 generation itself accepts only the new structures.

## Better country variety

Daily generation now loads up to seven recent Daily dates and builds a decaying country-exposure signal across all three difficulties. Candidate quality remains the primary validity gate; recent use only subtracts a preference penalty, so the generator never makes a good board invalid merely to force novelty. Cross-mode diversity selection remains in place.

The catalog strategy continues to favor strong per-capita and percentage/share categories because they naturally widen the set of countries that can be meaningful top performers. The global top-30 winner quality guard is not weakened in this release.

## Targeted catalog repairs

Four broad percentage/share concepts from the v16.2.3 `needs_rewrite` bucket receive explicit player-facing copy repairs:

- **Largest share of agricultural land irrigated**
- **Largest share of electricity from coal**
- **Largest share of electricity from nuclear power**
- **Highest R&D spending as a share of GDP**

This resolves the editorial-copy blocker and assigns the `share` measurement type. It does **not** bypass source validation or ranking completeness; any repaired category that still fails those gates remains non-playable.

## Historical expansion

Four additional broad historical milestones are derived from official World Bank World Development Indicators annual series:

- **Most recently became majority urban**
- **Most recently reached 50% internet use**
- **Most recently reached 50% electricity access**
- **Most recently reached 70-year life expectancy**

These use a conservative observed-crossing rule: year `Y` is accepted only when the source contains both `Y` at/above the threshold and `Y-1` below it. Countries that are already beyond the threshold when the source begins, have a gap across the crossing, or never cross are omitted rather than assigned an invented historical year. The categories stay out of play until source validation, editorial curation, ranking-completeness checks, and the shared Daily/Random gate all pass.

The historical product rule remains intentionally strict: prefer broad, distinct milestones that a normal geography/history player can reason about; do not multiply near-duplicate archaeology concepts or add specialist institutional trivia merely to increase category count.

## Measurement-type communication

Category cards now include a compact textual measure badge:

- `TOTAL`
- `SHARE`
- `PER CAPITA`
- `DATE`

Color remains a secondary visual cue rather than the only explanation of measurement type.

## Results navigation

Scout / Adventurer / Expert navigation is moved to a compact segmented control near the top of Results, directly before the placement detail. The redundant bottom difficulty-navigation buttons are removed.

## Strict phone gameplay fit

Active gameplay on the supported phone viewports is explicitly designed to fit in one viewport with no page scrolling. The v16.2.4 E2E suite checks 375×667, 390×844, 393×852, and 414×896 and requires:

- the document not to exceed the viewport during active play;
- every country card to be fully visible;
- every category slot to be fully visible;
- all countries to use no more than two rows;
- all categories to remain present at once;
- the lock button to remain visible after the cards; and
- category descriptions and measure badges to remain usable.

Blank space, header height, padding, and gaps were reduced before shrinking content. Scout uses a single four-country row; Adventurer uses 3×2 countries with a 2×2 category board; Expert uses 4×2 countries with a 2×3 category board.

## Catalog and database

Migration `045_v16_2_4_modes_variety_history.sql` preserves all v16.2.3 editorial dispositions, adds the new World Bank historical milestone curation/guard, and keeps Daily and Random on the same computed playable catalog. `assert_v16_2_4_release()` requires all eight curated historical categories to be source-verified, including all four new World Bank milestones, before publication.

The unwanted `history:newest-current-constitution` inverse remains fail-closed. Sports-equipment exports remains excluded.

## Accounts and leaderboards

The existing passwordless GeoStats account flow remains intact: email magic-link sign-in, secure callback/session cookies, required public-username onboarding, and automatic saving of pending Daily scores are unchanged. v16.2.4 adds release guards so these paths cannot be accidentally removed while changing gameplay.

The all-time leaderboards are made explicitly cross-version-safe for the mode redesign. Historical v16.2.3 scores are retained rather than filtered against the new lower Adventurer/Expert maxima, and each score is normalized using the maximum score that applied under its stored `rules_version`. Because raw points are no longer comparable across scoring eras, the all-time table now shows **Avg. %** instead of raw average points. Today’s leaderboard continues to show raw points because every player on a given Daily is competing on the same immutable board/rules.

## Dependency reproducibility

No lockfile was fabricated. The build environment used to assemble this release could not access all npm registry packages needed to generate a legitimate `package-lock.json`.

A new manual workflow, **Generate v16.2.4 package lock**, generates and verifies the real lockfile in GitHub and uploads it as an artifact. Once `package-lock.json` is committed, Verify and catalog-recovery workflows automatically use `npm ci`; until then they emit a warning and use `npm install`.

## QA

v16.2.4 adds focused static and SQL release checks for the new mode sizes/scoring, historical milestone derivation, country-exposure preference, measurement badges, Results navigation, strict mobile viewport behavior, legacy-board compatibility, workflow/release artifacts, and the no-Random-only policy.
