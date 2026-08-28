# GeoStats v16.2.7 rebuild

This release rebuilds catalog governance and production generation around the current 1,365-row warehouse rather than treating the old 364-category baseline as the target.

## Core changes

- Universal **Top-20** board-winner requirement; no historical/date exemption
- Anchor-first Daily/Random generation so playable categories are not starved by best-board pruning
- Explicit macro-domains for history, government/civics, culture/language/religion, sports, physical geography, geology/natural hazards, climate/environment/resources, health/demographics, education/labor/society, infrastructure/technology/science, economy/finance, trade, and food/agriculture
- Defined-subset eligible universes for chronology concepts where nonparticipants are outside the ranking rather than assigned synthetic values
- Decision provenance that distinguishes durable/manual exclusions from inherited generic exclusions
- Conservative first-principles recovery only for strong, verified, underrepresented inherited rejects; economy/trade/agriculture are not mass-restored
- Exact player-facing title deduplication
- WPP and World Bank CCKP importer repairs
- Production forced-anchor reachability auditing across Scout, Adventurer, and Expert
- Release gates requiring 500+ playable categories, zero unreachable playable categories, zero exact playable-title duplicates, breadth floors, and a maximum 60% combined economy/trade/agriculture share
- Source-slug-aware runtime routing for source organizations that host multiple GeoStats families
- Official-input sports chronology importers for men's FIFA World Cup first appearance and modern Olympic first appearance

## Sports source policy

The sports importer accepts only an official FIFA/IOC bulk or tabular input supplied to the workflow. It does not fall back to secondary datasets. The eligible universe is exactly the set of current countries with an official participation record in the supplied source.

## Release proof

Production loaders require both `enabled=true` and `eligible_daily=true`, so categories staged for reachability proof cannot leak into Daily, Random, or the direct warehouse-category API before publication. The Supabase installer is byte-for-byte synchronized with migration `054_v16_2_7_catalog_generator_rebuild.sql` and is regression-tested against drift.


`rebuild-v16-2-7.yml` runs the full v16.2.7 preflight (tests, typecheck, production build, and Playwright), imports and independently re-audits selected source families, stages strict-pass candidates without exposing them to players, forces every staged playable category through all three production difficulties plus Random/Daily exposure simulations, enforces Top-20 on generated boards, invokes `assert_v16_2_7_release()`, and only then atomically publishes the guarded catalog.

A release must not be called complete merely because the migration installs. Live Supabase/import/reachability checks must pass.
