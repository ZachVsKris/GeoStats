# GeoStats v13.0 — Unified Importers + WHO

v13.0 adds the first reusable multi-source importer framework and a complete WHO Global Health Observatory importer. It preserves the strict quarantine introduced in v12: imported data never becomes playable without automated qualification and explicit administrator approval.

## What this release adds

- A shared Python ingestion framework under `scripts/data_pipeline/`
- Dynamic WHO indicator discovery against WHO's current Indicator catalog
- 55 curated, player-readable health concepts
- Country-total filtering for the canonical 195-state GeoStats universe
- Common-year coverage, freshness, clustering, evidence, and ranking-stability scoring
- WHO observations stored with source dimensions and evidence status
- A canonical GeoStats category layer that separates player-facing concepts from provider-specific indicators
- Source priority and fallback relationships, without switching an approved preferred source automatically
- Dedicated GitHub Actions for FAOSTAT and WHO, updated to the current Node 24 action runtime
- A two-job **Import all source data** workflow
- Source-agnostic bulk review controls in Admin
- Coverage and quality sorting/filtering in the Category Library

WHO's official Global Health Observatory API is OData-based. The importer uses the official Indicator catalog and indicator entity endpoints documented by WHO.

## Required deployment order

1. In Supabase SQL Editor, run `RUN_THIS_IN_SUPABASE_FIRST.sql`.
2. Extract this ZIP.
3. Upload the **contents** into the root of the existing `ZachVsKris/Geohunter` repository, replacing matching files.
4. Commit the changes and wait for Vercel to show **Ready**.
5. Open GitHub → **Actions** → **Import WHO candidates** → **Run workflow**.
6. After it finishes, open `/admin`, choose source **WHO**, and review the quarantined categories.

The existing GitHub secrets are reused:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

## Workflows

- `.github/workflows/import-faostat.yml` — FAOSTAT only
- `.github/workflows/import-who.yml` — WHO only
- `.github/workflows/main.yml` — FAOSTAT and WHO in parallel

The old broken Admin link to `import-faostat.yml` is now valid because that workflow file actually exists.

## WHO selection behavior

The importer does not expose WHO's entire 1,000-plus-indicator catalog. It resolves a curated list of understandable concepts such as:

- life expectancy and healthy life expectancy
- maternal, infant, neonatal, and under-five mortality
- obesity, tobacco use, alcohol consumption, and physical inactivity
- tuberculosis, malaria, HIV, and hepatitis
- doctors, nurses, dentists, pharmacists, and hospital beds
- vaccination coverage
- universal health coverage
- clean cooking, water, sanitation, handwashing, and air pollution

Catalog matching is dynamic. If WHO renames or replaces an indicator, the importer looks for the best current match. If it cannot find a defensible match, it logs the concept as unmatched instead of inventing data.

## Quarantine rules

- Missing values remain missing; they are never converted to zero.
- Sex-, age-, residence-, and subgroup-specific rows are excluded unless a rule explicitly allows them.
- The newest sparse year cannot automatically displace a slightly older broadly covered year.
- A successful import does not mean approval.
- `auto_qualified=true` advances a category only to `needs_review`.
- Approval remains an administrator decision.

## Canonical categories

A canonical category is the stable GeoStats concept shown to players. Source categories are linked underneath it.

Example:

```text
Highest life expectancy
├── WHO GHO indicator (priority 10)
└── World Bank indicator (priority 40)
```

The preferred source changes only when a linked source category is both approved and enabled.

## Scope boundary

v13.0 loads WHO into the warehouse and creates the canonical source layer. The live puzzle generator still uses its existing approved-category integration. WHO categories remain unavailable to Daily until they pass review and the existing generator eligibility rules.
