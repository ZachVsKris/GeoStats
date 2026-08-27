# GeoStats v16.2.6 release notes

v16.2.6 is the large catalog-quality, category-exposure, research-expansion, and public-launch hardening release built on v16.2.5. It deliberately does **not** force every researched idea into gameplay: every candidate receives an explicit disposition, and only validated, comparable, playable categories can ship.

## Preserved game rules

- Scout: 4 countries × 4 categories.
- Adventurer: 6 countries × 4 categories.
- Expert: 8 countries × 6 categories.
- Scoring remains `placements-v16.2.4` with maxima 400 / 400 / 600.
- Existing historical score normalization and immutable scored-board behavior are preserved.
- The strict one-viewport mobile gameplay requirement remains a release gate.

## Master catalog/release tracking

The release includes committed master trackers covering existing playable categories, repair/expansion candidates, spreadsheet annotations, and non-category release work. The tracker separates:

1. source/data validity;
2. editorial playability;
3. generation propensity.

Difficult candidates are not silently forgotten: unresolved concepts receive an explicit blocker/non-shipping disposition.

## Stronger comparability and catalog correctness

v16.2.6 promotes cross-country comparability to a hard integrity concern. The shared checks now account for unit magnitude, denominator identity, percentage base, price/currency basis, local-vs-common currency, common year, observed/modeled conventions, and relevant entity/geographic scope.

Permanent catalog corrections include:

- blocking invalid absolute World Bank local-currency comparisons;
- correcting `EN.URB.LCTY` to absolute largest-city population semantics rather than share;
- preserving arable-land-per-person semantics for `AG.LND.ARBL.HA.PC`;
- preserving ATM/bank-branch denominators as per 100,000 adults;
- removing/clarifying the workbook’s explicitly rejected or overly technical categories;
- making Most World Heritage sites fail closed when the official source audit cannot verify it;
- fixing plain-language/copy issues such as GDP per unit of energy use and title casing/acronyms.

A same-source retry safeguard prevents a previously rejected/data-blocked row from being made playable merely by rerunning the same source/indicator/methodology without recorded repair evidence.

## Expansion research and importers

New fail-closed source/importer work includes:

- UN World Population Prospects 2024 demographics;
- World Bank Climate Change Knowledge Portal / CRU 1991–2020 climatologies;
- IMF World Economic Outlook repair paths using pinned historical data;
- Natural Earth capitals and carefully defined physical-geography derivations, including bordering-country count and a scale-disclosed coastline estimate;
- Constitute/Comparative Constitutions Project current-constitution enactment years and IPU Parline universal women’s suffrage milestones;
- NOAA/NCEI historical tsunami events;
- UNESCO Intangible Cultural Heritage;
- official-bulk-source pathways for additional administrative/scientific families when inputs are supplied.

The completed recovery ledger now accounts for **392/392 post-FINAL source-family tracker rows across 26 mapped families**. Of those, 387 have executable fail-closed importer concepts and 5 are explicit source-identity blockers; there are no unexplained missing recovery rows. The later recovery families include Global Findex 2025, FAO FRA 2025, UNICEF Data Warehouse, UNDP HDR/MPI, V-Dem v16, FAOSTAT Food Security/Healthy Diet, Köppen-Geiger 1991–2020, World Bank WDI Infrastructure & Connectivity, FAOSTAT Land Use, FAOSTAT/ESA WorldCover, World Bank Women Business and the Law 2026, and WHO/UNICEF JMP.

Expansion emphasizes physical geography, climate, demographics, history/civic geography, geology/natural hazards, and recognizable broad-knowledge concepts. Ambiguous metrics such as island counts, antimeridian east/west extremes, ancient chronology, or other concepts without a consistent defensible definition remain fail-closed rather than guessed. Coastline length is a special case: the fixed Natural Earth 1:10m derivation is allowed with an explicit caution that the number is scale-dependent (the coastline paradox), not presented as an absolute physical truth.

## Generator exposure redesign

The generator no longer treats raw catalog size as the main determinant of what players see. v16.2.6 adds soft selection preferences for:

- 21-day exact-category recency;
- semantic-family recency;
- broad world-knowledge buckets;
- Anchor / Standard / Specialty generation priority;
- greater exploration among strong candidate boards;
- deterministic Random selection from a strong quality band.

The old structural physical-geography bonus is removed. DATE/historical categories keep their special validity handling without receiving an unintended exposure advantage. Country-exposure behavior is preserved/regression-tested while category diversity improves.

## Results and mobile gameplay

Results ranking tables add **World Rank** derived from canonical GeoStats observation data alongside board placement.

Phone gameplay reclaims vertical whitespace so country cards use more of the viewport and category cards carry less unused interior space, while preserving the strict no-scroll requirement across supported small-phone viewports.

## Random becomes private QA

Public GeoStats is one Daily puzzle with Scout / Adventurer / Expert. Random remains available to authorized internal testers for seeded QA, but is hidden and server-protected for normal users.

## Admin, analytics, leaderboard, launch hardening

- Admin adds a last-30-Dailies diversity audit with catalog utilization, repeat concentration, median repeat interval, and country exposure.
- Admin terminology uses **Average %** and **Integrity-blocked**, and similarity wording identifies normalized title-token overlap rather than implying a misleading semantic percentage.
- Public leaderboard output is username-centered and retains server-side score validation/normalization.
- Analytics adds referrer/UTM and visitor-state metadata and excludes private Random testing from public analytics.
- Privacy/Terms/public copy are refreshed for the Daily-first product and private Random model.
- A lightweight account entitlement field preserves future monetization flexibility without implementing payments/subscriptions/ads.

## Legacy rejection governance

The release preserves all 791 durable historical rejections in a reason-aware activation guard and completes a first-principles current review of every row. Final disposition is **744 reasoned exclusions** and **47 legacy-only veto clearances**. A clearance does not revive the old rejected source path and does not make a category playable; it only prevents stale title/semantic history from suppressing a current canonical path or a newly validated distinct concept. All ordinary source, integrity, duplicate, player-quality, coverage and activation gates still apply.

## Compatibility and release safety

v16.2.6 uses additive migration/rollback design, keeps catalog/scoring versions distinct, preserves old scored boards and score interpretation, and adds a release assertion/verifier. Existing completed v16.2.5 UI/gameplay behavior is retained unless explicitly changed above.
