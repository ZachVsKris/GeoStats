# GeoStats v13.3

Adds three official data-source importers, all using the existing review quarantine and canonical-category pipeline.

## New sources

- UN Comtrade: curated merchandise-export categories such as coffee, cars, pharmaceuticals, clothing, crude oil, and gold
- U.S. EIA: curated international energy production, consumption, and electricity-generation categories
- UNHCR: refugee-hosting, refugee-origin, asylum, displacement, statelessness, and durable-solutions categories

## Safety and governance

- Every imported category starts disabled
- Quality scoring and minimum-coverage rules run before review
- Existing administrator approvals are preserved only while a category continues to pass the quality gate
- Daily boards do not use a new category until it is approved and eligible

## Credentials

- `EIA_API_KEY` is required as a GitHub Actions repository secret
- `COMTRADE_API_KEY` is optional; without it, the importer uses the public preview endpoint
- UNHCR requires no API key
