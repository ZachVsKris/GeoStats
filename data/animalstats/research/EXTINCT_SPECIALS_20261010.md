# Extinct Specials

Separate living/extinct board collections, enforced in shared board validation and therefore scoring. Regular Random, Daily and initial rotation use living animals. A top collection selector opens specials. Shared links preserve their exact collection and lineup. Expert specials are unavailable until six independent, suitable traits qualify.

The initial dinosaur release contains 42 exact species, 8 paired labels, 1,210 validated Scout/Adventurer boards and 481 distinct animal lineups. Every round contains three straightforward fossil/history comparisons and one bone measurement. Species coverage for every comparison is 42, exceeding the scoped minimum of 20. All 42 species have at least one eligible board. Opposites never share a board. Normal score schedules and result/data/CSV components are reused.

Measurements come from the full Benson et al. 2014 supplemental workbook (975 rows, 27 columns). Only adult, non-bonebed femur measurements with original references and no estimated/mixed-specimen notes qualify. Juveniles, reconstructed masses, regressions, inferred speeds and contested selected taxa are excluded. Multiple adult specimen lengths retain their reported range; boards cannot overlap. PBDB supplies the exact species join, naming authority, occurrence-record count and fossil age interval, preserved without midpoint conversion. Fossil records do not measure past population, evolutionary origin or the certainty of extinction time.

Artwork uses equal frames and recognizable anatomical groups, with illustrative colors. Static mode shows reconstructions because these species cannot be photographed. Illustration proportions never encode source statistics.

Rebuild: install Python xlrd, run intake-animalstats-extinct.py, expand-animalstats-extinct.py, render-animalstats-extinct-art.py, generate-animalstats-extinct-boards.py, then node scripts/test-animalstats-extinct.mjs --write. Raw-source URLs/hashes are in extinct-source-manifest.json. No publisher R scripts are executed.

The next mammal source is PHYLACINE's full 5,831-row, 25-field table. Its 352 EX/EP rows include familiar extinct mammal candidates. They remain research-only: Reported does not prove directly measured and other rows explicitly infer/impute body mass. Stable-release verification and original measurement review must precede admission. Bats have not been expanded.

Checks: complete dataset provenance/counter validation, every released board, perfect score of 400, mixed collection rejection, duplicate assignment rejection, ordinary opening rotation, TypeScript and production build passed. Browser layout/interaction checks are not yet complete.
