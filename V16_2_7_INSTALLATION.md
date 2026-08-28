# GeoStats v16.2.7 installation

1. Replace the repository files from the supplied v16.2.7 build.
2. In Supabase SQL Editor, run `RUN_THIS_IN_SUPABASE_FOR_V16_2_7.sql` once after all prior migrations through v16.2.6 are installed.
3. Push the repository to GitHub.
4. Run **Rebuild v16.2.7 catalog, diversity, and reachability** in GitHub Actions (`.github/workflows/rebuild-v16-2-7.yml`).
5. For official bulk-only families, supply the corresponding official URL input. FIFA and IOC categories stay fail-closed if their official inputs are not supplied.
6. The workflow independently re-audits each imported source, stages strict-pass candidates without making them live, runs forced-category and Random/Daily reachability/exposure proof, and only then atomically publishes the shared Daily/Random catalog after `assert_v16_2_7_release()` passes.
7. Run `VERIFY_V16_2_7.sql` in Supabase. `assert_v16_2_7_release()` must succeed before considering the release complete.

A staged candidate is not player-visible: production catalog and direct warehouse loaders require `computed_playable_v16_2=true`, `enabled=true`, and `eligible_daily=true`. Publication is deliberately the last guarded step.

## Hard release gates

- at least 500 playable categories
- at least 12 history categories
- both FIFA and IOC sports chronology categories represented
- at least 15 culture/language/religion categories
- at least 20 physical-geography + geology/natural-hazard categories
- economy + trade + food/agriculture no more than 60% of playable catalog
- every playable category reachable in Scout, Adventurer, and Expert
- every generated category's best displayed country globally Top 20
- no exact duplicate playable titles

Do not use `ROLLBACK_V16_2_7.sql` as a normal catalog-editing tool. It is a conservative emergency rollback that disables the new sports categories and clears reachability proof without mass-reverting editorial decisions.
