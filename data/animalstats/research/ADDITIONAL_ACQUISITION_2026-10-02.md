# Additional acquisition and endpoint audit

This pass acquired eight tables containing 55,553 raw rows. Rows overlap within and between catalogs; they are not 55,553 animals or new game facts. No live prizes were added.

| Source | Acquired coverage | Purpose and limits |
| --- | --- | --- |
| Global nest data | 15,983 source rows; 11,120 summary rows | Construction time and nest dimensions. Dimensions are often prose; architecture categories do not become numerical rankings. |
| European pollinator traits | 2,139 bee labels; 913 hoverfly labels | Insect coverage. Thermal experiment, hair and regional range fields need protocol/unit audit. Many other fields are categorical. |
| MammalBase diet | 24,039 interaction rows; 2,057 source consumer labels | Mammal feeding evidence. Sampling effort and prey resolution prevent naive record-count rankings. |
| Vertebrate eyes | 1,284 rows; 1,184 source labels | Eye diameter across several vertebrate groups. Keep axial/transverse/cornea measurements separate. |
| FRUGINT | 16 mammal and 59 bird rows | Ear measurements and food passage leads. Mixed mammal units and estimated fruit percentages are held/rejected. |

The endpoint queue contains eight source-specific review opportunities, with opposite labels using the same field. These overlap existing concepts and are not eight guaranteed new categories. Six are initially intuitive, two specialist. All remain held until source audit.

## Rejections and incomplete acquisitions

- Bee tongue length computed from intertegular distance cannot become a measured tongue-length prize.
- Qualitative diet converted to fruit percentages cannot become numerical diet rankings.
- Hoverfly duration bins and subjective flying ability cannot become exact durations or speeds.
- FRUGINT mammal lengths visibly mix magnitudes consistent with different units. No unit inference, midpoint calculation or automatic import was performed.
- Spider API metadata reported 234 traits and 105 datasets, but pagination returned the same ten-item first page with offset zero. Completeness is false. Restricted datasets were not downloaded.
- The 2026 fish swimming dataset is restricted and remains an evidence lead. Fish swimming performance, hearing, sleep, evolution and population categories still need comparable public observations.

## Reproduction

Run `python scripts/fetch-animalstats-additional-sources.py --cached-only` to validate available snapshot hashes, then `python scripts/audit-animalstats-additional-sources.py`. Dropping `--cached-only` reacquires the listed public files; mutable GitHub URLs must be checked against stored hashes. Raw third-party files and normalized raw records are ignored by git. Reports, checksums and audit code are retained.

The game remains at 72 locally configured labels. The broader 112-concept register still includes unsourced ideas and existing concepts; it must not be advertised as newly playable content.
