# GeoStats v16.3.0 validation record

## Automated release gates

- `npm run test-v16-3-0`
- `npm run typecheck`
- `npm run build`
- `npx playwright test --project=chrome-desktop --project=chrome-android` — 55 passed, 1 intentionally skipped
- `python scripts/test-koppen-geiger-importer.py`
- `node --experimental-strip-types scripts/test-leaderboard-rating.mjs`
- 1,000-date generator propensity/reachability checks inherited from v16.2.6+

## Production catalog assertions

The pre-deployment live database audit confirmed:

- strict database rows before stable-ID aliasing and final runtime editorial gates: 314
- strict database rows without a subject domain: 0
- strict database rows with a malformed domain: 0
- strict database rows with a generic `other` measurement: 0
- strict database rows without a card description: 0
- unresolved `pending`, `needs_review`, or `needs_discussion` editorial records: 0
- tropical-savanna climate category: retired from future generation and protected at the importer, database, promotion, and runtime boundaries

Warehouse row count is not presented as the player-visible category count.
FAOSTAT and Natural Earth rows retain stable gameplay IDs, and the application
applies final concept-clarity gates after the database's structural playability
review. The public `/api/playable-categories` response is the deployed release
count of record and is rechecked after production promotion.

The complete `npm run test-v16-3-0`, `npm run typecheck`, and `npm run build`
gates pass locally. Chromium desktop and Android pass the focused end-to-end
suite. Firefox, WebKit, iPhone, and Edge remain CI/browser-farm coverage because
the current build container lacks the required Firefox/WebKit system libraries
and a Microsoft Edge installation.

The copy-clarity view uses `security_invoker=true`. Supabase's security advisor
reports no new migration errors; leaked-password protection remains an owner
dashboard setting.

## Manual owner checks after deployment

- Create the external Google OAuth web client, add the Supabase callback URI, store the secret only in Supabase, and enable Google.
- Turn on Supabase leaked-password protection.
- Confirm the production sender is `GeoStats <accounts@geostats.xyz>`, click tracking is disabled, and the three repository templates match the Supabase dashboard.
- Test one real Google sign-in and one magic link in Gmail, Outlook, and iCloud; inspect Resend delivery/authentication results without sharing credentials.
- After an observation period, strengthen DMARC only after all legitimate senders are accounted for.
