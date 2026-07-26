# GeoStats v14.0.1

GeoStats is a strategy geography game built with Next.js and Supabase. v14 adds exact-value source snapshots, plain-language category descriptions, objective-only governance, and broad candidate imports. v14.0.1 repairs the expansion workflow so a partial or skipped import can no longer look successful.

## What v14.0.1 fixes

- Adds one **Repair and expand v14 imports** GitHub Action
- Imports all **24 Natural Earth** vector-derived candidates and fails if any are missed
- Scans past stale World Bank indicators until it reaches a target number of usable new candidates
- Restricts World Bank discovery to the official WDI catalog (`source=2`)
- Imports all **55 UN Comtrade** candidates when `COMTRADE_API_KEY` is configured and fails on partial completion
- Records attempted, successful, failed, and target-reached counts in `stat_import_runs`
- Adds `public.v14_import_health` for exact post-run diagnostics
- Verifies that new candidates actually reach `curation_status='pending'` and remain disabled

The existing 498 non-playable categories are not automatically “missing from review.” Most were already explicitly approved, excluded, superseded, quarantined, or rejected in the earlier curation releases. A zero pending count after the v14 migration means that no new v14 candidate import completed.

Start with [`START_HERE_V14.md`](START_HERE_V14.md).
