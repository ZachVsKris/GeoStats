# GeoStats v13.4.4 Final Playability Review

The v13.4.3 diagnostic returned 50 editorially retained categories that were not playable.

## Final decisions

- 33 categories receive category-specific numerical calibration and become playable
- 11 categories are removed after final review
- 5 ILOSTAT concepts remain retained but temporarily blocked because the stored common year is 2026 or 2027
- 1 World Bank forest-share category remains superseded by the stronger forest-area representative

This raises the current playable library from 203 to approximately 236 categories on the supplied database snapshot. After rerunning ILOSTAT with completed-year data, the ceiling is approximately 241.

## Why the generic gate was wrong

The original one-size-fits-all quality gate rejected useful categories for reasons that are normal for their subject matter:

- Oil and gas production have many legitimate zero values
- School-access indicators often have ceiling ties
- Customs product categories naturally cover fewer countries than population indicators
- Assessment and labor indicators can be high quality with 60 to 100 countries rather than 160
- Legacy World Bank rows do not always contain clustering and stability metadata

The new rules do not blindly bypass quality. Each approved exception has explicit floors for year, coverage, quality, clustering, and stability, while provenance and duplicate checks remain mandatory.

## Categories removed in this release

The 11 final removals are:

- Internally displaced people: only 38 common-year countries and missing values cannot safely be treated as zero
- School electricity access: excessive ceiling ties
- School sanitation access: excessive ceiling ties
- School drinking-water access: stale broad common year and excessive ties
- Youth literacy: below the 60-country common-year floor
- Doctor density: broad common year is 2018
- High-blood-pressure prevalence: broad common year is 2019
- Road-traffic death rate: broad common year is 2021
- Skilled birth attendance: broad common year is 2019
- Handwashing access: broad common year is 2019
- Antenatal-care coverage: broad common year is 2019

GeoStats continues to require 2022-current common-year data for playable categories.
