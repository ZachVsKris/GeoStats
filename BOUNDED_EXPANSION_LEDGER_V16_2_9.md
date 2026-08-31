# GeoStats v16.2.9 bounded expansion ledger

This ledger prevents repeated searches through unchanged sources. A pass may resume only when a materially new authoritative dataset, new release, or corrected country-level method changes the evidence. Ten new strict-pass categories is the minimum publication bundle; 20 or more is preferred, with no ceiling for genuinely distinct high-quality measures.

| Pass | Sources evaluated | New strict-pass candidates | Decision |
| --- | --- | ---: | --- |
| Natural and physical geography | Beck et al. peer-reviewed Köppen-Geiger 1991–2020 raster with Natural Earth sovereign geometry | 11 | Proceed through the controlled import, stored-source audit, atomic promotion, and reachability workflow |
| Country history | UN membership, Constitute, IPU, World Bank threshold histories, FIFA/IOC chronology candidates already implemented or staged | Fewer than 10 | Stop. Keep the six existing playable history measures; do not weaken global Top-20 distinctness or add near-duplicate threshold dates |
| Culture | UNESCO World Heritage and Intangible Cultural Heritage country counts plus existing culture-labeled source candidates | 0 | Stop. Both broad UNESCO count concepts are explicit owner exclusions; no replacement bundle met clarity, interest, breadth, and non-duplication together |
| Ethnic, religious, and racial demographics | Pew 2010/2020 global religious composition and remaining staged group measures | Fewer than 10 new | Stop. Thirteen high-quality religious-demography measures are already playable; the remaining Jewish measures do not both clear the current quality gate, and country race/ethnicity definitions are not sufficiently comparable for a global ranking bundle |
| Infrastructure, technology, and science | Dedicated World Bank infrastructure candidates, WDI catalog candidates, UN/WHO/UNESCO candidates already staged | Fewer than 10 | Stop. The remainder fails coverage, freshness, source-floor, duplication, or player-interest gates; do not substitute economy, trade, or agriculture padding |
| Final balance search: climate and weather | NASA POWER 2001–2020 climatology parameter pool | 11 concepts identified for one bounded feasibility pass | Proceed to a single reproducible capital-point feasibility run. Evaluate solar irradiance, UV index, cloud amount, wind speed, humidity, precipitation, temperature, daily temperature range, surface pressure, root-zone soil wetness, and evapotranspiration. Publish only if at least 10 remain distinct after coverage, Top-20, clarity, and semantic-collision checks; otherwise stop without opening another source search. |

## Natural bundle evidence

The completed GitHub feasibility run evaluated 13 candidate measures, covered 195 GeoStats countries, and returned `GO_TO_STAGING` with 11 passes. The two rejected measures were ice-cap share (only seven visible values and seven distinct Top-20 values) and climate diversity (only six distinct Top-20 values).

The approved bundle is limited to desert, arid, steppe, tropical rainforest, tropical monsoon, tropical savanna, temperate, Mediterranean, continental, polar, and tundra land shares. The workflow re-fetches the pinned publisher inputs once for the actual import, reproduces the proof, imports exactly those eleven keys, re-audits the stored snapshot, promotes atomically through database checks, and then re-runs generator reachability. Any failure leaves the bundle unavailable.

## Final balance-source decision

NASA POWER is the final source pool considered for this release cycle. Its official climatology API exposes a global 2001–2020 normal for hundreds of meteorological and solar parameters and permits up to 20 parameters in one point request. GeoStats can therefore evaluate one transparent point per country's single Natural Earth national capital while omitting countries with ambiguous capital points, matching the existing capital-coordinate universe.

This is a candidate pool, not an automatic publication list. Temperature and precipitation concepts must be rejected if their capital wording is not sufficiently distinct from existing country-wide climate categories. Technical measures such as root-zone soil wetness and evapotranspiration must also fail if player wording cannot remain intuitive. The pass ends after these eleven concepts; no replacement source search or padded variants are allowed in this cycle.

