# Dataset-first animal research

The locally generated compressed catalogs contain whole-table imports, not approved game values. Full third-party catalogs are excluded from the public repository; scripts, checksums and coverage summaries are retained. They are not imported by the Next.js client or included in daily rotation. `pilot.json` remains the reviewed gameplay dataset.

Run `python scripts/import-animalstats-databases.py` with Python 3 and `pyarrow` installed, then `python scripts/audit-animalstats-database-overlap.py`. Put the upstream files listed in `manifest.json` under `data/animalstats/source/`. The manifest records SHA-256 digests, byte sizes, source versions and database URLs; the importer writes deterministic gzip files. Raw downloads are ignored by git.

Upstream sources:

- SeaLifeBase: rOpenSci rfishbase's public snapshot, `slb/v26.06/parquet/species.parquet` at the S3 URL in the manifest. The source table contains 102,727 rows; the catalog includes only the 49,848 rows explicitly labeled Animalia. Missing taxonomy is excluded rather than guessed. Retain primary reference identifiers and length types. Redistribution/license review is required before exposing these records in the product.
- AnimalTraits 1.0.7: Zenodo record 6468938, `observations.csv`; CC0. Store separate study observations with their measurement methods and units.
- InsectBiteForceDatabase 1.0.0: Zenodo record 8183211, `iBite_table.csv` within the published archive; CC BY 4.0. Rühr et al. (2024), Scientific Data, DOI 10.1038/s41597-023-02731-w. Preserve reported geometric means and count unique specimens rather than repeated bite series.
- BIOTIC: `https://api.mba.ac.uk/biotic`, downloaded 2026-09-30; CC BY-NC-SA 4.0 for text. Categorical and prose fields remain categorical and prose. Photo rights are separate.
- GlobTherm: Zenodo record 4976423, `GlobalTherm_upload_02_11_17.csv`; Bennett et al. (2018), DOI 10.1038/sdata.2018.22. Original duplicate column headings are preserved by position. Endpoint, acclimation, ramp and exposure duration require review before comparison.

`insect-coverage-intersections.json` joins whole catalogs by exact scientific names. It excludes unnamed `sp` identifiers and requires at least three independent bite-force specimens. It does not resolve synonyms or assume unmatched species have no data elsewhere.

## Admission requirements

1. Confirm taxonomy, units, life stage, sex and observation origin.
2. Match assay endpoints and protocols; preserve uncertainty and independent sample counts.
3. Keep estimates and ordinal buckets distinct from measured numerical observations.
4. Choose genuinely different trait families; head size, body size and wing size do not make three distinct gameplay decisions.
5. Review licensed photos and board comparisons before adding a playable pack.
6. Approve daily boards separately; bulk import never grants approval.

The exact-name audit found 130 named insects with at least three independent bite-force specimens, but only one intersects GlobTherm and nine intersect AnimalTraits. Therefore these imports alone do not establish a four-family insect board. This is an explicit coverage gap, not a reason to relax measurement review or disguise repeated anatomy traits as variety.

## Broad import pass (2026-10-02)

Run `python scripts/import-animalstats-broad-catalogs.py` (requires openpyxl). This adds whole-table research snapshots for AmphiBIO, the Amniote life-history database, PanTHERIA WR05, AVONET BirdLife taxonomy, and SquamBase 1.0. Only one taxonomic representation per catalog is counted; overlapping species across databases are not unique animals. The resulting `broad-catalog-manifest.json` records input hashes and field coverage. `trait-review-queue.csv` is the manual decision worksheet, with preliminary interest classifications, not approved categories. Raw catalogs remain private and outside gameplay.

### Review sequence

1. Ingest broadly before choosing a category count; preserve original values, metadata, references, missing-value sentinels and inference flags.
2. Audit source dictionaries and licenses. Reject modeled values, including SquamBase allometric masses and PanTHERIA EXT columns, from gameplay. Nonmissing field counts are not usable observation counts.
3. Manually rate intuitive appeal, specialist interest, familiar-animal coverage, worldwide coverage, and measurement comparability. Shoulder height is specialist research, not overall height.
4. Merge equivalent concepts across sources only when definitions match. Do not count taxon-specific copies as distinct traits. Keep measurements such as total length and snout–vent length separate.
5. Audit the intersection of eligible traits by animal, not merely each table's size. Seek mixed-group boards; neither abundant bird measurements nor abundant marine rows should dictate rotation.
6. Promote only reviewed observations and meaningful categories. Reverse prizes share the same observations. Every board requires at least half intuitive categories, preferably more.

