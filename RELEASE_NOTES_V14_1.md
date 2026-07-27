# GeoStats v14.1 release notes

## Smarter Daily and random boards

- Scout allows no more than 2 countries from one continent
- Adventurer and Expert allow no more than 3 countries from one continent
- Scout allows no more than 1 FAOSTAT category
- Adventurer and Expert allow no more than 2 FAOSTAT categories
- Each category's board winner must rank within the strongest global half of reporting countries, capped at global rank 50
- The same constraints are enforced while generating, validating, loading, and scoring boards
- Country population is used only as a small optimization preference, not a hard quota, so boards are gently steered away from all-obscure lineups without sharply reducing the seed space

## Simpler Data & Source experience

The player-facing panel now contains only:

- category title and plain-language description
- source and comparison year
- searchable global country ranking
- one direct source-material link

Internal validation scores, evidence labels, technical definitions, query parameters, licenses, and governance explanations remain in the warehouse/admin systems rather than overwhelming players.

## Resilient UN Comtrade expansion

- Retries HTTP 429 responses using Retry-After or exponential backoff
- Adds a configurable delay between API requests
- Stops immediately and saves progress when quota is exhausted
- Skips categories already present on later runs
- Fetches the newest usable common year instead of downloading every recent year
- Treats API quota exhaustion as a resumable partial success
- Keeps real code, authentication, malformed-response, and warehouse failures visible

## First-party analytics and admin health

GeoStats now records privacy-conscious first-party events for:

- page views and visitor sessions
- games started and completed
- scores and completion rates
- shares
- source-panel opens
- sign-in requests and saved public usernames

The Admin Control Center adds:

- customized username count
- 30-day traffic and gameplay summary
- warehouse health by source
- recent Daily-generator success/failure history

No advertising, payment processor, subscription tier, or paywall is included. Existing permanent Supabase user IDs and the new analytics foundation keep those options open without committing to a monetization model now.
