# GeoStats v16.2.8 canonical launch docket

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
- [x] Require an account to view leaderboard standings, with the gate explained before sign-in
- [x] Explain the account benefit at the point of friction: Expert play, automatic verified score saving, and leaderboards
- [x] Keep account emails private and show only GeoStats usernames publicly
- [ ] Enable verified custom SMTP so authentication mail is sent as GeoStats rather than Supabase
- [ ] Externally verify From name/address, SPF, DKIM, DMARC, confirmation, magic-link, recovery, deliverability, and mobile rendering

## 3. Leaderboards — standalone launch package

- [x] Save signed-in Daily scores automatically; remove manual standings submission
- [x] Keep Scout, Adventurer, and Expert standings separate
- [x] Provide Today and All-time views for every difficulty
- [x] Compare scores fairly using board-adjusted results while retaining raw score context
- [x] Restrict leaderboard API data to authenticated accounts and disable caching
- [x] Handle signed-out, expired-session, empty, loading, query-error, and retry states clearly
- [x] Keep public copy free of internal QA terminology
- [x] Verify keyboard, screen-reader, phone, tablet, and desktop controls
- [ ] Re-run the production account flow after the final release commit: complete a Daily, confirm one automatic standing, refresh, change difficulty/time range, and confirm no duplicate/manual submission path

## 4. Analytics, accounts-created tracking, and Admin resilience

- [x] Track first-party visitors, page views, returning visitors, games started/completed, shares, and average result
- [x] Track successful authenticated account sessions without recording email in analytics events
- [x] Show total accounts, recent accounts, usernames, account conversion, acquisition paths, difficulty engagement, top categories, and top countries
- [x] Give Admin a plain-language glossary and explicit warehouse-health status
- [x] Let optional Admin subsystems fail independently rather than blanking the whole page
- [x] Repair the production warehouse-query failure state
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
- [x] Prove forced reachability for every playable category in Scout, Adventurer, and Expert
- [x] Penalize recent category, family, bucket, and country exposure during generation
- [x] Audit a rolling Daily simulation for excessive category repetition and meaningful country opportunity coverage
- [ ] Report Scout, Adventurer, and Expert board capacity using actual country-bank feasibility; raw category permutations alone are explicitly insufficient
- [ ] Re-run the production reachability and freshness audit after any catalog expansion

## 7. Bounded expansion — no spinning and no partial bundles

Each pass is independent and stops if it cannot prove at least 10 distinct additions. Proof requires an authoritative source, comparable country definition, broad coverage, clear player wording, non-duplication, a reproducible import, and actual Top-20 board feasibility. Failed or previously exhausted pathways are not retried without materially new evidence.

- [ ] Natural and physical geography: bounded 10-category feasibility pass
- [ ] Country history: bounded 10-category feasibility pass
- [ ] Culture: bounded 10-category feasibility pass
- [ ] Ethnic, religious, and racial demographics: bounded 10-category feasibility pass
- [ ] Import, stage, audit, and publish a subject bundle only if all 10 minimum candidates pass together

Out of expansion scope unless the owner later reopens them: education/labor/society, infrastructure/technology/science, and government/civics.

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

## External owner-only blocker

Custom authentication email cannot be enabled from source code alone. It requires a signed-in Supabase project owner (and the selected email provider/DNS account) to enter verified SMTP credentials and publish SPF, DKIM, and DMARC records. Templates and the verification checklist are already in the repository; this is the only known launch item that legitimately pauses for credentials or owner permission.
