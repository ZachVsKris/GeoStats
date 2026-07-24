# GeoStats v13.0 release notes

## Included

- Reusable Python warehouse importer framework
- WHO Global Health Observatory importer with 55 curated concepts
- Canonical category/source tables and source-priority selection
- WHO, FAOSTAT, and all-source GitHub workflows
- Fixed FAOSTAT workflow link
- Bulk approval, rejection, and reset actions
- Coverage filtering and quality/coverage/year/title sorting
- Recognition and specificity fields in Admin
- Paginated Admin category loading beyond 1,000 rows
- Review-decision preservation across WHO refreshes
- Current GitHub action runtimes (`checkout@v7`, `setup-python@v7`)

## Tested in the build environment

- Generic quality and editorial-state tests
- WHO matching/normalization unit tests
- Python compilation
- TypeScript strict syntax/type pass for every replaced Admin/API file against project-compatible stubs
- GitHub workflow YAML parsing

## Requires live verification after upload

- Supabase migration execution against the production project
- WHO API import using the repository secrets
- Full Vercel build against the complete repository

The ZIP is an overlay, not a standalone copy of GeoStats.
