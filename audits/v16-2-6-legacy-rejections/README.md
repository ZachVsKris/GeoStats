# v16.2.6 Legacy Rejection Guard

This audit is durable in the surviving repository and is designed to prevent two opposite failure modes: silently resurrecting old rejected concepts, and treating vague historical rejection labels as permanent truth.

## Preserved history

- legacy rejected rows preserved: **791**
- generic v15-only rationale: **610**
- generic v16.2.3 batch rationale: **168**
- category-specific/product decisions: **10**
- explicit duplicates: **3**
- current tracker exact-title collisions: **68**
- collisions initially requiring first-principles re-audit: **64**
- collisions with strong historical exclusion/duplicate basis: **4**
- hand-screened high-confidence semantic collisions: **12**

Migration `049_v16_2_6_legacy_rejection_guard.sql` makes unresolved exact-title and reviewed semantic collisions fail closed at activation. It also supports explicit `semantic` and `source_indicator` links through `category_legacy_rejection_resolutions_v16_2_6`. Ambiguous fuzzy matches are deliberately not auto-blocked.

## Priority-150 first-principles re-audit

`PRIORITY_150_FIRST_PRINCIPLES_REAUDIT.csv` reviews the highest-priority generic non-FAOSTAT rejections one by one. Migration `050_v16_2_6_priority_150_legacy_reaudit.sql` makes those judgments durable.

- **39** advance to validation: the stale generic rejection is cleared, but normal source/integrity/editorial/duplication gates still apply
- **1** clears the stale block so an already-retained primary-source path can govern (`Most cereal produced` → current FAOSTAT path); the rejected World Bank route is not revived
- **38** remain blocked pending family-level curation because they are plausible but too dense, close to stronger anchors, or definition-sensitive
- **72** now have a reasoned confirmed exclusion basis (subgroup slice, technical/niche concept, invalid cross-country comparability, overgrown emissions/macro matrix, near duplicate, etc.)

So **40** of the 150 generic historical vetoes are cleared, **38** remain under re-audit, and **72** are converted from vague legacy rejections into explicit current product decisions.

A cleared legacy decision is never equivalent to `playable`. The runtime still requires editorial approval, strict quality pass, no hard source/integrity blocker, and no remaining legacy blocker.
