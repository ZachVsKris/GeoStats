# GeoStats v16.3.0 final bounded source feasibility record

Date: 2026-09-01

This is the terminal source-search record for this release. A source may be
reopened only for a materially new release, an owner-supplied official input,
or a corrected country-attribution method. Availability alone is not approval:
each source still needs a reproducible country mapping, at least ten genuinely
different player concepts, adequate coverage and Top-20 distinctness, concise
copy, and a successful generator audit.

| Source | Provenance, access, and reuse | Country-comparison finding | Release decision |
| --- | --- | --- | --- |
| UN DESA Household Size and Living Arrangements | Official UN Population Division workbook and methodology | Promising direct country tables, but household-size bands and living-arrangement variants are highly correlated and the current release has not produced ten independently useful concepts through the full value audit | Stop for v16.3.0; highest-priority future tabular pass when the pinned workbook is supplied |
| FAO FRA 2025 | Official national reporting for 194+ countries/areas; CSV/API access; existing fail-closed 16-concept importer | Pipeline and fixture coverage exist, but no pinned production input has passed stored-snapshot, ranking, and reachability promotion | Keep staged, not playable; resume the existing importer rather than search again |
| JRC Global Surface Water 1984–2024 | European Commission/JRC global raster downloads; occurrence, change, seasonality, recurrence, transitions, and maximum extent | Authoritative and reusable, but country values require a pinned raster release, sovereign overlay, Landsat transition handling, and area-weighted validation | Stop for v16.3.0; reopen only with publisher rasters and a reproducible overlay proof |
| HydroATLAS | HydroSHEDS/WWF BasinATLAS, RiverATLAS, and LakeATLAS; CC BY 4.0; 56 variables and 281 attributes | Large pool, but watershed/reach values are not country values. A defensible aggregation must resolve transboundary features and the documented lower-quality coverage north of 60°N | Stop; no country ranking until an attribution policy and uncertainty audit are implemented |
| GLiM lithology | Peer-reviewed PANGAEA archive; CC BY 3.0; 16 top-level classes and 1.235M polygons | A coherent geology bundle is plausible, but requires pinned polygon data, geodesic sovereign intersection, and distinct-value testing for every class | Stop for this release; preferred future physical-geography overlay after JRC |
| Smithsonian GVP expansion | Official Volcanoes of the World 5.4.0 spreadsheets/WFS and confirmed-eruption workbook | Existing importer already covers the safe high-level concepts. Morphology, composition, VEI, and eruption-period variants need fixed-period missing-data and shared/island attribution audits before they can count as new concepts | No additional v16.3.0 promotion; retain existing GVP categories and importer tests |
| Glottolog 5.3 | Max Planck catalogue with stable Glottocodes; CC BY 4.0; downloadable structured release | Excellent language catalogue, but catalogue locations are not population prevalence and a language can span several countries. Counts by location/family/status need a published country-attribution rule and must avoid near-duplicate count variants | Stop; do not present catalogue counts as speakers or cultural prevalence |
| GHSL | European Commission/JRC open data; built-up surface, volume, population, settlement classification, and observed epochs | Technically feasible by sovereign raster/vector aggregation, but overlaps existing urban/rural/city measures and needs a pinned observed epoch plus ten demonstrably distinct concepts | Stop for v16.3.0; reopen only if a deduplicated ten-concept proof survives |
| UN Demographic Yearbook 2024 | Official UNSD XLS tables collected from 230+ national statistical offices | Direct country tables exist, but years, de facto/de jure bases, coverage, and registration completeness vary by measure. Many concepts duplicate WPP/WHO/UNICEF | Stop; use only a future same-year, same-definition bundle with explicit completeness gates |
| Cliopatria / Seshat | Cliopatria open geospatial polity data from 3400 BCE–2024; Seshat API/data licensing varies | Historical polities do not map cleanly to modern countries. Intersections would require a disclosed date, timestep, successor, overlap, and disputed-border method; Seshat bulk data also has reuse constraints | Stop; no modern-country gameplay derivation in this release |
| SoilGrids | ISRIC global modeled soil properties at 250 m and coarser derivatives; CC BY 4.0 for reviewed products | Country aggregation is possible, but depth/property variants would be easy padding and unfamiliar units need concise definitions. Modeled uncertainty and sovereign area weighting must be retained | Stop; reopen only with ten surface-layer concepts that pass player-copy and uncertainty review |
| NOAA IBTrACS v4r01 | Official NOAA/NCEI global best-track CSV, NetCDF, and shapefile data; updated several times weekly | Storm tracks are not inherently owned by countries. Landfall/intersection attribution, repeated storm visits, pre-satellite undercount, and cross-basin wind conventions prevent a fair ten-concept country bundle today | Stop; do not rank countries until a satellite-era landfall method is validated |
| NASA POWER | Official NASA MERRA-2/satellite APIs with JSON/CSV/NetCDF output and hundreds of parameters | The general temporal API is point-only. Capital-point weather is not a defensible country climate measure, and a global gridded country aggregation would duplicate the raster work above | Stop; reject the capital-point proposal rather than imply country-wide conditions |

## Final additional-source search

One last bounded search was performed for a non-economy source not already in
the memo. HydroLAKES/HydroSHEDS v2 was the strongest lead, but it belongs to the
same HydroATLAS family and requires the same transboundary and country-overlay
rules. It is therefore recorded as part of that stopped pass, not opened as a
new search loop.

## Outcome

No candidate was promoted merely to satisfy a count target. The ten retained
Köppen–Geiger concepts are the completed physical/climate bundle for this
release. The next best genuinely new bundles are GLiM and JRC Global Surface
Water, but both require publisher inputs and a production-grade sovereign
geospatial overlay before they can be judged on actual country values.
