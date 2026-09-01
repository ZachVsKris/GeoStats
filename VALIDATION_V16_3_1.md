# GeoStats v16.3.1 validation record

## Automated release gates

- `npm run test-v16-3-1`: passed, including the 1,000-day generator propensity/reachability checks and the complete importer fixture chain
- `npm run typecheck`: passed
- `npm run build`: passed on Next.js 16.2.11
- `npx playwright test --project=chrome-desktop --project=chrome-android`: 55 passed, 1 intentionally skipped desktop-only touch test
- Phone layouts verified at 375×667, 390×844, 393×852, 414×896, 667×375, and 844×390 without weakening the strict same-screen Daily layout

## Production database assertions

The connected production Supabase project passed all transaction assertions and the independent post-migration audit:

- computed playable catalog: 306
- enabled Daily catalog: 306
- SQL/runtime public catalog: 306
- service-import/export or combined goods-and-services rows: 0
- physical-goods import/export rows retained: 2
- copy/measurement contradictions: 0
- missing broad domains: 0
- generic grain icons: 8, down from 92 before the semantic review
- prior production-solver reachability exclusions accidentally omitted from a later function definition: restored and all 8 remain non-playable

Spot checks passed for arms imports (`🪖`), total country area (`🗺️`, physical geography), greenhouse-gas emissions (`🌫️`), calorie intake (`🍽️`, consumption), urban population (Population/demographics), bananas (`🍌`), pineapple (`🍍`), eggplant (`🍆`), and grapefruit (`🍊`).

## Public-catalog contract

- The database, game API, Data page, and Audit page use one approved catalog.
- Bundled quarantine rows cannot overwrite a live approved row with the same stable ID.
- A SQL-approved row rejected by runtime copy or measurement rules throws a catalog-contract error instead of disappearing silently.
- Daily and hidden Random QA continue to use the same approved catalog.
- The final semantic-icon follow-up advances the server catalog cache key so a deployment cannot reuse pre-fix player copy or icons.

## Security and operations

- The four v16.3.1 migrations are recorded in production.
- Post-migration Postgres logs contain no ERROR, FATAL, or PANIC event.
- Supabase security advisor: 94 informational RLS-without-policy notices for intentionally non-public workbench tables and one warning for owner-controlled leaked-password protection.
- Supabase performance advisor findings are informational and unchanged by this release.

The remaining leaked-password setting is documented at the Supabase [password security guide](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
