#!/usr/bin/env python3
"""Export the guarded v16.2.x category audit before or after promotion."""
from __future__ import annotations

import argparse
import csv
import json
import os
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from data_pipeline.supabase import SupabaseWarehouse

PAGE_SIZE = 1000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export GeoStats v16.2.x audit and promotion decisions.")
    parser.add_argument(
        "--phase",
        choices=("pre", "final"),
        default="final",
        help="Use pre before automatic promotion, or final after the workflow finalizer.",
    )
    parser.add_argument(
        "--release-version",
        choices=("16.2.1", "16.2.2"),
        default="16.2.2",
        help="Controls the publication guard and output filenames.",
    )
    return parser.parse_args()


def fetch_all(warehouse: SupabaseWarehouse, view: str, select: str = "*") -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        query = urlencode({"select": select, "limit": PAGE_SIZE, "offset": offset})
        page = warehouse._request("GET", f"{view}?{query}")  # repository-local REST helper
        current = [dict(row) for row in page] if isinstance(page, list) else []
        rows.extend(current)
        if len(current) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return rows


def cell(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return value


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    keys: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row:
            if key not in seen:
                seen.add(key)
                keys.append(key)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=keys)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: cell(row.get(key)) for key in keys})


def main() -> int:
    args = parse_args()
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.")
    warehouse = SupabaseWarehouse(url, key, timeout=180)

    # Recalculate the assessment without publishing gameplay flags. Only the
    # guarded finalizer mutates enabled/eligible_daily.
    warehouse._request("POST", "rpc/apply_v16_2_1_audit_reconciliation", {})
    if args.release_version == "16.2.2":
        warehouse._request("POST", "rpc/apply_v16_2_2_catalog_curation", {})
        warehouse._request("POST", "rpc/refresh_measurement_types_v16_2_2", {})
    warehouse._request("POST", "rpc/refresh_category_ranking_completeness_v16", {})
    warehouse._request("POST", "rpc/refresh_category_semantic_audit_v16_1", {})
    warehouse._request("POST", "rpc/refresh_category_promotion_assessment_v16_2", {})
    guard_rpc = "assert_v16_2_2_source_recovery" if args.release_version == "16.2.2" else "assert_v16_2_1_source_recovery"
    warehouse._request("POST", f"rpc/{guard_rpc}", {})

    audit = fetch_all(warehouse, "category_runtime_review_v16_2")
    decisions = fetch_all(warehouse, "category_promotion_dry_run_v16_2")
    if not audit:
        raise SystemExit(f"The v{args.release_version} runtime audit returned no categories. Run the matching installer first.")

    label = args.release_version.replace(".", "-")
    if args.phase == "pre":
        audit_path = Path(f"category-audit-pre-promotion-v{label}.csv")
        decision_path = Path(f"category-promotion-dry-run-v{label}.csv")
        summary_path = Path(f"category-audit-pre-promotion-v{label}-summary.json")
    else:
        audit_path = Path(f"category-audit-v{label}.csv")
        decision_path = Path(f"category-promotion-final-v{label}.csv")
        summary_path = Path(f"category-audit-v{label}-summary.json")

    write_csv(audit_path, audit)
    write_csv(decision_path, decisions)

    outcomes = Counter(str(row.get("promotion_decision_v16_2") or "unassessed") for row in audit)
    blockers = Counter(str(row.get("blocker_class_v16_2") or "none") for row in audit)
    sources: dict[str, Counter[str]] = {}
    for row in audit:
        source = str(row.get("source_organization") or "Unknown")
        sources.setdefault(source, Counter())[str(row.get("promotion_decision_v16_2") or "unassessed")] += 1
    consistency = fetch_all(warehouse, "category_catalog_consistency_v16_2")
    auto_promoted = 0
    for row in audit:
        metadata = row.get("metadata")
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except json.JSONDecodeError:
                metadata = {}
        if isinstance(metadata, dict) and bool(metadata.get("autoPromotedV16_2")):
            auto_promoted += 1

    recovery = fetch_all(warehouse, "catalog_recovery_status_v16_2_1")
    summary = {
        "version": args.release_version,
        "phase": args.phase,
        "categories": len(audit),
        "outcomes": dict(sorted(outcomes.items())),
        "blockerClasses": dict(sorted(blockers.items())),
        "bySource": {source: dict(sorted(counts.items())) for source, counts in sorted(sources.items())},
        "catalogConsistency": consistency[0] if consistency else {},
        "recoveryStatus": recovery[0] if recovery else {},
        "randomOnlyTier": False,
        "sharedCatalogRule": "enabled and eligible_daily must always be identical",
        "automaticPromotionsApplied": args.phase == "final" and auto_promoted > 0,
        "automaticPromotionCount": auto_promoted if args.phase == "final" else 0,
    }
    summary_path.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2, sort_keys=True), flush=True)
    consistency_failures = sum(int(summary["catalogConsistency"].get(key, 0) or 0) for key in (
        "daily_random_mismatches", "enabled_without_v16_2_pass", "daily_without_v16_2_pass",
    ))
    return 1 if args.phase == "final" and consistency_failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
