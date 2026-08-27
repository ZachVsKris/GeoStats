# GeoStats v16.2.6 validation

This file defines the release gates for v16.2.6. A candidate count is not a success criterion. The release succeeds only when the implemented application/database passes the gates below and every tracked category/workstream has an explicit disposition.

## Automated repository checks

`npm run test-v16-2-6` must pass:

- v16.2.6 static release checks;
- v16.2.6 SQL lexical/release checks;
- deterministic 1,000-day v16.2.5 → v16.2.6 structural category-propensity artifact + regression checks;
- 14-source common-year/reference-period policy audit;
- 533-row × 47-field tracker reconciliation checks;
- legacy generator regression checks;
- importer/data-pipeline suites;
- historical importer tests;
- source-integrity tests;
- new WPP, climate, IMF, Natural Earth/capitals, Constitute/IPU, NOAA tsunami, UNESCO ICH, AQUASTAT, FAO fisheries, USGS minerals, WHO GHED, UN DESA migrant-stock, WTO services, direct UN Tourism, and official-bulk reader fixtures.

`npm run check-v16-2-6` additionally requires:

- TypeScript `tsc --noEmit`;
- production Next.js build;
- Playwright E2E.

GitHub **Verify GeoStats v16.2.6** is the authoritative clean-environment execution of these gates.

## Catalog/tracker reconciliation

Require:

- every existing workbook annotation has an explicit resolution;
- every expansion/repair candidate has a research status, implementation status, final disposition, and reason/blocker;
- every non-category release workstream has an explicit implementation/gate status;
- no unexplained/pending tracker rows remain;
- no candidate is considered playable solely because it appears in the tracker.

## Data comparability/integrity

For playable statistical categories verify:

- comparable units and magnitude scales;
- identical relevant denominators (for example per 100 vs per 100,000 adults are not interchangeable);
- identical percentage bases;
- cross-country comparable currency/price basis;
- compatible common-year/date treatment;
- no silent mixing of incompatible modeled/observed conventions;
- compatible entity/geographic definitions;
- ranking coverage is sufficient so omitted countries cannot change the gameplay ranking;
- ties/distinctness satisfy board feasibility;
- exact source provenance is retained.

Absolute World Bank `.CN` / `.KN` local-currency magnitude series must not be playable cross-country comparisons unless a specific defensible conversion/comparability rule exists.

## Historical/geospatial validation

Historical categories additionally require complete-enough chronology, explicit current-state/successor-state rules, source identity, and uncertainty treatment. Approximate/overlapping ancient dates must not be turned into fake precision.

Geospatial/derived categories additionally require a pinned dataset/version, explicit formula, consistent territory treatment, geometry/resolution semantics, and reproducible derivation. Missing values may not be manually filled.

## Same-source rejection safeguard

A previously rejected/data-blocked category must not become playable via the same source + indicator + methodology unless the release has explicit repair evidence showing the blocker changed. Re-sourcing to a genuinely different primary/administrative dataset is preferred for repair targets.

## Generator regression

The committed structural audit is `artifacts/v16-2-6-propensity/PROPENSITY_1000_DAY_COMPARISON.json`; it runs 1,000 continuous Daily trios per version (14,000 category slots each). It intentionally isolates category-selection policy from country/winner search. The separate full production generator regression remains mandatory. Inspect at least:

- catalog reach / categories never reached;
- top 10/25/50 concentration;
- broad-bucket and semantic-family distribution;
- Anchor/Standard/Specialty distribution;
- exact-category and family repeat intervals;
- source/domain exposure;
- Scout vs Adventurer vs Expert exposure;
- country exposure and recent-country repetition.

The objective is not equal probability. The gate is that no small solver-convenient subset dominates and broad recognizable material has a meaningful path into play without creating a new repetitive quota pattern.

## Results / mobile / UI gates

- Results show board placement and canonical World Rank for each country/category result.
- Scout/Adventurer/Expert mode tabs and scoring remain unchanged.
- At 375×667, 390×844, 393×852, and 414×896 active play has no document scrolling/horizontal overflow and all countries/categories/Lock in Draft remain visible.
- The v16.2.6 phone-space rebalance gives country cards more usable vertical space while trimming category-card dead space.
- Longer new category copy must pass the same UI-fit gate.

## Private Random QA gates

Test with an authorized tester and a normal user:

- tester can access Random and seeded QA;
- non-tester `/random` redirects to Daily;
- server endpoints independently reject non-testers;
- public navigation/Rules/Results/SEO do not advertise Random;
- Random stays outside leaderboards/public analytics;
- seed determinism is preserved.

## Backward compatibility

Verify:

- historical Daily boards and Results load;
- old scores retain their scoring-version interpretation;
- leaderboard normalization remains unchanged;
- saved/pending scores survive;
- already-scored boards remain immutable;
- old shared result URLs remain functional or safely redirected;
- removed v16.2.6 categories disappear only from future/unscored generation;
- session/account migration remains safe;
- country diversity does not regress while category diversity improves.

## Supabase final verification

After v16.2.6 installation and source import/audit, run `VERIFY_V16_2_6.sql` and require all release assertions to pass. In particular confirm:

- additive v16.2.6 schema/migration exists;
- hard-block decisions are enforced by computed playability;
- no invalid local-currency row is playable;
- known semantic corrections are present;
- private tester/entitlement and analytics schema are healthy;
- source rows for newly playable categories are verifiable;
- no hard-blocked/unverified row is enabled.

## Production-only release checks

Repository tests cannot substitute for these deployment checks:

- Supabase backup/recovery confirmed;
- production Site URL/callback;
- custom SMTP + authenticated sender + SPF/DKIM;
- branded auth templates;
- non-team email sign-in test;
- production Daily play-through for all three difficulties;
- production small-phone smoke tests;
- leaderboard, analytics and source-link smoke tests;
- rollback path confirmed.

## Package integrity

Before final packaging:

- remove `.next`, `node_modules`, TypeScript build caches, `__pycache__`, `.pyc`, test output and other transient files;
- generate `FILE_MANIFEST_V16_2_6.txt` from the clean release tree;
- generate `SHA256SUMS_V16_2_6.txt` for manifest files except the checksum file itself;
- verify checksums;
- create the final release ZIP and extract/byte-compare it to the clean release tree.
