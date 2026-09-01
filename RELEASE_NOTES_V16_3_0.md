# GeoStats v16.3.0 release notes

## Clearer, more varied Daily boards

- Same-day semantic conflicts are hard failures within a board and across Scout, Adventurer, and Expert.
- Closely related Köppen–Geiger climate classifications are one-per-day concepts, even when their narrower strategy families differ.
- Glacier area and glacier percentage remain mutually exclusive, and the rule is covered by construction and validation tests.
- Every playable category now has a canonical subject domain and a nonempty board description.

## Definition and terminology audit

- All eleven playable Köppen–Geiger categories define the climate on the card using the exact Beck et al. (2023) thresholds.
- Temperate uses the source release's 0°C to 18°C coldest-month range and above-10°C warmest-month rule.
- Tropical, Mediterranean, continental, polar, tundra, arid, desert, and steppe copy includes the relevant temperature, precipitation, seasonality, or aridity thresholds.
- Percentage titles consistently use `%`; legacy `share` and incorrect `Largest` wording has been removed from the playable catalog.
- Card descriptions may be long enough to define an unfamiliar concept, while generic, internal, missing, and over-200-character copy still fails closed.

## Public all-time leaderboard

- The public leaderboard remains account-free to read and has only Scout, Adventurer, and Expert all-time tabs.
- Columns remain Rank, Player, Average score, Rating, and Completed games.
- Rating starts from normalized absolute score when a Daily has few players, blends toward peer-relative performance from 5 to 20 participants, and applies a 10-game confidence prior without awarding participation points.
- Five completed games are required. Historical and future v16.2.4-or-newer scores use the current board scale, including v16.3 scores.

## Account and delivery resilience

- The account dialog traps focus, closes predictably, restores focus, exposes live status, and uses friendly errors.
- Google provider availability is checked before redirecting, preventing the raw `Unsupported provider` page while setup is incomplete.
- Google remains the intended primary option once the provider is enabled; branded token-hash email remains the fallback and explicitly mentions spam/junk folders.
- Confirmation, magic-link, and recovery templates remain short, transactional, and compatible with links opened in a different browser context.

## Production polish and safety

- GeoStats now has a reusable custom globe mark, favicon, web-app manifest, Open Graph image, canonical/social metadata, and consistent branding on public information pages.
- Branded loading, not-found, page-error, and global-error states replace framework-default dead ends.
- Reduced-motion preferences apply globally, leaderboard loading uses a skeleton state, and admin pages are explicitly no-index.
- The catalog database migration closes with 321 computed-playable and 321 enabled categories, zero missing domains, zero missing card descriptions, and zero copy-clarity issues.
- The refreshed audit view runs with caller permissions. The only remaining non-informational Supabase security advisor is the owner-controlled leaked-password-protection toggle.

## Expansion discipline

- The source ledger remains the finite source of truth: each source pass must produce at least 10 approved categories, should target 20+, and may exceed 20 when the concepts are genuinely distinct.
- New household, surface-water, hydrography, lithology, language, volcano, settlement, demographic-yearbook, historical-polity, soil, forest, and cyclone leads are recorded with explicit bounded dispositions.
- No unverified source lead is promoted merely to meet a numerical target.
