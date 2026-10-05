# AnimalStats implementation status — 2026-10-05

## Implemented and verified
- Cute / Real lever preserves board, assignments and completed results; preference survives reload.
- Real uses GeoStats board classes and licensed animal photos, with category icons.
- GeoStats and AnimalStats share the actual score summary, optimal choices, result row and expanded ranking components, including Your Choice, Optimal Choice, placement, points, ranking expansion and source details.
- Category definitions work by hover, keyboard focus or tap, including on result rows.
- Two-way clicking and dragging, swaps, removal, and dragging an animal back to its bank.
- All animals in the candidate board pool have approved real photos. Twenty-five additional photos manually reviewed; mistaken species, illustrations, habitat-only images and predator/prey images rejected.
- Accessible photo credits list original creator, file page and license.
- Guinea pig redrawn with a compact connected body, folded ears, short feet, coat patches and no tail. All 105 existing cartoon frames and coat masks checked.
- Exactly tabulated maximum hibernation bouts admitted for four named mammals; longest/shortest labels adjacent in the category browser, three intuitive categories per new board, distinct winners and attainable perfect score.
- Calendar naming-date comparisons use exact integer ordering; IUCN scores retain their bounded ordinal validation.
- 9,000-board rotation simulation, 90 days of opening boards, board data validation and 2,538 AnAge numerical reconciliations pass.
- Production build and desktop/phone interaction checks pass.

## Still outstanding — do not represent these as completed
- Expansion to at least 200 playable distinct labels, ideally 500. Current default pool: 98 distinct labels / 112 trait directions, 3,454 boards and 99 animals. Catalog: 176 animals / 6,689 observations. Duplicate labels are not counted twice.
- Occasional insect and other invertebrate boards. Existing bee/fruit-fly/lobster records do not yet give enough comparable intuitive categories for a valid complete board. No fabricated missing facts added.
- Broader Expert coverage: current Expert pool remains mammal-only. Scout/Adventurer rotate mammals, birds and mixed boards.
- Continue improving species recognition where needed. All 105 native cartoons have now been visually compared with their approved reference photos; guinea pig, bison horns and hippo muzzle corrected. This does not cover the 71 additional catalog animals without native cartoons. Frame tests alone cannot establish anatomical correctness.
- Remaining cross-domain page controls and score-image sharing; the requested game/results layouts now use shared score summary, optimal choices, result row and expanded rankings.
- New data pending review: LepTraits, measured heart rates, further cognition tasks, GlobTherm, further hibernators. Research SQLite restored and verified with quick_check; raw records remain outside approved play until comparability/provenance checks pass.

## Scientific admission decisions this pass
- LepTraits species consensus adult flight calendars can combine regions; use per-source regional records for a future season category. Host-plant family counts describe documented caterpillar diet, not a complete diet or species IQ.
- Mixed thermal endpoints (critical maxima, lethal limits, thermoneutral limits) are not one comparable temperature category.
- Heart-rate rows need explicit adult/resting/unsedated protocols and primary-study verification; domestic dogs must never be relabeled wolves.
- Hibernation means can be estimated by the paper's authors; only exactly published TBDmax for conventional HIB records admitted. Conditions vary and are disclosed. No invented confidence bounds.

## Longevity semantic review
- Held 63 AnAge lifespan observations for 26 species where the current maximum is projected, anecdotal, or based on uncertain individual age. Research values remain unchanged; none are approved for play or public rankings.
- Withdrew 2,058 dependent candidate boards; all 3,876 remaining candidates pass structural validation. Source matching alone is not evidence of a measured age.
- Database responses must exactly match the released approved row set, preventing older approved warehouse entries from restoring held records.
- Apply `node scripts/apply-animalstats-longevity-review.mjs` after catalog imports/regeneration; then rerun board and source audits.

## Current interface and cognition pass
- Real submit button moved inside the matching panel, using GeoStats lock/submit classes.
- Shared score summary and Optimal Choices section added; score sharing moved into GeoStats-style action menu, with native share and accessible manual-copy fallback.
- Expanded rankings share one actual component between animals and countries; animal thumbnails match flag placement.
- Category information icon uses a native SVG, avoiding missing-font glyphs.
- Original MacLean et al. transparent-cylinder trial scores admitted for five unambiguous species, with cohort size, individual score ranges and source rows disclosed. Two Scout boards use four intuitive categories and distinct winners. These are measured cohort comparisons, never a species-wide IQ or population-intelligence ranking.
- New large-source metadata review saved: PanTHERIA physiological summaries can be modeled even in non-EXT columns; Amniote consolidated output shares/interpolates taxa; avian SSD sources may include range midpoints. No bulk approval from those outputs.
- 39 original avian SSD rows saved for targeted source review.

## Insect source acquisition and sharing follow-up
- Staged the original public CC BY 4.0 AnthropInsect 2.0 workbook, verified against repository MD5 and byte size; pinned source release and SHA-256.
- Separate research database stores 5,867 rows / 5,864 distinct source species names and 15,402 numerical cells. 8,248 reported min/max cells need original-study review; 3,840 typical estimates and 3,314 derived means are excluded. Zero automatic gameplay admissions.
- Source-stage/caste, lifetime versus per-day fecundity, regional generation counts and cell-level provenance are mandatory gates. Audit records 68 reversed ranges or typical estimates outside min/max.
- Added downloadable AnimalStats score images with matching score-card layout, file-sharing capability checks and download fallback. Reusing another board resets the image preview.
- Live deployed Real round verified at 400/400 with expanded rankings and full five-cohort cognition catalog.

## Verified museum ear measurements
- Added longest/shortest ear comparisons for six exact mammal taxa from 1,262 independent explicitly adult museum specimen records. Every admitted measurement matches an explicit raw ear-from-notch value in millimetres; original adult evidence, accession and institutional download DOI retained.
- Estimated values, inferred units, missing ages, substituted subspecies, unit errors and conflicting repeated specimen measurements excluded. Reported statistics are exact cohort medians, not worldwide population estimates; individual ranges and sex composition disclosed.
- Both directions now occur in default play, on four-intuitive-prize boards with different winners and attainable 400/400 scores.
- A fully intuitive four-prize board may pair pregnancy duration with litter size; other life-history limits and all independent rank/winner checks remain.
- Current audited release: 176 catalog animals / 6,689 observations, 3,880 valid candidate boards, 3,454 default boards, 98 distinct playable labels / 112 directions and 99 played animals. Expert remains mammal-only; insects remain outside play pending complete comparable board data.
