#!/usr/bin/env python3
"""Audit post-FINAL v16.2.6 tracker concepts against recovered importer catalogs.

This is intentionally a code-representation audit, not a data-validation audit.
A row is "represented" only when both its tracker key and exact player-facing title
are present in the mapped importer. Source validation, common-year coverage,
editorial review and activation remain separate release gates.

Every tracked row must now be either represented by the current importer catalog or
explicitly blocked by a durable product/data decision. Missing rows fail CI so a
source-family cleanup cannot silently erase expansion work.
"""
from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRACKER = ROOT / "ROWS_ADDED_SINCE_LAST_SELF_CONTAINED_REPO.csv"
OUTDIR = ROOT / "artifacts" / "v16-2-6-source-family-recovery"

SOURCE_TO_IMPORTER = {
    "WHO Global Health Observatory": "scripts/import-who.py",
    "UNESCO Institute for Statistics": "scripts/import-unesco.py",
    "ILOSTAT": "scripts/import-ilostat.py",
    "U.S. EIA International Energy Statistics": "scripts/import-eia.py",
    "World Bank Climate Change Knowledge Portal": "scripts/import-world-bank-climate.py",
    "IMF World Economic Outlook": "scripts/import-imf-weo.py",
    "FAO AQUASTAT Main Database": "scripts/import-aquastat.py",
    "WHO Global Health Expenditure Database": "scripts/import-who-ghed.py",
    "UN World Population Prospects 2024": "scripts/import-un-wpp.py",
    "UNHCR Refugee Data Finder": "scripts/import-unhcr.py",
    "FAOSTAT Food Balances": "scripts/import-faostat-food-balances.py",
    "UN World Urbanization Prospects 2025": "scripts/import-un-wup-2025.py",
    "UN World Urbanization Prospects 2025 Cities": "scripts/import-un-wup-2025-cities.py",
    "World Bank WDI Infrastructure & Connectivity": "scripts/import-world-bank-infrastructure.py",
    "Natural Earth 1:10m sovereign country geometry": "scripts/import-natural-earth.py",
    "FAOSTAT Land Use": "scripts/import-faostat-land-use.py",
    "FAOSTAT / ESA WorldCover 2021": "scripts/import-faostat-worldcover.py",
    "World Bank Women, Business and the Law 2026": "scripts/import-world-bank-wbl.py",
    "WHO/UNICEF Joint Monitoring Programme": "scripts/import-jmp-wash.py",
    "World Bank Global Findex 2025": "scripts/import-global-findex.py",
    "FAO Global Forest Resources Assessment 2025": "scripts/import-fao-fra-2025.py",
    "UNICEF Data Warehouse": "scripts/import-unicef-data.py",
    "UNDP Human Development Reports Data Center": "scripts/import-undp-hdr.py",
    "V-Dem Country-Year Core v16": "scripts/import-vdem-v16.py",
    "FAOSTAT Food Security & Healthy Diet": "scripts/import-faostat-food-security.py",
    "Köppen-Geiger 1991–2020 climate classification": "scripts/import-koppen-geiger.py",
}

# Durable source/product decisions are counted as accounted-for tracker rows, not
# as importer regressions. These keys must stay explicit: broad wildcard blocking
# would make it too easy for a future importer cleanup to hide missing concepts.
EXPLICIT_BLOCKERS = {
    "World Bank Climate Change Knowledge Portal": {
        "most-ice-days", "most-hot-days", "most-hot-humid-days", "longest-warm-spells",
    },
    "FAOSTAT / ESA WorldCover 2021": {"moss-lichen-share"},
    "World Bank Global Findex 2025": {
        "financial-institution-account",
        "mobile-money-account",
        "debit-card-ownership",
        "credit-card-ownership",
        "digital-payments",
        "formal-saving",
        "formal-borrowing",
        "mobile-phone-ownership",
        "smartphone-ownership",
        "phone-password",
        "wages-into-account",
        "government-payments-into-account",
        "utility-bills-digitally",
        "financial-resilience",
        "saved-any-money",
    },
    "UNDP Human Development Reports Data Center": {
        "mpi",
        "mpi-headcount",
        "mpi-intensity",
        "female-hdi",
        "male-hdi",
    },
}


