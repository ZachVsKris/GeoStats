# GeoStats v13.4.4

## Install

1. Replace the GitHub repository with the contents of this folder.
2. Wait for Vercel to deploy.
3. Run `RUN_THIS_IN_SUPABASE_FOR_V13_4_4.sql` in Supabase SQL Editor.
4. Run `VERIFY_V13_4_4.sql`.
5. The verification violation counts should all be `0`.

On the database snapshot used for this review, playable categories should rise from 203 to about 236.

Run **Import ILOSTAT candidates** once after installation. The importer already rejects 2026 and 2027 observations and will use the latest completed year. If the five temporarily blocked ILOSTAT concepts then meet their normal quality requirements, the playable total may rise to about 241.

No other importer needs to be rerun solely for v13.4.4.

## Audit files

- `CURATION_DECISIONS_V13_4_4.csv`: all 726 final editorial decisions
- `PLAYABILITY_REVIEW_V13_4_4.csv`: the 50-row diagnostic review and final disposition
- `PLAYABILITY_REPORT_V13_4_4.md`: policy summary
