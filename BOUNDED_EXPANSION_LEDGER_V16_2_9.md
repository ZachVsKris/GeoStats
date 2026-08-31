# GeoStats v16.2.9 bounded expansion ledger

This ledger prevents repeated searches through unchanged sources. A pass may resume only when a materially new authoritative dataset, new release, or corrected country-level method changes the evidence. Ten new strict-pass categories is the minimum publication bundle; 20 or more is preferred, with no ceiling for genuinely distinct high-quality measures.

| Pass | Sources evaluated | New strict-pass candidates | Decision |
| --- | --- | ---: | --- |
| Natural and physical geography | Beck et al. peer-reviewed Köppen-Geiger 1991–2020 raster with Natural Earth sovereign geometry | 11 | Proceed through the controlled import, stored-source audit, atomic promotion, and reachability workflow |
| Country history | UN membership, Constitute, IPU, World Bank threshold histories, FIFA/IOC chronology candidates already implemented or staged | Fewer than 10 | Stop. Keep the six existing playable history measures; do not weaken global Top-20 distinctness or add near-duplicate threshold dates |
| Culture | UNESCO World Heritage and Intangible Cultural Heritage country counts plus existing culture-labeled source candidates | 0 | Stop. Both broad UNESCO count concepts are explicit owner exclusions; no replacement bundle met clarity, interest, breadth, and non-duplication together |
| Ethnic, religious, and racial demographics | Pew 2010/2020 global religious composition and remaining staged group measures | Fewer than 10 new | Stop. Thirteen high-quality religious-demography measures are already playable; the remaining Jewish measures do not both clear the current quality gate, and country race/ethnicity definitions are not sufficiently comparable for a global ranking bundle |
| Infrastructure, technology, and science | Dedicated World Bank infrastructure candidates, WDI catalog candidates, UN/WHO/UNESCO candidates already staged | Fewer than 10 | Stop. The remainder fails coverage, freshness, source-floor, duplication, or player-interest gates; do not substitute economy, trade, or agriculture padding |

## Natural bundle evidence

The completed GitHub feasibility run evaluated 13 candidate measures, covered 195 GeoStats countries, and returned `GO_TO_STAGING` with 11 passes. The two rejected measures were ice-cap share (only seven visible values and seven distinct Top-20 values) and climate diversity (only six distinct Top-20 values).

The approved bundle is limited to desert, arid, steppe, tropical rainforest, tropical monsoon, tropical savanna, temperate, Mediterranean, continental, polar, and tundra land shares. The workflow re-fetches the pinned publisher inputs once for the actual import, reproduces the proof, imports exactly those eleven keys, re-audits the stored snapshot, promotes atomically through database checks, and then re-runs generator reachability. Any failure leaves the bundle unavailable.