def tracker_key(row: dict[str, str]) -> str:
    return (row.get("tracker_id") or "").split(":")[-1].strip()


def main() -> None:
    rows = list(csv.DictReader(TRACKER.open(encoding="utf-8-sig")))
    details: list[dict[str, object]] = []
    by_source: dict[str, dict[str, int]] = defaultdict(lambda: {"tracker_rows": 0, "represented": 0, "blocked": 0, "missing": 0})

    for source, importer_rel in SOURCE_TO_IMPORTER.items():
        importer = ROOT / importer_rel
        text = importer.read_text(encoding="utf-8")
        source_rows = [row for row in rows if row.get("source_candidate") == source]
        for row in source_rows:
            key = tracker_key(row)
            title = (row.get("category_title") or "").strip()
            key_present = bool(key and key in text)
            title_present = bool(title and title in text)
            blocked = key in EXPLICIT_BLOCKERS.get(source, set())
            represented = (not blocked) and key_present and title_present
            status = "blocked" if blocked else ("represented" if represented else "missing")
            details.append(
                {
                    "source_family": source,
                    "importer": importer_rel,
                    "tracker_id": row.get("tracker_id", ""),
                    "category_key": key,
                    "category_title": title,
                    "key_present": key_present,
                    "title_present": title_present,
                    "represented_in_importer_catalog": represented,
                    "explicitly_blocked": blocked,
                    "recovery_status": status,
                    "activation_certified": False,
                }
            )
            by_source[source]["tracker_rows"] += 1
            by_source[source][status] += 1

    OUTDIR.mkdir(parents=True, exist_ok=True)
    detail_path = OUTDIR / "source_family_recovery_detail.csv"
    with detail_path.open("w", newline="", encoding="utf-8") as handle:
        fieldnames = list(details[0]) if details else []
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(details)

    summary = []
    for source in SOURCE_TO_IMPORTER:
        counts = by_source[source]
        summary.append(
            {
                "source_family": source,
                "importer": SOURCE_TO_IMPORTER[source],
                **counts,
                "accounted": counts["represented"] + counts["blocked"],
                "representation_pct": round(100 * counts["represented"] / counts["tracker_rows"], 1) if counts["tracker_rows"] else 0.0,
            }
        )
    summary_path = OUTDIR / "source_family_recovery_summary.csv"
    with summary_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(summary[0]))
        writer.writeheader()
        writer.writerows(summary)

    totals = {
        "mapped_source_families": len(SOURCE_TO_IMPORTER),
        "mapped_tracker_rows": sum(item["tracker_rows"] for item in summary),
        "represented_tracker_rows": sum(item["represented"] for item in summary),
        "explicitly_blocked_tracker_rows": sum(item["blocked"] for item in summary),
        "accounted_tracker_rows": sum(item["accounted"] for item in summary),
        "missing_tracker_rows": sum(item["missing"] for item in summary),
        "note": "Importer-catalog representation only; no row is activation-certified by this audit.",
    }
    (OUTDIR / "source_family_recovery_summary.json").write_text(json.dumps({"totals": totals, "sources": summary}, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(totals, indent=2))
    for item in summary:
        print(f"{item['source_family']}: {item['represented']} represented + {item['blocked']} blocked / {item['tracker_rows']} tracked; {item['missing']} missing")

    if totals["missing_tracker_rows"]:
        missing = [item for item in details if item["recovery_status"] == "missing"]
        sample = ", ".join(f"{item['source_family']}:{item['category_key']}" for item in missing[:12])
        raise SystemExit(
            f"Source-family recovery audit failed closed: {totals['missing_tracker_rows']} tracked concepts are neither represented nor explicitly blocked. Sample: {sample}"
        )


if __name__ == "__main__":
    main()
