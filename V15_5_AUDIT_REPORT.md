# GeoStats v15.5 audit report

## Policy audit

The release separates data correctness from gameplay suitability. A category may be technically valid and still be retired because it is unintuitive, overly technical, redundant, or dependent on a normalization players would not expect.

The agriculture review specifically found that verified yield and animal-efficiency categories could still mislead players who interpret a crop category as total national output. v15.5 therefore uses a production-only FAOSTAT intake policy.

## Allowed measure classes

- Absolute national totals: production, imports, and exports.
- Compatible composition shares: sector value added/GDP, product exports/total exports, product production value/total agricultural production value, electricity source/total generation, land-cover class/land area.
- Product share of GDP only when the numerator is genuine product-specific value added.

## Retired measure classes

- Yield per hectare.
- Yield per animal.
- Harvested area.
- Livestock stocks and producing-animal counts.
- Animals slaughtered.
- Product output per person.
- Gross production value divided by GDP when represented as a GDP share.

## Verification performed locally

- v15 integration and gameplay tests.
- Synthetic Daily-trio feasibility tests.
- TypeScript/TSX syntax transpilation.
- Core invariant tests.
- All importer fixture tests.
- FAOSTAT production-only staging and title tests.
- Catalog similarity fixtures.
- Player-source and source-integrity fixtures.

A literal local `npm run build` could not be completed because the available package gateway did not contain `@supabase/ssr@0.12.3`. The GitHub verification workflow and Vercel remain the authoritative production-build checks.
