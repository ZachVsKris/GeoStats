# GeoStats v14.0.0 — Data Transparency & Expansion

## Player experience

- Added a **Source & all data** modal to result rankings and answer tooltips.
- The modal shows every country value used for the category, not merely the countries on the current board.
- Added search within the country-value table.
- Added direct-query, download, source-page, methodology, and license actions when available.
- Added plain-English descriptions beneath category titles, including mobile and expert layouts.
- Added explicit explanations for technical concepts such as maternal mortality, under-five mortality, labor-force participation, youth NEET, gross enrollment, incidence, and prevalence.

## Warehouse and governance

- Added full source-provenance fields, retrieval/version metadata, and reproducible-derivation metadata.
- Added verifiability, understandability, fun, objectivity, and player-quality fields.
- Added a fail-closed objective-only policy.
- Added description-quality checks that reject titles or subtitles that merely repeat technical jargon.
- Changed unseen-category handling from permanent automatic exclusion to a disabled, visible editorial-review queue.
- Extended duplicate arbitration so only categories passing every new player-quality gate can become preferred and playable.
- Updated admin bulk approval and individual review to enforce all v14 gates.

## Category expansion

- Added a broad World Bank WDI catalog importer, limited to 500 new candidates per default run and filtered against subjective/composite/index-style indicators.
- Expanded UN Comtrade to 55 player-facing product-export categories.
- Expanded Natural Earth to 24 reproducible vector-derived categories covering borders, neighbors, land pieces, geographic spans, coastlines, rivers, lakes, and glaciated areas.
- Added direct source-query and release metadata to UNHCR categories.
- Existing WHO, UNESCO UIS, ILOSTAT, FAOSTAT, EIA, and other source importers now emit the expanded v14 metadata schema and clear-description fallback.

## Natural Earth safeguards

- All calculations use named, versioned Natural Earth 1:10m layers and a versioned GeoStats derivation method.
- Coastline categories continue to be quarantined by the existing credibility policy because coastline rankings are resolution-sensitive.
- Reef rankings were deliberately not inferred from land polygons; assigning offshore reefs to countries requires maritime boundaries.
- Elevation, temperature, rainfall, biome, and terrain categories are not mislabeled as Natural Earth data.

## Compatibility

- v14 includes fallback queries for databases that have not yet received the v14 migration, but production deployment should apply `RUN_THIS_IN_SUPABASE_FOR_V14.sql` before importing.
- Existing v13.5 trust, random-seed, account, and leaderboard behavior is retained.
