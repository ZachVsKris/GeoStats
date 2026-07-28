# GeoStats v15.4.0 release notes

## Daily gameplay

- Enforces unique player-visible values for every country on a board; ties with countries outside the board remain allowed.
- Keeps the global winner requirement at top 30 rather than tying it to board size.
- Adds narrow strategy families, broad subject domains, and knowledge clusters.
- Allows at most one category from a knowledge cluster on a board, including one forced-displacement category maximum.
- Caps the full Daily trio at two displacement, three agriculture, and three trade categories.
- Requires at least two physical-geography categories across Scout, Adventurer, and Expert.
- Uses strict, balanced, and recovery profiles so source limits may relax without relaxing integrity, no-tie, or strategy-diversity rules.
- Adds an 18-second generation budget and bounded candidate searches.

## Catalog tiers

- `daily`: strongest coverage, clarity, reproducibility, freshness, and tie distribution.
- `random`: valid official categories that are less suitable for ranked Daily play.
- `quarantined`: unresolved integrity, source, clarity, freshness, subjectivity, duplication, or tie issues.
- The Category Review Workbench now shows Daily-ready and Random-only counts separately.

## Catalog review

- Reviews the full catalog, not only previously approved categories.
- Preserves explicit rejected and duplicate decisions.
- Treats harmless metadata/API warnings as non-blocking while retaining real value/ranking/country-set failures as blockers.
- Continues to exclude political, perception-based, happiness, confusing, esoteric, and vulnerable internet-use measures.
- Keeps modeled UNESCO completion and out-of-school measures out of circulation.
- Keeps ambiguous FAOSTAT aggregates and harvested-area variants out until specifically reviewed.

## Physical geography and wording

- Gives qualified Natural Earth coastline, borders, rivers, lakes, glaciated area, land-form, position, and span categories a path into Daily play.
- Requires multiple physical-geography categories across the Daily trio when the qualified catalog can support them.
- Cleans up titles including `Highest river density`, `Longest coastline`, `Most bordering countries`, `Longest river network`, and `Most refugees living abroad`.
- Normalizes UN Comtrade descriptions to plain English.

## Source panel

- Replaces the crowded header with a compact title, definition, and source-specification layout.
- Shows exact item/element/indicator codes, unit, year, flow, partner, layer, and map scale when available.
- Formats large currency and count values compactly while preserving exact values in the row tooltip.
- Warns when a general official portal may open a different default measure.

## Loading

- Reuses saved Daily trios and browser/CDN caches.
- Version-stamps Daily requests and browser cache keys so an old cached board cannot survive a rule upgrade.
- Keeps Daily generation server-side; the browser never loads hundreds of categories as a fallback.
- Loads common-year observations in bounded Supabase batches.
