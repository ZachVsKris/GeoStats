# GeoStats v16.2.3

## Reliability

- Fixes the v16.2.2 Supabase installer syntax error caused by the unescaped apostrophe in `Project's`.
- Adds a regression check for the corrected SQL literal and keeps a cumulative clean-install script.
- Reasserts `publish_daily_trio_v16(date,jsonb)`, `service_role` execution, and pgcrypto/digest schema visibility.
- Adds `VERIFY_V16_2_3.sql` and `ROLLBACK_V16_2_3.sql`.

## Catalog status cleanup

v16.2.2 resolved 307 backlog rows but flattened many repairable categories into generic rejection. v16.2.3 preserves the real disposition:

- 168 intentionally rejected
- 90 need a copy/semantic rewrite
- 36 require substantive data repair
- 7 require focused manual/source review
- 1 is explicitly marked duplicate
- 5 remain approved

These distinctions are visible through the Admin Workbench release-disposition fields. Broad but unresolved concepts such as coal exports and coastline-for-area are preserved for review rather than discarded; the non-comparable local-currency military-spending row is explicitly classified as a duplicate alternative to the existing comparable category. None of the repair/rewrite/manual-review rows become playable until the normal source, semantic, ranking, and gameplay gates pass.

## Faster Random

- Caches the complete serializable playable warehouse snapshot through Next's persistent data cache, versioned to the dataset/category set.
- Keeps the canonicalized generator representation warm for one hour per process, matching the persistent snapshot revalidation window so post-finalization catalog changes cannot stay stale for long.
- Makes deterministic `seed + difficulty + catalog version` responses CDN/browser cacheable.
- Adds `Server-Timing` plus catalog-load, generation, and total timing measurements.
- Retains the deterministic 60-attempt search rather than weakening quality rules merely for speed.

## Faster Daily

- Daily pages load the already-published board on the server and pass it with the initial page instead of waiting for hydration and then starting an API request.
- The complete published trio is persisted in a versioned Next data cache and still receives long-lived CDN caching.
- Successful publication invalidates the Daily cache; scheduled/admin generation warms today's payload again immediately.
- All three difficulties are carried together, so later difficulty switching can use the browser cache without another board request.
- The public Daily endpoint now reports server timing.

## Mobile gameplay

- Keeps the v16.2.2 no-page-scroll/two-country-row regression coverage.
- Removes final handset CSS rules that clipped category descriptions to one or two lines.
- Shortens board-description copy to complete compact sentences instead of hiding wording with ellipses.
- Keeps the subtle total/share/per-capita/historical-date measurement treatment.

## Historical expansion

Historical categories remain first-class `historical_date` measures. v16.2.3 intentionally adds only broad milestones a normal geography/history player can reason about:

- Most recently admitted to the UN
- Oldest current constitution (replaces the inverse newest-constitution gameplay category)
- Most recently became independent — IPU's explicit post-1940 independence field
- Earliest universal women's suffrage — earliest national IPU milestone explicitly marked universal rather than restricted

The release does **not** add World Heritage, Ramsar, biosphere, parliamentary-office, or other niche milestone categories. Broader ideas such as first World Cup/Olympic appearance, flag adoption, capital changes, first satellite, republic dates, slavery abolition, and currency age remain research candidates until a consistent authoritative global source is available.

## Repository/CI cleanup

- Removes the obsolete manually runnable v16.2.1 Comtrade repair/finalization workflow.
- Renames the partial `Import all source data` workflow to `Import core source data`.
- Updates recovery/history/verification workflows for v16.2.3 and adds IPU to import and audit matrices.
- Removes `tsconfig.tsbuildinfo` from the release.
- Next.js is pinned to 16.2.11, the July 2026 Active LTS security release that patches the known vulnerabilities affecting earlier 16.2.x builds.

## Dependency-lock note

This source package still does not contain a generated `package-lock.json`. The build environment used to assemble the release could not resolve required packages from its internal npm mirror (including the pinned `@playwright/test@1.55.0` and `@supabase/ssr@0.12.3`), while direct public-registry access timed out, so a trustworthy lockfile could not be generated here. CI therefore retains `npm install` rather than being switched to a broken `npm ci` configuration. Generate and commit the lockfile from a normal npm registry environment before making dependency-locking a release gate.

## Installer view-layout hotfix

- The v16.2.2 measurement-type migration now drops and recreates `category_review_workbench_v16_2` after `category_runtime_review_v16_2` gains `measurement_type`. PostgreSQL cannot use `CREATE OR REPLACE VIEW` when `runtime.*` inserts a new column ahead of existing Workbench columns; the explicit recreation prevents error `42P16` (`auto_vetting_recommendation` → `measurement_type`).
- `scripts/test-v16-2-3-static.cjs` now guards this exact view-layout migration requirement.
