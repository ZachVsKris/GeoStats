# GeoStats v13.5 credibility policy

The policy does not equate “government-originated” with “false,” and it does not remove a category simply because the result is surprising.

## The decision test

A category is playable only when it has:

1. a documented statistical source and methodology;
2. sufficient coverage, freshness, stability, and differentiation;
3. a credible collection system such as administrative records, household surveys, international modeling, geospatial derivation, customs records, or independent bibliometrics;
4. sufficiently consistent definitions for country-to-country ranking;
5. no unresolved incentive or reporting problem severe enough to make the rank misleading.

## Evidence labels

- **Observed/administrative:** customs, registries, or comparable operational records.
- **Internationally harmonized:** national or operational data reconciled under a common international methodology.
- **Modeled estimate:** a model fills gaps or harmonizes results.
- **Mixed observed and modeled:** substantial use of both.
- **Geospatially derived:** calculated from one common geometry source.
- **Independent bibliometric:** derived from publication databases rather than national claims.

## Important examples

### Internet use

Quarantined. The indicator can combine household surveys, regulator and operator reporting, and imputation. Differences in definitions and measurement systems can produce technically published but player-misleading rankings.

### Scientific journal articles

Retained with explanation. This World Bank series is based on independent bibliometric indexing and author affiliations, not a number asserted by Iran or another national government. It measures article count, not quality, influence, or research integrity.

### Military spending

Retained with explanation because the series relies on SIPRI reconciliation and independent estimation rather than accepting only a government’s headline claim.

### WHO vaccination coverage

Retained cautiously and named by exact vaccine dose/series. The result is presented as standardized WHO reported/estimated coverage, not as an independently counted census of every child.

## Fail-closed behavior

A category below 75 credibility or marked quarantined cannot be enabled by later curation or importer runs. New categories still require the existing curation/provenance system and the credibility gate.

## Complete approved-catalog decision file

`CATEGORY_TRUST_REVIEW_V13_5.csv` records the v13.5 decision for all 241 categories from the supplied approved export. The policy produces:

- 212 approved
- 17 caution
- 12 quarantined
- 2 EIA categories conditionally eligible only after nonzero/tie-concentration checks

A caution status is still playable only when the category clears the 75-point credibility floor and every numerical quality gate. It is shown to players with an explicit evidence label and trust explanation.
