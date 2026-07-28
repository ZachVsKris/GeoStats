# GeoStats v15.0.0 — Category Review Workbench

This build replaces the overlapping editorial gates with one visible review decision plus structured reasons. It keeps strict data-integrity requirements and adds a fast review interface at `/admin/review`.

## Deployment order

1. Back up Supabase.
2. Run the complete `RUN_THIS_IN_SUPABASE_FOR_V15.sql` file in Supabase SQL Editor.
3. Upload the **contents** of this repository to the root of GitHub and let Vercel deploy.
4. In GitHub Actions, run **Audit all source integrity** with `source = all` and `include_nonplayable = true`. The workflow now reconciles the v15 policy automatically.
5. Run `VERIFY_V15.sql`. The two sections labeled “must return zero rows” should be empty.
6. Sign in as a GeoStats administrator and open `/admin/review`.

## What the Workbench includes

- One authoritative status: Pending, Approved, Rejected, Duplicate, Needs rewrite, or Needs discussion
- Permanent structured flags for political/self-reported, subjective/composite, confusing, esoteric, stale, and poor-coverage categories
- Top and bottom country values in the comparable year
- Source, methodology, and dataset links
- Semantic-group editing and potential-overlap review
- Player-facing title rewrites
- Keyboard review: `A`, `R`, `D`, `W`, `N`, `P`, `C`, arrow keys, and `/` for search
- Audit history for every saved change

## Strict playability policy

Editorial approval alone does not make a category playable. A category must also have:

- an official allowed source
- verified source integrity
- quality score of at least 70
- acceptable credibility
- no prior explicit content/curation exclusion
- at least 30 comparable countries
- comparable data from 2022 or later
- a safe exact or general human-readable official source page

The installer repairs World Bank exact indicator links and assigns safe general official portals to supported sources without automatically approving their categories.
- no political/self-report, subjective/composite, confusing, esoteric, stale, poor-coverage, or duplicate flag

Legacy comprehension, interest, and review columns remain available as evidence, but missing values in those old fields no longer erase otherwise strong categories.

## Initial policy exclusions

The installer conservatively rejects known unwanted concepts including happiness/perception/governance indices, internet-usage self-reporting, labor-income share, output per worker, and employment-to-population ratios. Broader survey/perception wording is placed into Needs discussion rather than automatically approved.

## Rollback

`ROLLBACK_V15.sql` restores runtime category fields captured before the first v15 installer run. It preserves review decisions and history by default.
