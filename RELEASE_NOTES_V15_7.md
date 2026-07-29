# GeoStats v15.7.0 release notes

## Clean integrated repository

v15.7 replaces the mixed v15.6.x tree with one internally consistent repository, database migration, verification file, rollback file, and release workflow.

## Catalog

- One approved catalog for Daily and Seeded
- `computed_playable_v15` is authoritative
- Removed stale `metadata.catalogTier` eligibility logic
- Removed Random-only from server, browser, Workbench, and editorial policy paths
- Restored CO₂ emissions per person as a distinct approved concept, subject to the normal hard integrity gate
- Added structured measure, normalization, strategy-family, and knowledge-cluster metadata
- Player wording no longer drives generator classification

## Generator and performance

- Loads the complete approved catalog
- Bulk-loads common-year observations with bounded Supabase requests
- Includes FAOSTAT and smaller sources instead of silently sampling them out
- Replaces greedy one-pass trio construction with bounded category backtracking, candidate-round pools, and joint trio selection
- Uses strict, balanced, recovery, and availability-first profiles
- Keeps data integrity, ties, top-30 winners, distinct winners, dimensions, semantic conflicts, and country-overlap rules hard
- Treats ideal source/domain/physical variety as preferences
- Adds five-minute server dataset caching
- Adds scheduled Daily pre-generation

## Persistence and security

- Stores immutable JSON board snapshots
- Preserves scored legacy modes independently
- Repairs only unscored modes
- Locks generation by date for both public and administrator paths
- Restricts public generation to the current New York date
- Requires administrator authentication for official board writes
- Uses the most recent valid Daily as an unranked fallback if current generation fails

## Seeded

- Seeded boards are generated on the server
- Same seed, difficulty, dataset version, and category-set version reproduce the same board
- Uses a fixed deterministic attempt budget instead of network-dependent browser loading

## Interface

- Dedicated complete board descriptions rather than full source definitions
- No board-description ellipses or line clamps
- Compact mobile menu, difficulty tabs, summary strip, country bank, loading state, and error state
- Workbench cards now show Playable and Approved but blocked
- Workbench can edit board descriptions

## Data integrity

The following physical categories are quarantined because the current warehouse contains zero observations:

- Northernmost country
- Southernmost country
- Longest combined land borders
- North–south span

They remain candidates for later importer repair rather than being silently used by the generator.
