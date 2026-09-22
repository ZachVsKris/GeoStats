# Observation table compaction — 2026-09-22

## Purpose

Reduce Supabase database storage without removing observations, changing the game schema, slowing normal reads, or changing importer behavior.

## Safety controls

- Archived the original 600,723-row observation table before the operation in `GeoStats_Observations_Before_Compaction_2026-09-08.zip` (SHA-256 `e87b5033a495f2f0bd724fcea82e722ae32f6f4eb2017ecd5857cba18cb65326`).
- Copied into an isolated table while a trigger mirrored inserts, updates, key changes, and deletes.
- Compared every primary key in both directions: zero missing and zero extra rows.
- Compared every non-key column with a primary-key join: zero mismatched rows.
- Built all five production indexes before cutover.
- Used a bounded, metadata-only cutover that aborts on an occupied table, incoming foreign key, publication membership, or undiscovered dependency.
- Tested the full prepare, mirror, index, safe-abort, cutover, RLS, upsert, view-rebinding, cascade, and index path on isolated PostgreSQL 17.

## Verified result

| Measure | Before | After | Change |
| --- | ---: | ---: | ---: |
| Observation rows | 600,723 | 600,723 | 0 |
| Observation table and indexes | 435,691,520 bytes | 379,265,024 bytes | -56,426,496 bytes (-12.9%) |
| Database after prior online index rebuild | 534,973,587 bytes | 479,571,091 bytes | -55,402,496 bytes (-10.4%) |
| Production indexes | 5 | 5 | 0 |
| Latest-value view rows | 50,964 | 50,964 | 0 |
| Integrity view rows | 1 | 1 | 0 |

The temporary staging copy raised the database to 915,262,611 bytes immediately before cutover. Removing the old physical table and maintenance schema returned it to 479,571,091 bytes.

## Compatibility checks

- Existing `INSERT ... ON CONFLICT DO UPDATE` behavior succeeded inside a rolled-back production transaction.
- The canonical country-name trigger is present.
- Row-level security and the enabled-category read policy are present.
- Anonymous delete permissions remain filtered by RLS; the production check deleted zero rows.
- `stat_latest_values` and `stat_observation_integrity_v144` remained bound and queryable.
- The Daily API returned HTTP 200 after cutover with all three modes and `daily;dur=23` server timing.

## Files

- `prepare-observation-compaction.sql` creates the isolated copy and write mirror.
- `index-observation-compaction.sql` builds the production index set after copying.
- `finish-observation-compaction.sql` performs the guarded cutover and removes staging objects.
- `scripts/test-observation-compaction.mjs` exercises the full process on isolated PostgreSQL 17.
