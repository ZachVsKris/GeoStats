# GeoStats launch runbook

## Green-light checks

- GitHub verification workflow passes on the release commit
- Vercel production deployment is READY and `/daily`, `/daily/adventurer`, `/daily/expert`, and `/leaderboard` load without console errors
- An unsigned browser can complete all three Daily modes
- Signing in transfers every eligible browser completion, while the unique database rule keeps the first score per user, date, and mode
- Supabase security advisor has no security-definer view or public security-definer function errors
- Database storage is below the 470 MiB warning threshold
- Read-only load test stays under 1% errors and 3,000 ms p95 at 100 concurrent workers

## Capacity response

- **Warning (470 MiB):** pause bulk imports and inspect table growth before adding data
- **Critical (480 MiB):** stop nonessential writes, preserve gameplay, and either reclaim verified non-game data or upgrade storage
- Analytics retains 90 days; expired rows and rate-limit buckets are deleted by the existing Daily cron
- Never drop observation indexes or playable observations as an emergency shortcut

## Rollback

1. In Vercel, promote the last verified production deployment
2. Confirm all Daily modes and the public leaderboard load
3. Leave the database hardening and rate limits in place; they are backward-compatible with the prior UI
4. If a database migration itself causes a verified regression, prepare and review a targeted forward migration instead of editing migration history

## Incident triage

1. Check Vercel runtime errors and deployment status
2. Check Supabase project health, storage, and database advisors
3. Confirm the cached Daily endpoint responds before investigating account-only features
4. Protect anonymous gameplay first; analytics may safely fail closed without affecting the game
