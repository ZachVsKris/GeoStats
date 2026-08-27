GitHub SQL hotfix for GeoStats v16.2.6

Replace these three repository files with the versions in this folder:
- supabase/migrations/047_v16_2_6_full_release.sql
- RUN_THIS_IN_SUPABASE_FOR_V16_2_6.sql
- ROLLBACK_V16_2_6.sql

This fixes PostgreSQL view-column renaming average_score <-> average_percent.
