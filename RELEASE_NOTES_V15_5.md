# GeoStats v15.5.0 release notes

## Catalog simplification

- Adds Daily-ready, Random-only, Needs rewrite, Quarantined, and Retired editorial outcomes.
- Adds a hard comprehensibility screen for technical or contrived categories.
- Retires measures whose natural title would hide an essential technical qualification.
- Adds preferred representatives for obvious duplicate and inverse clusters.
- Adds a catalog-wide correlation review using Spearman rank correlation, top-10 overlap, top-30 overlap, title similarity, knowledge cluster, and strategy family.

## Production-only agriculture policy

- FAOSTAT now imports only absolute total production quantities.
- Existing FAOSTAT yield, harvested-area, livestock-stock, producing-animal, slaughter-count, per-hectare, per-animal, and per-person categories are retired.
- Production titles use plain language such as `Most maize produced`.
- Static fallback categories no longer include yield or per-animal measures.
- Future FAOSTAT refreshes cannot reactivate the retired measure classes.

## Compatible percentage policy

- Allows genuine value-added shares of GDP.
- Allows product export value as a share of total merchandise exports.
- Allows product production value as a share of total agricultural production value when both use the same valuation basis.
- Allows electricity-source shares and land-cover shares.
- Rejects gross production value divided by GDP as a falsely labeled GDP share.
- Requires genuine product-specific value added for any product share-of-GDP category.

## Diversity and duplicate control

- Adds narrow strategy families, broad domains, and knowledge clusters.
- Keeps a maximum of one forced-displacement category per board.
- Adds religion limits across boards and the Daily trio.
- Uses correlation review to retire or demote near-duplicate categories that reward the same knowledge.
- Keeps controlled fallback profiles so the generator remains feasible.

## New source intake

- Pew Research Center religious-composition estimates.
- Smithsonian Global Volcanism Program.
- USGS fixed-period earthquake summaries.
- ESA WorldCover country land-cover summaries.
- HydroSHEDS river and lake summaries.
- Fixed-grid elevation and terrain summaries.

New imports remain quarantined until source validation and editorial review pass.

## Design and source clarity

- Uses concise player-facing titles while preserving exact source terminology in the source panel.
- Expands source specifications for religion, earthquakes, volcanoes, land cover, waterways, and elevation.
- Removes the obsolete FAOSTAT Yield-versus-Production warning because active FAOSTAT gameplay now uses Production Quantity only.

## Database

Run `RUN_THIS_IN_SUPABASE_FOR_V15_5.sql` only after the GitHub verification workflow and Vercel deployment pass. The migration is rerunnable and creates backup tables before changing catalog decisions.
