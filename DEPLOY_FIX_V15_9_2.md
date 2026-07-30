# GeoStats v15.9.2 deployment correction

This correction fixes the Next.js/Supabase TypeScript error in `app/api/leaderboard/route.ts`. The dynamic Supabase select is normalized through a runtime type guard instead of directly casting `GenericStringError[]` to `ScoreRow[]`.

It also makes the hidden-workflow upgrade explicit:

- replace `.github/workflows/main.yml` with the included v15.9.2 version;
- delete obsolete `import-physical-summaries.yml`, `import-unesco.yml`, and `import-v15-8-expansion.yml`.

No Supabase SQL changes are required for this deployment correction.
