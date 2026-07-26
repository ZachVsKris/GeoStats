#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from data_pipeline.supabase import SupabaseWarehouse


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify that the v14 expansion import actually created reviewable candidates.")
    parser.add_argument("--natural-earth-min", type=int, default=24)
    parser.add_argument("--world-bank-run-min", type=int, default=100)
    parser.add_argument("--comtrade-run-min", type=int, default=0)
    parser.add_argument("--require-pending", action="store_true", default=True)
    return parser.parse_args()


def _integer(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _health_map(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(row.get("source_organization")): row for row in rows if row.get("source_organization")}


def _summary_table(rows: list[dict[str, Any]]) -> str:
    lines = [
        "| Source | Catalog | Playable | Pending review | Latest run | Successful | Failures |",
        "|---|---:|---:|---:|---|---:|---:|",
    ]
    for row in rows:
        lines.append(
            "| {source} | {catalog} | {playable} | {pending} | {status} | {success} | {failures} |".format(
                source=row.get("source_organization") or "",
                catalog=_integer(row.get("category_count")),
                playable=_integer(row.get("playable_count")),
                pending=_integer(row.get("pending_review_count")),
                status=row.get("import_status") or "none",
                success=_integer(row.get("latest_run_successful")),
                failures=_integer(row.get("latest_run_failures")),
            )
        )
    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.")

    warehouse = SupabaseWarehouse(url, key)
    try:
        rows = warehouse.get_import_health()
    except Exception as error:
        raise SystemExit(
            "Could not read public.v14_import_health. Run RUN_THIS_IN_SUPABASE_FOR_V14_0_1.sql first. "
            f"Underlying error: {error}"
        ) from error

    rows = sorted(rows, key=lambda row: str(row.get("source_organization") or ""))
    print(_summary_table(rows), flush=True)
    health = _health_map(rows)
    errors: list[str] = []

    natural = health.get("Natural Earth")
    if not natural:
        errors.append("Natural Earth has no warehouse health row.")
    else:
        if natural.get("import_status") != "completed":
            errors.append(f"Natural Earth latest import status is {natural.get('import_status')!r}, not 'completed'.")
        if _integer(natural.get("latest_run_successful")) < args.natural_earth_min:
            errors.append(
                f"Natural Earth imported only {_integer(natural.get('latest_run_successful'))} categories; "
                f"expected at least {args.natural_earth_min}."
            )
        if _integer(natural.get("latest_run_failures")):
            errors.append(f"Natural Earth latest run recorded {_integer(natural.get('latest_run_failures'))} failures.")
        if _integer(natural.get("category_count")) < args.natural_earth_min:
            errors.append(
                f"Natural Earth catalog contains only {_integer(natural.get('category_count'))} categories; "
                f"expected at least {args.natural_earth_min}."
            )
        if args.require_pending and _integer(natural.get("pending_review_count")) < 1:
            errors.append("Natural Earth created no pending editorial candidates; the expansion did not reach the v14 review queue.")

    world_bank = health.get("World Bank")
    if not world_bank:
        errors.append("World Bank has no warehouse health row.")
    else:
        if world_bank.get("import_status") != "completed":
            errors.append(f"World Bank latest import status is {world_bank.get('import_status')!r}, not 'completed'.")
        if _integer(world_bank.get("latest_run_successful")) < args.world_bank_run_min:
            errors.append(
                f"World Bank latest expansion produced only {_integer(world_bank.get('latest_run_successful'))} usable candidates; "
                f"required minimum is {args.world_bank_run_min}."
            )

    if args.comtrade_run_min > 0:
        comtrade = health.get("UN Comtrade")
        if not comtrade:
            errors.append("UN Comtrade has no warehouse health row.")
        else:
            if comtrade.get("import_status") != "completed":
                errors.append(f"UN Comtrade latest import status is {comtrade.get('import_status')!r}, not 'completed'.")
            if _integer(comtrade.get("latest_run_successful")) < args.comtrade_run_min:
                errors.append(
                    f"UN Comtrade latest expansion produced only {_integer(comtrade.get('latest_run_successful'))} categories; "
                    f"required minimum is {args.comtrade_run_min}."
                )

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY", "").strip()
    if summary_path:
        text = "## GeoStats v14 expansion verification\n\n" + _summary_table(rows) + "\n"
        if errors:
            text += "\n### Problems\n" + "\n".join(f"- {item}" for item in errors) + "\n"
        else:
            text += "\nAll required import and review-queue checks passed.\n"
        Path(summary_path).write_text(text, encoding="utf-8")

    if errors:
        print("\nImport verification failed:", flush=True)
        for item in errors:
            print(f"- {item}", flush=True)
        # Include machine-readable recent run details in the action log.
        try:
            recent = warehouse.list_recent_import_runs(limit=20)
            print("\nRecent import runs:\n" + json.dumps(recent, indent=2, default=str), flush=True)
        except Exception as error:
            print(f"Could not retrieve recent import-run details: {error}", flush=True)
        return 1

    print("\nAll required import and review-queue checks passed.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
