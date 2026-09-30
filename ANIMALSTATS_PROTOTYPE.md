# AnimalStats protected preview

Work remains on `feature/animalstats-prototype`. `/animals`, `/animals/review`, `/api/animals/results`, and `/cat` require the runtime preview flag or this branch's Vercel preview environment. Public GeoStats has not been promoted or changed.

## Current coverage

152 animals, 67 trait entries, 2,733 sourced observations and 138 approved photographic icons. There are 62 playable random candidates: 42 Scout, 16 Adventurer and four Expert. The pool includes bears, mixed mammals, frogs/amphibians, reptiles and birds. All Expert candidates currently compare mammals. Seventeen of 62 boards are all birds; source-compatible flight and sleep boards are retained alongside the new life-history packs. Fish and invertebrate packs remain incomplete; bulk research catalogs are not silently counted as playable coverage.

Random play chooses an animal subject group before choosing a board, and changes group on the next board whenever alternatives exist. Date-based opening boards rotate mammal, amphibian, bear, bird and reptile subjects; Scout and Adventurer never both open on birds. Same-group and mixed boards remain available. All traits on every board have distinct first-place animals; all 62 boards attain the full 400/600 score.

Sources include pinned AnAge Build 15, AVONET v7, AmphiBIO v1/version 5, raw August 2015 Amniote life histories, Alerstam et al. 2007 measured flight speeds and wingspans, Verberk et al. 2020 field diving records, Boston University EEG sleep observations, HomeRange field observations, and EURING September 2023 ringing age records. Flight is cruising airspeed rather than maximum speed. Sleep measurements use laboratory adult EEG recordings. Ringing records are published minimum known ages, not typical lifespans. Home-range disagreement envelopes currently prevent those observations entering playable boards.

Rebuild the base with `build-animalstats-pilot.py`, `add-animalstats-birds.py`, and `expand-animalstats.py`; then run `add-animalstats-interesting-traits.py`, `add-animalstats-amniote.py`, `add-animalstats-interesting-traits.py` again to annotate imported traits, synchronize approved photos, `refine-animalstats-traits.py`, `generate-animalstats-boards.py`, `find-animalstats-expert-boards.py`, and `audit-animalstats.py`. Downloaded source archives are ignored. Selected observations and provenance are retained in the repository.

Amniote observations use exact species rows without subspecies interpolation; distinct positive reports supply a median and source disagreement envelope, not a confidence interval. Unknown-origin longevity is excluded. AmphiBIO egg diameters are excluded because measurement definitions differ; frog snout-vent length is separate from salamander total length. AnAge quality/sample-size flags describe longevity only. Missing uncertainty remains explicitly unknown.

## Review and daily admission

The validator rejects incompatible sources, units, sex/life stages, origins, estimates, missing approved portraits, overlapping reported ranges, numerical gaps below 5%, redundant concepts, and repeated winners. Editorial admission requires distinct questions, varied rankings and several animals competing across traits. Pregnancy/incubation duration, offspring count, maturity, milk dependence and offspring size have separate meanings; mirrored questions and nearly identical rankings are still rejected. Expert permits two anatomical questions only if their orderings are sufficiently different. The coverage-graph search considers complete six-trait intersections and prunes pairs with ties, small gaps or overlapping bounds before assembling eight-animal boards. Validation produces candidates, not editorial approval.

**Zero boards are currently approved for daily play.** `reviews.json` requires reviewer/date and source, uncertainty and playability evidence bound to the exact board and data. Daily shows an awaiting-review state until those reviews exist. Browser PASS labels are playtest feedback and cannot authorize a daily board. `/animals/review` exposes the holds and provenance.

## Experience and account storage

Small portraits stay visible. Click either an animal or trait first, drag into a trait, swap placements, and reset. Random play, result sharing, a searchable Field Guide and personal stats are integrated. CAT navigation introduces an atlas/habitat/underground visual identity; Things is a visual placeholder, not a playable game.

Device history records the first completion of a board per day. Signed-in future results use the separate `animal_game_results` table. The additive migration has been applied. Owner-only RLS permits authenticated reads; browser writes are denied. The server derives scores from canonical assignments and uses first-completion uniqueness. Existing guest history is not imported into an account. Countries scores remain separate.

Build with `ANIMALSTATS_PREVIEW_ENABLED=true npm run build`; verify with the same flag and `npx playwright test e2e/animalstats.spec.ts --project=chrome-desktop`. Account ownership and browser-write denial were checked in a rolled-back database transaction. A live signed-in browser session still needs validation.

## Visual identity

Blue globe-C, amber cat-A and green shovel-T follow the supplied reference. The small SVG cat blinks and moves its tail slowly, offers a pause control and respects reduced motion. Rainforest artwork stays behind a quiet paper surface; photos remain small visible round icons. The redesign adds a more legible cream working surface, forest-green controls, amber difficulty tabs, trait-family labels and a compact desktop layout. Reptile and amphibian boards receive restrained palette accents.

`public/animalstats/rainforest.webp` was generated using built-in image generation and optimized to WebP. Prompt: wide rainforest cut-paper/screenprint illustration in jade, teal, moss, cream and amber; toucan, monkey, tapir and jaguar in outer vegetation; central 65% quiet misty cream-green space; no text or interface.
