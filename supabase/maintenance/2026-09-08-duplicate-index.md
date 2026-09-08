# Observation index cleanup

Applied hosted migration `remove_duplicate_observation_lookup_index` on 2026-09-08.
Removed only `public.stat_observations_v144_lookup_idx`, a nonunique btree on
(category_id, country_iso3, data_year), identical in key order to the valid unique
primary key. It was not a constraint index or replica identity. A 2-second lock
timeout guarded the short transactional DROP. No observation or history rows were
modified by this migration.

Database bytes before: 816123027; after: 742714515. Index bytes: 73375744.
Post-check: removed index absent, 600723 actual observations, 414 enabled
categories, zero unsafe-enabled, zero safe-hidden. The earlier 601033 live-tuple
figure was a statistics estimate, not a before/after row count.

Rollback, if ever required: `CREATE INDEX CONCURRENTLY stat_observations_v144_lookup_idx ON public.stat_observations (category_id, country_iso3, data_year);`

This does not resolve the full quota overage. Retained data and audit backups were
not deleted. The organization usage page remains the authority for restriction
status; a retention decision or plan change may still be required.
