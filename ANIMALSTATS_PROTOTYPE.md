# AnimalStats release

## Current scope

The October 5 release has 176 catalog animals, 6,995 released observations and 180 archived trait directions. Default play uses 3,564 composition-approved boards, 101 animals and **106 distinct visible prize labels** (120 underlying source-specific directions). Opposites count separately in the label total; repeated labels do not. The requested 200-label minimum and 500-label ambition are not complete.

Every default Scout/Adventurer board has at least three intuitive prizes out of four. Expert has at least four out of six. Familiar animal types anchor every board: one of four contestants or two of six/eight. Opposites, identical/reversed orderings and shared winners cannot appear on the same board. A perfect allocation is attainable. Scientific names remain exact; recognizability is an editorial classification, never a data substitution.

All 3,990 stored candidates pass structural checks. The 426 older composition-ineligible challenges remain addressable by their original links but do not enter default rotation. Shoulder-height boards are excluded. Missing illustrations, invalid source references, unit mismatches, source-method mismatches, inferred facts, unapproved rows, incompatible sex/stage, overlapping supplied bounds and ranks less than five percent apart block release.

## Presentation and interaction

Cute mode uses the county-fair pen, attached names, uniform 200×160 animation frames and unnumbered prize podiums. There are 107 explicit native species drawings. Real mode uses the GeoStats matching layout, licensed real photos and measurement icons. The top lever preserves choices, round and results. Both modes use the actual shared GeoStats score summary, result rows, optimal choices and ranking components.

Both-direction click/tap selection, drag, swaps, return-to-bank and × removal are supported. Category definitions open on hover, focus or tap. Results include board rankings, full released source rankings, provenance and CSV exports. Score sharing supports text, PNG preview/download and native sharing with fallback. No breeding, birth or hybrid system remains. Motion respects reduced-motion preferences.

## New verified comparisons

- Museum ear length: six exact adult specimen cohorts, explicit millimetres and notch-to-tip measurements. Recorded cohort medians are disclosed as such, not population means or species maxima. Unknown ages, estimated measurements, inferred units, conflicting duplicates and domestic dogs misidentified as wild wolves are excluded.
- Mammal Diversity Database v2.5: 296 exact released counts matched to 54 unambiguous catalog taxa. Country/territory and continent lists follow the source's native/historical definition, including introductions before 1500 and excluding recent introductions. Uncertain country entries are excluded. Family diversity means recognized living species in the versioned taxonomic family, not individuals or offspring. Original CSV checksums and independent reconciliation are retained.
- Hibernation: directly reported conventional-hibernation records, with no estimated table means admitted.
- Treat-puzzle performance and practice: original tested cohorts, sample sizes, individual variation and exact recorded familiarization counts. The practice endpoint follows the common four-correct-in-five rule in the original Methods; animals absent from the test dataset are not inferred. These are task-specific cohort comparisons, never general intelligence rankings. Practice and performance cannot share a board.

## Rotation

Scout rotates mammals, birds and mixed boards. Adventurer rotates mammals and birds. Expert now has 12 valid bird boards across four distinct lineups, alongside the mammal pool. Expert subject weights favor mammals and allow softer group switching so the small bird pool does not occupy every other round. Board counts never directly determine subject exposure. Recent labels, contestants and lineups are downweighted; immediate identical lineups are avoided where alternatives exist.

A 9,000-draw audit reaches every available animal and label in each difficulty without immediate repeated lineups. The current Expert simulation is 2,161 mammal and 839 bird rounds. This is simulation evidence, not a promised fixed quota.

## Remaining expansion

Insect and other invertebrate coverage remains insufficient. The original AnthropInsect 2.0 workbook is staged with 5,867 source rows and explicit estimate exclusions; zero observations from that staging are approved for play. Citation-to-cell, life-stage, caste and unit ambiguities require primary-source review. Common domestic cats, dogs, cattle, sheep and chickens need better coverage; wild taxa must not be relabeled as domestic equivalents. Breed-dependent measurements need explicit cohorts.

The original CarniDIET 1.0 CSV and workbook are now pinned and checksum-verified: 29,121 study/prey rows for 103 source taxa, with 11 exact catalog matches. Source metadata distinguishes estimated biomass/volume from sample occurrence and dry-weight records. A primary-paper shortlist is staged; zero diet observations or labels are approved from this pass.

Universal strength, global IQ, abundance, lifetime travel and several other attractive comparisons still need defensible comparable data. Do not fill these gaps with guesses, modeled values or repeated category names.

## Verification

- `node scripts/audit-animalstats-playability.mjs`: full board/data/paired-direction/illustration audit, rotation and opening-board simulation.
- `python scripts/audit-animalstats-source-reconciliation.py`: exact pinned AnAge reconciliation.
- `python scripts/audit-animalstats-cognition-reconciliation.py`: independent exact arithmetic checks of all 20 released cohort endpoints and no practice/performance co-boards.
- `python scripts/audit-animalstats-mdd-reconciliation.py`: original MDD CSV checksum and all 296 released count checks.
- `node scripts/test-animal-cartoon-frames.mjs`: all 107 native drawings stay inside uniform frames.
- `node scripts/review-animalstats-art.mjs [species IDs]`: read-only drawing/reference-photo contact sheets.
- `node scripts/verify-animalstats-presentations.mjs`: desktop/phone, both modes, choices/results persistence, definitions, drag/click, rankings, source access, sharing fallbacks, perfect ear/cognition/MDD/Expert-bird rounds and zero page errors.
- `npm run build -- --webpack`: production compilation, TypeScript and route generation.

This branch previews Animals without changing the GeoStats main production branch. Permanent public deployment access has not been changed; temporary sharing access expires independently of challenge URLs.
