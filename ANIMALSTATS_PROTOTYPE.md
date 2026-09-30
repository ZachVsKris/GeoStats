# AnimalStats paired-category prototype

This private preview replaces reproduction-heavy and frog-heavy board selection with an exact 50/50 mix of intuitive questions and specialist details. Scout and Adventurer use two of each; Expert uses three of each. Every category has a playable opposite, using identical source observations. Opposites and closely related measurements cannot share a board. All category winners are different, so a perfect allocation remains attainable.

The playable pool contains 91 direction-specific rounds, 49 animals and 17 category pairs. The broader research collection remains accessible in the Field Guide. There are 33 paired metrics in the measurement archive; incomplete intersections do not enter play. Categories include mass, lifespan records, flight, wingspan, breeding-range area, tail length, beak dimensions, lower-leg length, wing shape, directly weighed brain cohorts, and selected life-history comparisons. At most one reproductive or development metric appears on a board.

Geography comes from 144 Animal Diversity Web species accounts. The UI translates their biogeographic labels and links each account. These labels include introduced distributions and are not native-only range claims. Playable animals cover the Nearctic, Neotropical, Palearctic, Oriental, Ethiopian, Australian and Antarctic regions, oceanic islands, and Atlantic, Pacific and Arctic waters. Random play chooses animal groups before board counts and gives regions absent from the previous round an equal chance. It avoids consecutive identical lineups where alternatives exist.

## Evidence and limitations

Numbers remain observed or compiled from named sources; no imputed measurements are admitted. Paired directions copy every observation, note, bound and source exactly. Five-percent adjacent separation and supplied range checks apply. Missing bounds remain explicitly unknown and keep daily approval separate.

New brain data includes only AnimalTraits records explicitly marked `brain weighed`, originally reported in grams or kilograms. Volume conversions and records without a measurement method are excluded. Published cohort medians and their full observed envelopes are used; cohort sex and age are not standardized and this is disclosed in the definition and source notes. Brain size is not intelligence. This subset is suitable for source-aware playtesting, pending daily review.

Some requested concepts still lack comparable source coverage: universal strength, population rankings, lifetime path length, precise diet diversity and endangerment-as-a-number are excluded. Scout and Adventurer include mammals and reptiles; Expert currently has bird boards because these are the available six-metric complete intersections. Fish, insects, shellfish and amphibians remain in the research collection but do not yet satisfy the new 50/50 and distinct-winner rules. This is a prototype of the approved direction, not a claim of completed worldwide taxonomic coverage.

## Reproduce

Run `python scripts/generate-animalstats-boards.py`, then `python scripts/audit-animalstats.py`. Regional account snapshots are cached in `data/animalstats/research/regions.json`; numeric bulk inputs remain in the existing source archive. Daily reviews are not created by either script.

Run `ANIMALSTATS_PREVIEW_ENABLED=true npm run build`, then `ANIMALSTATS_PREVIEW_ENABLED=true npx playwright test e2e/animalstats.spec.ts --project=chrome-desktop`. Tests cover every board's numeric validation, exact high/low observations, 50/50 balance, one reproductive metric, distinct winners, mobile layout, interactions, sources, daily gate and saved history.

Preview is enabled only by the existing private feature branch or explicit preview flag. Production navigation is unchanged.
