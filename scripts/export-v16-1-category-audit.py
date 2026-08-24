#!/usr/bin/env python3
"""Export the complete GeoStats v16.1 category audit from Supabase.

The SQL audit view contains one row for every catalog category, including the
player title, source identity, units, ranking logic, top/bottom values, audit
issues, editorial state, and runtime playability decision.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

VIEW = "category_full_audit_v16_1"
PAGE_SIZE = 1000


def fetch_page(url: str, key: str, start: int, end: int) -> list[dict[str, Any]]:
    query = urlencode({"select": "*", "order": "source_organization.asc,player_title.asc,id.asc"})
    request = Request(
        f"{url.rstrip('/')}/rest/v1/{VIEW}?{query}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "Range": f"{start}-{end}",
            "Range-Unit": "items",
        },
    )
    with urlopen(request, timeout=120) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, list):
        raise RuntimeError("Unexpected audit response from Supabase.")
    return [dict(row) for row in payload]


def fetch_all(url: str, key: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        page = fetch_page(url, key, start, start + PAGE_SIZE - 1)
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows
        start += PAGE_SIZE


def csv_value(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description="Export all GeoStats v16.1 category audit rows.")
    parser.add_argument("--output", default="category-audit-v16-1.csv")
    parser.add_argument("--summary", default="category-audit-v16-1-summary.json")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL", "").strip()
    key = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise SystemExit("SUPABASE_URL and a Supabase service-role secret are required.")

    rows = fetch_all(url, key)
    if not rows:
        raise SystemExit("The category audit view returned no rows. Run the v16.1 installer first.")

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    fields = list(rows[0].keys())
    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: csv_value(row.get(key)) for key in fields})

    summary: dict[str, Any] = {"categories": len(rows), "audit_status": {}, "playable": 0}
    for row in rows:
        status = str(row.get("semantic_audit_status") or "unknown")
        summary["audit_status"][status] = summary["audit_status"].get(status, 0) + 1
        if row.get("computed_playable_v16") is True:
            summary["playable"] += 1
    Path(args.summary).write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(summary, sort_keys=True), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
