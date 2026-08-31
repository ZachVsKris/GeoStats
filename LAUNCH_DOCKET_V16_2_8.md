# GeoStats v16.2.9 canonical launch docket

This is the single source of truth for the launch work discussed with the product owner. A package is complete only when its application, database, GitHub Actions, and production checks have the evidence required below. Ordinary implementation work is not a stopping point.

## 1. Reviewed playable catalog and player copy

- [x] Keep only categories that pass the reviewed, computed-playable, source-integrity, clarity, duplicate, coverage, distinct-value, and global Top-20 winner gates
- [x] Apply the owner-requested removals, including services imports, services exports, combined goods-and-services concepts, duplicate airline passengers, UNESCO living traditions, net income/transfers from abroad, and other durable retirements
- [x] Keep the stateless-population category only with an accessible definition
- [x] Rename unclear mapped-feature copy where the data supports the simpler idea; keep genuinely different lake measures distinct
- [x] Clarify the non-Christian/non-Muslim religion category in concise player language
- [x] Remove terminal periods from all player-facing category descriptions
- [x] Review the entire playable catalog for immediate comprehension, fun, source meaning, unit meaning, and duplicate concepts
- [x] Ensure approved or pending rows cannot appear playable merely because an older flag remained true
- [x] Refresh the owner-review workbook from the exact production playable catalog

## 2. Accounts, access, and account value

- [x] Let guests play Scout and Adventurer
- [x] Let guests see today's Expert board without placing countries
- [x] Require a free account to play Expert
- [x] Let everyone view leaderboard standings; require an account only to appear in them
- [x] Explain the account benefit at the point of friction: Expert play, automatic verified score saving, and leaderboards
- [x] Keep account emails private and show only GeoStats usernames publicly
- [ ] Enable verified custom SMTP so authentication mail is sent as GeoStats rather than Supabase
- [ ] Externally verify From name/address, SPF, DKIM, DMARC, confirmation, magic-link, recovery, deliverability, and mobile rendering

## 3. Leaderboards — standalone launch package

- [x] Save signed-in Daily scores automatically; remove manual standings submission
- [x] Keep Scout, Adventurer, and Expert standings separate
- [x] Provide one All-time view for every difficulty; do not maintain a Daily leaderboard
- [x] Show rank, player, average score on the current mode scale, rating, and completed games
- [x] Keep leaderboard reading public, strip private identifiers, highlight the signed-in player, and disable caching
- [x] Handle signed-out, expired-session, empty, loading, query-error, and retry states clearly
- [x] Keep public copy free of internal QA terminology
- [x] Verify keyboard, screen-reader, phone, tablet, and desktop controls
- [ ] Re-run the production account flow after the final release commit: complete a Daily, confirm one automatic standing, refresh, change difficulty, and confirm no duplicate/manual submission path

## 4. Analytics, accounts-created tracking, and Admin resilience

- [x] Track first-party visitors, page views, returning visitors, games started/completed, shares, and average result
- [x] Track successful authenticated account sessions without recording email in analytics events
- [x] Show total accounts, recent accounts, usernames, account conversion, acquisition paths, difficulty engagement, top categories, and top countries
- [x] Give Admin a plain-language glossary and explicit warehouse-health status
- [x] Let optional Admin subsystems fail independently rather than blanking the whole page
- [x] Repair the production warehouse-query failure state
- [x] Exclude administrators and internal testers from public traffic figures while preserving a private QA count
- [x] Add an automatically refreshed daily traffic-and-accounts table to Admin
- [ ] Verify category/country engagement tables have populated after sufficient post-release gameplay

## 5. Game presentation and cross-browser quality

- [x] Explain the color-coded card edges with a visible subject key and state that colors do not affect scoring
- [x] Preserve the dark atlas aesthetic while improving hierarchy, spacing, legibility, and action clarity
- [x] Fit Scout, Adventurer, and Expert boards on supported phone, tablet, 13-inch laptop, and desktop layouts
- [x] Cover portrait and landscape behavior, scroll containment, touch targets, keyboard actions, and reduced motion
- [x] Test Chromium/Chrome and Edge-compatible behavior locally
- [ ] Require green GitHub Chromium, Firefox, and WebKit/Safari-equivalent Playwright checks on the final release commit
- [ ] Run final real-device smoke checks in current Chrome and Safari after the final deployment

