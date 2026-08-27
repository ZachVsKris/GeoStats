# GeoStats v16.2.6 build validation record

**Release state:** source repository finalized for activation gating.

## Locally passed release checks

The final reconstructed source tree was validated with the repository's fail-closed v16.2.6 checks. Passing checks include:

- 533-row × 47-field master tracker reconciliation with zero blank fields, duplicate IDs, or pending dispositions
- 32-workstream release ledger with zero pending statuses/evidence gaps
- 16-source-family common-year/reference-period policy audit
- committed deterministic 1,000-day structural category-propensity comparison (14,000 category slots/version)
- v16.2.6 static, SQL, generator-policy, and legacy production-generator regressions
- generic data pipeline + World Bank, WHO, ILOSTAT, Natural Earth, Comtrade, EIA, UNHCR, FAOSTAT, Pew religion, Smithsonian volcano, USGS earthquake, and historical importer fixtures
- UN WPP, World Bank climate, IMF WEO, Natural Earth capitals, NOAA tsunami, UNESCO ICH, AQUASTAT, FAO Fisheries, USGS Minerals, WHO GHED, UN DESA migrant stock, WTO services, direct UN Tourism, and official-bulk reader fixtures
- complete post-FINAL source-family recovery audit: 392/392 tracker rows accounted across 26 mapped families, with 387 executable importer concepts, 5 explicit source-identity blockers, and zero unexplained missing rows
- Global Findex 2025, FAO FRA 2025, UNICEF Data Warehouse, UNDP HDR/MPI, V-Dem v16, FAOSTAT Food Security/Healthy Diet, Köppen-Geiger, World Bank Infrastructure, FAOSTAT Land Use, FAOSTAT/ESA WorldCover, WBL 2026, and JMP WASH importer fixtures
- complete first-principles re-audit of all 791 durable legacy rejections: 744 reasoned exclusions and 47 legacy-only veto clearances, with no unresolved `requires_reaudit` rows
- Python compilation across `scripts/`
- parsing of all GitHub workflow YAML files
- `git diff --check`

The structural propensity artifact completed 1,000 days for both versions with zero structural failures. Every constituent command in `npm run test-v16-2-6` has passed independently in the final build environment; the monolithic chained command itself exceeds the fixed tool execution window before completion, so certification is recorded constituent-by-constituent rather than treating a timeout as a product failure. In the final deterministic run, v16.2.6 reduced top-10 concentration and <=3-day exact-category repeats relative to the preserved v16.2.5 policy simulation while maintaining full simulated catalog reach.

## Fresh dependency-backed checks that require CI/deployment

This execution environment does not contain the repository's `node_modules` and cannot reach npm to install the exact lockfile dependencies. A global `tsc` invocation therefore fails at module/type resolution (React, Next, Supabase, Playwright, Node types) before it can serve as a clean dependency-backed application typecheck. This is an **environment gate**, not recorded as a passing check.

The following remain mandatory activation gates and are enforced by the repository/installation instructions:

1. `npm ci --include=dev --no-audit --no-fund`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test-e2e`, including the four required phone viewports
5. apply the additive v16.2.6 Supabase migration and source imports
6. run `VERIFY_V16_2_6.sql` with no blocker rows
7. production auth/email configuration and external sign-in test
8. production Daily/leaderboard/analytics/source-link/rollback smoke tests

No release document should interpret an unexecuted activation gate as passed.

## Key final reconciliation decisions

- `GeoStats-main (22)(2).zip` remains the preserved last-complete v16.2.5 safety baseline.
- New v16.2.6 source IDs have runtime routing, source registry entries, governance metadata, and trust profiles.
- Previously rejected concepts are not revived through the same failed source path without explicit repair evidence.
- WPP tracker rows are mapped by concept/title to their actual importer indicators rather than by candidate-number offset.
- Natural Earth bordering-country count and coastline are reconciled to actual importers; feature-count river/lake/glacier concepts remain review-only where Natural Earth is not exhaustive.
- Coastline is allowed only as a fixed Natural Earth 1:10m scale-dependent geospatial estimate with an explicit caution label.
- Oldest current constitution and earliest universal women's suffrage are wired to Constitute/IPU fail-closed import paths and the release workflow.
- Scoring remains `placements-v16.2.4`; settled Scout/Adventurer/Expert geometry is unchanged.
