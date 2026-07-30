# GeoStats v15.8 expansion inputs

The **Import v15.8 expansion candidates** workflow always imports the sources that can be retrieved directly: Pew religious composition, Smithsonian volcanoes, USGS earthquakes, Natural Earth physical facts, and UNESCO World Heritage.

The remaining workflow inputs are optional so the automatic sources can run immediately. Supply the following official or officially derived CSV URLs to import the corresponding additional candidates.

## AQUASTAT

Accepted core columns: country, variable/indicator name, year, and value. See `data-templates/v15-8/aquastat-template.csv`.

Curated concepts:
- renewable water per person
- water stress
- total freshwater withdrawal
- agriculture's share of water use
- irrigated cropland share
- dam capacity

## USGS minerals

Accepted core columns: country, commodity/mineral, year, mine production/value, and unit. See `data-templates/v15-8/usgs-minerals-template.csv`.

Only familiar total mine-production concepts are considered. Reserves, capacity, ore grade, and bauxite are excluded.

## FAO fisheries

Normalize the official FishStat export to:

`country_iso3,country_name,year,capture_tonnes,aquaculture_tonnes`

See `data-templates/v15-8/fao-fisheries-template.csv`.

## Physical summaries

WorldCover, HydroSHEDS, and elevation inputs must use the documented country-summary schema in `data-templates/v15-8/physical-summary-template.csv`. Each row must identify its source, metric, country, year, value, unit, release, methodology, derivation method, and boundary dataset.

Supported metrics are defined in `scripts/import-physical-summaries.py`.

## Review behavior

Every newly discovered expansion category is inserted fail-closed and marked for manual review. Automated vetting records a recommendation but never enables a category. Existing human approvals are preserved across refreshes, subject to fresh source-integrity validation.
