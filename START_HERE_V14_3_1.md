# Start Here: GeoStats v14.3.1 Content Trust

This is the corrected v14.3 Semantic Quality release. It keeps the v14.3 board rules and adds a permanent content-comprehension gate plus a separate player-safe source-link gate.

## What changes immediately

- All 726 catalog candidates now have an explicit content decision in `CATEGORY_CONTENT_SOURCE_REVIEW_V14_3_1.csv`.
- The 252 previously approved categories were re-reviewed. Nine were removed and 17 were renamed for clarity.
- “Highest employment-to-population ratio,” “Highest labor-income share of GDP,” and “Highest output per worker” are explicitly excluded.
- Players never receive raw API, JSON, CSV, ZIP, spreadsheet, or forced-download links.
- A category cannot be playable without a verified human-readable external page showing the exact official indicator or filtered dataset.
- World Bank indicator pages are restored as the player-facing links.
- Categories from providers without a proven exact readable deep link remain disabled rather than receiving a misleading generic or downloadable link.

## Installation

### 1. Upload the complete repository

Upload every file and folder, including the hidden `.github` directory. Confirm GitHub contains:

- `.github/workflows/audit-source-integrity.yml`
- `.github/workflows/audit-player-source-links.yml`
- `supabase/migrations/024_content_comprehension_and_player_links.sql`
- `scripts/audit-player-source-links.py`

### 2. Apply the combined Supabase installer

Run the entire contents of:

`RUN_THIS_IN_SUPABASE_FOR_V14_3_1.sql`

Then run:

`VERIFY_V14_3_1.sql`

The unsafe-playable query must return zero rows.

### 3. Deploy the application

Deploy the repository through Vercel. The application version is `14.3.1`, and the rules/cache version is `8.1`, so old cached boards are not trusted.

### 4. Repair and audit source data

Run **Audit all source integrity** first with enforcement activation left off. Review the generated report, repair genuine importer/data mismatches, and rerun until the categories intended for play are verified.

### 5. Audit player source links

Run **Audit player source links**. It confirms that each candidate link:

- uses HTTPS
- returns an HTML page
- does not force a download
- identifies the exact indicator or saved filtered view

A failed or ambiguous link keeps the category disabled.

## Important temporary effect

The playable catalog may be substantially smaller after installation. This is intentional. World Bank categories have a reliable exact indicator-page pattern. Other sources remain blocked until their exact human-readable deep links are supplied and validated. The game fails closed rather than sending players to raw data or generic source pages.

## Review files

- `CONTENT_SOURCE_REVIEW_V14_3_1.md`: summary
- `CATEGORY_CONTENT_SOURCE_REVIEW_V14_3_1.csv`: all 726 decisions
- `VERIFY_V14_3_1.sql`: database verification
- `VALIDATION_V14_3_1.md`: test and acceptance checklist
- `FILE_MANIFEST_SHA256_V14_3_1.txt`: SHA-256 checksum manifest for the packaged repository
