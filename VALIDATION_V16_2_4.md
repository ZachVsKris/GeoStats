# GeoStats v16.2.4 validation

## Required automated checks

GitHub **Verify GeoStats v16.2.4** must pass:

- v16.2.4 static release checks
- v16.2.4 SQL lexical checks
- generator regression checks
- importer suites
- historical importer tests
- TypeScript typecheck
- production build
- Playwright E2E

## Mode/scoring invariants

- Scout: 4 countries, 4 categories, 0 decoys, 100/75/50/25, max 400.
- Adventurer: 6 countries, 4 categories, 2 decoys, 100/80/60/40/20/0, max 400.
- Expert: 8 countries, 6 categories, 2 decoys, 100/85/70/55/40/25/10/0, max 600.
- New generation rejects old dimensions.
- Stored v16.2.3 Daily payloads can still be decoded/rendered/scored with legacy configuration.

## Mobile hard gate

At all supported phone viewports (375×667, 390×844, 393×852, 414×896), active gameplay must satisfy all of the following simultaneously:

- document height does not exceed the viewport;
- no horizontal overflow;
- every country card is entirely inside the viewport;
- every category slot is entirely inside the viewport;
- countries occupy at most two rows;
- all category slots are present at once;
- the lock button is visible without scrolling;
- titles remain readable and descriptions are not line-clamped away;
- measurement badges are present.

Reducing blank space must never regress the complete single-viewport board requirement.

## Country variety

Daily generation uses a seven-day decaying country-exposure preference. Verify that the exposure signal affects candidate scoring but is not a validity rule. Random generation must remain deterministic and must not depend on recent Daily history.

## Historical milestone validation

For each v16.2.4 World Bank milestone:

- current countries only;
- official indicator and threshold recorded in metadata;
- crossing year accepted only when both year Y and Y-1 are observed and cross the threshold;
- left-censored countries omitted;
- gaps across the threshold omitted;
- source audit independently reproduces the identity/threshold/crossing rule;
- category cannot become playable unless validation and shared-gate checks pass.

## Supabase final verification

After **Import v16.2.4 historical categories and finalize** is green, run `VERIFY_V16_2_4.sql` and require every check to be `PASS`. In particular:

- original 4 historical categories verified;
- at least 8 curated historical categories verified total;
- all 4 World Bank historical milestones verified;
- shared playable catalog remains at least 260;
- no pending editorial backlog;
- all 4 targeted share-category rewrites are editorially resolved, while source/ranking gates remain authoritative;
- no Daily/Random mismatch;
- no unverified playable category;
- unwanted newest-constitution inverse has zero playable rows;
- sports-equipment exports remains excluded;
- publication RPC exists, is executable by `service_role`, and can resolve pgcrypto;
- all playable categories have measurement types.

## Accounts and leaderboard compatibility

- Passwordless `signInWithOtp` account creation/sign-in remains wired to the GeoStats auth callback.
- The callback exchanges/verifies the Supabase token and persists the session in cookies.
- New profiles continue through required `username_customized` onboarding before pending Daily scores are saved.
- Score submissions preserve the immutable Daily board version metadata.
- All-time leaderboards must not discard legacy scores merely because their raw points exceed a v16.2.4 maximum.
- Each historical score is normalized against the max score associated with its stored rules era: v16.2.3 Scout 400 / Adventurer 600 / Expert 800 versus v16.2.4 Scout 400 / Adventurer 400 / Expert 600.
- The all-time public table displays average percentage rather than a cross-era raw-point average.
- Today’s standings remain raw-point standings for one immutable Daily board.

## Dependency reproducibility

A package lock must be generated from the pinned `package.json`, not handcrafted. Use **Generate v16.2.4 package lock**, commit the exact artifact, and rerun Verify. The workflow switches to `npm ci` when the lock exists.
