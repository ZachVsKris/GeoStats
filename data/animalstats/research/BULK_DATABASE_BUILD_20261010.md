# Searchable bulk AnimalStats research database

Built from seven whole-source imports, with **37 tables and 671,334 source records**. These totals include bibliography, taxonomy, definition and quarantined export records; they are not counts of animals, verified measurements or playable categories. The 27 trait-data tables contain 398,239 rows, including heterogeneous and modeled records still requiring review.

Added complete reported COMBINE mammal data, its per-field source mappings, TetrapodTraits v2.0.1 and the TOFF release/thesaurus to the prior marine and marsupial intake. COMBINE and TetrapodTraits were already on our source register; this pass acquires their full tables and integrates them into this database rather than counting them as new discoveries.

## Coverage and quality

- COMBINE reported table: 6,263 rows, 5,962 distinct harmonized binomials, matching 58 current AnimalStats animals. Repeated harmonized names remain separate. Reported/source rows are aligned and verified using all six taxonomy columns; citations cannot be overwritten by a one-name dictionary.
- TetrapodTraits: 33,281 rows, matching 143 current animals. Source citations and explicit imputation flags remain attached. The match count includes imputed records and does not establish playable coverage.
- FishBase and SeaLifeBase: table-specific reference IDs, original bibliography, species-code joins and exact current-roster matches preserved. Sample size, sex, population, method, reliability and stage remain in source records.
- Marsupials: observation-level values and adjacent references preserved. The unqualified species-mean table is not used as approved game data.
- BIOTIC: raw bands and categorical codes preserved; missing-data strings are excluded from nonmissing coverage. No midpoint values are invented.
- TOFF: the downloaded 2019 nested CSV export is malformed. It is quarantined as raw lines. The 2024 thesaurus is a separate definition table; it cannot establish that all definitions have measurements.

**Zero records are game-approved.** A record review is also not approval of every field in that record. Field methods, upstream estimates, units, life stage, sex, population, statistic, licensing, category interest and full-board coverage still require admission review. Brain mass does not establish intelligence; year of scientific description does not establish evolutionary age.

## Files and use

1. Install Python packages `pyarrow`, `openpyxl` and `libarchive-c`, with system libarchive available.
2. Run `python scripts/download-animalstats-bulk-intake.py` to fetch pinned data and verify available publisher and snapshot checksums.
3. Run `python scripts/build-animalstats-bulk-research.py` to build the local SQLite database and durable coverage report. Failed builds leave the last completed database intact.
4. Search fields with `python scripts/query-animalstats-bulk-research.py --source combine --field mass`.
5. Inspect an exact value and provenance with `python scripts/query-animalstats-bulk-research.py --animal Lion --source combine --field adult_brain_mass_g`.

Search opens SQLite in read-only mode. Source records carry table identity, source row, scientific name, exact current-roster match, original nonmissing fields, provenance and pending review status. Missing cells are omitted from working JSON; original files and the field schema remain checksummed.

`bulk-research-build.json` retains the schema, row counts, field coverage, explicit estimate flags, exact roster matches and source-file hashes. `bulk-priority-field-review.json` selects 23 source-field entries for initial review, retaining overlaps and the requirement to keep counter-directions together. This queue is not 23 new categories. Existing gameplay data, boards and the live label count are unchanged by this intake.

Integrity, foreign keys, zero unreviewed admissions, paired COMBINE provenance and read-only field/animal searches passed verification.
