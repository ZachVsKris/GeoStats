# GeoStats v13.4 — Canonical names and automatic governance

## What changed

### Canonical country names

- Adds a fixed 195-country ISO3-to-display-name registry used by Python importers, the World Bank importer, and the database.
- Rewrites existing observation names and installs a trigger so source-specific labels cannot overwrite canonical names.
- Keeps each source's original country label in observation metadata for auditability.

### Automatic category approval

- Automatically enables categories only after numerical quality, provenance, and uniqueness gates all pass.
- Fails closed when the source or methodology is not classified.
- Preserves manual rejections.
- Automatically disables a formerly approved category if later data no longer qualify.

### Provenance policy

- Requires documented methodology and an acceptable evidence class, such as internationally harmonized administrative data, standardized surveys, transparent modeling, customs records, or geospatial derivation.
- Does not automatically accept unsupported figures merely asserted by country leadership.
- Treats national statistical-office data as potentially valid only when the international source documents harmonization or validation.

### World Bank re-review

- Re-evaluates every existing World Bank category; no legacy approval is grandfathered.
- Uses indicator-level policy rather than trusting the World Bank label alone.
- Explicitly quarantines internet-use ranking pending stronger indicator-level validation because its inputs may combine surveys, administrative reporting, and imputation.

### Duplicate protection

- Assigns categories to canonical concept groups, including exact, inverse, and complementary measures such as wettest/driest, most/least forest cover, urban/rural share, and wage/self-employment share.
- Keeps at most one playable category in each group.
- Prefers the direct authoritative source over a republished World Bank version, then uses quality, coverage, and freshness.
- Stores superseded categories in the warehouse for audit and future reconsideration.

## Required migration

Run `RUN_THIS_IN_SUPABASE_FOR_V13_4.sql` once after deploying the repository. It is designed to be rerunnable.
