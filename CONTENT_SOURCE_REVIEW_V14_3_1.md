# GeoStats v14.3.1 Content and Source-Link Review

This release records a structured row-by-row decision for every category in the 726-candidate catalog. It also re-reviews every category previously approved for play. Content approval and source-link approval are separate gates: a category may be understandable and interesting while remaining disabled until its official provider offers a verified human-readable webpage showing the exact data.

## Summary

- Catalog candidates with an explicit decision: **726**
- Previously approved categories re-reviewed: **252**
- Content-approved after re-review: **243**
- Content-excluded in the full catalog: **483**
- Newly removed from the previously approved library: **9**
- Approved with a clearer title: **17**

## By source

| Source | Reviewed | Content approved | Content excluded | Exact links ready | Exact link still needed | Link unavailable |
|---|---:|---:|---:|---:|---:|---:|
| FAOSTAT | 549 | 132 | 417 | 0 | 132 | 0 |
| ILOSTAT | 14 | 7 | 7 | 0 | 7 | 0 |
| Natural Earth | 8 | 6 | 2 | 0 | 0 | 6 |
| U.S. EIA | 2 | 2 | 0 | 0 | 2 | 0 |
| UN Comtrade | 13 | 13 | 0 | 0 | 13 | 0 |
| UNESCO UIS | 29 | 16 | 13 | 0 | 16 | 0 |
| UNHCR | 11 | 7 | 4 | 0 | 7 | 0 |
| WHO | 25 | 15 | 10 | 0 | 15 | 0 |
| World Bank | 75 | 45 | 30 | 45 | 0 | 0 |

## Newly removed from the previously approved library

- **Highest fixed telephone subscriptions per 100 people** (World Bank · `IT.MLT.MAIN.P2`): Removed as dated and low-interest for current gameplay.
- **Highest industry share of GDP** (World Bank · `NV.IND.TOTL.ZS`): Too technical for immediate play: industry value added as a share of GDP is not intuitive enough.
- **Fastest labor-productivity growth** (ILOSTAT · `SDG_0821_NOC_RT_A`): Too technical for immediate play: annual labor-productivity growth requires interpreting an economic productivity measure.
- **Highest employment-to-population ratio** (ILOSTAT · `EMP_2WAP_SEX_AGE_RT_A`): Too technical and too close to unemployment and labor-force participation for ordinary play.
- **Highest labor-income share of GDP** (ILOSTAT · `SDG_1041_NOC_RT_A`): Too technical for immediate play: labor-income share of GDP is not self-explanatory.
- **Highest output per worker** (ILOSTAT · `GDP_205U_NOC_NB_A`): Too technical for immediate play: output per worker depends on a specialized productivity measure.
- **Largest bee population** (FAOSTAT · `QCL:'02196:5114`): Removed pending clearer source semantics and a player-facing unit; “bee population” may be misleading.
- **Highest investment share** (World Bank · `NE.GDI.TOTL.ZS`): Too technical for immediate play: gross capital formation share is not self-explanatory.
- **Highest gross savings rate** (World Bank · `NY.GNS.ICTR.ZS`): Too technical for immediate play: gross savings as a share of GDP is not self-explanatory.

## Renamed for immediate comprehension

- **Oldest population** → **Highest share of people age 65+** (World Bank · `SP.POP.65UP.TO.ZS`)
- **Youngest population** → **Highest share of children under 15** (World Bank · `SP.POP.0014.TO.ZS`)
- **Largest agricultural economy** → **Largest agricultural output** (World Bank · `NV.AGR.TOTL.CD`)
- **Most asylum applications by origin** → **Most asylum applications by country of origin** (UNHCR · `asylum-applications:coo:applied`)
- **Most refugees originating** → **Most refugees by country of origin** (UNHCR · `population:coo:refugees`)
- **Highest health spending share** → **Highest health-spending share of GDP** (World Bank · `SH.XPD.CHEX.GD.ZS`)
- **Highest female labor participation** → **Highest share of women working or seeking work** (World Bank · `SL.TLF.CACT.FE.ZS`)
- **Highest exports share of GDP** → **Most export-dependent economy** (World Bank · `NE.EXP.GNFS.ZS`)
- **Highest military spending share** → **Highest military-spending share of GDP** (World Bank · `MS.MIL.XPND.GD.ZS`)
- **Most renewable freshwater** → **Most renewable freshwater resources** (World Bank · `ER.H2O.INTR.K3`)
- **Lowest working-poverty rate** → **Lowest share of workers in extreme poverty** (ILOSTAT · `SDG_0111_SEX_AGE_RT_A`)
- **Lowest youth NEET rate** → **Lowest share of young people not working or in school** (ILOSTAT · `EIP_NEET_SEX_RT_A`)
- **Lowest informal-employment rate** → **Lowest share of workers in informal jobs** (ILOSTAT · `EMP_NIFL_SEX_RT_A`)
- **Highest vocational enrollment share** → **Highest vocational-education share** (UNESCO UIS · `GTVP.2T3.V`)
- **Highest outbound student mobility** → **Highest share of students studying abroad** (UNESCO UIS · `MOR.5T8.40505`)
- **Lowest malaria incidence** → **Fewest new malaria cases per person** (WHO · `MALARIA_EST_INCIDENCE`)
- **Highest antenatal-care coverage** → **Highest prenatal-care coverage** (WHO · `WHS4_154`)

## Source-link policy

- The player interface uses only `player_source_url`. It never falls back to API, JSON, CSV, ZIP, XLSX, XML, or bulk-download URLs.
- A player link must be an external HTTPS page, return HTML without an attachment header, and pass a source-specific exactness check.
- World Bank indicator pages are backfilled as exact links.
- All other sources remain disabled until a proven shareable exact-data page is supplied and validated.
- Natural Earth derived rankings remain disabled because the source does not publish GeoStats’ exact derived ranking as an external data table.

The complete row-by-row decision table is `CATEGORY_CONTENT_SOURCE_REVIEW_V14_3_1.csv`.
