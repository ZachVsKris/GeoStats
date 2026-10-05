# AnimalStats implementation status — 2026-10-05

## Implemented and verified
- Cute / Real lever preserves board, assignments and completed results; preference survives reload.
- Real uses GeoStats board classes and licensed animal photos, with category icons.
- GeoStats and AnimalStats share the actual result row component, including Your Choice, Optimal Choice, placement, points, ranking expansion and source details.
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
- Expansion to at least 200 playable distinct labels, ideally 500. Current default pool: 94 distinct labels / 108 trait directions, 3,450 boards and 99 animals. Catalog: 176 animals / 6,667 observations. Duplicate labels are not counted twice.
- Occasional insect and other invertebrate boards. Existing bee/fruit-fly/lobster records do not yet give enough comparable intuitive categories for a valid complete board. No fabricated missing facts added.
- Broader Expert coverage: current Expert pool remains mammal-only. Scout/Adventurer rotate mammals, birds and mixed boards.
- Recognition review and redrawing of every cartoon. Frame tests cannot establish anatomical correctness; this release specifically fixes the reported guinea pig.
- Exact reuse of the remaining GeoStats page components beyond boards/results, and complete cross-domain presentation controls.
- New data pending review: LepTraits, measured heart rates, cognition tasks, GlobTherm, further hibernators. Research SQLite restored and verified with quick_check; raw records remain outside approved play until comparability/provenance checks pass.

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
