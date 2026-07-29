# GeoStats v15.5 validation

Run locally or in GitHub Actions:

```bash
npm run test-v15
npm test
npm run test-importers
npm run test-player-links
npm run test-source-integrity
npm run build
```

The final command must pass in GitHub Actions and Vercel before running the Supabase migration.

Key v15.5 assertions:

- no active static yield or per-animal agricultural categories;
- FAOSTAT importer stages only Production or Production Quantity;
- SQL retires existing non-production FAOSTAT categories;
- compatible normalization policies are explicit;
- gross production value/GDP is not treated as a GDP share;
- duplicate/correlation review does not retire distinct concepts based on correlation alone;
- Daily constraints remain feasible in synthetic stress tests.
