# GeoStats v13.4.2 — complete editorial curation

This release reviews the entire 453-category approved export and makes the result automatic and persistent.

## Final library

- Reviewed: 453
- Retained: 205
- Curated out: 248
- FAOSTAT retained: 133 of 365

## What changed

- FAOSTAT is fail-closed: only the 133 explicitly reviewed item/measure combinations can be playable
- Harvested-area, producing-animal, offal, hide, fat, equivalent, n.e.c., obscure processing, and other technical variants are disabled
- Production and yield may both remain for recognizable commodities, but share a similarity group and cannot appear together in one round
- Weaker World Bank, UNESCO, UNHCR, and Natural Earth duplicates are disabled
- ILOSTAT is capped at the latest completed calendar year, eliminating 2026/2027 projections from current play
- The Daily game catalog now uses the curated warehouse categories instead of leaving them only in Admin
- Admin shows the editorial decision and blocks manual re-approval of curated-out categories

Manual review is not required. Future imports automatically reapply the same curation registry.