## Owner-supplied post-search leads

After the release search was closed, the owner supplied a separate research memo containing materially new source leads. Recording them here is not a new open-ended search and does not make any category playable. Every source remains subject to the independent 10-category minimum and the normal source, license, country-definition, coverage, uniqueness, Top-20, semantic-collision, and generator gates.

| Source lead | Repository comparison | Bounded disposition |
| --- | --- | --- |
| UN DESA Household Size and Living Arrangements 2026 | Genuinely new | Highest-priority human-demography feasibility pass. Official 2026 data and methodology are available; require at least 10 clearly different household/living-arrangement concepts without treating correlated household-size bands as padding. |
| JRC Global Surface Water 1984–2024 | Genuinely new | High-priority physical-Earth pass. Use one pinned release and explicitly handle the documented Landsat collection transition and known recurrence caveat; prefer area/transition concepts that remain intuitive. |
| HydroATLAS | New extension of the existing HydroSHEDS family | High-priority hydrography pass. Start from its 56 variables/281 attributes, but remove climate, agriculture, population, and land-cover concepts already represented elsewhere before counting the 10-category floor. |
| GLiM global lithology | Genuinely new | High-priority geology pass. The 16 top-level lithology classes are a plausible coherent bundle; use sovereign-area shares and reject classes whose global Top-20 values are not distinct. |
| Glottolog 5.3 | Previously tracked, never validated or shipped | Reopen only because a current structured release and downloadable CLDF/CSV/SQL evidence were supplied. Count language, family, isolate, and clearly separated status concepts; do not manufacture 20 from near-identical endangerment labels. |
| Expanded Smithsonian GVP | Existing source, only shallowly used | Re-audit the current official volcano/eruption release for at least 10 new morphology, composition, eruption-history, and VEI concepts. Keep one fixed observation period and semantic-family protections. |
| GHSL country statistics | Genuinely new | Secondary human-geography pass. Use observed epochs only, deduplicate against existing urban/rural/population categories, and prove that at least 10 built-up/settlement concepts remain. |
| UN Demographic Yearbook | Genuinely new source family | Secondary pass. Birth/death/marriage/household measures may be comparable; ethnicity, language, and religion counts require especially strict definition and reporting-coverage review and must not be assumed comparable. |
| Cliopatria/Seshat polity geometry | Genuinely new | Conditional history pass. Named-polity footprint categories may clear quantity, but shifting borders, timestep resolution, disputed interpretations, and modern-country intersection rules must be disclosed and fail closed. |
| SoilGrids | Genuinely new | Conditional physical-Earth pass. Proceed only if 10 player-comprehensible, non-jargon soil concepts survive; raw availability of many depth/property combinations does not count. |
| FAO Global Forest Resources Assessment 2025 | Not untapped: a fail-closed importer with 16 candidates already exists | Resume the existing importer/audit path rather than create a new source pipeline. No category is counted until the official input, stored snapshot, and board feasibility pass. |
| NOAA IBTrACS | Previously tracked and stopped unresolved | Keep stopped unless a newly defined satellite-era country-intersection method proves 10 genuinely different, globally fair storm concepts. |

Verified first-party starting points: UN DESA household data (`https://www.un.org/development/desa/pd/data/households-and-living-arrangements-data`), HydroATLAS (`https://www.hydrosheds.org/hydroatlas`), JRC Global Surface Water (`https://global-surface-water.appspot.com/download`), Glottolog downloads (`https://glottolog.org/meta/downloads`), GHSL datasets (`https://ghsl.jrc.ec.europa.eu/datasets.php`), UN Demographic Yearbook (`https://unstats.un.org/unsd/demographic-social/products/dyb/`), GLiM archive (`https://doi.pangaea.de/10.1594/PANGAEA.788537`), and Cliopatria (`https://github.com/Seshat-Global-History-Databank/cliopatria`).
