# GeoStats: maximum verified category recovery

> Superseded checkpoint: REPAIR_ACCEPTANCE_2026_09_07.md records **414 playable categories (96 restored)** and subsequent runtime/cache, Daily and official-source livestock repairs. The earlier live verifier bypassed runtime gating; that gap was found and fixed. The full importer suite has since passed. Below is the historical 410-category milestone, not final acceptance.

Verified 7 September 2026. The production database now has **410 playable/enabled categories**, up from **318**: **92 additions**, with no previously playable category removed.

| Mode | Eligible categories |
| --- | ---: |
| Scout | 410 |
| Adventurer | 409 |
| Expert | 409 |

Arctic land area is Scout-only. The other 409 categories are available in all three modes. These are catalog eligibility counts, not a promise that every category fits every country bank or appears in today's saved Daily.

## What changed

- Replaced unnecessary global/Top-20 distinct-value prefilters with the actual country-bank size. The production validator still enforces distinct displayed values, distinct winners, required global winner rank, complete bank observations, source/topic diversity and continent limits.
- Approved individual snapshot-bound quality exceptions only where existing source audits and full solver witnesses support them. Original numerical quality scores remain retained; reviewed credibility adjustments are documented as caution, not perfect certainty.
- Repaired five unit-only audit failures without changing observations or pretending to perform new source fetches.
- Qualified Natural Earth lake/reservoir, river and coastline categories as fixed-scale map inventories or measurements.
- Preserved legitimate signed UN population rates and repaired population-decline wording.
- Reviewed generic historical finance exclusions individually. Explicit product exclusions and original legacy ledger entries remain intact.
- Added durable mode restrictions and release checks. A metadata edit cannot accidentally widen Arctic to larger modes; stale observations or invalid evidence fail closed.

## Acceptance evidence

