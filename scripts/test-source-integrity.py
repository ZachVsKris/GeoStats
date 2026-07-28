#!/usr/bin/env python3
from __future__ import annotations

from data_pipeline.integrity import VALIDATION_VERSION, competition_ranks, snapshot_checksum, source_identity_checks, units_compatible, validate_category_snapshot
from data_pipeline.models import CandidateDefinition, IndicatorRule, QualityResult, SourceObservation

rule = IndicatorRule(
    key="test-series", title="Largest test values", description="Test values.", family="Test", icon="📊",
    unit="units", value_type="total", ranking_direction="high", include=("TEST.CODE",), min_coverage=3,
)
candidate = CandidateDefinition(
    rule=rule,
    source_indicator_code="TEST.CODE",
    source_indicator_name="Official test series",
    source_url="https://example.test/source",
    metadata={"source_query": {"indicator": "TEST.CODE"}, "official_unit": "units"},
)
observations = [
    SourceObservation("USA", "United States", 2024, 100.0, candidate.source_url, "TEST.CODE:USA:2024"),
    SourceObservation("CAN", "Canada", 2024, 50.0, candidate.source_url, "TEST.CODE:CAN:2024"),
    SourceObservation("MEX", "Mexico", 2024, 50.0, candidate.source_url, "TEST.CODE:MEX:2024"),
]
quality = QualityResult(
    score=95, review_status="approved", auto_qualified=True, common_year=2024, common_year_coverage=3,
    latest_year=2024, country_coverage=3, official_share=1.0, modeled_share=0.0, clustering_score=90,
    stability_score=90, evidence_tier="A", notes="fixture",
)
expected_row = {
    "id": "worldbank-catalog:test-code", "unit": "units", "ranking_direction": "high",
    "source_organization": "World Bank", "source_dataset": "World Development Indicators",
    "source_indicator_code": "TEST.CODE", "common_year": 2024, "common_year_coverage": 3,
    "source_query": {"indicator": "TEST.CODE"}, "metadata": {"source_indicator_name": "Official test series", "official_unit": "units"},
}
stored_category = dict(expected_row)
stored_rows = [
    {"country_iso3": row.country_iso3, "data_year": row.data_year, "value": row.value}
    for row in observations
]

passed = validate_category_snapshot(
    source_slug="worldbank", source_organization="World Bank", source_dataset="World Development Indicators",
    category_id=expected_row["id"], candidate=candidate, quality=quality, source_observations=observations,
    expected_category_row=expected_row, stored_category=stored_category, stored_observations=stored_rows,
)
assert passed.status == "verified", passed
assert passed.expected_count == 3 and passed.compared_count == 3
assert passed.source_checksum == passed.stored_checksum
assert competition_ranks({"USA": 100, "CAN": 50, "MEX": 50}, "high") == {"USA": 1, "CAN": 2, "MEX": 2}
assert len(snapshot_checksum({"USA": 1.0})) == 64

assert units_compatible("people/km²", "reported value", "Population density (people per sq. km of land area)")
assert units_compatible("per 100 people", "rate", "Mobile cellular subscriptions (per 100 people)")
assert units_compatible("USD", "reported value", "GDP (current US$)")
assert not units_compatible("tonnes", "%", "Forest area (% of land area)")

bad_rows = [dict(row) for row in stored_rows]
bad_rows[1]["value"] = 49.0
failed = validate_category_snapshot(
    source_slug="worldbank", source_organization="World Bank", source_dataset="World Development Indicators",
    category_id=expected_row["id"], candidate=candidate, quality=quality, source_observations=observations,
    expected_category_row=expected_row, stored_category=stored_category, stored_observations=bad_rows,
)
assert failed.status == "failed"
assert failed.value_mismatch_count == 1
assert "value mismatches" in (failed.failure_reason or "")
assert "values" in failed.details.get("failureTypes", [])

wrong_metadata = dict(stored_category, unit="tonnes")
metadata_failure = validate_category_snapshot(
    source_slug="worldbank", source_organization="World Bank", source_dataset="World Development Indicators",
    category_id=expected_row["id"], candidate=candidate, quality=quality, source_observations=observations,
    expected_category_row=expected_row, stored_category=wrong_metadata, stored_observations=stored_rows,
)
assert metadata_failure.status == "failed"
assert metadata_failure.metadata_checks["unit"] is False
assert VALIDATION_VERSION.startswith("geostats-v14.4")

wrong_official_unit = dict(stored_category)
wrong_official_unit["metadata"] = {**stored_category["metadata"], "official_unit": "tonnes"}
official_unit_failure = validate_category_snapshot(
    source_slug="worldbank", source_organization="World Bank", source_dataset="World Development Indicators",
    category_id=expected_row["id"], candidate=candidate, quality=quality, source_observations=observations,
    expected_category_row=expected_row, stored_category=wrong_official_unit, stored_observations=stored_rows,
)
assert official_unit_failure.status == "failed"
assert official_unit_failure.metadata_checks["official_unit"] is False

wrong_series_rule = IndicatorRule(
    key="life-expectancy", title="Highest life expectancy", description="Life expectancy.",
    family="Health", icon="🫀", unit="years", value_type="other", ranking_direction="high",
    include=(r"life expectancy at birth",), exclude=(r"maternal",), min_coverage=3,
)
wrong_series = CandidateDefinition(
    rule=wrong_series_rule, source_indicator_code="WRONG", source_indicator_name="Maternal mortality ratio",
    source_url="https://example.test/wrong", metadata={"source_query": {"indicator": "WRONG"}},
)
identity = source_identity_checks("who", wrong_series)
assert identity["official_name_matches_required_concept"] is False
assert identity["official_name_avoids_excluded_concepts"] is False

aggregate_observations = observations + [SourceObservation("WLD", "World", 2024, 200.0, candidate.source_url, "TEST.CODE:WLD:2024")]
aggregate_quality = QualityResult(
    score=95, review_status="approved", auto_qualified=True, common_year=2024, common_year_coverage=4,
    latest_year=2024, country_coverage=4, official_share=1.0, modeled_share=0.0, clustering_score=90,
    stability_score=90, evidence_tier="A", notes="fixture",
)
aggregate_expected = dict(expected_row, common_year_coverage=4)
aggregate_stored = dict(aggregate_expected)
aggregate_rows = stored_rows + [{"country_iso3": "WLD", "data_year": 2024, "value": 200.0}]
aggregate_failure = validate_category_snapshot(
    source_slug="worldbank", source_organization="World Bank", source_dataset="World Development Indicators",
    category_id=expected_row["id"], candidate=candidate, quality=aggregate_quality, source_observations=aggregate_observations,
    expected_category_row=aggregate_expected, stored_category=aggregate_stored, stored_observations=aggregate_rows,
)
assert aggregate_failure.status == "failed"
assert aggregate_failure.metadata_checks["source_country_universe"] is False
print("GeoStats v14.4 source integrity fixture tests passed.")
