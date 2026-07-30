# GeoStats v15.8.3 vetting-query correction

The v15.8 expansion imports completed, but the final automated-vetting step queried observations for the entire viable catalog in one large PostgREST request. It also fetched every historical year and relied on deep offset pagination before discarding non-common-year rows. Supabase canceled the statement at offset 73,000.

v15.8.3 changes the observation reader to:

- group categories by their selected common year;
- add the common-year filter to the database query;
- split category IDs into small request chunks;
- keep pagination shallow within each chunk; and
- recursively split a chunk when Supabase reports a statement timeout.

No database migration is required. The source imports that ran before the failure remain in Supabase. After committing this patch, run the separate **Vet expanded category catalog** workflow with source `expansion`. Rerunning the full import workflow is also safe but unnecessary.
