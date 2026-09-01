# GeoStats v16.3.0 handoff

## Outcome

GeoStats v16.3.0 completes the agreed player, catalog, leaderboard, account,
admin, source-research, accessibility, and visual-polish scope that can be built
without an account owner entering third-party secrets.

The compound tropical-savanna measure shown as “Most land with a hot,
seasonally dry climate” is hard-retired. It cannot enter future Daily boards,
and unscored saved boards containing it are discarded. Scored historical boards
are preserved for result integrity.

## Completed build

- Public all-time leaderboard; sign-in is required only to appear in standings.
- Columns: Rank, Player, Average score, Rating, Completed games.
- Rating blends normalized score with peer-relative performance as sample size
  grows and applies a 10-game confidence prior without participation points.
- Google availability is checked before redirect; email magic links use a
  token-hash flow that works across browser contexts.
- Branded auth, loading, not-found, error, metadata, favicon, manifest, social
  preview, responsive, reduced-motion, focus, and admin no-index treatment.
- Same-day semantic conflict checks within each board and across Scout,
  Adventurer, and Expert, including glacier and climate-family exclusions.
- Terminology and definition audit, including temperature or precipitation
  thresholds where they materially define unfamiliar climate terms.
- Explicit measurement taxonomy; no playable category uses `Other`.
- Finite editorial dispositions: approved, rewrite, data repair, duplicate, or
  rejected. No pending/discussion queue remains.
- Bounded source expansion pass with explicit dispositions and no numerical
  padding requirement.
- Live audit workbook covering all 1,472 catalog records and the 314 strict
  database-playable records.

## Database migrations

Apply in timestamp order if rebuilding another environment:

1. `20260901170510_remove_tropical_savanna_from_saved_boards.sql`
2. `20260901171000_v16_3_0_eliminate_remaining_other_measurements.sql`
3. `20260901172000_v16_3_0_finite_review_backlog_dispositions.sql`
4. `20260901173500_v16_3_0_close_discussion_backlog.sql`

These migrations have already been applied to the connected production
Supabase project.

## Validation

- `npm run test-v16-3-0`: passed
- `npm run typecheck`: passed
- `npm run build`: passed
- Chromium desktop + Android Playwright suite: 55 passed, 1 skipped
- Strict catalog checks: 314 playable, 0 missing domains, 0 malformed domains,
  0 generic `other` measurements, 0 missing descriptions
- Editorial queue: 0 pending/review/discussion records

See `VALIDATION_V16_3_0.md` for the environment-specific cross-browser note.

## Owner-only finish

Only the following actions require private dashboard credentials or real-inbox
judgment and therefore remain outside the code release:

1. Create the Google OAuth web client, store its secret directly in Supabase,
   and enable the Google provider.
2. Enable Supabase leaked-password protection.
3. Confirm the production SMTP sender and matching repository templates; test
   deliverability to Gmail, Outlook, and iCloud without sharing recipient data.
4. Confirm SPF, DKIM, and DMARC pass in Resend logs, keep link tracking off for
   auth email, and strengthen DMARC only after legitimate senders are observed.
5. Complete one real Google and one email sign-in acceptance check, including
   username selection, Expert access, score saving, sign-out, and return sign-in.

Exact dashboard steps are in `V16_3_0_OWNER_FINISH.md`.

## Source of truth

- Release notes: `RELEASE_NOTES_V16_3_0.md`
- Validation: `VALIDATION_V16_3_0.md`
- Final source feasibility pass: `FINAL_BOUNDED_SOURCE_FEASIBILITY_V16_3_0.md`
- Expansion ledger: `BOUNDED_EXPANSION_LEDGER_V16_2_9.md`
- Owner checklist: `V16_3_0_OWNER_FINISH.md`
