# Bulk AnimalStats database intake — October 10, 2026

This intake acquires whole source tables and inventories their fields. It adds **zero playable labels**. Field counts include overlapping measures and do not establish how many categories will pass review.

| Source | Acquired | Review constraints |
| --- | --- | --- |
| [Marsupial Database](https://doi.org/10.6084/m9.figshare.29626664) | Complete observation and mean tables: 414 species, 35 traits, references alongside individual values | Follow upstream sources to separate measurements from inferred values. Prefer observation table over unqualified averaging. Several traits duplicate current mammal categories. |
| [MBA BIOTIC](https://api.mba.ac.uk/help_biotic) | Complete export: 685 published species rows, 39 biological fields, 11 context columns | Many fields are bins or qualitative codes. Exclude unknowns; never infer midpoint measurements. CC BY-NC-SA text license needs product-use review. |
| FishBase, version 26.06 | 13 complete trait tables, species table, bibliography | Preserve population, sex, stage, units, measurement types and reference IDs. Growth fits, inferred trophic levels and image geometry are held. |
| SeaLifeBase, version 26.06 | 10 complete trait tables, species table, bibliography | Same reference/method checks; tables vary greatly in coverage. Existing species-table measures are not new categories. |
| [World Spider Trait Database](https://doi.org/10.1093/database/baab064) | Complete catalog of 234 trait definitions; 100-record public access sample | Full observation download is unfinished. Definitions include specialist traits, not 234 useful categories. Restricted observations remain excluded. |
| [Mammal knowledge-gap synthesis](https://doi.org/10.5061/dryad.05qfttfdq) | Dataset metadata and seven-workbook manifest | Workbook endpoints returned 401/403. Its advertised 5,706 species are not acquired trait records. Binary availability matrices must never become biological rankings. |

## Reproduction

Run `python scripts/download-animalstats-bulk-intake.py`, then `python scripts/audit-animalstats-bulk-intake.py`. Dependencies are `libarchive-c` (plus system libarchive) and `pyarrow`. The downloader checks available snapshot hashes and the publisher's Marsupial archive checksum. It reads downloaded data without executing source software.

The JSON audit includes source URLs/DOIs, version, file hashes, every field, nonmissing and numeric record counts, taxon coverage, exact current-roster matches where available, interest flags and promotion holds. Exact-name matches are deliberately conservative; synonym reconciliation remains separate. Reference fields and bibliographic records support provenance checks but do not themselves verify methods.

## Admission

Manually review interest, reconcile duplicate metrics, resolve original references and reject modeled/imputed observations before making categories playable. Compare compatible units, sexes, stages, populations and summary statistics. Keep opposites together in review. Broad rankings need at least 50 animals across three major groups; scoped rankings need 20; breed rankings need eight. Boards must retain familiar animals and a majority of intuitive categories. Existing scoring and live gameplay remain unchanged by this research intake.
