# Owner catalog review, 8 September 2026

Source: `GeoStats-Review-2026-09-07AWYComments (1).xlsx`, playable catalog, column A (`Comments`). All 90 comments are recorded with stable category IDs and individual dispositions in `audits/owner-review-2026-09-08.json`.

- 44 explicit removals and 5 conditional/overlapping retirements (49 total)
- 36 definition/title clarifications
- 4 additional hyphen-only notes, covered by the catalog-wide title cleanup
- 1 positive comment retained without a substantive change
- 414 → 365 playable categories; no additions

Conditional decisions: retire domestic credit relative to broad money pending a simpler concept; retire business density rather than falsely label a per-person measure as a total; keep the Global Findex account series, the explicit ODA series, and customs goods imports instead of overlapping alternatives. Those source definitions are not asserted to be identical.

Display wording is kept in durable presentation metadata, separate from the source title, technical definition, units, ranking direction and observations. This avoids invalidating source-bound validation records for presentation-only changes. Existing recovery witnesses are replaced with newly verified witnesses using only retained categories. The migration checks all source observation hashes and rejects unintended category removals.

Title cleanup removes word-to-word compound hyphens; numerical ranges and minus signs remain. Existing boards dated through 8 September retain their original categories and scoring, including today's four already-recorded scores. Retirement applies to new Random selection and subsequent Dailies. Existing boards receive updated display copy.

Definition evidence: source technical definitions and importer rules already in the repository; [WHO clean cooking definition](https://www.who.int/data/gho/data/indicators/indicator-details/GHO/gho-phe-primary-reliance-on-clean-fuels-and-technologies-proportion); [Beck et al. climate classification](https://www.nature.com/articles/s41597-023-02549-6). Simplified descriptions preserve the measured concept; full technical definitions remain available.

Validation: rollback-only database trial retained exactly 365 categories with no unintended retirements; 1,093 successful source-backed category/mode witnesses and three valid future Daily trios, including top-20 and cross-board rules. See `audits/owner-review-verification-2026-09-08.json`. Focused regression checks cover updated wording, changing reference years and the dated-board retirement exception.

The final witness run used exact IEEE-754 values exported from PostgreSQL, avoiding decimal rounding in the initial JSON export. Source hashes are checked again inside the activation transaction. Application change: PR #18, `68d65775b054c5d3dba0eadba35173bb586f5143`. GitHub's catalog/importer, typecheck, source-policy, Natural Earth and production build gates passed; cross-browser verification was still running when these release notes were prepared.

Email sign-in's spam/junk reminder was committed separately as `dfdb61b`. Inbox placement itself is not resolved by that reminder.

Hosted activation succeeded as migration `20260908163017_owner_category_review`. Verified afterward: 365 enabled categories, 49 retirements, 36 presentation updates and zero unsafe published categories. All three current Daily payload hashes are unchanged; all 39 saved scores remain, including today's four scores. The final cache-version update follows activation so new Random games receive the updated catalog.

Follow-up owner instruction: also retire `unwpp:lowest-death-rate` (Fewest annual deaths per 1,000 people). Applied as `20260908163838_retire_lowest_death_rate`, bringing the catalog to 364. It does not occur on today's Daily boards. Catalog revision 16.3.4.7 invalidates browser, server and Random snapshot caches; existing dated boards retain their scoring data.

## Northernmost and southernmost boundaries

Both categories now derive from Natural Earth 5.1.1 map units, excluding dependencies, leases and separately coded overseas territories. The U.S. Minor Outlying Islands require an explicit administrative-code exclusion because Natural Earth assigns their individual map units ISO_A3_EH=USA. Integral islands, Alaska and Hawaii remain included. This is not a largest-mainland-polygon rule.

Five observations change across the two categories: Norway and New Zealand in northernmost; Norway, France and the Netherlands in southernmost. The attached source audit records all 390 values, archive SHA-256 and exact before/after differences. Other geographic measurements are unchanged. The importer uses the same policy for future refreshes.

The current 364-category catalog was checked with 1,090 valid category/mode board witnesses and three future Daily trios. A bounded search initially failed on the unrelated landlocked-neighbors Expert category under a different traversal order; retaining the original deterministic audit order yielded a valid witness against the same corrected source values. Historical board payloads are not edited; copy hydration preserves their original boundary definition when derivation versions differ. Cache revisions force new board generation to reload the corrected catalog/data.

The importer commit also exposed a legacy workflow that automatically ran ten production importers on geography code changes. Run 34254002165 was cancelled. The workflow now imports only on explicit manual dispatch; workflow-file pushes only cancel superseded runs. A bit-exact warehouse comparison confirmed no unrelated observation values changed. Restoring 61 altered definition records and rechecking all 1,090 witnesses repairs the source-bound evidence invalidated by that unintended run. Catalog cache revision 16.3.4.9 clears any intermediate cached catalog.

## Source suitability review

Owner approved the recommended source suitability decisions. Ten active categories are excluded from future Random/Daily generation: stateless population, glacier area, three river network/count measures, lake count/total/share, and two coastline measures. Glacier share was already inactive and now also has a durable rejection. Coastline records are marked as needing data repair pending stronger cross-source validation. Both Pew other-religions categories remain available. The live catalog falls from 364 to 354; saved boards retain their values and scores. Three future Daily trios validate against the retained catalog.
