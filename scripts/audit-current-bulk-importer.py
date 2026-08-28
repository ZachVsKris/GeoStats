#!/usr/bin/env python3
"""Fail-closed independent audit of the *current* curated bulk-importer catalog.

This intentionally ignores retired historical candidates that remain in the warehouse
ledger. It re-parses the pinned official bulk file in dry-run mode, rebuilds quality and
expected metadata, and compares every current candidate's stored common-year snapshot
and ranking against the official source.
"""
from __future__ import annotations

import argparse
import importlib.util
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from data_pipeline.governance import evaluate_governance
from data_pipeline.integrity import validate_category_snapshot
from data_pipeline.quality import score_observations
from data_pipeline.supabase import SupabaseWarehouse

SOURCES = {
    "globalfindex2025": ("import-global-findex.py", "Importer", "GLOBAL_FINDEX_2025_INPUT"),
    "undphdr": ("import-undp-hdr.py", "Importer", "UNDP_HDR_INPUT"),
}


def load_class(filename: str, class_name: str):
    path = SCRIPT_DIR / filename
    spec = importlib.util.spec_from_file_location("geostats_current_bulk_" + path.stem.replace("-", "_"), path)
    if not spec or not spec.loader:
        raise RuntimeError(f"Could not load {path}.")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return getattr(module, class_name)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, choices=sorted(SOURCES))
    args = parser.parse_args()

    url = (os.getenv("SUPABASE_URL") or "").strip()
    key = (os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise SystemExit("Supabase warehouse credentials are required.")

    filename, class_name, input_env = SOURCES[args.source]
    input_path = (os.getenv(input_env) or "").strip()
    if not input_path:
        raise SystemExit(f"{input_env} is required.")

    warehouse = SupabaseWarehouse(url, key, timeout=180)
    importer = load_class(filename, class_name)(warehouse, input_path, dry_run=True)
    candidates = importer.discover()
    if not candidates:
        raise SystemExit(f"{args.source}: current importer catalog is empty.")

    failures = []
    for candidate in candidates:
        category_id = importer.category_id(candidate)
        source_observations = importer.fetch_observations(candidate)
        quality = score_observations(candidate.rule, source_observations)
        importer.validate_eligible_universe(candidate, source_observations, quality)
        governance = evaluate_governance(importer.source_slug, candidate, quality)
        expected_row = importer.build_category_row(candidate, quality, governance, category_id)
        stored_category = warehouse.get_category_integrity_state(category_id)
        if not stored_category:
            failures.append(f"{category_id}: stored category missing")
            continue
        stored_observations = warehouse.get_category_observations(category_id, quality.common_year) if quality.common_year else []
        result = validate_category_snapshot(
            source_slug=importer.source_slug,
            source_organization=importer.source_organization,
            source_dataset=importer.source_dataset,
            category_id=category_id,
            candidate=candidate,
            quality=quality,
            source_observations=source_observations,
            expected_category_row=expected_row,
            stored_category=stored_category,
            stored_observations=stored_observations,
        )
        if result.status != "verified":
            failures.append(f"{category_id}: {result.status}: {result.failure_reason}")
        else:
            print(f"verified {category_id}: {len(stored_observations)} countries, common year {quality.common_year}", flush=True)

    if failures:
        for failure in failures:
            print(f"ERROR {failure}", file=sys.stderr, flush=True)
        return 1
    print(f"{args.source}: all {len(candidates)} current curated candidates independently verified.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
