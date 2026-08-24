# GeoStats v16.2.4 installation

v16.2.4 upgrades a verified v16.2.3 database and application. Do not rerun older installers during this upgrade.

## Before installation

1. Confirm the final v16.2.3 production smoke test is clean.
2. Take a Supabase snapshot.
3. Preserve the final v16.2.3 repository/commit as the rollback baseline.

## Install

1. Run `RUN_THIS_IN_SUPABASE_FOR_V16_2_4.sql` in the Supabase SQL Editor.
2. Push the v16.2.4 repository to GitHub.
3. Let **Verify GeoStats v16.2.4** run. It must be green before catalog publication.
4. For full dependency reproducibility, run **Generate v16.2.4 package lock**, download its `package-lock.json` artifact, add that exact file at repository root, commit it, and let Verify run again. With the lock present, Verify uses `npm ci` automatically.
5. Run **Import v16.2.4 historical categories and finalize**. The four source jobs import/re-audit UN membership, Constitute, IPU, and the new World Bank historical milestones. The final job publishes only after the guarded release assertions pass.
6. Download/review the source-integrity and category-audit artifacts.
7. Run `VERIFY_V16_2_4.sql` in Supabase and confirm every final check reports `PASS`; the release-blocker query immediately above the check table must return zero rows.
8. Redeploy/promote v16.2.4 in Vercel after finalization and verification.
9. Run the production smoke test below.

If Vercel auto-deploys on the initial repository push, that deployment is acceptable as a preview. Trigger one final redeploy after catalog finalization so the first production Daily/Random cache snapshot uses the finalized catalog.

## Same-day Daily transition

If v16.2.3 already published the current day's trio, v16.2.4 intentionally accepts that stored legacy trio rather than replacing a board people may already have played. Those boards retain their original dimensions/scoring. The next newly generated Daily uses the v16.2.4 4×4 / 6×4 / 8×6 structures.

## Production smoke test

- Daily Scout loads and a newly generated board has 4 countries / 4 categories.
- Daily Adventurer loads and a newly generated board has 6 countries / 4 categories.
- Daily Expert loads and a newly generated board has 8 countries / 6 categories.
- A same-day legacy board, if present, still renders and scores correctly.
- Random Scout/Adventurer/Expert use the new structures and repeat identically from the same seed.
- Scoring maxima are Scout 400, Adventurer 400, Expert 600.
- Results show the difficulty switcher near the top and no duplicate switcher at the bottom.
- Category cards show textual TOTAL / SHARE / PER CAPITA / DATE badges.
- At 375×667, 390×844, 393×852, and 414×896 active play requires no page scrolling and every country/category panel is fully visible.
- Account creation/sign-in works through the email magic-link flow; a new account is prompted to choose a public username before its pending score is submitted.
- Signed-in Daily scores save normally and appear on the appropriate difficulty leaderboard.
- Today’s leaderboard shows the current board’s raw score; all-time standings retain legacy scores and show cross-version **Avg. %** rather than comparing incompatible raw point maxima.
- Locking, per-category rankings, source panels, and sharing remain normal.

## Rollback

The preferred rollback is the pre-install Supabase snapshot plus the preserved v16.2.3 repository. `ROLLBACK_V16_2_4.sql` is supplied as a conservative database rollback: it fail-closes v16.2.4-only historical categories and restores the v16.2.3 ranking/runtime/finalizer functions without deleting source/provenance data.
