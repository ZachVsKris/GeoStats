# GeoStats v15.2.0

## Catalog recovery

- Approved official categories no longer become unplayable solely because an exact human-readable deep link is unavailable.
- General official source pages are repaired where possible.
- Metadata drift, API failures, and source-link precision are exposed as warnings rather than hard blockers.
- Direct value, ranking, country-set, duplicate, coverage, freshness, credibility, and editorial failures remain hard blockers.
- v15 rejections inherited only from mechanical legacy fields are recovered to `approved` or `pending` using the pre-v15 backup.
- Deliberate legacy curation and content exclusions remain rejected.

## Daily generation

- Includes the server-side warehouse dataset loader fix and adaptive generation profiles.
- Dataset-loading diagnostics retain concrete failure samples.

## Repository cleanup

- Removes duplicate visible workflow folders and old release-package artifacts from the active repository.
- Keeps database migration history under `supabase/migrations`.
