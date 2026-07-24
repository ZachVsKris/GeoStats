# Validation

Completed before packaging:

- FAOSTAT importer smoke test
- Shared data-pipeline tests
- WHO importer tests
- UNESCO UIS importer tests
- ILOSTAT importer tests
- Natural Earth importer tests
- GeoStats game invariant tests, including Scout as the default route
- TypeScript and TSX syntax transpilation across the repository
- YAML parsing for all six GitHub workflow files

A full `next build` was not completed in the packaging environment because dependency installation timed out. The underlying v12.1.1 application had previously deployed, and the v13.2 changes were syntax-checked and covered by the invariant tests.
