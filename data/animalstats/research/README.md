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
