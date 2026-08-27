# GeoStats v16.2.6 final build status

**Build date:** 2026-08-27 PT  
**Scope:** final offline/source build and release-gate reconciliation  
**Production activation:** intentionally fail-closed until dependency-backed CI and production Supabase/auth checks pass

## Completed build scope

- Master category ledger: **533 rows × 47 fields**, zero blank required fields, duplicate tracker IDs, or pending dispositions.
- Release ledger: **32 workstreams**, zero pending statuses/evidence gaps.
- Expanded-evidence research ledger: **925 rows** with source-family recovery retained separately from the compact final master tracker.
- Post-FINAL source-family recovery: **392/392 rows accounted across 26 mapped source families**.
  - 387 executable fail-closed importer concepts.
  - 5 explicit source-identity blockers.
  - 0 unexplained missing recovery rows.
- Durable historical rejection review: **791/791 rows resolved**.
  - 744 reasoned exclusions.
  - 47 legacy-only veto clearances.
  - 0 unresolved `requires_reaudit` rows.
- Generator structural regression artifact: 1,000 simulated days for baseline and v16.2.6.
  - Catalog reach: 100% in both simulations.
  - Top-10 exposure share: 7.957% -> 4.393%.
  - Top-25 exposure share: 16.329% -> 10.557%.
  - Exact-category repeats within <=3 days: 2,136 -> 242.
- Scoring remains `placements-v16.2.4`; v16.2.6 changes catalog/generation rules without rewriting historical scored games.

## Final offline test result

Every constituent gate invoked by `npm run test-v16-2-6` passed independently in this build environment, including tracker/common-year reconciliation, propensity, recovery/static/SQL/generator regressions, historical compatibility, source-integrity fixtures, all mature importers, all reconstructed importers, the 791-row legacy guard/re-audit, and the 392-row source-family recovery audit.

The single chained `npm run test-v16-2-6` command exceeds the fixed execution window in this tool environment before all subprocesses can print completion; this timeout is not treated as a passing test, nor as a product failure. Constituent-pass evidence is the certification basis here.

Additional checks passed:

- Python compilation across `scripts/`.
- GitHub workflow YAML parsing.
- Player source-link policy fixtures.
- `git diff --check`.

## Activation checks not claimable in this environment

This container has no repository `node_modules`, its shell cannot resolve `registry.npmjs.org`, and the exact lockfile dependencies therefore cannot be installed here. The following remain mandatory and are already wired into the repository verification/deployment workflow:

1. `npm ci --include=dev --no-audit --no-fund`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test-e2e` including required phone viewports
5. apply the additive v16.2.6 Supabase migrations/imports in the target environment
6. run `VERIFY_V16_2_6.sql` with no blocker rows
7. production auth/email/external-sign-in verification
8. production Daily, leaderboard, analytics, source-link and rollback smoke tests

No source-family candidate becomes playable merely because an importer exists. Activation continues to require source identity, provenance, common-year/reference-period policy, canonical-country coverage, comparable units/denominators/currency basis, tie/ranking safety, player quality, board feasibility, editorial approval and the runtime release verifier.

## Key final artifacts

- `V16_2_6_MASTER_TRACKER.csv`
- `V16_2_6_MASTER_TRACKER_EXPANDED_EVIDENCE.csv`
- `V16_2_6_RELEASE_TRACKER.csv`
- `audits/v16-2-6-legacy-rejections/FULL_791_FIRST_PRINCIPLES_REAUDIT.csv`
- `supabase/migrations/051_v16_2_6_full_791_legacy_reaudit.sql`
- `RUN_THIS_IN_SUPABASE_FOR_V16_2_6.sql`
- `VERIFY_V16_2_6.sql`
- `ROLLBACK_V16_2_6.sql`
- `BUILD_VALIDATION_V16_2_6.md`
- `RELEASE_NOTES_V16_2_6.md`
