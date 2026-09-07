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
- Fixed capacity estimates to exclude modes a category is not approved for, including empty scopes. Corrected the reported elapsed time to include all three estimates.
- Separated publication minimum-coverage warnings from official-source mismatches in source-integrity v4. Missing countries, wrong values/ranks/units, conflicting duplicates and source-identity failures still fail validation. The quality and runtime publication gates remain independent; no held database row was bulk reclassified.
- Refreshed the owner review workbook: 414 playable rows, 146 remaining rows and all 242 original recovery candidates, with 96 promotions identified and formula-checked totals.
- Reconciled the launch docket with the later maximum-catalog instruction: no arbitrary ten-addition floor or obsolete blanket subject exclusions; explicit removals remain.

## Verification

- Full npm test suite passed: importer/source fixtures, generator regressions, static checks, behavior tests and bounded-cache tests.
- Full npm tests and TypeScript passed again after the capacity and source-integrity changes.
- Strict runtime accepted all 414 categories; 96 source-bound recovery records remain current.
- Fresh exact-source-hash audit proved 1,240 category/mode board witnesses: all 414 Scout, 413 Adventurer and 413 Expert, with no unresolved category.
- Fresh 30-day simulation (September 8–October 7) passed all 90 boards and all 30 cross-mode trio validations. It represented 247 categories and 159 countries; the most frequent category appeared on 7 dates. A separate 9,000-anchor sample selected 413 categories; the finite sample does not establish zero probability for the unselected category, which has a successful forced witness. These simulated boards were not published or used to replace scored Dailies.
- Actual country-bank capacity sampling completed 3,000 sets in every mode. Discovered feasible: Scout 1,302; Adventurer 1,189; Expert 276. Unresolved, not rejected: 205, 252 and 268 respectively. The JSON records statistical estimates and uncertainty; these are category sets, not every possible country-bank permutation.
- GitHub run 34162671543 passed the full Chromium, Firefox, WebKit, responsive, build, TypeScript, importer and source-fixture matrix on 0e3c1e325116bf0593380b70fbce59b089dd5f22. That commit reached production READY as dpl_EKWifiP1waqQc6L1J9MmT7YDwJ9E; its checked one-hour error/warning scan returned no logs.
- Engagement tables are populated: 70 category and 76 country rows. Production Privacy and Terms render with current public/account access rules; signed-out Admin redirects to Daily.
- DNS checks: DMARC p=none; send.geostats.xyz SPF includes amazonses.com; resend._domainkey.geostats.xyz publishes a DKIM key. This verifies records exist, not that sent mail passes alignment or lands in an inbox.
- Security advisors: service-only tables retain default-deny RLS. Two notices concern intentionally public read-only category readiness used by the catalog view; the function returns only a boolean and has a fixed empty search path. Disabled leaked-password protection remains an account configuration item. No grant was widened to clear a notice.
- Runtime-fix commit 669298235916e0c519a39735317fbc5534f6358b reached production READY as dpl_5tuALyAgoRAgwrX7iCC2vHvZkMb8. Its observed production error/warning scan was clean.
- Applied database migrations: 20260907210725 source repair, 20260907211158 verified promotion.
- Final source/importer/UI follow-up release status is recorded separately after deployment.

## Not yet accepted

- **Google/account flow:** both Google and email options are visible. New and returning user authorization, callback, username, Expert access, authenticated score save and relogin need an authorized test account.
- **Email deliverability:** SMTP settings, sent-message authentication/alignment and actual Gmail/Outlook/iCloud delivery remain unverified. Published DNS records alone do not establish delivery. Inbox placement cannot be guaranteed.
- **Phone QA:** the CI browser/responsive matrix passed. Real iPhone/Safari testing remains separate and unverified.
- **Remaining categories:** 92 source-verification cases (many also involve coverage), 30 coverage cases, 11 stale-data cases, 7 subjective/composite measures, 2 source-link checks, 2 duplicates, 1 product exclusion and 1 noncomparable-unit case. They were not silently rejected or bulk-promoted.
- **Long-horizon distribution:** current evidence is the bounded 30-day simulation and 9,000-anchor sample, not an exhaustive long-term fairness guarantee. Older 1,000-day simulations remain regression fixtures.

## Reproducible evidence

- audits/maximum-candidate-dispositions-2026-09-07.json
- audits/strict-runtime-replay-2026-09-07.json
- audits/faostat-stock-source-2026-09-07.json
- audits/faostat-stock-proofs-2026-09-07.json
- audits/daily-repair-before-2026-09-07.json
- audits/daily-repair-publication-2026-09-07.sql
- audits/live-414-reachability-2026-09-07.json
- audits/live-414-capacity-2026-09-07.json
- audits/live-414-freshness-2026-09-07.json
- Exact applied SQL under supabase/migrations.
