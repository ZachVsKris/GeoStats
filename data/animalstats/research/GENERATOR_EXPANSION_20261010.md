# Generator expansion, October 10, 2026

Published eligibility audit: 19,064 playable boards, 141 distinct labels, 167 trait IDs, 188 living animals appearing in rounds. Previous release: 12,341 boards, 139 labels, 186 round animals. This is primarily board-combination expansion, not a claim of 6,723 new biological facts.

The generator now attempts Scout, Adventurer and Expert for mammals, birds, reptiles, amphibians, fish, insects, invertebrates, dogs, cats, mixed and marine. Expanded invertebrate groups include cephalopods, gastropods, cnidarians, arachnids and horseshoe crabs. Publication ceilings and lifetime per-lineup variant limits are removed. Generation uses a configurable runtime budget and a seed incorporating the existing catalog, so additional passes can continue. One new board per sampled lineup per pass prioritizes variety.

New v6 boards require at least half intuitive categories and at least one/two familiar animals, depending on difficulty. The numeric rank gap is 3% for v6; every adjacent placement must satisfy it. The life-history-count ceiling is removed for v6. Exact ties at every placement and overlapping bounds remain blocked. Canonical sources, measurement basis, life stage, sex, wild/captive distinctions, non-imputed values, distinct metrics and unique winners remain enforced. Existing boards retain their prior validation policy.

The 50/20/8 publication floors have not been replaced in this release: a coverage-review mechanism still needs to assess each smaller source. Image-free rankings already exist; gameplay still requires approved images.

Remaining zeros have diagnostic evidence: insects have only two approved portraits, neither with four publishable metrics; invertebrates have ten approved portraits but only one animal with four distinct publishable metrics. Cats have six animals with four metrics, but their only six-animal lineup lacks four compatible distinct metrics. Fish and amphibian Expert attempts cannot find six compatible, independently winning facts. These are measured bottlenecks, not assumed shortages.

MacroTraits was acquired from the author-linked Zenodo package: 1,893 species, 41 traits, 408,888 coded evidence rows, 8,280 references and 43 exact current-roster matches. Frozen R data and labels are retained. Its scores are fuzzy-coded modalities, not measurements. No biological point values were invented from them; intake remains research-only pending original-reference review.

Validation: all 15,101 group boards passed source coverage, board validation, composition and independent-winner checks; perfect scoring tested in each available group/difficulty. Coverage tests, nonlinear-scoring tests, TypeScript and production build passed.

The initial no-percentage-gap pass qualified 39,832 boards. The user reaffirmed no ties and a minimum 3% numeric difference at every placement; the corrected release qualifies 19,064. New Expert combinations from that first pass fail the restored spacing requirement and are excluded. `--validate-only` can re-audit both board shards without generating additional rounds.
