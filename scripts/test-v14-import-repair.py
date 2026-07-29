#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from data_pipeline.base import WarehouseImporter
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation


class FakeImporter(WarehouseImporter):
    source_organization = "Fake"
    source_dataset = "Fake catalog"
    source_slug = "worldbank"

    def discover(self):
        return [
            CandidateDefinition(
                rule=IndicatorRule(
                    key=f"candidate-{index}",
                    title=f"Candidate {index}",
                    description="A clearly explained objective value.",
                    family="Test",
                    icon="📊",
                    unit="people",
                    value_type="total",
                    ranking_direction="high",
                    include=(str(index),),
                    min_coverage=1,
                    evidence_tier="B",
                    specificity_score=90,
                    recognizability_score=90,
                ),
                source_indicator_code=str(index),
                source_indicator_name=f"Candidate {index}",
                source_url="https://example.com/data",
                metadata={"api_url": "https://example.com/api"},
            )
            for index in range(10)
        ]

    def fetch_observations(self, candidate):
        if candidate.rule.key in {"candidate-0", "candidate-2"}:
            raise RuntimeError("fixture failure")
        return [
            SourceObservation(
                country_iso3=f"X{index:02d}",
                country_name=f"Country {index}",
                data_year=2025,
                value=float(index),
                source_url="https://example.com/data",
            )
            for index in range(110)
        ]

    def category_id(self, candidate):
        return candidate.rule.key


result = FakeImporter(None, dry_run=True).run(scan_limit=8, target_successes=3)
assert result["candidates_discovered"] == 10
assert result["candidates_selected"] == 8
assert result["categories_processed"] == 3
assert result["candidates_attempted"] == 5
assert result["target_reached"] is True
assert len(result["failures"]) == 2

root = Path(__file__).resolve().parents[1]
world_bank = (root / "scripts/import-world-bank-catalog.py").read_text()
assert "source=2" in world_bank
assert "--target-successes" in world_bank
assert "--scan-limit" in world_bank
assert "--minimum-successes" in world_bank

natural = (root / "scripts/import-natural-earth.py").read_text()
comtrade = (root / "scripts/import-comtrade.py").read_text()
assert "default=len(RULES)" in natural
assert "default=len(SPECS)" in comtrade

workflow = (root / ".github/workflows/repair-v14-expansion.yml").read_text()
for required in (
    "Import all 24 Natural Earth candidates",
    "--target-successes",
    "--minimum-successes 55",
    "verify-v14-import-expansion.py",
):
    assert required in workflow

migration = (root / "RUN_THIS_IN_SUPABASE_FOR_V14_0_1.sql").read_text()
assert "create or replace view public.v14_import_health" in migration
assert "pending_review_count" in migration
assert "apply_category_governance" in migration

print("v14.0.2 import-repair checks passed")
