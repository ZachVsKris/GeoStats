# AnimalStats build progress — October 3, 2026

## Website

Published the GeoStats layout and interaction update to the AnimalStats preview branch. Header, mode controls, minimal surrounding language, two-way click/drag assignment, podium swaps and removal, full rankings, source dialogs, category/animal browsing and exact-unit CSV exports are implemented. Fair colors are brighter and podium ribbons show stars rather than ordinal prizes. Normal phone/desktop viewports fit the complete game; short windows allow scrolling to Submit. Dialog focus no longer resets when typing. Shoulder-height categories are excluded from the playing page.

Validation: TypeScript and production builds passed; all 23 AnimalStats browser tests passed in desktop Chromium, including touch emulation and four viewport sizes. A live Vercel session completed a board and displayed the new result layout. These are not claims of native Safari/Firefox verification. WebKit lacked required system libraries that the environment could not install; Firefox did not complete startup within the test timeout. The failed cross-browser attempts are not passing checks.

## Expansion

The private research snapshot now has 700,063 records across 24 catalogs, 162 concepts, 322 proposed prize labels and 1,296 pending quality checks. Raw and extracted records overlap; this is not a unique species count or a playable category count. The live private research warehouse previously held 81,227 rows; this new snapshot has not all been uploaded to Supabase.

Acquired MOBS 1.0 with 170,214 raw rows and 80,844 AphiaIDs. Preserved its original reference catalog and citation requirement. Extracted 177,433 additional candidate observations for marine dimensions, eye size, torpor, diving, cognition tasks and chewing. Marine protists, algae and unidentified phyla are excluded from candidate observations. Colonies/zooids/polyps, anatomical endpoints, sex/stage, preservation, study effort and uncertainty still require source review. MOBS 1.0 lacks biological-unit and sex fields documented for v2, so these cannot be inferred.

Recovered the 132-row primary chewing table. Exact-binomial numeric extraction retains 127 rows. Ambiguous numeric typography and genus-only entries are held, not guessed. The paper often measures a single animal per species and does not establish universally comparable food/stage/sex conditions.

Validated the official Europe PMC archive of the Blomquist 2019 milk supplement. Extracted 357 reported concentrations: 124 fat, 124 protein and 109 sugar observations. Excluded all 15 missing sugar cells, model-imputed output, transformed life-history variables and inferred energy. Lactation stage, original assay, sample size and taxonomy remain pending. Corrected the earlier invalid milk archive acquisition record.

Recovered the original author workbook for Tucker & Rogers 2014, with 108 carnivorous mammals (57 marine, 51 terrestrial) and 188 references. Retained original log values and reversible kilogram conversions rather than rounded PDF values. Three missing minimum-prey cells stay missing. Diet entries may refer to prey-species mass rather than a weighed kill, so the review label and eligibility gate now make this distinction explicit.

Thirty-nine measured observations were manually screened and promoted in this pass, producing 78 direction-specific rows and eight new prize labels: fastest/slowest breathing at rest, and most/least milk fat, sugar and protein. Resting breathing is restricted to five exact wild-species matches from a single study with at least three sampled animals and explicit adult/resting/unsedated flags. Milk comparisons use 34 reviewed concentrations from 12 placental mammals with reported lactation stage and N ≥ 3; marsupials, monotremes and missing values are excluded. Each board allows at most one milk-composition prize. Full rankings use the validated release snapshot if warehouse data fails its checks. The playing warehouse now contains 4,751 approved direction-specific rows.

Current playing coverage is 80 category IDs / 70 distinct displayed labels and 1,471 validated boards, not 200. Some IDs repeat prize names across separate source/group pools; these are not counted as additional distinct labels. Reaching 200–500 genuinely useful playable labels requires further source acquisition, original-reference auditing and animal illustration coverage; the requirement remains open.

## Safeguards

Generator candidates now require finite positive values, approved observed/compiled origins, exact units, measurement basis and canonical source matches. Each reverse direction qualifies independently; valid boards are no longer discarded merely because an opposite has no board. Opposites remain adjacent on the editorial list.

Raw source material and the research database remain private and outside the public code repository. Review recommendations remain distinct from scientific approval and gameplay eligibility.

## Latest release verification

Commit b283458a84ad3430860cf6b47c801157fe2b1590 is deployed on the AnimalStats preview branch. Production build passed. The prior 26 checks passed across targeted runs; four checks for the changed data endpoint, new breathing and milk rounds, and searchable/exportable full catalog passed again in desktop Chromium. The live breathing board completed and its full five-animal source ranking displayed correctly. The 200-category requirement remains unfinished.
