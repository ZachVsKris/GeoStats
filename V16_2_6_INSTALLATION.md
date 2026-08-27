# GeoStats v16.2.6 installation

GeoStats v16.2.6 is a single large release built on the verified v16.2.5 baseline. It preserves v16.2.4 scoring and the 4×4 / 6×4 / 8×6 difficulty geometry while expanding the catalog research pipeline, redesigning category exposure, making Random a private QA mode, adding world rank to Results, strengthening comparability gates, and hardening launch/admin infrastructure.

## Before installation

1. Preserve the current production v16.2.5 Git commit as the rollback baseline.
2. Take or confirm a recoverable Supabase backup/snapshot.
3. Confirm GitHub/Vercel/Supabase release secrets are present.
4. Confirm Node 22+ and the committed root `package-lock.json` are used; release workflows use `npm ci`.
5. Do not run older v16.2.x catalog recovery/finalization workflows while the v16.2.6 release is being activated.
6. Review `V16_2_6_MASTER_TRACKER.csv` and `V16_2_6_RELEASE_TRACKER.csv`. Every candidate/workstream must have an explicit disposition/status; validation-blocked categories remain non-playable.

## Install application/database layer

1. Run `RUN_THIS_IN_SUPABASE_FOR_V16_2_6.sql` in the Supabase SQL editor.
2. Push the v16.2.6 repository to GitHub.
3. Require **Verify GeoStats v16.2.6** to pass before catalog publication.
4. Confirm the v16.2.6 SQL verifier can see the additive release schema, catalog hard blocks, tester permissions, analytics additions, and release assertions.

## Import and validate expansion sources

Run **Import v16.2.6 expansion and finalize**. The workflow is fail-closed: a source family that cannot be independently validated does not become playable.

Automatic/remote source families wired in this release include the v16.2.5 catalog plus new or repaired v16.2.6 paths such as:

- UN World Population Prospects 2024;
- World Bank Climate Change Knowledge Portal / CRU climatology;
- IMF World Economic Outlook using pinned historical observations rather than projections;
- Natural Earth country geometry and capitals/physical-geography derivations where the metric is well defined;
- Constitute current-constitution enactment years and IPU Parline universal women’s suffrage milestones;
- NOAA/NCEI historical tsunami records;
- UNESCO Intangible Cultural Heritage;
- re-source/recovery paths with same-source retry safeguards.

Official bulk-input importers remain fail-closed until their exact official source file/input is supplied and validates. No category is promoted merely because a candidate exists in the tracker.

## Catalog rules enforced by v16.2.6

- The country universe remains the existing GeoStats 195.
- Data validity, editorial playability, and generation propensity are separate decisions.
- A previously rejected/data-blocked category cannot become playable through the same failed source + indicator + methodology unless the recorded blocker has genuinely changed and repair evidence is supplied.
- Absolute World Bank local-currency series that are not cross-country comparable are hard blocked.
- Unit, denominator, percentage base, magnitude, price/currency basis, year, modeled/observed convention, entity definition, and geographic scope are integrity concerns rather than copy concerns.
- The explicit workbook removals and clarify-or-remove decisions are applied to future generation.
- Historical/geospatial candidates remain fail-closed when chronology, successor-state treatment, geometry/resolution, uncertainty, or ranking completeness cannot support a defensible ordering.
- Daily and playable Random QA use the same validated catalog; Random is not a lower-quality catalog tier.

## Private Random QA

Random remains implemented for authorized internal testers only.

- Public navigation/help/Results do not advertise Random.
- `/random` redirects non-testers to Daily.
- Seeded/Random server endpoints independently enforce tester authorization.
- Random remains excluded from public leaderboards and public analytics.
- Tester access is controlled by database state; do not hard-code a personal email/username.

After installation, explicitly grant tester permission only to the intended authorized account(s) using the deployed administrative process/database policy.

## Final verification

After expansion import/audit completes:

1. Run `VERIFY_V16_2_6.sql`.
2. Require every release assertion/check to pass and every blocker query to be empty.
3. Confirm no hard-blocked or unverified category is playable.
4. Confirm Daily/Random catalog flags remain consistent.
5. Run a production Daily puzzle on Scout, Adventurer, and Expert.
6. Verify historical Daily boards/results and old shared links still load.
7. Verify leaderboard normalization and old scoring-version interpretation are unchanged.
8. Verify Results shows Board Rank + Country + World Rank + Value (+ Reference/Points where layout permits).
9. Smoke-test 375×667, 390×844, 393×852, and 414×896 active-play layouts with no page scrolling or horizontal overflow.
10. Verify the Admin last-30-Dailies diversity view and analytics fields populate correctly.
11. Verify private Random authorization with both an authorized tester and a normal account.
12. Verify source links and source provenance for newly playable categories.

## Production authentication/email checklist

These settings live outside the repository and must be confirmed in production before launch:

- Supabase Site URL and callback URL;
- custom SMTP;
- authenticated GeoStats sender domain;
- SPF/DKIM;
- GeoStats-branded auth email templates;
- appropriate click-tracking setting;
- a real sign-in test from a non-team/external email.

## Rollback

If v16.2.6 must be withdrawn:

1. Restore/redeploy the preserved v16.2.5 application commit.
2. Run `ROLLBACK_V16_2_6.sql` only after reviewing the comments and current production state.
3. Re-run the v16.2.5 verifier and production smoke tests.

The release is designed to be additive and fail-closed; old scored boards/scores remain immutable and scoring stays `placements-v16.2.4`.
