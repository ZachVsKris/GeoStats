# GeoStats v14.4 validation

Run locally after dependencies are installed:

```bash
npm run check-v14-4
```

This executes v14.4 integration assertions, repository verification, invariant tests, TypeScript/TSX syntax checks, and a production Next.js build.

The repository also includes `.github/workflows/verify-v14-4.yml`, which runs the checks and production build on GitHub. Importer unit tests can be run separately with:

```bash
npm run test-importers
```

Database validation is in `VERIFY_V14_4.sql`.
