#!/usr/bin/env python3
"""Repair legacy World Bank categories in place without creating duplicate IDs.

The broad legacy warehouse predates the current metadata and audit contracts. This
script resolves every stored World Bank indicator against the current WDI catalog,
refreshes official metadata, and optionally replaces 2022-current observations. Human
editorial decisions are preserved. Categories remain fail-closed until the independent
source-integrity audit and v16.2 finalizer pass them.
"""
from __future__ import annotations

import argparse
import importlib.util
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from data_pipeline.quality import score_observations
from data_pipeline.supabase import SupabaseWarehouse

SCRIPT = Path(__file__).resolve().parent / "import-world-bank-catalog.py"
SPEC = importlib.util.spec_from_file_location("geostats_world_bank_recovery", SCRIPT)
if not SPEC or not SPEC.loader:
    raise RuntimeError("Could not load the World Bank importer.")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
WorldBankCatalogImporter = MODULE.WorldBankCatalogImporter
unit_and_type = MODULE._unit_and_type


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh legacy World Bank categories in place.")
    parser.add_argument("--refresh-values", action="store_true", help="Replace 2022-current observations and recalculate the common year.")
    parser.add_argument("--limit", type=int, default=0, help="Maximum stored categories to process; 0 means all.")
    parser.add_argument("--only-approved", action="store_true", help="Limit recovery to approved or curated categories.")
    return parser.parse_args()


def observation_rows(category_id: str, observations: list[Any]) -> list[dict[str, Any]]:
    return [{
        "category_id": category_id,
        "country_iso3": item.country_iso3,
        "country_name": item.country_name,
        "data_year": item.data_year,
        "value": item.value,
        "source_url": item.source_url,
        "source_record_id": item.source_record_id,
        "metadata": item.metadata,
    } for item in observations]


def main() -> int:
    args = parse_args()
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.")

    warehouse = SupabaseWarehouse(url, key, timeout=180)
    importer = WorldBankCatalogImporter(None, dry_run=True)
    candidates = {candidate.source_indicator_code: candidate for candidate in importer.discover()}
    stored = warehouse.list_categories_by_source("World Bank")
    if args.only_approved:
        stored = [row for row in stored if str(row.get("review_status") or "") == "approved" or str(row.get("curation_status") or "") == "approved"]
    if args.limit > 0:
        stored = stored[: args.limit]

    repaired = refreshed = unresolved = failed = 0
    failures: list[dict[str, str]] = []
    now = datetime.now(timezone.utc).isoformat()
    for index, row in enumerate(stored, start=1):
        category_id = str(row.get("id") or "")
        code = str(row.get("source_indicator_code") or "")
        candidate = candidates.get(code)
        print(f"[{index}/{len(stored)}] {row.get('title')} ({code})", flush=True)
        if not candidate:
            unresolved += 1
            failures.append({"categoryId": category_id, "indicator": code, "error": "Indicator not resolved by the current WDI catalog."})
            continue
        try:
            metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
            source_query = candidate.metadata.get("source_query") or {"indicator": code, "country": "all"}
            official_unit = candidate.metadata.get("official_unit") or ""
            display_unit, value_type = unit_and_type(candidate.source_indicator_name, str(official_unit))
            patch: dict[str, Any] = {
                "source_dataset": "World Development Indicators",
                "source_url": candidate.source_url,
                "source_page_url": candidate.metadata.get("source_page_url") or candidate.source_url,
                "player_source_url": candidate.source_url,
                "player_source_status": "exact",
                "player_source_reason": "Exact official World Bank indicator page.",
                "player_source_checked_at": now,
                "link_quality_score": 100,
                "methodology_url": candidate.metadata.get("methodology_url"),
                "exact_query_url": candidate.metadata.get("exact_query_url"),
                "api_url": candidate.metadata.get("api_url"),
                "source_query": source_query,
                "technical_definition": candidate.rule.technical_definition or candidate.source_indicator_name,
                "unit_explanation": candidate.rule.unit_explanation or candidate.rule.unit,
                "unit": display_unit,
                "value_type": value_type,
                "dataset_release": candidate.metadata.get("dataset_release"),
                "retrieved_at": now,
                "validation_status": "pending",
                "validation_reason": "World Bank metadata refreshed in v16.2; awaiting independent official-source comparison.",
                "validation_mismatch_count": 0,
                "validation_ranking_mismatch_count": 0,
                "enabled": False,
                "eligible_daily": False,
                "metadata": {
                    **metadata,
                    "source_indicator_name": candidate.source_indicator_name,
                    "official_series_name": candidate.source_indicator_name,
                    "official_unit": official_unit,
                    "source_query": source_query,
                    "worldBankRecoveryVersion": "geostats-v16.2.1-world-bank-recovery-v2",
                    "worldBankRecoveredAt": now,
                },
                "updated_at": now,
            }
            if args.refresh_values:
                observations = importer.fetch_observations(candidate)
                quality = score_observations(candidate.rule, observations)
                if quality.common_year is None or quality.common_year_coverage < 30:
                    raise RuntimeError("No recent common year with at least 30 country observations.")
                warehouse.replace_category_observations(category_id, observation_rows(category_id, observations))
                patch.update({
                    "common_year": quality.common_year,
                    "common_year_coverage": quality.common_year_coverage,
                    "country_coverage": quality.country_coverage,
                    "latest_available_year": quality.latest_year,
                    "quality_score": quality.score,
                    "clustering_score": quality.clustering_score,
                    "stability_score": quality.stability_score,
                    "quality_standard_version": "geostats-v16.2.1-world-bank-recovery-v2",
                })
                refreshed += 1
            warehouse.patch_category(category_id, patch)
            repaired += 1
        except Exception as error:
            failed += 1
            failures.append({"categoryId": category_id, "indicator": code, "error": str(error)[:1000]})
            print(f"  failed: {error}", flush=True)

    print({
        "selected": len(stored), "metadataRepaired": repaired, "valuesRefreshed": refreshed,
        "unresolved": unresolved, "failed": failed, "failures": failures[:50],
    }, flush=True)
    # Individual categories can remain unresolved/manual; a systemic failure should stop the workflow.
    return 1 if stored and repaired == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
