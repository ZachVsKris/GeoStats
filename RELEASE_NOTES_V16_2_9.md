# GeoStats v16.2.9 release notes

## Public all-time standings

- The leaderboard is readable without an account and no longer has a Daily view
- Scout, Adventurer, and Expert remain separate
- Columns are Rank, Player, Average score, Rating, and Completed games
- Historical v16.2.4-and-later scores are normalized to the current mode scale; board-relative rating remains the ranking measure
- Signed-in players are highlighted, while private user IDs and emails never leave the server

## Account conversion and authentication

- Google is the primary sign-in action; passwordless email remains available as a fallback
- Account copy consistently says that sign-in is needed to appear in standings, save verified scores, and play Expert—not to read the leaderboard
- Branded token-hash email callbacks avoid the browser-local PKCE verifier mismatch that can occur when an email link opens in another browser context

## Daily-board variety

- Exact and semantic category conflicts are rejected across the complete same-day Scout, Adventurer, and Expert trio
- The protection also applies within an individual board through the shared category-admission rules
- This blocks pairs such as total glaciated area and glaciated land share from appearing on the same date

## Catalog and bounded expansion

- “Highest transport services as % of service exports” is a durable owner-directed exclusion at the importer and database boundaries
- A completed, reproducible 195-country Köppen-Geiger feasibility run cleared 11 climate-geography measures
- A manual production workflow re-proves, imports, independently audits, atomically promotes, and reachability-tests exactly those eleven measures
- History, culture, demographic, and infrastructure/technology/science passes are recorded as finite no-go outcomes below ten new additions; unchanged failed sources must not be searched repeatedly

## Quality and launch safety

- Admin catalog paging uses the indexed category ID and sorts after retrieval, avoiding the production statement timeout caused by ordering the deeply joined review view by title
- Versioned cache, rules, data, and player-copy identifiers advance to v16.2.9
- The production build, TypeScript, static release checks, and focused generator/importer checks are required before publication
- Production database changes, the climate import, the permanent Google OAuth credential, main-branch merge, and `geostats.xyz` deployment remain explicit owner approval gates
