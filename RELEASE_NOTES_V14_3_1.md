# GeoStats v14.3.1 Release Notes

## Category comprehension audit

The complete 726-candidate catalog now has a row-by-row decision:

- 243 content-approved
- 483 content-excluded
- 252 formerly approved categories re-reviewed
- 9 formerly approved categories removed
- 17 approved categories renamed for immediate comprehension

New removals include the three categories flagged during Daily review:

- Highest employment-to-population ratio
- Highest labor-income share of GDP
- Highest output per worker

The audit also removes labor-productivity growth, industry share of GDP, gross investment share, gross savings rate, fixed telephone subscriptions, and the ambiguous “bee population” category.

## Exact player-source links

Source/audit URLs are now separated from player URLs. Every player-facing source surface, including Data & Source, `/data`, and `/audit`, uses only `player_source_url` and never falls back to `exact_query_url`, `api_url`, `download_url`, or a generic source homepage.

A database trigger permanently blocks play unless the category has:

- content review = approved
- immediate comprehension score of at least 80
- gameplay-interest score of at least 65
- player source status = exact
- a safe HTTPS HTML page
- link-quality score of at least 90

World Bank pages use `https://data.worldbank.org/indicator/[CODE]`. Other sources are fail-closed until a source-specific exact readable deep link passes the live audit.

## Import safety

Reimports now preserve completed content-review decisions and previously audited exact player links. Refreshed values still return to source-integrity pending status, but a data import cannot silently erase editorial decisions or replace a readable page with an API/download URL.

## Admin and workflows

Admin now shows:

- content-review status and scores
- player-link status and quality
- exact-link and blocked-link counts
- direct access to the player-link audit workflow

The approval API independently enforces the same content and link gates.

## Existing v14.3 gameplay rules retained

- board winner must be globally ranked #30 or better
- no two categories from the same semantic family
- semantic similarity warnings and board revalidation
- continent and source limits
- fail-closed source-integrity catalog

## Versions

- App: `14.3.1`
- Rules/cache: `8.1`
