# GeoStats v13.5.0 release notes

## Credibility and self-report controls

- Added category-level credibility score, status, evidence label, comparability risk, corroboration status, and explanation.
- Added a fail-closed credibility gate to database governance and runtime board generation.
- Added `CATEGORY_TRUST_REVIEW_V13_5.csv`, covering all 241 categories in the supplied approved export.
- Quarantined internet-use percentage because survey, regulator, operator, and imputation methods are not sufficiently comparable for a trusted country ranking without additional corroboration.
- Retained scientific-journal article counts as independent bibliometric data and clarified that they measure volume, not research quality.
- Quarantined Natural Earth coastline length because the ranking changes with geometry resolution.
- Quarantined low-quality and specifically identified high-comparability-risk categories.
- Added nonzero/tie-concentration gating for EIA physical-energy categories.
- Renamed WHO vaccine series to HepB3, MCV1, and BCG coverage.

## Source transparency

- Result tooltips and expanded rankings use the exact `source_url` stored for the category.
- Added separate methodology links.
- Added evidence type, credibility score, and “Why trusted” explanation to results.
- Persisted Daily boards are rehydrated with current warehouse metadata.

## Automated playable catalog

- Added a server-backed playable-category catalog so every currently approved, enabled warehouse category can enter board generation without a new hardcoded application release.
- Existing static IDs are preserved when possible so older Daily boards remain decodable; warehouse-only categories use their governed database IDs.
- The application falls back to the bundled catalog when Supabase is temporarily unavailable.

## Board diversity

- Added per-difficulty source caps.
- Added FAOSTAT/agriculture caps.
- Prevented production and yield versions of the same commodity from appearing together.
- Prevented aggregate and component categories from appearing together.
- Prevented closely related trade, production, percentage, and total concepts from clustering on one board.

## All-time leaderboard

- Replaced raw-score comparison across days with a board-relative performance score.
- Each result is standardized against players who completed the same Daily.
- Small daily cohorts are shrunk toward the mode-wide distribution.
- A 20-game Bayesian confidence prior balances performance and experience.
- Five Dailies remain required to qualify.

## Random testing

- Restored deterministic unranked seed mode for Scout, Adventurer, and Expert.
- Added seed entry, copyable links, new-seed generation, and exact board reproduction.
- Random scores never enter Daily leaderboards.

## GeoStats authentication

- Added first-sign-in username onboarding inside GeoStats.
- Added case-insensitive username uniqueness and reserved-name protection.
- Scores wait until the player chooses a public username.
- Added GeoStats-branded email templates and custom SMTP setup instructions.
