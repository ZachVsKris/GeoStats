# GeoStats v16.2.8 validation

## Automated release gate

Require GitHub **Verify GeoStats v16.2.8** to pass before treating a commit as published. The workflow runs the catalog and importer regressions, TypeScript, the production build, and Playwright across Chromium, Firefox, and WebKit profiles.

## Product invariants

- Scout: 4 countries, 4 categories, maximum 400 points
- Adventurer: 6 countries, 4 categories, maximum 400 points
- Expert: 8 countries, 6 categories, maximum 600 points
- Guests can play Scout and Adventurer
- Guests can preview but cannot play Expert
- Only signed-in accounts can read leaderboard data
- Signed-in Daily scores save automatically; there is no manual standings submission
- Leaderboards expose separate Scout, Adventurer, and Expert Today/All-time standings only after authentication
- Internal Random QA is inaccessible and undiscoverable to public users

## Catalog invariants

- The production playable catalog contains 316 reviewed categories at this release boundary
- Play requires the existing computed eligibility, integrity, clarity, duplicate, coverage, distinct-value, and universal Top-20 board-winner gates
- No category expansion pass may publish a partial bundle below its stated 10-category minimum
- Removed service-import, service-export, combined goods-and-services, duplicate, and owner-retired concepts remain fail-closed
- Player descriptions have no terminal period and known ambiguous wording remains covered by static regression tests
- Board-capacity estimates must include actual country-bank construction under the universal Top-20 winner rule; category-only combinations must be labeled raw and not playable

## Browser and accessibility checks

- No horizontal or vertical document overflow during active phone play at the supported portrait and landscape sizes
- Every country, measure, selector, and Lock in draft action remains visible
- The category color key opens on desktop and mobile and explicitly says colors do not affect scoring
- Difficulty and leaderboard controls expose usable names, roles, and selected state
- Tables can scroll horizontally on narrow screens without expanding the page

## Production checks

1. Confirm migrations 069 through 077 are present in Supabase
2. Confirm the Supabase project reports healthy and the targeted RLS performance warnings are absent
3. Confirm Vercel deploys the exact green GitHub commit to production
4. Confirm `/daily`, `/daily/adventurer`, `/daily/expert`, `/leaderboard`, `/admin`, `/privacy`, and `/terms` respond without runtime-error clusters
5. Confirm Admin shows traffic, account funnel, acquisition, mode breakdowns, top categories/countries, and warehouse health
6. Send external auth tests only after custom SMTP is verified; confirm the From name/address, SPF, DKIM, DMARC, links, and spam placement
7. Complete a signed-in Daily and confirm the standing appears automatically exactly once in the correct difficulty and time range
8. Confirm the final launch-docket checkboxes match the deployed commit rather than an earlier local or preview build

## Rollback

Promote the last known-good Vercel deployment first. The v16.2.8 database changes are additive and backward-compatible, so an application rollback does not require an immediate database rollback. Use `ROLLBACK_V16_2_8.sql` only if the reporting views or policy rewrites themselves must be reverted.
