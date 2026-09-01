# GeoStats v16.3.0 validation record

## Automated release gates

- `npm run test-v16-3-0`
- `npm run typecheck`
- `npm run build`
- `npm run test-e2e` across Chromium, Edge, Firefox, WebKit, Android, and iPhone profiles
- `python scripts/test-koppen-geiger-importer.py`
- `node --experimental-strip-types scripts/test-leaderboard-rating.mjs`
- 1,000-date generator propensity/reachability checks inherited from v16.2.6+

## Production catalog assertions

The post-deployment API and database audit confirmed:

- player-visible stable gameplay IDs: 278
- strict database rows before stable-ID aliasing and final runtime editorial gates: 310
- player-visible categories without a subject domain: 0
- player-visible categories without a card description: 0
- player-visible Köppen–Geiger categories with climate taxonomy: 10
- tropical-savanna climate category: retired from future generation and protected at the importer, database, promotion, and runtime boundaries

Warehouse row count is not presented as the player-visible category count.
FAOSTAT and Natural Earth rows retain stable gameplay IDs, and the application
applies final concept-clarity gates after the database's structural playability
review. The public `/api/playable-categories` response is the release count of
record.

The copy-clarity view uses `security_invoker=true`. Supabase's security advisor
reports no new migration errors; leaked-password protection remains an owner
dashboard setting.

## Manual owner checks after deployment

- Create the external Google OAuth web client, add the Supabase callback URI, store the secret only in Supabase, and enable Google.
- Turn on Supabase leaked-password protection.
- Confirm the production sender is `GeoStats <accounts@geostats.xyz>`, click tracking is disabled, and the three repository templates match the Supabase dashboard.
- Test one real Google sign-in and one magic link in Gmail, Outlook, and iCloud; inspect Resend delivery/authentication results without sharing credentials.
- After an observation period, strengthen DMARC only after all legitimate senders are accounted for.
