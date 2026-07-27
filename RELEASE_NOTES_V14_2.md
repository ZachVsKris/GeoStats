# GeoStats v14.2 — Source Integrity

## Data integrity

- Adds a universal end-to-end validation framework across World Bank, WHO, UNESCO UIS, ILOSTAT, Natural Earth, UN Comtrade, U.S. EIA, and UNHCR
- Adds a source-specific FAOSTAT QCL bulk-file validator
- Refetches official source snapshots independently from stored data
- Compares every country value in the selected common year
- Rejects regions, aggregates, unexpected territories, duplicates, and snapshots below the category coverage floor
- Recalculates competition rankings, including ties
- Checks source organization, dataset, indicator/item/element, official series name, unit, year, coverage, exact query identity, and source records
- Re-runs catalog concept selectors for WHO, UNESCO, and ILOSTAT so a wrong official series code cannot validate merely because its values imported consistently
- Checks FAOSTAT item/element/title/unit semantics, including yield versus total production
- Saves source and stored SHA-256 snapshot checksums
- Quarantines definite mismatches and categories that cannot be verified
- Separates import success from validation success
- Adds validation history and one-time fail-closed enforcement activation
- Removes bundled/static gameplay fallbacks: if the verified warehouse catalog is unavailable, GeoStats fails visibly instead of serving unverified data

## Player-facing source screen

- Keeps the simplified Data & Source view
- Shows only description, source, year, ranking lookup, and source-material link
- Uses the exact source query when available and the official bulk download otherwise
- Never labels a partial board snapshot as a global ranking
- Refuses to return an incomplete verified ranking

## Admin

- Adds Data Integrity overview, source-by-source counts, audit history, and quarantined-category reasons
- Links directly to the full GitHub source audit workflow

## Included v14.1 improvements

- Scout maximum two countries per continent; Adventurer and Expert maximum three
- Scout maximum one FAOSTAT category; Adventurer and Expert maximum two
- Every board winner must be in the strongest global half, capped at rank 50
- Soft familiarity scoring rather than a rigid famous-country quota
- First-party traffic, game, account, score, completion, and sharing analytics
- Resumable, quota-aware UN Comtrade imports
