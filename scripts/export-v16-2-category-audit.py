#!/usr/bin/env python3
"""Export the v16.2 category audit before or after conservative promotion."""
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
    parser = argparse.ArgumentParser(description="Export GeoStats v16.2 audit and promotion decisions.")
    parser.add_argument(
        "--phase",
        choices=("pre", "final"),
        default="final",
        help="Use pre before automatic promotion, or final after the workflow finalizer.",
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

    # Recalculate the assessment and synchronize the one-catalog gameplay flags.
    # This never changes editorial status or auto-promotes a category.
    warehouse._request("POST", "rpc/refresh_v16_2_runtime_catalog", {})

    audit = fetch_all(warehouse, "category_runtime_review_v16_2")
    decisions = fetch_all(warehouse, "category_promotion_dry_run_v16_2")
    if not audit:
        raise SystemExit("The v16.2 runtime audit returned no categories. Run the v16.2 installer first.")

    if args.phase == "pre":
        audit_path = Path("category-audit-pre-promotion-v16-2.csv")
        decision_path = Path("category-promotion-dry-run-v16-2.csv")
        summary_path = Path("category-audit-pre-promotion-v16-2-summary.json")
    else:
        audit_path = Path("category-audit-v16-2.csv")
        decision_path = Path("category-promotion-final-v16-2.csv")
        summary_path = Path("category-audit-v16-2-summary.json")

    write_csv(audit_path, audit)
    write_csv(decision_path, decisions)

    outcomes = Counter(str(row.get("promotion_decision_v16_2") or "unassessed") for row in audit)
    blockers = Counter(str(row.get("blocker_class_v16_2") or "none") for row in audit)
    sources: dict[str, Counter[str]] = {}
    for row in audit:
        source = str(row.get("source_organization") or "Unknown")
        sources.setdefault(source, Counter())[str(row.get("promotion_decision_v16_2") or "unassessed")] += 1
    consistency = fetch_all(warehouse, "category_catalog_consistency_v16_2")
    summary = {
        "version": "16.2",
        "phase": args.phase,
        "categories": len(audit),
        "outcomes": dict(sorted(outcomes.items())),
        "blockerClasses": dict(sorted(blockers.items())),
        "bySource": {source: dict(sorted(counts.items())) for source, counts in sorted(sources.items())},
        "catalogConsistency": consistency[0] if consistency else {},
        "randomOnlyTier": False,
        "sharedCatalogRule": "enabled and eligible_daily must always be identical",
        "automaticPromotionsApplied": args.phase == "final",
    }
    summary_path.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2, sort_keys=True), flush=True)
    consistency_failures = sum(int(summary["catalogConsistency"].get(key, 0) or 0) for key in (
        "daily_random_mismatches", "enabled_without_v16_2_pass", "daily_without_v16_2_pass",
    ))
    return 1 if consistency_failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
