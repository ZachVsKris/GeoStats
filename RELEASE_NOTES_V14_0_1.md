# GeoStats v14.0.1 release notes

## Root cause

The v14 database migration completed, but the broad import workflow did not add new rows. The unchanged source totals and uniform snapshot-level verifiability scores confirm that the new Natural Earth, World Bank catalog, and Comtrade importers had not completed. The empty pending queue was therefore an import-completion problem, not evidence that hundreds of previously curated exclusions had disappeared.

## Fixes

- Added a single repair workflow with required-secret preflight
- Added strict completeness gates for Natural Earth and Comtrade
- Added target-success scanning for the World Bank catalog
- Added direct WDI source filtering
- Added detailed import-run telemetry
- Added a warehouse health view and post-import verifier
- Added clear deployment and verification instructions
