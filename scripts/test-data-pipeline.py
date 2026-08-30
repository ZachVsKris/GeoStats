#!/usr/bin/env python3
from data_pipeline.models import IndicatorRule, SourceObservation
from data_pipeline.quality import score_observations
from data_pipeline.base import WarehouseImporter

rule = IndicatorRule(
    key="test",
    title="Highest test value",
    description="test",
    family="Test",
    icon="🧪",
    unit="units",
    value_type="other",
    ranking_direction="high",
    include=("test",),
    min_coverage=100,
    evidence_tier="A",
)
rows = []
for year in (2024, 2025):
    for index in range(160):
        rows.append(SourceObservation(
            country_iso3=f"T{index:02d}"[-3:],
            country_name=f"Country {index}",
            data_year=year,
            value=float(index + (year - 2024) * 0.1),
            source_url="https://example.test",
            evidence_status="official",
        ))
quality = score_observations(rule, rows)
assert quality.common_year == 2025
assert quality.common_year_coverage == 160
assert quality.clustering_score >= 90
assert quality.stability_score >= 90
assert quality.auto_qualified

# A sparse newest year must not displace a broadly comparable prior year.
sparse_rows = [row for row in rows if row.data_year == 2024]
for index in range(5):
    sparse_rows.append(SourceObservation(
        country_iso3=f"S{index:02d}", country_name=f"Sparse {index}", data_year=2026,
        value=float(index), source_url="https://example.test", evidence_status="official",
    ))
sparse_quality = score_observations(rule, sparse_rows)
assert sparse_quality.common_year == 2024, sparse_quality
assert sparse_quality.common_year_coverage == 160

# Stable climate normals use their peer-reviewed publication year for source
# freshness without pretending that the 1991-2020 observation period ended in
# a newer year.
climatology_rule = IndicatorRule(
    **{**rule.__dict__, "key": "climate-normal", "temporal_scope": "climatology", "publication_year": 2023}
)
climatology_rows = [SourceObservation(
    country_iso3=row.country_iso3,
    country_name=row.country_name,
    data_year=2020,
    value=row.value,
    source_url=row.source_url,
    evidence_status=row.evidence_status,
) for row in rows if row.data_year == 2024]
climatology_quality = score_observations(climatology_rule, climatology_rows)
assert climatology_quality.common_year == 2020
assert climatology_quality.auto_qualified, climatology_quality
assert "climatology:2023" in climatology_quality.notes
base_row = {"review_status": "needs_review", "enabled": False, "eligible_daily": False}
assert WarehouseImporter.preserve_editorial_state(
    base_row, {"review_status": "rejected"}, auto_qualified=True
)["review_status"] == "rejected"
assert WarehouseImporter.preserve_editorial_state(
    base_row, {"review_status": "approved"}, auto_qualified=True
)["enabled"] is False
revoked = WarehouseImporter.preserve_editorial_state(
    base_row, {"review_status": "approved"}, auto_qualified=False
)
assert revoked["review_status"] == "needs_review" and revoked["enabled"] is False
print("Generic data-pipeline tests passed.")
