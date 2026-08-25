# GeoStats v16.2.5

v16.2.5 is a usability, presentation, and catalog-quality refinement built on the verified v16.2.4 scoring/mode redesign. Scout remains 4×4, Adventurer 6×4, and Expert 8×6; scoring is unchanged from v16.2.4.

## Mobile and desktop board polish

Active phone gameplay remains a strict one-viewport experience, but v16.2.5 reclaims unnecessary blank space from headers, gaps, padding, country cards, and controls so category copy can be larger and easier to read. Supported regression viewports remain 375×667, 390×844, 393×852, and 414×896.

Desktop gameplay now uses difficulty-specific Country Bank proportions rather than stretching one geometry across all modes. Scout no longer produces oversized four-card boxes, while Adventurer/Expert give six/eight-country banks more usable width and better long-name handling. Desktop cards also stop filling unnecessary vertical height.

## Touch interaction fixes

- **Lock in draft** is wired for one intentional touch submission rather than requiring a second tap.
- The Rules modal owns its own touch scroll area and uses mobile-safe overscroll behavior.
- Selected difficulty tabs use a consistent high-contrast state instead of turning into difficult-to-read dark text.
- The Random seed field is wider, and Random Results difficulty links preserve the seed/mode.

## Measurement presentation cleanup

Measurement type remains explicit through textual `TOTAL`, `SHARE`, `PER CAPITA`, `DATE`, and related labels, but the old color encoding is removed. Badges now use one neutral style. Decorative measurement-color strokes are removed from gameplay, placement rows, optimal-allocation rows, and source/result surfaces.

The redundant category-card information icon is removed from normal gameplay cards.

## Results cleanup

The Scout / Adventurer / Expert Results switcher appears before Final Score. The optimal-reference section is labeled **Best Possible** rather than **Perfect Round**, avoiding the implication that a player achieved a perfect score when the section is actually showing the best allocation.

## Icon and copy corrections

The playable-category normalization layer adds semantic icon fixes for common mismatches such as vegetable oil, computer chips, protected waters, livestock, Hindu religion, volcanoes, and freshwater concepts. It also corrects known awkward player-facing copy such as computer-chip exports and freshwater-withdrawal language.

## Historical/date ranking policy

Historical chronology categories no longer need to satisfy the ordinary global top-winner prominence heuristic. This is intentionally narrow: DATE categories still must pass source validation, coverage, ranking-completeness, tie/distinctness, semantic, and gameplay-integrity requirements. Incomplete chronology that could alter an oldest/newest result remains blocked.

## Catalog deep-review targets

Migration `046_v16_2_5_ui_catalog_refinement.sql` records exactly **63** reviewed catalog targets:

- **33 promotion/reconsideration targets** whose old editorial blocker can be cleared while normal hard gates stay authoritative.
- **30 repair/re-source targets** that remain fail-closed until source, metadata, semantic, coverage, and ranking audits genuinely pass.

The promotion group includes stronger displacement, agriculture/water, livestock, Hindu-religion, geology, emissions/energy, biodiversity, health/infrastructure, business-density, international-student, and familiar commodity-export concepts identified during the full 1,346-row catalog review.

The repair group includes high-value concepts such as GDP per person, economic/population growth, inflation, life expectancy, health spending per person, exports share, services trade, rainfall, air freight, crude oil/natural gas production, migrant population, unemployment/working-poverty, selected historical milestones, World Heritage, water stress, education spending/STEM/vocational education, camel population, carbon intensity, and tourism measures.

The final playable count is deliberately **not** a quota. A target that cannot pass the strict shared gate remains non-playable.

## Source-policy correction

The previous promotion assessment contained a blanket source-level exclusion that prevented UNESCO UIS and U.S. EIA rows from ever recovering even after a clean re-import. v16.2.5 removes that provider-wide ban. Those sources are now evaluated row-by-row through the same official-source validation, credibility, semantic, ranking, coverage, clarity, and gameplay gates as other sources. This does not lower any row-level quality requirement.

## Category-family diversity

To ensure a larger catalog produces more variety rather than repetitive boards, the generator enforces one-per-board constraints for closely related knowledge clusters including forced displacement, livestock population, emissions, freshwater, tourism, energy systems, religious composition, and product-specific exports. Existing source/domain/trade/agriculture/similarity caps remain in force.

The seven-day Daily country-exposure preference from v16.2.4 is preserved.

## Catalog cleanup and admin audit

- The ambiguous **Largest protected share of land and sea** category is explicitly removed from gameplay.
- Cross-family similarity scoring is made more conservative to reduce the implausible repeated ~88% false positives seen in the Data Audit interface.
- Historical-source workflow/status language is updated for the current import path.
- Admin integrity/review information is clarified where practical without changing the hard gate.

## Compatibility

- v16.2.4 scoring is unchanged; `SCORING_VERSION` remains `placements-v16.2.4`.
- v16.2.3 stored legacy boards/scores retain their legacy dimensions/maxima.
- v16.2.4 and v16.2.5 scores share the same scoring era for all-time normalization.
- Passwordless account creation/sign-in, username onboarding, pending-score submission, Daily publication, and leaderboard architecture remain intact.

## Release automation

The committed `package-lock.json` is now part of the release tree and v16.2.5 workflows use `npm ci`. The obsolete v16.2.4 lock-generation workflow is removed. Verify, audited catalog recovery, and historical-finalization workflows are all version-guarded to v16.2.5.
## Recovery and Random-load hardening

Late release validation identified two operational bottlenecks that did not change gameplay rules but could prevent healthy production operation. v16.2.5 now:

- increases the mobile Country Bank height while shrinking unused Atlas-card interior space; desktop geometry is unchanged;
- cold-loads Random from only the playable runtime catalog, fetches observation rows in smaller chunks, caps concurrent observation reads, and installs a matching `(category_id, data_year, country_iso3)` index;
- reduces FAOSTAT category upsert batches from 400 to 25 rows;
- limits recovery/audit matrix concurrency to reduce Supabase contention;
- gives `record_category_validation` and `reconcile_category_playability_v15` explicit longer function-level statement timeouts plus targeted retries for PostgreSQL `57014` cancellations while preserving fail-closed validation;
- treats optional Comtrade/historical repair misses as partial recovery rather than failing the entire release before the independent audit/finalizer can decide playability; and
- wires `EIA_API_KEY` into recovery when configured, while cleanly skipping optional EIA repair/audit when it is absent so those candidates simply remain blocked.

These changes do not relax source, ranking, coverage, or gameplay gates.


- Category placement controls are row-aligned so adjacent `Select a country` boxes stay at the same vertical position even when titles/descriptions wrap differently.
