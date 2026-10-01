# AnimalStats paired-category prototype

This private preview replaces reproduction-heavy and frog-heavy board selection with at least half intuitive questions on every individual board. Generation tries the highest intuitive count first; specialist details are optional. Scout and Adventurer have two to four intuitive questions, and Expert has three or four. Every category has a playable opposite, using identical source observations. Opposites and closely related measurements cannot share a board. All category winners are different, so a perfect allocation remains attainable.

The playable pool contains 267 direction-specific rounds, 74 animals and 22 category pairs. The broader research collection remains accessible in the Field Guide. There are 30 paired metrics in the measurement archive; incomplete intersections do not enter play. Categories include mass, lifespan records, flight, wingspan, breeding-range area, published mammal range-map area, directly weighed brain cohorts, and selected life-history comparisons. Beak width/depth, lower-leg length and wing shape are excluded. Tail length is a specialist detail. Pregnancy duration, number of young and incubation duration are intuitive questions; sexual maturity and weaning remain specialist details. Distinct concepts may have statistically correlated rankings; identical or reversed rank vectors, repeated metric keys and shared winners remain forbidden.

Geography comes from 144 Animal Diversity Web species accounts. The UI translates their biogeographic labels and links each account. These labels include introduced distributions and are not native-only range claims. Playable animals cover the Nearctic, Neotropical, Palearctic, Oriental, Ethiopian, Australian and Antarctic regions, oceanic islands, and Atlantic, Pacific and Arctic waters. Random play chooses animal groups before board counts and gives regions absent from the previous round an equal chance. It avoids consecutive identical lineups where alternatives exist.

## Evidence and limitations

Numbers remain observed or compiled from named sources; no imputed measurements are admitted. Paired directions copy every observation, note, bound and source exactly. Five-percent adjacent separation and supplied range checks apply. Missing bounds remain explicitly unknown and keep daily approval separate.

New brain data includes only AnimalTraits records explicitly marked `brain weighed`, originally reported in grams or kilograms. Volume conversions and records without a measurement method are excluded. Published cohort medians and their full observed envelopes are used; cohort sex and age are not standardized and this is disclosed in the definition and source notes. Brain size is not intelligence. This subset is suitable for source-aware playtesting, pending daily review.

Some requested concepts still lack comparable source coverage: universal strength, population rankings, lifetime path length, precise diet diversity and endangerment-as-a-number are excluded. Scout and Adventurer include mammals and reptiles; Expert now has 44 mammal rounds and two bird rounds; 40 of its 46 rounds have four intuitive questions. Fish, insects, shellfish and amphibians remain in the research collection but do not yet satisfy the minimum-half-intuitive and distinct-winner rules. This is a prototype of the approved direction, not a claim of completed worldwide taxonomic coverage.

Mammal mapped range imports only positive, exact-species GIS area values from PanTHERIA WR05 August 2008, whose range maps date to 2003. It is historical mapped extent, not current occupied habitat. Model-adjusted body-length and other estimated PanTHERIA traits are excluded.

## Animated sanctuary design (October 1, 2026)

The play surface is now an animated animal pen above four or six trait podiums. All 74 playable animals have anatomical 3D profiles, articulated bodies, head features, markings and palettes. Their joints animate independently; CSS animates the surrounding clouds, butterflies and nursery sequence. Hover, keyboard focus, selection or a pointer hold reveals an animal's name. Pointer capture supports mouse and real touch dragging, including moving a podium resident; tap/keyboard selection remains available and placements swap when needed.

After scoring, each selected animal meets the actual first-place animal for that trait. A replayable nine-second approach, courtship, mating, time jump and birth animation produces a deterministic fantasy offspring with the selected parent's body and the correct parent's head, using articulated species models. Matching parents produce a baby of the same species. Each reveal is replayable. The offspring is explicitly fictional; sourced values and scoring are unchanged. Pause controls and reduced-motion styles reveal the offspring immediately without the transition.

Verification includes mouse swapping/dragging, real CDP touch dragging, name reveal, every offspring's parent IDs against the scored winner, replay/pause, reduced motion, phone overflow, and the existing three-mode, source, scoring and history checks. The canvas component lives in `components/AnimalSprite.tsx`, the anatomical profiles, rigs and shared renderer in `lib/animalstats3d.ts`, reveal logic in `components/AnimalHybridReveal.tsx`, and the scoped visual layer in `app/animals/animal-sanctuary.css`.

## Reproduce

Run `python scripts/generate-animalstats-boards.py`, then `python scripts/audit-animalstats.py`. Regional account snapshots are cached in `data/animalstats/research/regions.json`; numeric bulk inputs remain in the existing source archive. Daily reviews are not created by either script.

Run `ANIMALSTATS_PREVIEW_ENABLED=true npm run build`, then `ANIMALSTATS_PREVIEW_ENABLED=true npx playwright test e2e/animalstats.spec.ts --project=chrome-desktop`. Tests cover every board's numeric validation, exact high/low observations, minimum-half-intuitive balance, exclusion of obscure bird anatomy, distinct winners, mobile layout, interactions, sources, daily gate and saved history.

Preview is enabled only by the existing private feature branch or explicit preview flag. Production navigation is unchanged.

### Living 3D characters, v4

All 74 playable species have anatomical profiles for articulated, procedurally modeled 3D cartoon characters. Features include species-specific proportions, muzzle and bill shapes, ears, horns, tusks, trunks, shell, flukes and plumage or coat markings. These are stylized models, not scanned or photorealistic animals. The old raster artwork remains archived and is no longer used in the game.

Leg and knee joints, heads, blinking eyes, tails, wings and trunks animate independently. Hover turns the head toward the player. Feet share a common ground line; characters are normalized by projected geometry into equal presentation frames, excluding real-world scale as a clue. The old whole-image roaming animation is disabled. Rounded species-specific ears, expressive eyes, continuous skinned tails and articulated trunks, differentiated feet and coat details make each animal recognizable and playful. All skinned parts bind after assembly, and static geometry is batched per material into one shared WebGL renderer.

A single WebGL renderer renders each visible character to its own canvas. Static meshes are merged by material to reduce draw calls. Off-screen characters retain their first frame and stop rendering until visible; paused characters retain their pose. Shared geometry and materials avoid duplicate allocations, while per-character geometry is disposed on unmount.

Fictional offspring inherit the selected animal's articulated body and the correct animal's head, fitted to the body socket. Matching parents produce a baby of the same species. Nursery animations begin as each card enters view: parents share a 3D scene, investigate one another, and use mounting, aquatic contact or coiling poses. A clearly labeled time jump precedes live birth, hatching or pouch entry according to the body parent. Boa constrictors give live birth; platypuses hatch from eggs. Newborns start small and are greeted by their mother. These are condensed, non-graphic cartoon sequences; cross-species offspring remain fictional. Replay, pause and reduced-motion behavior remain available.

Occupied podiums retain their accessible × button for returning an animal to the pen. Tests cover profile coverage, joint motion, rendered frame changes, paused frame stability, equal canvas sizing, touch dragging, removal, scoring and the pairing/birth sequence.
