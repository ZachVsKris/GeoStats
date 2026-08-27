# GeoStats v16.2.2 release notes

## Catalog cleanup

- Disposes the full 307-category unresolved v16.2.1 editorial backlog instead of leaving a permanent pending queue.
- Records every disposition in `category_release_decisions_v16_2_2` and ships the review export `V16_2_2_BACKLOG_DECISIONS.csv`.
- Initial disposition: 5 approved, 10 kept for focused discussion/repair, and 292 rejected as too technical, narrow, duplicative, weakly comparable, or otherwise poor GeoStats questions.
- Keeps Daily and Random on one shared playable catalog. There is no Random-only quality tier.
- Makes high-end ranking completeness source-neutral: a well-covered, verified **high-wins** category can qualify when omissions cannot plausibly alter the meaningful top ranking.
- Keeps **low-wins** rankings strict because missing countries can easily change the bottom of a ranking.
- Refreshes stale credibility quarantine for six independently verified Natural Earth categories so a stale admin label does not override current source verification.

## Category wording and product curation

- Removes **Largest sports-equipment exports** from gameplay.
- Renames the protected-area category to **Largest protected share of land and sea** with the description: “Share of each country’s terrestrial and marine area designated as protected.”
- Applies explicit total/share/rate wording corrections to approved categories that previously had technically valid but ambiguous titles.

## Measurement-type visual system

- Adds `measurement_type` metadata with five values: `total`, `share`, `per_capita`, `historical_date`, and `other`.
- Adds restrained measurement accents to gameplay category cards, result rows, perfect-answer rows, and Data & Source views.
- Color remains supplementary: titles and descriptions still explicitly communicate total, share, per-person/rate, or historical meaning.

## Historical categories

v16.2.2 adds the historical-data framework and the first two source-audited categories:

- **Most recently admitted to the UN** — official United Nations Member State admission dates.
- **Newest current constitution** — `year_enacted` from Constitute/Comparative Constitutions Project records explicitly marked as currently in force; historic and draft constitutions are excluded.

Historical observations store a sortable numeric value separately from the displayed historical date/year. This avoids lexical date sorting and prepares the app for BCE/CE-capable curated historical datasets later.

The release intentionally does **not** add a vague “Oldest country” category or unsourced oldest-city/capital/university trivia. Those require explicit definitions and country-by-country provenance before becoming playable.

## Admin Workbench

- Carries `measurement_type` through the canonical category review view and API.
- Continues to use `computed_playable_v16_2` from the same runtime gate the generator uses, reducing admin/generator status drift.
- Surfaces the precise primary blocker/promotion reason rather than treating every non-playable category as generically blocked.

## Daily publication reliability

- Permanently sets the Daily publication RPC search path to include the schema where Supabase installed `pgcrypto`, fixing the production `digest()` failure discovered after v16.2.1 verification.
- Preserves `service_role` execution and reloads PostgREST schema metadata.
- Daily generation now distinguishes a missing RPC, permission problem, schema-cache issue, pgcrypto/digest dependency problem, atomic-trio guard failure, and other publication errors.

## Release verification

`VERIFY_V16_2_2.sql` now checks, among other things:

- World Bank, FAOSTAT, WHO, and Comtrade source-integrity floors;
- both historical categories are verified;
- at least 260 categories are in the shared playable catalog;
- Daily and Random flags match;
- no unverified category is playable;
- all Pew religion categories remain playable;
- no editorial backlog remains pending;
- sports-equipment exports are excluded;
- the protected-area title is corrected;
- playable categories have measurement metadata; and
- the Daily publication RPC exists, is executable by `service_role`, and can resolve the pgcrypto schema.

## Recovery workflows

- Adds **Import v16.2.2 historical categories and finalize** for the normal v16.2.1 → v16.2.2 upgrade path.
- Updates the full recovery workflow to v16.2.2 and includes the two historical sources.
- Preserves the FAOSTAT per-category atomic replacement timeout fix.
- Preserves forced refresh of existing UN Comtrade categories during full recovery.
