# GeoStats v14.0.0 — start here

This package is the **complete repository**, not a patch. Replace the contents of the GitHub repository connected to Vercel with everything in this folder.

## Deployment order

1. Replace the GitHub repository contents with this build.
2. Confirm the v13.5 database migration has already been applied.
3. In **Supabase → SQL Editor**, run `RUN_THIS_IN_SUPABASE_FOR_V14.sql` once.
4. Run `VERIFY_V14.sql`. The queries labeled as zero-row checks must return no rows.
5. Deploy through Vercel.
6. Test:
   - `/daily`
   - `/daily/adventurer`
   - `/daily/expert`
   - `/random/easy`
   - `/random`
   - `/random/expert`
   - `/data`
   - `/admin`
7. Finish a board, open **View rankings**, and choose **Source & all data**. Confirm the modal shows:
   - the exact all-country values used by GeoStats
   - year and unit
   - indicator and dataset
   - exact-query/download/original-source links when available
   - methodology and calculation details
8. In GitHub, run **Actions → Import all source data → Run workflow**.
9. Review newly imported candidates in `/admin`. New candidates are intentionally disabled until manually approved.

## Required GitHub Actions secrets

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

Optional source secrets:

- `COMTRADE_API_KEY` for the full UN Comtrade import
- `EIA_API_KEY` for U.S. EIA data

The World Bank catalog and Natural Earth imports do not require source API keys.

## What the all-source workflow imports

- up to 500 new objective World Bank WDI candidates, skipping indicators already in the warehouse
- the existing broad FAOSTAT candidate library
- 55 WHO health concepts
- 37 UNESCO UIS concepts
- 24 ILOSTAT concepts
- 24 Natural Earth vector-derived geography concepts
- 55 UN Comtrade product-export concepts
- EIA energy concepts
- UNHCR displacement concepts

The number that ultimately becomes playable will be much smaller. Every candidate still has to pass freshness, coverage, quality, provenance, credibility, objectivity, verifiability, clarity, fun, duplicate, and editorial-review gates.

## Important v14 behavior

### Exact source no longer means “send the player to a homepage”

The game first opens a GeoStats source panel containing the exact country snapshot used in the ranking. External links are supporting evidence, not the only way to verify the answer.

### New categories do not enter play automatically

Broad importers place unseen concepts into a visible review queue. An administrator must approve a candidate after all automatic gates pass.

### Objective-only policy

GeoStats blocks happiness, corruption-perception, democracy, freedom, peace, prosperity, competitiveness, “best country,” and other subjective or composite rankings. It retains direct underlying measures when those measures are objective and understandable.

### Natural Earth scope

The v14 Natural Earth importer derives only measurements supported by the versioned 1:10m country, river, lake, and glaciated-area layers. It does not pretend Natural Earth supplies elevation, climate, or national reef ownership. Those require separate authoritative datasets or maritime boundaries in a future spatial release.

## Source-panel fallback behavior

Some providers do not offer stable, pre-filtered deep links. In those cases GeoStats still preserves:

- the exact imported country rows
- comparison year
- source indicator code
- retrieval date
- source page/download/API metadata
- technical definition and methodology

That preserved snapshot earns a lower verifiability score than a stable direct query, but it remains independently inspectable inside GeoStats.
