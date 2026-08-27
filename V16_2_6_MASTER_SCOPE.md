# GeoStats v16.2.6 master scope

This file is the release-level source of truth for the single comprehensive v16.2.6 build. It is intentionally fail-closed: every requested idea is tracked, but only independently validated, clearly defined, globally comparable data may become playable.

## Frozen baseline
- Input repository: `GeoStats-main (22).zip` / v16.2.5
- Current playable catalog: 351 categories
- User-annotated existing categories: 105
- New/repair research candidates logged: 145
- Public gameplay dimensions and scoring remain unchanged: Scout 4×4, Adventurer 6×4, Expert 8×6; scoring version remains `placements-v16.2.4`.

## Completion rule
The release is not complete because it reaches a category-count target. It is complete when:
1. Every existing annotation is resolved.
2. Every candidate in `V16_2_6_MASTER_TRACKER.csv` has a documented final disposition.
3. Every playable category passes source/provenance, semantic, coverage/ranking, tie-safety, player-copy, and gameplay-quality gates.
4. Generator diversity is measured before/after and does not simply replace one overexposed subset with another.
5. Public-launch, private-Random, backward-compatibility, and rollback checks in `V16_2_6_RELEASE_TRACKER.csv` are resolved.

## Source policy
Use primary government/international/scientific sources whenever practical. Secondary/reference sources may discover or corroborate facts but do not override a stronger primary source. Respect source licensing and access terms; do not bulk-harvest a secondary site that prohibits systematic retrieval. Preserve exact provenance, retrieval/version information, source query, derivation method, and input datasets.

## Historical/geospatial policy
Historical categories must define successor-state treatment. Geospatial categories must define territory treatment, antimeridian behavior where relevant, geometry resolution, and any derived calculation before values are ranked. No hand-filled missing country values.
