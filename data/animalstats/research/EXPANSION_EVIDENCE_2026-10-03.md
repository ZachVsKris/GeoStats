# Expansion evidence audit — October 3, 2026

This completes a bounded extraction and public-account acquisition pass, not the entire expansion or category certification.

## Counts

- 12,648 candidate numeric rows extracted across 18 concepts; all pending.
- Live private research database: 81,227 rows after this import, including 12,648 expansion-evidence rows.
- Local snapshot: 351,951 raw/source and extracted rows across 20 catalogs. Derived extraction overlaps upstream tables; neither total means unique animals.
- 24 mammal accounts fetched successfully; 13 beyond the prior pilot species pool.
- Review inventory remains 162 concepts / 322 proposed labels. No new label count is claimed for source acquisition.
- Certified new fair-board comparisons: 0. No gameplay approvals or deployment.

## Paired comparisons and extraction coverage

| Comparison | Numeric rows | Source taxon labels | Status |
|---|---:|---:|---|
| Largest breath / Smallest breath | 24 | 24 | Source/method review pending |
| Fastest resting breathing / Slowest resting breathing | 76 | 76 | Source/method review pending |
| Longest egg / Shortest egg | 261 | 261 | Source/method review pending |
| Most daily energy burned in the wild / Least daily energy burned in the wild | 3991 | 586 | Source/method review pending |
| Fastest resting heartbeat / Slowest resting heartbeat | 32 | 31 | Source/method review pending |
| Most blood pumped per heartbeat / Least blood pumped per heartbeat | 11 | 11 | Source/method review pending |
| Longest / Shortest | 4932 | 4922 | Source/method review pending |
| Longest lived / Shortest lived | 538 | 332 | Source/method review pending |
| Heaviest / Lightest | 62 | 55 | Source/method review pending |
| Latest adulthood / Earliest adulthood | 786 | 662 | Source/method review pending |
| Longest nursing / Shortest nursing | 24 | 20 | Source/method review pending |
| Heaviest newborn / Lightest newborn | 294 | 294 | Source/method review pending |
| Most babies at once / Fewest babies at once | 1197 | 1153 | Source/method review pending |
| Longest pregnancy / Shortest pregnancy | 49 | 40 | Source/method review pending |
| Most litters per year / Fewest litters per year | 228 | 228 | Source/method review pending |
| Most energy burned at rest / Least energy burned at rest | 46 | 44 | Source/method review pending |
| Most distinct call types / Fewest distinct call types | 42 | 42 | Source/method review pending |
| Longest whiskers / Shortest whiskers | 55 | 7 | Source/method review pending |

## Findings that change eligibility

- Field-energy paper explicitly uses midpoints for ranges and estimated dry/fresh/carbon mass conversions. Hold all extracted rows until original-reference tracing establishes eligible observed values. Source: https://doi.org/10.1038/s41597-025-05868-y
- Fish metadata mixes annual egg production with ovarian batch counts, and eggs with live offspring. These do not share one endpoint.
- Arthropod archive combines expert knowledge with literature and lacks per-cell method/source in the exported facts. It also carries noncommercial rights. Thermal-niche and dispersal-score fields were excluded.
- Repeated whisker clips are not independent animals. Units still require verification.
- Physiological filters require adult/resting/unsedated flags. Awake status, environment, primary methods and uncertainties still need checks.
- Primate predicted ancestral repertoires and mammal derived AnnualFecundity/TeatRatio were excluded.
- Account summaries preserve explicit scalars only; ranges are not converted to midpoints. Average/record, sex, environment and taxonomy remain separate review gates.

## Major source access and remaining work

Dryad male/female mass dataset metadata is verified, but the download returned 403 through web retrieval; numeric data have not been acquired in this pass. Species360 remains an access investigation, not acquired data. Marine survey sources, historical/cognition endpoints and original references for these extracted measurements remain outstanding. The 18 extracted concepts do not represent a complete audit of all 162 proposals.

## Reproduce

Run `scripts/fetch-animalstats-expansion-accounts.py` with beautifulsoup4 4.14.3, then `scripts/extract-animalstats-expansion-evidence.py` with openpyxl and xlrd. Rebuild the paired review and research snapshot with their existing scripts. Full third-party observations remain private. Source hashes and row locations are retained; no imputation or automatic approval occurs.
