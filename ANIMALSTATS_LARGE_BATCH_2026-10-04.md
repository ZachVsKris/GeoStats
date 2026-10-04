# AnimalStats larger expansion — 4 October 2026

84 → 100 distinct playable prize labels; 4269 validatable candidates; 157 species in the research/game catalog.

New opposites remain adjacent. One-sided prey endpoints represent different measurements and are not falsely paired. These numbers count only labels present in generated playable challenges, not source fields or research proposals.

| Prize | Opposite | Source coverage |
|---|---|---|
| Heaviest hatchling | Lightest hatchling | 40 species |
| Largest eyes | Smallest eyes | 15 species |
| Sharpest measured vision | Least sharp measured vision | 7 species |
| Fastest recorded chewing | Slowest recorded chewing | 24 species |
| Largest prey in published diet | One-sided | 12 species |
| Smallest prey in published diet | One-sided | 12 species |
| Widest prey-size range | Narrowest prey-size range | 12 species |
| Oldest scientific description | Newest scientific description | 147 species |
| Most threatened | Least threatened | 135 species |

## Quality gates

At least half intuitive prizes on every board. Unique winners and metrics; no duplicate prey-size prizes on a board. Numeric observations require 5% separation and non-overlapping reported bounds. IUCN categories use strict ordinal separation and display category names; codes are not probabilities. DD and NE do not rank. All previous 2,740 shared challenges retain their IDs, animal order and prize order.

Scientific-description age is the published name-authorship year subtracted from fixed reference year 2026; it is not evolution or first human discovery. IUCN values come from the publisher’s GBIF checklist published 28 July 2026; assessment dates differ and the snapshot is not a live status lookup.

Chewing rates are recordings from small samples with variable zoo diets, often one animal; labels explicitly say recorded. Original durations are retained in notes and converted as 60000 / milliseconds per cycle. Prey-size endpoints are published comparative diet bounds, not individual prey weights or the largest animal a predator could defeat. Eye length is axial; visual acuity uses behavioral observations only.

New species: horse, dromedary camel, European rabbit, house mouse and ring-tailed lemur. Each has original animated species-specific SVG art, the same presentation size, and an always-visible name.

## Reproduction

Pinned primary snapshots are included in the separate source archive. Run scripts/expand-animalstats-senses-diet.py, scripts/expand-animalstats-history-conservation.py, then scripts/redesign-animalstats-prototype.py. Snapshot hashes, source rows, authorship years, IUCN taxon IDs and excluded records are retained in the source audits.

## Still required

This is meaningful expansion, not completion of the 200–500 target. Larger physiology and insect sources still need comparable protocols, exact taxon matches, more familiar animals and source-level audits. Daily release approval remains separate.

## Validation

Production build and 39 browser/catalog checks passed, including all candidate board validation, source rankings, ordinal ties, one-sided browsing, opposite values, retained links, click/drag placement, removal and phone layouts. The approved database catalog is synced with 1,101 changed/recent observations; its playable labels and source coverage are checked independently.
