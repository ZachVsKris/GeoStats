# GeoStats v16.2.1

v16.2.1 is a focused corrective release for the v16.2 catalog-recovery audit. It does not change the game rules or reintroduce a separate Random catalog.

## Corrected

- World Bank official-unit wording no longer creates a substantive source-integrity failure when values, country coverage, and rankings match. Player-facing units remain fail-closed when they are genuinely wrong.
- World Bank recovery repairs generic units from the current official series name and links to the exact official indicator page.
- Common-year selection now chooses the newest year meeting the source coverage floor. A sparse newest year can no longer displace a broadly comparable prior year.
- FAOSTAT QCL identity is verified by domain, item code, element code, year, unit, values, and rankings rather than exact equality between an official label and the player-facing title.
- FAOSTAT QCL categories use the official dataset page as an accepted general source link and now produce their own audit artifact.
- A clean, zero-mismatch Pew audit can refresh stale source-specific credibility quarantines.
- Missing Comtrade credentials and source-level audit failures now fail the workflow visibly.
- The finalizer refuses to publish when major-source audit counts or the proposed playable catalog fall below conservative minimums.
- Audit summaries report whether any automatic promotion actually occurred and how many categories were promoted.
- `actions/upload-artifact` is updated to v7, eliminating the Node.js 20 deprecation warnings.

## Publication safeguards

The runtime catalog is not changed by the installer. Recovery must produce at least:

- 300 usable World Bank audits
- 25 verified FAOSTAT QCL categories
- 15 usable WHO audits
- 40 verified UN Comtrade categories
- 180 categories passing the shared Daily/Random gate

Failure of any threshold stops finalization before gameplay flags are changed.