Reference tables remain in the pinned source archives (AmphiBIO references, Amniote references and sparse source rows, PanTHERIA References; AVONET metadata and source sheets). SquamBase includes row-level metadata; its separate trait dictionary is also downloaded. Review these before promoting an aggregate value.

## Underrepresented groups source pass (2026-10-02)

`python scripts/import-animalstats-gap-sources.py` requires openpyxl and pyarrow. It imports research-only tables for LepTraits consensus and record-level sources, the Odonate Phenotypic Database, FishBase v26.06, CarniDIET 1.0, COMBINE reported data (with source tables retained), and DISPERSE. `gap-source-manifest.json` records input hashes and row/name/field coverage; `gap-trait-review-queue.csv` records initial interest flags and comparability restrictions. These counts are not approved observations or global unique-species counts.

Prioritize insects, spiders and non-shark fish for gameplay admission. Mammals dominate current board appearances but need more distinct, familiar facts. Research volume must not set rotation probabilities. LepTraits reference rows must be matched to consensus entries; COMBINE reported data still requires checking upstream estimates. CarniDIET prey richness depends on study effort; frequency, biomass and volume are not interchangeable. DISPERSE is fuzzy-coded and may be genus/family-level, so it provides discovery/context, not precise numeric ranks. FishBase reference IDs must be joined to original studies, and modeled traits excluded.

Additional verified source leads, not yet bulk-imported:

- World Spider Trait database: https://doi.org/10.1093/database/baab064 ; global observation repository with references, sex/stage and methods. Check export access and individual-study provenance.
- GlobalAnts: https://doi.org/10.1111/icad.12211 ; global ant morphology/ecology/life history. Morphospecies and locality abundance are not worldwide populations; published coverage is stronger for morphology than life history.
- Bee Functional Trait Database: https://big-bee-network.github.io/bee-functional-trait-database/ ; methods, reference DOI and specimen context. Linked body-size GitHub currently exposes only a README, so do not count that repository as imported observations.
- Chinese bee specimen measurements: https://doi.org/10.5061/dryad.v9s4mw703 ; direct morphological measurements are candidates, inference outputs excluded.
- European wild bee/hoverfly traits: https://doi.org/10.1038/s41597-026-07513-8 ; useful categorical behavior and habitat context, but converted tongue lengths and body-size bands cannot be treated as direct measurements.
- New Zealand aquatic invertebrate traits: https://niwa.co.nz/freshwater/aquatic-invertebrate-traits-database ; regional source/context, not a global balance solution; review trait bands.
- Freshwaterecology.info: https://www.freshwaterecology.info/ ; European coverage; verify export access, taxonomic resolution and permissions.

No taxonomic group has earned a rotation quota simply by having a large source table. Admission must test overlap of reviewed traits, familiar species and geographic spread, followed by board-level appearance audits.

## Manual editorial screen and readiness review

Run `python scripts/audit-animalstats-trait-screen.py` after all three research import passes. It applies explicit editorial concept mappings and records exclusions in `screened-traits.csv`. Its scope is field-level screening, not certification of every observation. Run `python scripts/fetch-animalstats-insect-accounts.py`, then `python scripts/audit-animalstats-insect-readiness.py` for the targeted insect review. Full account prose remains private; only availability, hashes, field lists and review outcomes are tracked. See `AUDIT_2026-10-02.md` for results and promotion gates.

`python scripts/fetch-animalstats-research-snapshots.py` restores additional downloads listed in `additional-downloads.json` and verifies SHA-256 before writing. A changed upstream file fails closed for review. Existing raw imports remain pinned by their previous manifests. No script in this research pass modifies gameplay data or grants observation approval.
