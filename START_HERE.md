# GeoStats v15.2

This repository is a clean runtime release. Historical release files were removed from the working tree; they remain available in Git history.

## Install

1. Push this repository to GitHub and wait for **Verify GeoStats v15** and Vercel to succeed.
2. Run `RUN_THIS_IN_SUPABASE_FOR_V15_2.sql` in Supabase.
3. Open `/api/daily-trio/2026-07-28`, then `/daily`.
4. Do not run **Audit all source integrity** with enforcement enabled.

## What v15.2 changes

- Uses the direct server-side Supabase dataset loader introduced in v15.1.
- Makes exact source-link precision informational rather than a gameplay blocker.
- Restores mechanically inherited rejections only when the pre-v15 backup shows no deliberate curation/content exclusion.
- Preserves permanent political, subjective, confusing, esoteric, stale, poor-coverage, duplicate, and true data-integrity blocks.
- Keeps explicit legacy editorial exclusions intact.
