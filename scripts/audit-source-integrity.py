#!/usr/bin/env python3
"""Audit every currently playable GeoStats warehouse category against its official source.

The audit is independent from import success. It refetches the official series, compares
all countries in the selected common year with Supabase, recalculates every rank, checks
series identity/unit/year/coverage, saves checksums, and quarantines any mismatch.
"""
from __future__ import annotations

import argparse
import importlib.util
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from data_pipeline.governance import evaluate_governance
from data_pipeline.integrity import VALIDATION_VERSION, unable_to_verify, validate_category_snapshot
from data_pipeline.quality import score_observations
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_SPECS: dict[str, tuple[str, str, str]] = {
    "worldbank": ("import-world-bank-catalog.py", "WorldBankCatalogImporter", "World Bank"),
    "who": ("import-who.py", "WhoImporter", "WHO"),
    "unesco": ("import-unesco.py", "UnescoImporter", "UNESCO UIS"),
    "ilostat": ("import-ilostat.py", "IlostatImporter", "ILOSTAT"),
    "naturalearth": ("import-natural-earth.py", "NaturalEarthImporter", "Natural Earth"),
    "comtrade": ("import-comtrade.py", "ComtradeImporter", "UN Comtrade"),
    "eia": ("import-eia.py", "EiaImporter", "U.S. EIA"),
    "unhcr": ("import-unhcr.py", "UnhcrImporter", "UNHCR"),
}


def load_class(filename: str, class_name: str):
    path = SCRIPT_DIR / filename
    module_name = "geostats_audit_" + path.stem.replace("-", "_")
    spec = importlib.util.spec_from_file_location(module_name, path)
    if not spec or not spec.loader:
        raise RuntimeError(f"Could not load {path}.")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return getattr(module, class_name)


def audit_source(slug: str, warehouse: SupabaseWarehouse, *, include_nonplayable: bool = False) -> dict[str, Any]:
    filename, class_name, source_org = SOURCE_SPECS[slug]
    importer_class = load_class(filename, class_name)
    importer = importer_class(warehouse, dry_run=True)
    categories = warehouse.list_categories_for_validation(
        source_organization=source_org,
        playable_only=not include_nonplayable,
    )
    run_id = warehouse.create_validation_run(source_org, VALIDATION_VERSION, {
        "sourceSlug": slug,
        "playableOnly": not include_nonplayable,
        "categoryCount": len(categories),
        "auditMode": "official-source-refetch",
    })
    verified = failed = unable = 0
    try:
        discovered = importer.discover()
        by_code = {candidate.source_indicator_code: candidate for candidate in discovered}
        for index, category in enumerate(categories, start=1):
            category_id = str(category["id"])
            code = str(category.get("source_indicator_code") or "")
            print(f"[{slug} {index}/{len(categories)}] {category.get('title')} ({code})", flush=True)
            candidate = by_code.get(code)
            if candidate is None:
                result = unable_to_verify(
                    f"The current {source_org} catalog did not resolve stored series {code!r}.",
                    common_year=category.get("common_year"),
                    details={"storedCategoryId": category_id, "sourceIndicatorCode": code},
                )
                warehouse.record_category_validation(category_id, result, run_id=run_id)
                unable += 1
                continue
            try:
                source_observations = importer.fetch_observations(candidate)
                quality = score_observations(candidate.rule, source_observations)
                governance = evaluate_governance(importer.source_slug, candidate, quality)
                expected_row = importer.build_category_row(candidate, quality, governance, category_id)
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
                    stored_category=category,
                    stored_observations=stored_observations,
                )
            except Exception as error:
                result = unable_to_verify(
                    str(error),
                    common_year=category.get("common_year"),
                    details={"storedCategoryId": category_id, "sourceIndicatorCode": code, "sourceSlug": slug},
                )
            warehouse.record_category_validation(category_id, result, run_id=run_id)
            if result.status == "verified":
                verified += 1
                print("  verified", flush=True)
            elif result.status == "failed":
                failed += 1
                print(f"  quarantined: {result.failure_reason}", flush=True)
            else:
                unable += 1
                print(f"  unable to verify: {result.failure_reason}", flush=True)
        status = "completed" if unable == 0 else "partial"
        warehouse.finish_validation_run(
            run_id,
            status=status,
            completed_at=datetime.now(timezone.utc).isoformat(),
            categories_selected=len(categories),
            categories_verified=verified,
            categories_failed=failed,
            categories_unable=unable,
            details={
                "sourceSlug": slug,
                "playableOnly": not include_nonplayable,
                "verified": verified,
                "failed": failed,
                "unable": unable,
            },
        )
    except Exception as error:
        warehouse.finish_validation_run(
            run_id,
            status="failed",
            completed_at=datetime.now(timezone.utc).isoformat(),
            categories_selected=len(categories),
            categories_verified=verified,
            categories_failed=failed,
            categories_unable=unable,
            error_message=str(error)[:2000],
        )
        raise
    return {"source": slug, "selected": len(categories), "verified": verified, "failed": failed, "unable": unable}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refetch and audit GeoStats categories against official sources.")
    parser.add_argument("--source", choices=["all", *SOURCE_SPECS], default="all")
    parser.add_argument("--include-nonplayable", action="store_true", help="Audit all imported candidates, not only approved/playable categories.")
    parser.add_argument("--activate", action="store_true", help="Enable fail-closed source-integrity enforcement after the audit.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.")
    warehouse = SupabaseWarehouse(url, key, timeout=180)
    slugs = list(SOURCE_SPECS) if args.source == "all" else [args.source]
    results = [audit_source(slug, warehouse, include_nonplayable=args.include_nonplayable) for slug in slugs]
    print({"validationVersion": VALIDATION_VERSION, "results": results}, flush=True)
    has_unable = any(result["unable"] for result in results)
    if args.activate and not has_unable:
        print({"activation": warehouse.activate_source_integrity_enforcement()}, flush=True)
    elif args.activate:
        print({"activation": "skipped", "reason": "At least one selected category could not be verified."}, flush=True)
    # A definite mismatch is handled by quarantine and does not make the workflow itself fail.
    # Inability to access/identify a source fails the audit and prevents activation so the owner
    # cannot mistake a partial audit for a completed source-integrity rollout.
    return 1 if has_unable else 0


if __name__ == "__main__":
    raise SystemExit(main())
