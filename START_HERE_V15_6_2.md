# GeoStats v15.6.2 stability patch

This is an **update patch**, not a clean-repository replacement and not the new-category expansion.

## Included

### One approved catalog

- Removes Random-only as a category-quality tier
- Any category previously approved for Random is promoted to the same approved catalog used by Daily and Seeded
- Random and Seeded continue to construct different boards, but they no longer receive a lower-quality category pool
- Quarantined, duplicate, retired, or hard-integrity-failing categories remain unavailable

### Daily availability

- Physical geography remains a strong target, not a fatal requirement
- Adds staged generation profiles ending in an availability-first profile
- Relaxes source, broad-domain, and minimum-type preferences only
- Does not relax:
  - source/data integrity
  - board dimensions
  - displayed-value tie prevention
  - top-30 winning-country requirement
  - distinct category winners
  - semantic conflicts
  - duplicate-category exclusion
  - maximum one-country overlap across Daily modes
- Adds maximum one emissions category and one service-composition category across the full Daily trio
- Replaces the technical player-facing generator error with a short temporary message
- Advances the Daily category-set version so unscored current/future boards regenerate

### Category copy

- Restores **Most CO₂ emissions per person** as fully approved
- Rewrites both communications/computer indicators as explicit import/export shares
- Rewrites transport-service and travel-service indicators as explicit import/export shares
- Preserves original source wording in metadata
- Audits every currently approved/playable title and description for:
  - “etc.”
  - “n.e.c.”
  - unexplained acronyms
  - overly long titles
  - overly long descriptions
  - descriptions already ending in an ellipsis
- Adds a manual-review query for the remaining copy queue
- Adds final CSS overrides so old clamp rules cannot cut off player copy

## Installation order

1. Create a backup branch in GitHub.
2. Extract `GeoStats-v15.6.2-stability-patch.zip`.
3. Upload its contents to the root of the existing repository, replacing matching files.
4. Do not delete unrelated repository files.
5. Commit and push.
6. Wait for GitHub verification and Vercel to show Ready.
7. Run `RUN_THIS_IN_SUPABASE_FOR_V15_6_2.sql` in a new Supabase SQL Editor query.
8. Run `VERIFY_V15_6_2.sql`.
9. Hard-refresh GeoStats.
10. Open Scout, Adventurer, and Expert. The first request may generate and cache the new trio.

## Verification expectations

- `random_only_categories` = 0
- No row has `metadata.catalogTier = random`
- No enabled category has `eligible_daily = false`
- No playable title contains “etc.”
- CO₂ per person and the six service-composition categories appear approved
- Current/future old-version board query normally returns zero rows
- The manual copy-review query may return rows; those become the next manual editorial pass

## Rollback

1. Revert the Git commit containing v15.6.2.
2. Run `ROLLBACK_V15_6_2.sql`.
