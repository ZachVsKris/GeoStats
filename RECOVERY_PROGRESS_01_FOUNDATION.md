# GeoStats v16.2.6 Expansion Recovery — Checkpoint 01

Date: 2026-08-26
Branch: `v16.2.6-expansion-recovery`
Recovered baseline: `f724b67` (`GeoStats-v16.2.6-FINAL.zip`)

## Why this checkpoint exists

The complete handoff contains a 925-row expansion tracker, but the last surviving self-contained repository contains only the earlier 533-row implementation. The 392 rows added after that repository cannot be treated as implemented merely because their tracker status says so. This recovery branch reconstructs missing behavior against the actual source tree and preserves recoverable Git checkpoints as work proceeds.

## Verified baseline

Before recovery edits, the preserved v16.2.6 tracker/static/SQL/generator/importer test chain ran successfully through nearly the entire suite. The command was stopped by the execution timeout rather than an observed assertion failure. The repository ZIP does not include `node_modules`; a later `npx tsc --noEmit` therefore reports unresolved React/Next/Playwright/Supabase/Node packages and is not considered a valid TypeScript release gate until dependencies are restored.

## Implemented in checkpoint 01

### Explicit eligible universes

- Added category metadata for universal vs. defined-subset eligible universes.
- Added explicit eligible-country count/list, eligibility rule, within-universe coverage, and exclusion-reason fields.
- Added fail-closed importer validation for defined subsets.
- Defined-subset categories require at least 12 eligible countries; 12–15 require an explicit exception approval.
- Explicit eligible-country lists must agree with the declared count and common-year observations.
- Added SQL migration `048_v16_2_6_eligible_universe_recovery.sql` and appended it to the cumulative v16.2.6 installer.
- Universal legacy categories retain the existing 30-country promotion floor for backward compatibility; defined subsets are evaluated against their declared legitimate universe.

### Subset exposure balancing

- Added an eligible-universe band helper.
- Added a small, capped, non-quota generator boost for legitimate subset categories.
- The boost declines with recent exact-category exposure and does not override fail-closed playability gates.

### Historical-successor foundation

- Added a shared historical-successor registry for USSR, Yugoslavia, Czechoslovakia, East/West Germany, North/South Yemen, Tanganyika/Zanzibar, and pre-2011 Sudan.
- Default policy is `none`: no historical value is inherited by a successor unless a category explicitly opts into a supported mapping mode.
- Ambiguous historical states intentionally have no default primary successor.

### Recovery tests

`npm run test-v16-2-6-recovery` passes:

- eligible-universe validation fixtures
- historical-successor fixtures
- expansion-recovery static checks

## Still required before release

- Reconcile the authoritative 925-row tracker into the repository without losing the 392 post-FINAL rows.
- Reconstruct and test the 26 source-family ingestion layer represented by those rows.
- Replace mechanically inferred Understand / Interest / Uniqueness scores with genuine category review evidence.
- Run anti-proliferation and semantic-duplication review across the expanded catalog.
- Extend the deterministic propensity audit to the required difficulty/source/domain/family/universe/country metrics.
- Integrate explicit successor-policy metadata into relevant historical importers.
- Restore JS dependencies and run TypeScript/build/Playwright gates.
- Run required database/live-Supabase and production E2E gates before any package is called final.

This checkpoint is a recovery milestone, not a release certification.
