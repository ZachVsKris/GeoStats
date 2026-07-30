# GeoStats v15.8.0

## Gameplay and navigation
- Renames Seeded to Random while preserving deterministic seeds.
- Removes the redundant Daily navigation button.
- Keeps Scout, Adventurer, and Expert as the Daily-mode controls.

## FAOSTAT correction
- Excludes yield, per-hectare, per-animal, harvested-area, slaughter, carcass, and productivity categories.
- Keeps clear total production categories.
- Keeps clear livestock-population totals such as horses, cattle, sheep, goats, pigs, and poultry when recorded as head/count stocks.
- Adds a runtime fail-closed check so an incorrectly flagged yield cannot enter play.

## Copy correction
- `EN.URB.LCTY` is now **Highest share living in largest city** with a percentage-based board description.

## Expansion intake
- Adds UNESCO World Heritage, AQUASTAT, USGS minerals, and FAO fisheries importers.
- Retains prepared Pew, volcano, earthquake, land-cover, river/lake, and elevation importers.
- Adds a combined expansion-import workflow and a standalone automated-vetting workflow.

## Vetting and manual review
- Automated checks cover validation, coverage, ties, title/description clarity, FAOSTAT policy, semantic overlap, title similarity, and ranking correlation.
- Recommendations are approve, rewrite, duplicate, quarantine data, or retire.
- Recommendations never auto-activate categories.
- Workbench displays the automated recommendation beside the manual decision tools.
