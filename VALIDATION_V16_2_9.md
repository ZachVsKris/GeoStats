# GeoStats v16.2.9 validation

## Automated release checks

Run `npm run check-v16-2-9`. The release is blocked unless the inherited catalog/importer suite, v16.2.9 static checks, TypeScript, production build, and Chromium/Firefox/WebKit Playwright matrix all pass.

## Required database order

1. Apply `20260831061610_v16_2_9_transport_retirement_and_public_leaderboard.sql`
2. Confirm the removed transport category is not computed playable
3. Dispatch the bounded Köppen workflow only after the migration exists
4. Require all eleven stored-source validations, atomic promotion, and full Scout/Adventurer/Expert reachability proof to pass
5. Confirm the resulting playable catalog count is 326 (316 baseline, minus one transport category, plus eleven climate categories)
6. Run Supabase security and performance advisors and review any new RLS or index finding

## Production smoke matrix

- Signed out: Scout and Adventurer play; Expert previews but cannot accept placements; all three all-time leaderboards load
- Google sign-in: existing same-email accounts link safely, username onboarding appears when needed, Expert unlocks, and leaderboard reading remains public
- Email sign-in: branded message arrives, callback works from a separate tab/browser context, and no code-verifier mismatch appears
- Score: one signed-in Daily score saves once, survives refresh, and contributes after the five-game qualification threshold
- Admin: `/admin` and `/admin/review` reject non-admins; traffic/accounts, catalog health, semantic conflicts, integrity, and diversity panels load independently
- Daily generation: no semantically equivalent categories occur within a board or across modes on the same date; no board winner ranks below global Top 20
- Presentation: current Chrome and Safari phone/desktop checks show no clipped board controls, inaccessible modal, console error, or layout overflow
- Email: Resend shows SPF and DKIM aligned for `geostats.xyz`; DMARC is present; From name/address are GeoStats-branded; Gmail and one non-Gmail mailbox are checked for inbox/spam placement

## Rollback

Application rollback is independent of additive database objects. If the new natural bundle causes a release issue, run `ROLLBACK_V16_2_9.sql` to disable only those eleven new categories while preserving their source evidence and all historical scores. The owner-directed transport exclusion is intentionally not reversed.
