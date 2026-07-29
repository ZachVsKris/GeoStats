# GeoStats importer framework

Every source importer subclasses `WarehouseImporter` and implements four source-specific operations:

1. `discover()` resolves player-facing concepts against the source catalog.
2. `fetch_observations()` returns normalized country-year observations.
3. `category_id()` creates a stable source-specific identifier.
4. The shared framework scores numerical quality, applies documented provenance policy, writes canonical country names, arbitrates duplicate concepts, links canonical concepts, and logs every import.

## Automatic governance

A category is playable only when all three gates pass:

- **Numerical quality:** coverage, freshness, common-year comparability, clustering, stability, and evidence flags.
- **Provenance:** a documented international, administrative, survey, modeled, or geospatial methodology with independent validation. Unsupported assertions supplied by political leadership do not qualify.
- **Uniqueness:** only the preferred category in a concept group can remain enabled. Direct authoritative sources outrank republished versions, then quality, coverage, and freshness break ties.

## Safety invariants

- Unknown or unclassified provenance fails closed.
- A manually rejected category remains rejected after refresh.
- A previously approved category is disabled if it later fails quality, provenance, or duplicate arbitration.
- Missing source observations stay missing and are never converted to zero.
- Canonical country display names are forced from ISO3 codes; original source labels remain in observation metadata.
- Each import is logged in `stat_import_runs`.

The Admin page is an audit dashboard. It shows why a category was approved, quarantined, or superseded; routine approval clicks are no longer required.
