# GeoStats importer framework

Every source importer subclasses `WarehouseImporter` and implements four source-specific operations:

1. `discover()` resolves player-facing concepts against the source catalog.
2. `fetch_observations()` returns normalized country-year observations.
3. `category_id()` creates a stable source-specific identifier.
4. The shared framework scores quality, writes quarantine records, links canonical concepts, logs runs, and preserves human review decisions.

## Safety invariants

- Imports never auto-enable new categories.
- A rejected category remains rejected after refresh.
- An approved category remains approved only while it still passes the strict gate.
- Missing source observations stay missing and are never converted to zero.
- Only canonical UN-country ISO3 codes are stored.
- Each import is logged in `stat_import_runs`.

The first implementation is `scripts/import-who.py`. Future UNESCO, tourism, and geography importers should reuse this package rather than duplicating warehouse logic.