- Production code commit: [fac7d368](https://github.com/ZachVsKris/GeoStats/commit/fac7d368a9833eedecfd9734fa4b9134d24dd8de). Vercel production deployment `dpl_4LejxGyVviRRoHoQ9UjsXBURyBQ7` reached READY before activating mode-specific categories.
- Three applied catalog migrations: `20260907201754`, `20260907202915`, `20260907203421`. Exact applied SQL is committed with those versions.
- **274 full board witnesses** for the 92 additions replayed against the actual live catalog and exact floating-point observation export, with no candidate overrides. A complete Daily trio also passed the production cross-mode validator.
- All 92 snapshot/dependency proofs are current. The full refresh was run again: 410 ready, 410 enabled, **0 safe-but-hidden**, **0 unsafe-published**.
- Rollback-only tests confirmed that corrupting evidence or changing an observation invalidates readiness; the durable presentation contract prevents accidental mode widening. Test mutations were rolled back.
- Production build, TypeScript, current recovery/static checks, source-integrity fixtures and production-generator regressions passed.
- The full importer suite did **not** complete: this workspace lacks Shapely and pycountry. Browser visual QA remains unaccepted after the earlier preview access block. No claim is made that email deliverability or Google OAuth configuration has been verified.
- No source observations, scored historical Daily boards or user scores were changed by this recovery.

## Remaining 150 candidates

These are **not 150 permanently rejected ideas**. They are the remaining rows from the original 242-candidate queue; 42 retain editorial approval and 108 retain other review states. Technical publication is a separate decision. Buckets below are a mutually exclusive audit summary, not necessarily the database's first displayed blocker.

| Main remaining issue | Count |
| --- | ---: |
| source verification | 93 |
| data repair | 3 |
| coverage | 30 |
| source link verification | 2 |
| subjective or composite | 7 |
| stale data | 11 |
| duplicate | 2 |
| product exclusion | 1 |
| noncomparable units | 1 |

The three poultry-stock categories have metadata claiming validated coverage but no warehouse observations at any year; they need source reimport and verification. Some incomplete-coverage categories, including basic drinking-water access, could become eligible after a specific coverage/source review. A bounded search failure is not proof of impossibility. This is the maximum **verified in this recovery**, not a claim that no future source repair or defensible coverage review can add more.

The machine-readable companion `audits/maximum-candidate-dispositions-2026-09-07.json` records all 242 candidates, current decisions, remaining blockers and specific review findings.

## Promoted categories

| Category | Modes |
| --- | --- |
| Fastest broad-money growth rate | All three |
| Fastest economic growth rate | All three |
| Fastest growth rate in domestic credit relative to broad money | All three |
| Fastest growth rate in government credit relative to broad money | All three |
| Fastest growth rate in private credit relative to broad money | All three |
| Fastest population growth rate | All three |
| Fewest land-border neighbors among landlocked countries | All three |
| First men's FIFA World Cup appearance | All three |
| Highest % of adults with a financial account | All three |
| Highest % of bank loans that are nonperforming | All three |
| Highest % of people covered by 3G | All three |
| Highest % of people covered by 4G | All three |
| Highest % of people covered by 5G | All three |
| Highest % of people using clean cooking fuels | All three |
| Highest % of people with electricity access | All three |
| Highest % of rural residents using clean cooking fuels | All three |
| Highest % of rural residents with electricity access | All three |
| Highest % of urban residents using clean cooking fuels | All three |
| Highest % of urban residents with electricity access | All three |
| Highest % using safely managed sanitation | All three |
| Highest average annual precipitation | All three |
| Highest bank capital as % of assets | All three |
| Highest bank credit to the private sector as % of GDP | All three |
| Highest bank liquid reserves as % of assets | All three |
| Highest broad money as % of GDP | All three |
| Highest consumption taxes as % of industry and services output | All three |
| Highest debt interest as % of government expenses | All three |
| Highest debt interest as % of government revenue | All three |
| Highest development aid as % of capital investment | All three |
| Highest development aid as % of imports | All three |
| Highest development aid as % of national income | All three |
| Highest discounted foreign debt as % of export income | All three |
| Highest discounted foreign debt as % of national income | All three |
| Highest external debt as % of national income | All three |
| Highest financial-sector private credit as % of GDP | All three |
| Highest foreign-debt payments as % of export income | All three |
| Highest foreign-debt payments as % of national income | All three |
| Highest freshwater withdrawals as % of internal resources | All three |
| Highest goods-and-services taxes as % of government revenue | All three |
| Highest government asset investment as % of GDP | All three |
| Highest government budget balance as % of GDP | All three |
| Highest government expenses as % of GDP | All three |
| Highest government payroll as % of expenses | All three |
| Highest government purchases as % of expenses | All three |
| Highest government revenue excluding grants as % of GDP | All three |
| Highest grants and other receipts as % of government revenue | All three |
| Highest hepatitis B vaccination rate | All three |
| Highest income and profit taxes as % of all taxes | All three |
| Highest income and profit taxes as % of government revenue | All three |
| Highest income inequality (Atkinson %) | All three |
| Highest inequality in length of life (%) | All three |
| Highest inequality in schooling (%) | All three |
| Highest inflation rate | All three |
| Highest inward foreign investment as % of GDP | All three |
| Highest life expectancy | All three |
| Highest measles vaccination rate | All three |
| Highest miscellaneous government spending as % of expenses | All three |
| Highest miscellaneous taxes as % of government revenue | All three |
| Highest monetary-sector private credit as % of GDP | All three |
| Highest natural population increase rate | All three |
| Highest net claims on government as % of GDP | All three |
| Highest net energy imports as % of energy use | All three |
| Highest net migration rate | All three |
| Highest outward foreign investment as % of GDP | All three |
| Highest pre-primary learning participation rate | All three |
| Highest public and IMF debt payments as % of exports | All three |
| Highest public foreign-debt payments as % of export income | All three |
| Highest public foreign-debt payments as % of national income | All three |
| Highest reserves as % of foreign debt | All three |
| Highest share of public foreign-debt payments to multilateral lenders | All three |
| Highest short-term foreign debt as % of export income | All three |
| Highest short-term foreign debt as % of reserves | All three |
| Highest subsidies and transfers as % of government expenses | All three |
| Largest Arctic land area | Scout |
| Largest coal exports | All three |
| Largest crude-oil exports | All three |
| Largest current-account surplus as % of GDP | All three |
| Largest electricity exports | All three |
| Longest coastline on Natural Earth's map | All three |
| Lowest annual population growth rate | All three |
| Most air freight by weight and distance | All three |
| Most bordering countries | All three |
| Most coastline per km² on Natural Earth's map | All three |
| Most fertilizer used per hectare of arable land | All three |
| Most lakes and reservoirs in Natural Earth's atlas | All three |
| Most neighbors among landlocked countries | All three |
| Most net IDA development lending received | All three |
| Most recently cut under-five mortality below 50 | All three |
| Most recently reached 50% electricity access | All three |
| Most recently reached 50% internet use | All three |
| Most river features in Natural Earth's atlas | All three |
| Most secure Internet servers per million people | All three |

## Separate macro review references

The final two finance additions use percentages with explicit denominators, not the legacy dollar totals: [World Bank current-account balance definition](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/BN.CAB.XOKA.GD.ZS) and [World Bank multilateral debt-service definition](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/DT.TDS.MLAT.PG.ZS). Existing independent observation audits were retained.
