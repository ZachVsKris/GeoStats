# GeoStats v14.0.1 — import repair and expansion

This package is the **complete repository**, not a patch. Replace the contents of the GitHub repository connected to Vercel with everything in this folder.

## What the uploaded Supabase result actually showed

The catalog totals were still exactly the pre-v14 totals: 8 Natural Earth, 13 UN Comtrade, and 76 World Bank categories. All sources also had an average verifiability score of about 88, which is the v14 migration's preserved-snapshot fallback for existing rows. That means the schema migration ran, but the new expansion import did not complete. The 498 non-playable existing categories were already curated in earlier releases; they should not all be moved back into the editorial queue.

## Deployment order

1. Replace the GitHub repository contents with this build.
2. Confirm `RUN_THIS_IN_SUPABASE_FOR_V13_5.sql` and `RUN_THIS_IN_SUPABASE_FOR_V14.sql` were previously applied.
3. In **Supabase → SQL Editor**, run `RUN_THIS_IN_SUPABASE_FOR_V14_0_1.sql` once.
4. Deploy through Vercel.
5. In GitHub, run **Actions → Repair and expand v14 imports → Run workflow**.
6. Leave the default World Bank settings for the first run:
   - target usable candidates: `500`
   - maximum indicators scanned: `2000`
7. After the Action succeeds, run `VERIFY_V14_0_1.sql` in Supabase.
8. Open `/admin` and filter for `Needs review` and `Candidate` rows. Newly imported categories remain disabled until approval.

## Required GitHub Actions secrets

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `COMTRADE_API_KEY` to import all 55 product-export candidates

Natural Earth and World Bank require no source API key.

## What the repair workflow imports

### Natural Earth

Exactly 24 reproducible vector-derived geography candidates. The workflow exits unsuccessfully if fewer than 24 are processed. Because 8 existed in the uploaded database, a successful run should update those 8 and add 16 new candidates.

### World Bank WDI

The importer now queries the WDI catalog directly with `source=2`, scans up to 2,000 not-yet-imported indicators, skips stale or unusable series, and keeps going until it inserts 500 usable candidates or exhausts the scan. The workflow requires at least 100 usable new candidates by default so a no-op or mostly failed run cannot appear successful.

### UN Comtrade

When `COMTRADE_API_KEY` is present, the workflow imports all 55 curated export-product candidates and fails if the run is partial. Without the key, it clearly reports that Comtrade was skipped rather than implying the expansion happened.

## Expected verification

`public.v14_import_health` should show:

- **Natural Earth:** latest run `completed`, 24 successful, 0 failures, at least 24 total categories, and at least one pending-review category
- **World Bank:** latest run `completed` and at least 100 successful new candidates on the default repair run
- **UN Comtrade:** 55 successful on the latest run when the key is configured

`VERIFY_V14_0_1.sql` also confirms that no pending category is enabled and that every playable category still passes the objective, verifiability, clarity, and fun gates.

## Why pending review was previously zero

The v14 SQL migration did not itself create new categories. It upgraded metadata and governance on the existing catalog. New rows only reach `curation_status='pending'` after an importer successfully writes them and calls the governance RPC. v14.0.1 makes that import completion visible and enforceable.

## Source and clarity behavior retained

- Every ranking can open the exact GeoStats country-value snapshot used
- Direct API/download/methodology links are shown when available
- Every category includes a plain-English subtitle
- Subjective and composite rankings remain blocked
- New candidates never enter Daily automatically
