# GeoStats v13.4.3 complete catalog curation

The v13.4.3 review covers every category present in the two supplied catalog exports: the 453 categories reviewed in v13.4.2 plus the 273 categories that had previously failed closed.

| Source | Reviewed | Retained editorially | Curated out |
|---|---:|---:|---:|
| FAOSTAT | 549 | 133 | 416 |
| ILOSTAT | 14 | 11 | 3 |
| Natural Earth | 8 | 6 | 2 |
| U.S. EIA | 2 | 2 | 0 |
| UN Comtrade | 13 | 13 | 0 |
| UNESCO UIS | 29 | 16 | 13 |
| UNHCR | 11 | 7 | 4 |
| WHO | 25 | 15 | 10 |
| World Bank | 75 | 49 | 26 |
| **Total** | **726** | **252** | **474** |

## Editorial standards applied

- Excluded exact, inverse, and weaker cross-source duplicates
- Excluded future-dated ILOSTAT projections
- Excluded low-coverage, stale, opaque composite, and overly technical categories
- Excluded indicators whose international comparability depends too heavily on uneven self-reporting
- Preserved manual rejections and the separate numerical-quality gate
- Retained only one rainfall direction, using category-specific rules despite the shared World Bank indicator code
- Kept future unseen indicators fail-closed so no manual admin queue is required

## Important source decisions

- **FAOSTAT:** The existing 133-player-friendly allowlist remains. All 184 previously unreviewed FAOSTAT rows were excluded because they were below the specialty coverage/quality threshold, harvested-area variants, technical animal-input measures, narrow processed products, or duplicates.
- **World Bank:** Retained total and per-person CO₂ emissions, methane emissions, highest average rainfall, and air freight. Excluded internet usage, duplicate unemployment/cereal/education/sanitation indicators, the inverse rainfall category, and zero-coverage rows.
- **WHO:** Retained direct WASH, workforce-density, malaria, blood-pressure, road-safety, and maternal-care measures. Excluded stale mortality series, opaque composites, and survey-sensitive smoking/suicide comparisons.
- **UNESCO UIS:** Retained direct education spending, skills, school infrastructure, literacy, STEM, researcher, and student-mobility measures. Excluded gross-enrollment and near-inverse completion measures.
- **ILOSTAT:** Retained six clear additional labor indicators. Excluded technical labor-underutilization measures and the stale collective-bargaining series.
- **UNHCR, EIA, Comtrade, Natural Earth:** Retained clear operational, energy, trade, and border-neighbor measures; excluded residual/low-coverage or geometry-sensitive measures.

Editorial approval does not bypass the numerical-quality, provenance, or duplicate-arbitration gates. A retained category enters Daily only when all four systems pass.
