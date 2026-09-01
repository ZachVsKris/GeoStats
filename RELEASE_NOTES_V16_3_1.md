# GeoStats v16.3.1 release notes

## One public catalog

- The database, game API, Data page, and Audit page now publish the same approved catalog.
- Runtime safety checks fail loudly if SQL marks a category playable but application copy or measurement rules reject it; categories can no longer disappear silently between layers.
- Bundled quarantine records cannot overwrite a live approved category with the same stable ID.

## Durable editorial decisions

- World Bank services-import, services-export, and combined goods-and-services measures are retired by indicator family, so a later source refresh cannot restore them under a new title.
- Reviewed percentage titles use explicit `%` wording and are reapplied after refreshes.
- Awkward crop-production grammar is corrected in both persisted and player-facing copy.

## Icons and taxonomy

- Largest arms imports uses `🪖` instead of a government-building icon.
- Total country area is classified as physical geography and uses `🗺️`.
- Tax revenue and military-spending cards use subject-specific icons.
- FAOSTAT crop and livestock cards use the depicted commodity or animal where an unambiguous emoji exists; `🌾` is reserved for genuinely grain-like measures.
- FAOSTAT Food Balances are grouped under Consumption rather than Agriculture, and the two historical-date categories have explicit history domains.

## Release contract

- Scout remains 4 countries × 4 categories, Adventurer 6 × 4, and Expert 8 × 6.
- Expert and score-saving participation remain sign-in gated; public leaderboards remain readable without an account.
- Daily and hidden Random QA continue to draw from one shared fail-closed catalog.
- New source passes require at least 10 approved categories to publish, with 20 or more preferred.
