# GeoStats v14.4.0 — Start here

This is a complete repository, not a patch. Superseded release installers have been moved to `archive/legacy-releases`, so the root contains only the current operational files. The hidden `.github/workflows` folder is already included. A visible duplicate is also available at `GITHUB_ACTIONS/workflows` so you can inspect or manually copy workflows without showing hidden files in Finder.

## Deployment order

1. Back up Supabase.
2. Run `RUN_THIS_IN_SUPABASE_FOR_V14_4.sql` in Supabase SQL Editor.
3. Replace the GitHub repository with the contents of this complete repository and deploy through Vercel.
4. Run the **Audit all source integrity** GitHub Action with `source = all`.
5. Run the **Audit player source links** action. Exact links are preferred; safe general official pages remain playable. Both audits automatically reconcile the legacy playability booleans from the v14.4 computed policy.
6. Run `VERIFY_V14_4.sql` in Supabase. Every section marked “MUST return zero rows” should be empty.
7. Test `/daily`, `/daily/adventurer`, `/daily/expert`, and `/api/playable-categories`.
8. While signed in as an administrator, open `/api/admin/daily/capacity` to view exact raw category combinations and estimated rule-valid capacity by mode.

## Critical behavior changes

- Source-link quality is no longer allowed to silently disable trustworthy categories.
- Exact and general human-readable official pages are both accepted; APIs and downloads remain blocked.
- Scout, Adventurer, and Expert are generated and validated as one Daily package.
- Similar categories are prohibited across the full three-mode package.
- Every board winner must rank in the global top 30.
- Existing boards with saved scores are preserved rather than silently replaced.

## Validation record

See `BUILD_VALIDATION_V14_4.md` for completed checks and the production-build verification path. A visible copy of `.gitignore` is provided as `GITIGNORE_VISIBLE.txt`.
