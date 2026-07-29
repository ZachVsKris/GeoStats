# GeoStats v15.6.1 corrective patch

This is an **update patch**, not a repository replacement and not the category-expansion release.

## What it changes

- Adds canonical Seeded/Random routes for Scout, Adventurer, and Expert
- Keeps older `/random/scout`, `/random/normal`, and `/random/adventurer` links working
- Ensures every Seeded route explicitly renders the game in `mode="random"`
- Aligns the application with database rules version `12.2`
- Busts the server category caches so new copy is visible promptly
- Applies the agreed wording and catalog decisions:
  - Largest city by population
  - Largest land area, with duplicate handling
  - Most greenhouse gas emissions
  - Highest fine-particle air pollution
  - Most fruit produced
  - Travel-services categories quarantined for indicator-specific review
- Preserves original source titles and descriptions in metadata
- Removes desktop description ellipses and allows natural wrapping

It does **not** import or approve the new expansion categories. That remains the next phase.

## Install order

1. Create a backup branch in GitHub.
2. Extract `GeoStats-v15.6.1-corrective-patch.zip`.
3. Upload the extracted contents to the root of the existing repository, replacing matching files. Do not delete unrelated files.
4. Commit and push.
5. Wait for the GitHub verification workflow and Vercel deployment to pass.
6. Run `RUN_THIS_IN_SUPABASE_FOR_V15_6_1.sql` in a new Supabase SQL Editor query.
7. Run `VERIFY_V15_6_1.sql`.
8. Hard-refresh the browser.

## Seed test

Use a seed such as `ATLAS-TEST-261`:

1. Open `/random?seed=ATLAS-TEST-261`.
2. Record the six category IDs/names and eight countries.
3. Open the copied link in a private window.
4. Confirm the same Adventurer board appears.
5. Repeat with:
   - `/random/easy?seed=ATLAS-TEST-261`
   - `/random/expert?seed=ATLAS-TEST-261`

The same seed is deterministic only for the same difficulty and current dataset/catalog version. That is intentional: changes to approved data or category eligibility may change a future board generated from the same text seed.

## Rollback

- Revert the Git commit for application files.
- Run `ROLLBACK_V15_6_1.sql` to restore the pre-patch category records.
