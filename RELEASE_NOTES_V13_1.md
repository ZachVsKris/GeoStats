# GeoStats v13.1 — UNESCO, ILOSTAT, and Natural Earth

## Added

- UNESCO UIS importer with 37 curated player-facing concepts across education, science, research, and school infrastructure
- ILOSTAT importer with 24 curated labor-market, productivity, working-conditions, and social-protection concepts
- Natural Earth importer deriving eight stable country-geography categories from a consistent 1:10m geometry source
- Individual GitHub Actions for all three sources
- Updated Run All Sources workflow
- Active source cards and workflow links in Admin
- v13.1 strict-quality metadata and preserved quarantine behavior

## Safety and editorial controls

- Imports remain disabled and in quarantine until administrator approval
- Existing approvals and rejections are preserved on re-import when they still pass the current gate
- Source categories link into the canonical category layer
- Technical source labels are converted to player-facing GeoStats category titles

## Expected behavior

The exact number of imported categories depends on the current source catalogs and which curated concepts can be resolved. An unmatched concept is logged and skipped rather than guessed.
