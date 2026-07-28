# GeoStats v15.0.0 release notes

## Added

- Category Review Workbench at `/admin/review`
- Single authoritative editorial state
- Permanent policy flags for political/self-reported and poor-gameplay measures
- Review audit log
- Semantic-group and title editing
- Top/bottom value previews and overlap discovery
- Keyboard-driven review flow
- v15 runtime catalog and playability reconciliation
- World Bank exact-link restoration and safe official-portal fallbacks for supported sources
- Importers and audits now reconcile v15 rather than re-running the retired v14.4 gate

## Changed

- Daily/runtime categories now come from `category_review_queue_v15`
- Strict integrity remains mandatory, but unpopulated legacy scoring fields are no longer simultaneous hard gates
- Source diversity is no longer confused with topic diversity; semantic groups are editable in the Workbench
- Exact and general official human-readable source pages are both accepted

## Preserved

- Source-integrity validation
- Country/value/ranking checks
- Top-30 board rule
- Daily mode dimensions and cross-mode country limits
- Existing importers and observation data
