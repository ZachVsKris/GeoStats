# GeoStats v15.3 audit report

## Problems addressed

1. The failed v15.2.1 patch did not pass TypeScript narrowing and removed World Bank importer helpers still used elsewhere.
2. The old Daily path could load large numbers of datasets in the browser after a server error.
3. Saved-board validation incorrectly used board size as the global winner threshold.
4. The game allowed player-visible ties between board countries.
5. The source modal forced long titles, definitions and source names into competing columns.
6. UNESCO modeled completion rates were presented with misleading plain-language copy.
7. FAOSTAT’s general portal could default to Production even when GeoStats ranked Yield.
8. Most reproducible physical-geography candidates remained outside play.

## Generation feasibility review

The production composer now has three profiles:

- **strict**: original source and agriculture caps;
- **catalog-balanced**: moderate fallback caps;
- **catalog-recovery**: broader fallback caps while retaining category and geographic diversity.

Profiles are attempted only when source-capacity math shows that 18 distinct Daily categories are possible. Time is divided across the remaining profiles so the strict profile cannot consume the entire request budget. Each round retains:

- Scout: 4 categories, 5 countries, max 2 countries per continent;
- Adventurer: 6 categories, 8 countries, max 3 per continent;
- Expert: 8 categories, 10 countries, max 3 per continent;
- unique displayed values for every board country in every category;
- distinct category winners;
- top-30 global winners;
- complete common-year data;
- within-board semantic-family uniqueness;
- no exact category repeated across Daily modes;
- at most one country shared between any two modes.

A synthetic fixture with 90 categories, 72 countries, nine sources, 12 category types and six continents successfully composes each individual mode and a complete tie-free Daily trio through the real production composer.

## Catalog review limits

The repository does not contain a complete human-authored decision for every live pending row. v15.3 therefore does **not** claim to manually approve all pending categories. The SQL clear-pass is deliberately conservative and uses the existing live review metadata. Anything not meeting every threshold remains pending for Workbench review.

## Physical geography

v15.3 can activate the existing Natural Earth 1:10m measures for borders, coastline, land pieces, geographic spans, mapped rivers, lakes and glaciated areas when the live hard gate passes. Elevation and satellite land-cover categories are not included because they require new DEM/land-cover import pipelines, fixed reference products and reproducible country overlays.

## Verification completed

Passed locally:

- v15 integration checks;
- TypeScript/TSX syntax transpilation for 84 files;
- strict full-project TypeScript checking with external framework modules stubbed;
- core game invariants;
- synthetic Daily feasibility stress test;
- World Bank, FAOSTAT, WHO, UNESCO, ILOSTAT, Natural Earth, UN Comtrade, EIA and UNHCR importer tests;
- player-source-link fixtures;
- source-integrity fixtures.

A local `next build` could not be completed because the available npm registry gateway repeatedly timed out/returned HTTP 503 while installing dependencies. The GitHub **Verify GeoStats v15** workflow and Vercel are therefore the authoritative production build checks.
