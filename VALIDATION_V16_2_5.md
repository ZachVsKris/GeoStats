# GeoStats v16.2.5 validation

## Required automated checks

GitHub **Verify GeoStats v16.2.5** must pass before publication:

- v16.2.5 static release checks;
- v16.2.5 SQL lexical checks;
- generator/regression checks;
- importer suites and historical importer tests;
- TypeScript typecheck;
- production Next.js build; and
- Playwright E2E.

The release workflows use the committed root `package-lock.json` and `npm ci`.

## Unchanged mode/scoring invariants

- Scout: 4 countries, 4 categories, 100/75/50/25, max 400.
- Adventurer: 6 countries, 4 categories, 100/80/60/40/20/0, max 400.
- Expert: 8 countries, 6 categories, 100/85/70/55/40/25/10/0, max 600.
- v16.2.5 does not introduce a new scoring era.
- Stored v16.2.3 Daily payloads remain readable/scorable with the legacy configuration.

## Mobile hard gate

At 375×667, 390×844, 393×852, and 414×896 active gameplay must simultaneously satisfy:

- document height does not exceed the viewport;
- no horizontal overflow;
- every country card is fully visible;
- every category card is fully visible;
- countries occupy no more than two rows;
- Lock in draft is visible without scrolling;
- category titles/descriptions and neutral measurement badges remain readable; and
- phone layout uses reclaimed whitespace rather than hiding gameplay content.

Touch E2E must additionally confirm:

- Lock in draft completes with one intentional touch;
- Rules content can be touch-scrolled to the end; and
- Random Results difficulty switching stays Random and preserves the current seed.

## Presentation invariants

- No gameplay category-card information icon.
- Measurement labels are textual and neutral; measurement-type color encoding is absent.
- No old colored measurement strokes in placement rows, Best Possible/optimal allocation, source panels, or other Results surfaces.
- Active difficulty tabs remain readable and high contrast.
- Results mode tabs precede Final Score.
- Reference allocation says **Best Possible**, not **Perfect Round**.
- Full Random seed is visible without requiring horizontal input scrolling in supported layouts.

## Catalog policy invariants

- Exactly 63 v16.2.5 review targets are registered: 33 promotion + 30 repair.
- All 63 targets resolve to actual catalog rows before publication.
- Promotion targets may clear editorial rejection/copy blockers only; they still require the same computed-playable gate as every other category.
- Repair targets remain fail-closed until re-import/re-audit makes them pass.
- Daily and Random flags must match for every category; no Random-only status may exist.
- The ambiguous combined protected-land-and-sea category must have zero playable rows.
- No provider-wide UNESCO UIS or U.S. EIA exception may bypass row-level source/credibility/ranking requirements in either direction.

## Historical DATE policy

DATE/historical categories bypass only the ordinary global winner-prominence/top-rank heuristic. Validate that they still fail when:

- coverage is insufficient;
- omitted countries could change a low/high chronological ranking;
- source identity or derivation cannot be verified;
- values are tied/clumped beyond board feasibility; or
- another hard semantic/integrity gate fails.

## Generator diversity

Verify that one board cannot contain multiple categories from the constrained clusters:

- forced displacement;
- livestock population;
- emissions;
- freshwater;
- tourism;
- energy system;
- religious composition; and
- product-specific exports.

Existing broad-domain, same-source, agriculture, FAOSTAT, trade, similarity, aggregate, and commodity-conflict caps remain active. Random remains deterministic and independent of recent Daily country history. Daily retains the seven-day decaying country-exposure preference.

## Supabase final verification

After **Recover v16.2.5 audited catalog** (or the narrower historical finalizer when appropriate) is green, run `VERIFY_V16_2_5.sql` and require every row to report `PASS`. Also require the release-blocker query immediately above the check table to return zero rows.

Important checks include:

- v16.2.4 release invariants still pass;
- all 63 v16.2.5 target rows resolve;
- all 33 promotion candidates have the expected editorial approval state;
- all 30 repair candidates remain tracked whether or not the repair succeeds;
- shared computed playable catalog remains above the release safety floor;
- Daily/Random mismatch count is zero;
- protected land-and-sea combined category is not playable;
- no enabled category sits outside the computed playable gate;
- no unverified category is playable; and
- every playable category has a valid measurement type.

The number of successfully repaired/playable targets is informational, not a forced threshold.

## Accounts and leaderboards

- `signInWithOtp` flow remains wired to the Supabase auth callback.
- Required username onboarding remains intact.
- Pending Daily score is saved after successful onboarding/sign-in.
- Today leaderboard remains raw-score based for one immutable Daily board.
- v16.2.3 scores are normalized using their historical maxima.
- v16.2.4 and v16.2.5 use the same scoring/maxima for cross-version normalization.
- All-time display remains Avg. % rather than comparing incompatible raw scoring eras.

## Local-package integrity

Before packaging:

- remove `tsconfig.tsbuildinfo`, `__pycache__`, `.pyc`, `.next`, and other transient caches;
- generate `FILE_MANIFEST_V16_2_5.txt` from the clean release tree;
- generate `SHA256SUMS_V16_2_5.txt` for every manifest file except the checksum file itself;
- run the static checksum verifier; and
- extract the release ZIP and byte-compare its files to the clean release tree.
