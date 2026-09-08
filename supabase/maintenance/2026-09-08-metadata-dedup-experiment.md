# Observation metadata deduplication: local experiment, September 8, 2026

Status: promising read/storage prototype; **not production-ready or deployed**.

The experiment copied all 600,723 geography observations into local PGlite
0.3.14 (PostgreSQL 17.5, WebAssembly). It made no production schema, data,
application, or configuration changes. No paid Supabase branch was created.
The application baseline inspected was commit 4e618fa; production may advance
independently, so a future implementation must recheck the current code.

## Storage and fidelity

Twenty-five bounded production SELECTs exported only geography observations.
Every export was SHA-256 verified before loading. These are separate transactions,
not a single global snapshot. Each loaded row was then compared against the
reconstructed view using bidirectional EXCEPT ALL across every column.

- Rows: 600,723; mismatched or missing rows: **0**
- Distinct metadata records: 86,249; distinct non-null source URLs: 646
- Fresh original-layout table plus its five indexes: 379,420,672 bytes
- Compact observations plus all dictionaries and indexes: 255,901,696 bytes
- Net reduction: **123,518,976 bytes / 117.8 MiB / 32.6%**

This isolates deduplication from production's existing table/index bloat. Do not
add estimates blindly or treat the local byte count as a native-production
measurement. Repeated VACUUM reduced dictionary storage slightly between runs.
Production remained about 643.6 million bytes during this experiment.

The compact copy retains all ranking columns and all five original index key
orders. Metadata and URLs are stored in dictionaries with integer references.
Metadata equality is checked in addition to its fingerprint, preventing hash
collisions from merging different values. Foreign keys preserve referential
integrity; null source URLs reconstruct as null.

## Read performance

The compatibility view uses LEFT joins to dictionaries with unique primary keys.
For gameplay projections that omit metadata and source URLs, PostgreSQL removed
both joins in every tested plan. Tests reproduce the single-category lookup and
the first page of bulk category loading from lib/serverWarehouseCategoriesV16_2_7.ts.
They cover 47 cases sampled across the observation catalog, using latest stored
years. This is not a replay of every approved common year or every pagination offset.
All selected results were identical before and after.

| Run | Timed executions per layout | Original median / p95 | Compact median / p95 |
| --- | ---: | ---: | ---: |
| Initial | 376 | 0.182 / 1.188 ms | 0.172 / 1.433 ms |
| Follow-up | 1,410 | 0.156 / 0.895 ms | 0.153 / 0.863 ms |

Each case is warmed, then execution order alternates between layouts. The initial
p95 increase prompted the longer follow-up rather than being discarded. In the
follow-up, 4 of 47 per-case medians increased; the largest absolute increase was
0.016 ms (agLand, 0.325 to 0.341 ms). Results show no material regression in this
local workload, but do not establish zero slowdown under production traffic.
Absolute timings are local SQL execution time, not browser/API latency. This
single-session WebAssembly runtime cannot measure native Supabase concurrency,
PostgREST behavior, RLS costs, cold server caches, or migration impact.

## Confirmed compatibility blocker

The existing importer uses POST stat_observations?on_conflict=category_id,country_iso3,data_year
with merge-duplicates. Reproducing the corresponding INSERT ... ON CONFLICT
against this view fails with SQLSTATE 55000: cannot insert into view.
scripts/data_pipeline/supabase.py also reads full provenance fields during audits.
The prototype therefore must not replace the production table as-is.

A complete implementation would need an atomic, collision-safe write path,
importer integration, update/delete and rollback tests, and preservation of all
dependent views/functions, grants, RLS, and data-validation behavior. Renaming a
table alone does not rebind existing database dependencies to a new view.
Live rollout also needs a bounded migration plan that accounts for lock time,
temporary disk use and CPU/I/O load, followed by native staging load tests.

## Reproduce

Install @electric-sql/pglite@0.3.14 in a separate LAB_DIRECTORY with --save-exact
--ignore-scripts. Supply manifest.json and part-N.b64 geography exports as
documented by scripts/benchmark-metadata-dedup.mjs. Then run:

    node scripts/benchmark-metadata-dedup.mjs LAB_DIRECTORY

The export passphrase in the runner is a transport-compression mechanism, not a
secret or production credential. Dataset exports and local pgdata are excluded
from this branch. The SQL is intentionally under maintenance, not migrations.
The results JSON contains the full follow-up measurements and per-case timings.

Production verification after the read-only export: 600,723 observations;
catalog checksum 5ea1fef7f809d42c7b60bc2f924d0209; Daily trio HTTP 200,
78,567 response characters, server-timing daily;dur=87. That one request is a
health check, not a performance benchmark.

References: [PGlite API](https://pglite.dev/docs/api),
[PostgreSQL 17 view behavior](https://www.postgresql.org/docs/17/sql-createview.html).
