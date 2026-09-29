# AnimalStats prototype

This work is isolated on `feature/animalstats-prototype`. The existing GeoStats difficulty configuration supplies board dimensions and rank points. The `/animals` route is unlinked and requires `ANIMALSTATS_PREVIEW_ENABLED=true` at runtime. It is not a public launch.

`lib/animalstats.ts` defines animals, traits, sources, photos, observations, candidate boards, and review labels. Its validators reject incomplete provenance, duplicate identifiers, imputed values, missing or incompatible observations, missing approved photos, unfamiliar animals, parent/subspecies overlap, rank ties or gaps below 5%, overlapping reported bounds when supplied, and repeated category winners. The private route exposes numerical candidates for playtesting; none is approved for a public daily board until separately reviewed and marked `PASS`.

## Data admission

1. Identify canonical institutional or peer-reviewed sources, record their version, retrieval date and reuse terms. The pilot uses AnAge Build 15 and AVONET version 7, both with attribution licenses.
2. Define a trait precisely and use the same source and measurement basis for every animal on a board.
3. Record observed or directly compiled values and inspect meaningful uncertainty bounds. Do not fill gaps with estimates.
4. License and attribute a representative photo for every active animal. The pilot has 51 visually screened, approved photo assets among 58 candidate animals; the remaining animals cannot be selected on a board.
5. Run `python scripts/build-animalstats-pilot.py`, `python scripts/add-animalstats-birds.py`, and `python scripts/generate-animalstats-boards.py` to rebuild the versioned JSON. The AVONET workbook is fetched on demand and excluded from git because it is 21 MB. Run `ANIMALSTATS_PREVIEW_ENABLED=true npm run build`, then start a private preview with the same flag.
6. Playtest survivors and inspect uncertainty around close species means. No board should ship simply because the validator accepts it.

## Current state

The private prototype has **58 animals, 25 precisely defined traits, 716 sourced observations, 51 approved photos, and 30 numerical candidates** (10 per mode). It reuses GeoStats mode dimensions and rank points and displays source and photo attribution. Daily pilot selection rotates themed, clustered, and cross-animal candidates across Scout and Adventurer while preserving at least two board types per day. Expert candidates currently use bird boards only; cross-bird/mammal boards lack enough comparable universal traits.

The results screen collects optional playtest labels and notes in browser storage and can download them as JSON. These are reviewer notes, not approvals in the dataset. The candidates still need independent uncertainty review and human playtesting, especially for species averages with few specimens. The prototype is not ready for production integration. No Vercel preview has been deployed yet.
