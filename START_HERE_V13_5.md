# GeoStats v13.5.0 — start here

## Deployment order

1. Replace the GitHub repository contents with this build.
2. In Supabase SQL Editor, run `RUN_THIS_IN_SUPABASE_FOR_V13_5.sql` once.
3. Run `VERIFY_V13_5.sql`. The two queries labeled “must return zero rows” should be empty.
4. Configure branded authentication using `AUTH_BRANDING_SETUP_V13_5.md`.
5. Deploy through Vercel.
6. Test:
   - `/daily`
   - `/daily/adventurer`
   - `/daily/expert`
   - `/random/easy`
   - `/random`
   - `/random/expert`
   - `/leaderboard?difficulty=easy`
7. Complete one random board, reload its copied seed URL, and confirm it reproduces the same board.
8. Sign in with a new email and confirm GeoStats prompts for a username before saving a leaderboard score.

## Important behavior changes

- Internet-use percentage is quarantined from Daily and Random play pending independent corroboration.
- Scientific-journal article totals remain because the source is independently bibliometric, but GeoStats explains that the measure is publication volume rather than quality.
- Results use stored exact-source links and separate methodology links.
- Board generation loads the full currently approved warehouse catalog rather than only a hardcoded subset.
- All-time ratings compare scores against that same day’s board before applying a 20-game confidence adjustment.
- Random seed games are unranked and never enter Daily scores or leaderboards.
- Authentication is player-facing GeoStats, but custom SMTP must be configured separately for emails to come from a GeoStats-domain sender.
