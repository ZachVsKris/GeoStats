# Verified obsolete backup cleanup — September 8, 2026

Removed 32 obsolete public backup tables after verifying no live database dependencies, foreign keys, function references, user triggers, policies, or application gameplay references. Old rollback scripts can still reference these historical backups; restore the archive before running such scripts.

Archive: GeoStats_Legacy_Backups_2026-09-08.zip (user-held, 15,036,048 bytes)
SHA-256: 9a786d75d1434f4689fb9f36daa7b1c11e50fd170e4e231bdd847e6a5cd627f6
Archive includes 38,969 rows, full JSON exports, column definitions, constraints, indexes, grants, RLS state, checksums and restore.sql.
Every exported payload matched its source SHA-256. A representative restore into a temporary table reproduced 1,285 rows exactly; that transaction was rolled back.

Applied migration: archive_verified_obsolete_backup_tables.
The transaction locked only obsolete backup tables with NOWAIT, verified all 32 source payload hashes against the archive, and used DROP TABLE RESTRICT. No CASCADE, active-index change, observation deletion, or gameplay-query change was performed.

Before: 741,936,275 database bytes.
After: 643,583,123 database bytes.
Reclaimed: 98,353,152 bytes (about 93.8 MiB).
The database remains above the free allowance.

Verified unchanged:
- 600,723 observations.
- 44 saved scores.
- Catalog ID/enabled checksum: 5ea1fef7f809d42c7b60bc2f924d0209.
- Daily date/difficulty/board-hash checksum: 56d50356fa38cb864eca1c3aa1c512c5.
- Public Daily endpoint returned HTTP 200; server timing 92 ms on the post-change check. This is a spot check, not an end-to-end performance benchmark.

Removed tables:
- v15_2_review_state_backup
- v15_3_category_backup
- v15_3_review_state_backup
- v15_4_category_backup
- v15_4_review_state_backup
- v15_5_category_backup
- v15_5_review_state_backup
- v15_6_1_category_backup
- v15_6_2_category_backup
- v15_6_2_editorial_backup
- v15_6_2_review_state_backup
- v15_6_category_backup
- v15_6_source_backup
- v15_7_category_backup
- v15_7_editorial_backup
- v15_7_review_state_backup
- v15_8_category_backup
- v15_8_editorial_backup
- v15_8_review_backup
- v15_8_source_backup
- v15_9_1_category_backup
- v15_9_1_review_backup
- v15_9_category_backup
- v15_9_review_backup
- v15_category_state_backup
- v16_1_category_backup
- v16_1_review_backup
- v16_2_6_category_state_backup
- v16_2_category_backup
- v16_2_review_backup
- v16_category_backup
- v16_review_backup

Further storage reduction was not attempted because the remaining candidates need additional dependency and performance validation.
