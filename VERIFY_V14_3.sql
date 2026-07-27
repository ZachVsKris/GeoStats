-- GeoStats v14.3 verification

-- 1. No category may be missing semantic metadata.
select id,title,source_organization,semantic_family,semantic_topic,enabled,eligible_daily
from public.stat_categories
where semantic_family is null or semantic_topic is null
order by source_organization,title;

-- 2. No currently playable category may be awaiting or failing source validation.
select id,title,source_organization,validation_status,validation_reason
from public.stat_categories
where (enabled or eligible_daily)
  and coalesce(validation_status,'pending') <> 'verified'
order by source_organization,title;

-- 3. Source-integrity totals and recent failures.
select * from public.data_integrity_overview;
select * from public.data_integrity_by_source order by source;
select * from public.data_integrity_issues order by source_organization,title;

-- 4. These pairs are intentionally prevented from appearing together on one board.
select * from public.board_semantic_conflicts;

-- 5. Confirm the examples that triggered this release are classified together.
select id,title,source_indicator_code,semantic_family,semantic_topic
from public.stat_categories
where lower(concat_ws(' ',title,source_indicator_code)) similar to
  '%(employment-to-population|employment.population|unemployment|refugees originating|asylum applications by origin|refugees-origin|asylum-origin)%'
order by semantic_family,title;

-- 6. Review the semantic family assigned to every currently playable category.
select * from public.board_quality_category_status
where enabled and eligible_daily
order by semantic_family,title;

-- 7. World Bank repaired snapshots should have one common year, matching coverage,
-- exact source metadata, and zero validation mismatches once verified.
select
  id,title,source_indicator_code,common_year,common_year_coverage,country_coverage,
  validation_status,validation_expected_count,validated_observation_count,
  validation_mismatch_count,validation_ranking_mismatch_count,
  metadata->>'importSnapshotPolicy' as import_snapshot_policy,
  metadata->>'source_indicator_name' as official_series_name,
  metadata->>'official_unit' as official_unit
from public.stat_categories
where source_organization='World Bank'
order by title;
