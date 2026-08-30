# GeoStats v16.2.8 launch readiness

This release turns the reviewed 316-category catalog into a launch-ready product package. It does not force additional categories through the catalog gates.

## Player experience

- Scout and Adventurer remain playable without an account
- Expert boards remain visible to guests, while play requires a free account
- Leaderboards are account-only and clearly explain that eligible Daily scores save automatically
- Scout, Adventurer, and Expert standings are separate, with Today and All-time views
- Category-card edge colors now identify broad subject groups through a visible, non-scoring color key
- Player-facing category descriptions are concise, unambiguous, and omit terminal periods
- Internal Random QA routes and terminology stay out of the public product
- The leaderboard is a standalone launch package: account-only reading, automatic standings for verified Daily results, per-difficulty Today/All-time views, fair board-adjusted comparisons, and complete resilience states

## Admin and analytics

- Added first-party analytics for traffic, visitor return, account funnel, acquisition, difficulty, category, and country reporting
- Successful authentication attribution without collecting email addresses in analytics events
- Partial Admin degradation: one unavailable subsystem no longer blanks the whole dashboard
- Explicit warehouse-health checks, refresh controls, and plain-language Admin glossary
- Analytics reporting views are service-role-only

## Reliability and security

- Account-only leaderboard API responses are private and never cached
- Database failures return generic public messages while preserving server-side diagnostics
- Supabase owner policies cache `auth.uid()` once per statement and target `authenticated`
- GitHub Actions remains the release authority for Chromium, Firefox, and WebKit compatibility
- Custom GeoStats auth-email templates and DNS/provider checklist are committed; enabling the branded sender still requires the project owner to configure verified custom SMTP
- The canonical launch docket records every remaining product, data, browser, leaderboard, expansion, and publication gate in one place

## Catalog expansion boundary

Any further expansion is split into four bounded feasibility passes: natural/physical geography, country history, culture, and ethnic/religious/racial demographics. Each pass stops without import or publication unless it proves at least 10 distinct, authoritative, broad-coverage, Top-20-feasible categories that are not repeats of previously failed work.

Board-capacity reporting must test whether a sampled category set can form an actual country bank under the global Top-20, distinct-winner, distinct-value, continent, and board-diversity rules. A raw permutation count is not a playable-board count.
