# GeoStats v13.4.3 release notes

## Complete 726-category review

v13.4.3 completes the editorial review that v13.4.2 began.

- 726 categories reviewed
- 252 retained editorially
- 474 curated out
- 0 current categories left unreviewed
- Future unseen indicators still fail closed
- Manual category approval is not required

## Key corrections

- Adds category-specific curation keys so the high- and low-rainfall categories can receive different decisions despite sharing one World Bank indicator code
- Retains only highest average rainfall and excludes the exact inverse
- Approves the World Bank CO₂ and methane series under a documented harmonized-emissions provenance class
- Retains Natural Earth land-border-neighbor counts
- Retains EIA crude-oil production when its numeric gate passes
- Completes decisions for the remaining UNESCO, WHO, ILOSTAT, UNHCR, Comtrade, EIA, Natural Earth, World Bank, and FAOSTAT rows
- Corrects the duplicate-arbitration SQL function carried in v13.4.2

Editorial approval still does not bypass numeric quality, provenance, or duplicate arbitration.
