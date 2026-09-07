# GeoStats repair acceptance — 7 September 2026

## Verified result

**414 playable/enabled categories, up from 318: 96 restored and no baseline removals.**
Scout has 414; Adventurer and Expert have 413 each. Arctic land area remains Scout-only.
Live checks: zero safe-but-hidden, zero unsafe-enabled; all 96 recovery records have current source/dependency fingerprints.

This is the largest verified catalog reached here, not proof that additional source work cannot recover more.
The original queue now has **146 unresolved categories**: 38 editorial-approved and 108 in other review states. See the complete disposition JSON.

## Verification correction

The earlier 410-category checkpoint overstated application verification. Its “live” replay bypassed the runtime safety gate. Production logs exposed four rejected categories and an oversized raw catalog cache.
The runtime gate, cache and verifier are now repaired. The original 274 witnesses passed strict replay; 12 new livestock witnesses also passed strict live replay, for 286 recovery-board checks.

## Completed in this pass

- Fixed approved-copy/runtime mismatches and sourced coastline/population-rate measurement handling. Hard exclusions and source/semantic checks remain.
- Replaced oversized raw catalog caches with bounded player-facing pages. Added tests for smaller server row caps and cross-page duplicate identities.
- Replaced September 7's conflicting lake Daily trio using the production solver and recent-play history. Atomic publication required unchanged source/board checks and zero submitted scores. Old unscored rows are backed up. Historical scored boards and submitted scores were not changed.
- Downloaded the official FAOSTAT QCL archive and independently extracted four stock series. Restored **327 missing poultry observations**: 171 chickens, 83 ducks, 73 turkeys. Converted “1000 An” to individual animals; exactly verified 46 existing camel observations.
- Fixed the importer to retain and convert those stock units on future imports, with regression fixtures.
- Confirmed desktop remove control on the right with equal **3 px top and bottom gaps**.
- Completed signed-out Scout assignment, results and expanded-ranking checks. No horizontal page/ranking overflow at 1363 px. Clarified “Best possible: 0” to “First-place picks.”
- Preserved previous lake/glacier/religion semantics, atomic category review and durable copy contracts, leaderboard pagination, safe auth redirects/provider retries, mode eligibility and responsive results work.

## Verification

- Full npm test suite passed: importer/source fixtures, generator regressions, static checks, behavior tests and bounded-cache tests.
- TypeScript passed after the final result-label change.
- Strict runtime accepted all 414 categories; 96 source-bound recovery records remain current.
- Runtime-fix commit 669298235916e0c519a39735317fbc5534f6358b reached production READY as dpl_5tuALyAgoRAgwrX7iCC2vHvZkMb8. Its observed production error/warning scan was clean.
- Applied database migrations: 20260907210725 source repair, 20260907211158 verified promotion.
- Final source/importer/UI follow-up release status is recorded separately after deployment.

## Not yet accepted

- **Google/account flow:** both Google and email options are visible. New and returning user authorization, callback, username, Expert access, authenticated score save and relogin need an authorized test account.
- **Email deliverability:** SMTP, SPF/DKIM/DMARC and actual Gmail/Outlook/iCloud delivery remain unverified. Inbox placement cannot be guaranteed.
- **Phone/cross-browser QA:** responsive CSS is implemented, but this session measured desktop only. Real iPhone/Safari and the full CI browser matrix are not claimed passed.
- **Remaining categories:** 92 source-verification cases (many also involve coverage), 30 coverage cases, 11 stale-data cases, 7 subjective/composite measures, 2 source-link checks, 2 duplicates, 1 product exclusion and 1 noncomparable-unit case. They were not silently rejected or bulk-promoted.
- **Distribution/capacity:** older 1,000-day simulations are regression fixtures, not fresh 414-category propensity or capacity evidence.

## Reproducible evidence

- audits/maximum-candidate-dispositions-2026-09-07.json
- audits/strict-runtime-replay-2026-09-07.json
- audits/faostat-stock-source-2026-09-07.json
- audits/faostat-stock-proofs-2026-09-07.json
- audits/daily-repair-before-2026-09-07.json
- audits/daily-repair-publication-2026-09-07.sql
- Exact applied SQL under supabase/migrations.