## 6. Board correctness, scale, and freshness

- [x] Enforce the global Top-20 winner requirement with no category exemptions
- [x] Enforce different category winners, distinguishable displayed values, one use per country, country/continent limits, category-family conflicts, and cross-mode Daily-trio constraints
- [x] Treat semantically equivalent or nested measures as conflicts both within one board and across all three boards on the same date
- [x] Prove forced reachability for every playable category in Scout, Adventurer, and Expert
- [x] Penalize recent category, family, bucket, and country exposure during generation
- [x] Audit a rolling Daily simulation for excessive category repetition and meaningful country opportunity coverage
- [ ] Report Scout, Adventurer, and Expert board capacity using actual country-bank feasibility; raw category permutations alone are explicitly insufficient
- [ ] Re-run the production reachability and freshness audit after any catalog expansion

## 7. Bounded expansion — no spinning and no partial bundles

Each pass is independent and stops if it cannot prove at least 10 distinct additions. Ten is the per-pass publication floor, 20+ is preferred, and there is no combined 20-category release floor or arbitrary ceiling when one authoritative source yields many genuinely distinct high-quality measures. Proof requires an authoritative source, comparable country definition, broad coverage, clear player wording, non-duplication, a reproducible import, and actual Top-20 board feasibility. Every pass is finite and recorded; failed or previously exhausted pathways are not retried without materially new evidence.

- [x] Natural and physical geography: bounded proof found 11 candidates that pass the authoritative-source, 195-country, and global Top-20 distinct-value gates; controlled import/promotion workflow prepared
- [x] Country history: bounded pass stopped below ten new additions; six strong categories remain live and the rejected candidates fail distinctness or editorial rules
- [x] Culture: bounded pass stopped below ten; the two available UNESCO count concepts are explicit owner exclusions and no acceptable replacement bundle was found
- [x] Ethnic, religious, and racial demographics: bounded pass stopped for new additions; 13 broad Pew religious-demography categories are already live, while the two remaining candidates do not clear the quality floor and ethnicity/race definitions are not globally comparable
- [x] Infrastructure, technology, and science: bounded candidate review stopped below ten new strict-pass additions; do not pad from economy/trade indicators
- [x] Final balance-source search: NASA POWER is the last new pool opened this cycle, with one finite 11-concept capital-climatology feasibility pass recorded in the ledger; no further source search follows it
- [ ] Import, stage, audit, and publish a subject bundle only if all 10 minimum candidates pass together

Out of expansion scope unless the owner later reopens them: education/labor/society and government/civics.

## 8. Release safeguards and publication

- [x] Keep internal Random QA inaccessible and undiscoverable to public users while retaining owner testing
- [x] Keep privacy and terms copy aligned with account, analytics, Expert, and leaderboard behavior
- [x] Add database rollback guidance and keep application rollback independent from additive migrations
- [x] Scan for committed secrets and keep local/Vercel artifacts ignored
- [ ] Pass static catalog/player-copy tests, importer tests, TypeScript, production build, and the full browser matrix on the final commit
- [ ] Confirm all required Supabase migrations and targeted RLS performance checks
- [ ] Confirm Vercel deploys the exact final green GitHub commit to `geostats.xyz`
- [ ] Smoke-test Daily modes, account gates, leaderboard, Admin, privacy, terms, analytics events, and runtime logs in production
- [ ] Refresh the category-review workbook if the playable catalog changes after any bounded expansion

## External owner approval gates

Custom SMTP and domain authentication are configured, but final delivery/inbox tests remain. Google sign-in code is ready; creating the permanent Google OAuth credential and enabling it in Supabase requires the owner to approve that external credential at the action point. Applying production migrations, importing the 11-category climate bundle, merging to the public main branch, and deploying to `geostats.xyz` also require final production approval.
