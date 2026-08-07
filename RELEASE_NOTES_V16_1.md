# GeoStats v16.1 corrective release

GeoStats v16.1 is a corrective release focused on category meaning, source fidelity, Daily reliability, loading speed, and mobile presentation. It does not add another broad source expansion.

## Catalog-wide audit

The release creates `category_semantic_audit_v16_1` and `category_full_audit_v16_1`. Every catalog category receives a database-generated audit row containing:

- player title, description, unit, value type, direction, source, dataset, and exact source code;
- the selected comparison year, observation count, distinct-value count, minimum and maximum;
- the twelve highest and twelve lowest stored results;
- ranking-completeness status and top-value feasibility;
- substantive source-validation failures;
- title/unit/result-logic findings;
- a final automated audit state: pass, rewrite required, data repair required, review required, or excluded.

Only categories with an editorial approval, required source/ranking gates, and semantic audit status `pass` can be loaded into gameplay. The GitHub import workflow exports one CSV row per database category for continued human review. The automated audit is a first-pass governance screen; it does not claim that a person manually verified all 1,337 categories.

## Known data and copy repairs

- Replaces the incorrect WHO clean-cooking population-count series with `PHE_HHAIR_PROP_POP_CLEAN_FUELS` and enforces 0–100 percentage bounds.
- Rejects the former clean-cooking category that used a population count in millions while displaying a percentage.
- Renames and clarifies statelessness as a residence-based UNHCR measure.
- Uses natural Food Balance wording such as “Highest estimated rice consumption per person,” while explaining that it is a national food-balance estimate rather than measured household intake.
- Corrects poultry meat, spice, forest-area, and protected-area titles and descriptions.
- Uses a neutral spice icon rather than implying that the category covers peppers only.
- Keeps FAOSTAT yield, harvested-area, slaughter, carcass-yield, and other nonproduction elements out of production categories.
- Blocks categories with substantive existing value, coverage, duplicate, or ranking-validation failures.

## Daily generator

- Expands each mode’s retained candidate pool from 14 to 96.
- Generates a larger raw set and retains candidates based on score plus cumulative category/country diversity.
- Accumulates compatible candidates across generation profiles instead of discarding each profile’s alternatives.
- Searches a substantially larger trio-combination space and backtracks across Scout, Adventurer, and Expert.
- Preserves scored/fixed modes while giving unscored generation a much broader compatibility search.
- Recursively splits failed observation batches so one malformed category cannot remove an entire 80-category batch from generation.

The diversity rules remain in force: category reuse, country overlap, forced-displacement limits, and family limits are not relaxed.

## Loading and browser behavior

- Deduplicates concurrent Daily requests in the browser.
- Uses saved board payloads before any catalog reconstruction.
- Caches complete Daily trios by date and dataset version.
- Gives emergency fallback boards only a short cache life so a newly published Daily replaces them quickly.
- Preserves unsigned completed Daily results locally across refreshes.

## Mobile and player-facing polish

- Keeps the no-scroll mobile assignment board.
- Reserves enough width to display the full 24-character Random seed.
- Rebalances seed controls, tabs, card padding, typography, and disabled-button contrast.
- Replaces oversized corner “i” characters with consistent SVG information controls.
- Changes board-ranking headers to “Among these N countries” to avoid implying a global rank.
- Adds responsive regression coverage for full-seed visibility and information controls.

## Supabase finalization

The canonical v16.1 installer includes the v16.0 hotfixes:

- protected `DELETE` statements include an explicit `WHERE` clause;
- ranking, semantic-audit, runtime-refresh, and finalization functions have a 180-second function-specific timeout;
- finalization uses an advisory transaction lock.
