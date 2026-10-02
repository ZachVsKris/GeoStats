# AnimalStats paired-category prototype

This private preview replaces reproduction-heavy and frog-heavy board selection with at least half intuitive questions on every individual board. Generation tries the highest intuitive count first; specialist details are optional. Scout and Adventurer have two to four intuitive questions; Expert has at least three. Life-history metrics are capped at one per Scout/Adventurer board and three per Expert board. Every category has a playable opposite, using identical source observations. Opposites and closely related measurements cannot share a board. All category winners are different, so a perfect allocation remains attainable.

The playable pool contains 517 direction-specific rounds, 76 animals and 29 category pairs. The broader research collection remains accessible in the Field Guide. There are 36 paired metrics in the measurement archive; incomplete intersections do not enter play. Categories include mass, lifespan records, flight, wingspan, breeding-range area, published mammal range-map area, directly weighed brain cohorts, and selected life-history comparisons. Beak width/depth, lower-leg length and wing shape are excluded. Tail length is a specialist detail. Pregnancy duration, number of young and incubation duration are intuitive questions; sexual maturity and weaning remain specialist details. Distinct concepts may have statistically correlated rankings; identical or reversed rank vectors, repeated metric keys and shared winners remain forbidden.

Geography comes from 144 Animal Diversity Web species accounts. The UI translates their biogeographic labels and links each account. These labels include introduced distributions and are not native-only range claims. Playable animals cover the Nearctic, Neotropical, Palearctic, Oriental, Ethiopian, Australian and Antarctic regions, oceanic islands, and Atlantic, Pacific and Arctic waters. Random play chooses animal groups before board counts and gives regions absent from the previous round an equal chance. It avoids consecutive identical lineups where alternatives exist.

## Evidence and limitations

Numbers remain observed or compiled from named sources; no imputed measurements are admitted. Paired directions copy every observation, note, bound and source exactly. Five-percent adjacent separation and supplied range checks apply. Missing bounds remain explicitly unknown and keep daily approval separate.

New brain data includes only AnimalTraits records explicitly marked `brain weighed`, originally reported in grams or kilograms. Volume conversions and records without a measurement method are excluded. Published cohort medians and their full observed envelopes are used; cohort sex and age are not standardized and this is disclosed in the definition and source notes. Brain size is not intelligence. This subset is suitable for source-aware playtesting, pending daily review.

Some requested concepts still lack comparable source coverage: universal strength, population rankings, lifetime path length, precise diet diversity and endangerment-as-a-number are excluded. Scout has 242 rounds, Adventurer 221 and Expert 54. Play includes mammals, reptiles, birds and selected sharks. Insects, shellfish and amphibians remain in the research collection but do not yet have eligible illustrated boards. This is a prototype of the approved direction, not a claim of completed worldwide taxonomic coverage.

Mammal mapped range imports only positive, exact-species GIS area values from PanTHERIA WR05 August 2008, whose range maps date to 2003. It is historical mapped extent, not current occupied habitat. Model-adjusted body-length and other estimated PanTHERIA traits are excluded.

## County fair design

The bunting-trimmed ring holds animated SVG contestants and four or six ribbon stands on one screen. Eighty species have explicit drawings; 76 currently enter the 517 valid boards. Every drawing uses a 200×160 frame at equal presentation size. Names are always visible above each contestant in an attached nameplate. Species features include long-necked ostriches and emus, a platypus bill and webbed feet, distinct primates and bear markings, and individual bird bills/plumage.

Mouse and touch dragging, either-order tap selection, keyboard selection, swapping, and × removal are supported. Blink, head, tail and limb animations respect pause and reduced motion. Results award the real first-place animal; no breeding, birth or hybrid system remains.

The active board and submit button fit desktop 1440×900 and 1366×768 and phone 390×844 and 375×667, including Expert’s eight contestants and six stands. Prize browsing, results, history and the field guide may scroll. The renderer is `components/AnimalSprite.tsx`, profiles are `lib/animalstatsCartoons.ts`, gameplay is `components/AnimalStatsGame.tsx`, and styling is `app/animals/animal-sanctuary.css`.

Preview is enabled only by the existing feature branch or explicit preview flag; production navigation is unchanged. The immutable pinned catalog is validated once per server worker, then reused. Daily still requires a review bound to the exact board and data fingerprints.

## Expanded county fair (2026-10-02)

The Prizes tent browses playable sourced pairs, with search and question-style filters. Either direction launches a compatible board trail; changing difficulty or returning to Random clears the trail. Challenge links pin the exact board ID without revealing assignments. Existing Vercel share access is preserved when supplied in the fair_share URL fragment; those access links expire independently of board IDs.

Judging reveals a staggered award ceremony and every animal’s ranked source value, highlighting the player’s entry. Very small W/g values retain three significant digits rather than rounding to zero. Help explains allocation, swaps, removal, equal illustration frames, and board-relative rankings. Focus stays inside the help dialog; Escape closes it. Animation respects pause and reduced motion.

New eligible pairs cover normal complete permanent tooth counts, empirical swimming travel speed, adult EEG paradoxical/REM sleep, laboratory basal energy use, and basal energy per gram using the source-matched metabolic assay body mass. Teeth are exact dental-formula counts, with direct observation reference links. REM is not a count of dreams. Basal energy is not food consumption. Travel speeds are observed study means, never maximum sprint claims or model predictions. Full included study-mean envelopes prevent overlapping comparisons.

The land-travel pair remains in the archive because its four eligible contestants cannot form a distinct-ranking, distinct-winner board; it is not advertised in the playable prize tent. Population abundance, current extinction risk, bite force, lifetime distance and generic strength are not fabricated to fill coverage gaps.

Six additional drawings distinguish basking, scalloped hammerhead, shortfin mako, leopard and whale sharks, plus loggerhead turtles. Sharks have vertical caudal fins and gill slits; whale sharks have pale spots, leopard sharks dark saddles, and hammerheads broad heads. Loggerheads have flippers and a broad beaked head. The generator requires an explicit illustrated profile; unsupported taxa cannot silently use generic fallback artwork. All 80 illustrations are frame-checked.

Reproduce additions with `python scripts/expand-animalstats-fair.py`, then `python scripts/redesign-animalstats-prototype.py`. The travel archive is downloaded on demand and its SHA-256 is pinned in `fair-expansion-observations.json`; source records and arithmetic are preserved there. Build with `ANIMALSTATS_PREVIEW_ENABLED=true npm run build`, run the AnimalStats Chromium end-to-end suite, and run `node scripts/test-animal-cartoon-frames.mjs`. Daily boards remain gated by independent source/uncertainty/editorial review; no approvals are invented.
