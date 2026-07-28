# GeoStats v15.2 audit report

## Catalog finding

The 76-category count was not caused by one single mass rejection. The repository contains a large body of deliberate prior curation exclusions, including near-duplicates, harvested-area variants, obscure aggregate commodities, exact complements, and technical measures. Those should remain excluded.

The major recoverable problem was narrower:

- approved FAOSTAT categories were blocked because `player_source_status = needs_exact_url`
- source-link precision was included in the hard playability predicate
- v15.0 also promoted some mechanically inherited legacy `blocked` states into permanent editorial rejection

## v15.2 policy

Hard blockers remain:

- explicit editorial rejection or duplicate status
- political/self-reported, subjective/composite, confusing, esoteric, stale, or poor-coverage flags
- direct value mismatches
- ranking mismatches
- missing/extra country-set integrity failures
- low quality or quarantined credibility
- fewer than 30 comparable countries
- data older than the category's accepted minimum

Warnings that no longer block play:

- exact source deep link unavailable
- general official portal used instead
- metadata wording drift
- transient API or source-retrieval failure
- verification pending without a direct value/ranking/country-set failure

## Recovery behavior

The migration uses `v15_category_state_backup` to restore only rejected rows whose pre-v15 state shows no deliberate curation or content exclusion. Rows explicitly excluded by prior catalog/content review stay rejected.

The expected immediate result is materially more than 76 playable categories, largely by restoring already-approved FAOSTAT categories. The exact count cannot be guaranteed without running the migration against the live database because true integrity, year, coverage, and credibility gates remain active.

## Repository audit

Passed locally:

- v15.2 integration checks
- game invariants
- TypeScript/TSX syntax transpilation for 80 files
- importer fixture tests
- player-source policy fixtures
- source-integrity fixtures
- YAML parsing for every active workflow

A full `next build` could not be completed locally because dependency installation timed out. Vercel and the `Verify GeoStats v15` workflow remain the final production build checks.
