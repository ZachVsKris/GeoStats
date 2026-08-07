#!/usr/bin/env python3
"""Audit every currently playable GeoStats warehouse category against its official source.

The audit is independent from import success. It refetches the official series, compares
all countries in the selected common year with Supabase, recalculates every rank, checks
series identity/unit/year/coverage, saves checksums, and quarantines any mismatch.
"""
from __future__ import annotations

import argparse
from dataclasses import replace
import importlib.util
import json
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

# filename, importer class, source organization, optional GeoStats ID prefix.
# The prefix is required when several importers share one organization (for
# example the general World Bank catalog and the six v15.9 expansion series).
SOURCE_SPECS: dict[str, tuple[str, str, str, str | None]] = {
    "worldbank": ("import-world-bank-catalog.py", "WorldBankCatalogImporter", "World Bank", None),
    "tourismmigration": ("import-tourism-migration.py", "TourismMigrationImporter", "World Bank", "worldbank-expansion:"),
    "who": ("import-who.py", "WhoImporter", "WHO", None),
    "unesco": ("import-unesco.py", "UnescoImporter", "UNESCO UIS", None),
    "ilostat": ("import-ilostat.py", "IlostatImporter", "ILOSTAT", None),
    "naturalearth": ("import-natural-earth.py", "NaturalEarthImporter", "Natural Earth", None),
    "comtrade": ("import-comtrade.py", "ComtradeImporter", "UN Comtrade", None),
    "eia": ("import-eia.py", "EiaImporter", "U.S. EIA", None),
    "unhcr": ("import-unhcr.py", "UnhcrImporter", "UNHCR", None),
    "pew": ("import-pew-religion.py", "PewReligionImporter", "Pew Research Center", "pew-religion:"),
    "faostatfbs": ("import-faostat-food-balances.py", "FoodBalanceImporter", "FAOSTAT Food Balances", "faostat-fbs:"),
    "unescoheritage": ("import-unesco-world-heritage.py", "Importer", "UNESCO World Heritage Centre", "unescoheritage:"),
    "smithsonian": ("import-smithsonian-volcanoes.py", "SmithsonianVolcanoImporter", "Smithsonian GVP", "smithsonian-gvp:"),
    "usgs": ("import-usgs-earthquakes.py", "UsgsEarthquakeImporter", "USGS", "usgs:"),
    "unmembership": ("import-historical-categories.py", "UNMembershipImporter", "United Nations", "history:un-admission"),
    "constitute": ("import-historical-categories.py", "ConstituteImporter", "Constitute Project", "history:newest-current-constitution"),
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


def result_summary(result: Any) -> dict[str, Any]:
    details = result.details if isinstance(result.details, dict) else {}
    return {
        "status": result.status,
        "commonYear": result.common_year,
        "expected": result.expected_count,
        "stored": result.stored_count,
        "compared": result.compared_count,
        "valueMismatches": result.value_mismatch_count,
        "rankingMismatches": result.ranking_mismatch_count,
        "failureTypes": details.get("failureTypes") or (["source_access"] if result.status == "unable_to_verify" else []),
        "failureReason": result.failure_reason,
        "failureBuckets": details.get("failureBuckets") or {},
    }




def classify_nonblocking_audit_result(result: Any) -> Any:
    """Separate true data/identity failures from metadata-only warnings.

    Hard failures: wrong series identity, unit, reference year, ranking direction,
    country set, duplicate snapshot, values, or ranks. Missing internal labels,
    saved query text, declared coverage metadata, and checksum-only drift are
    warnings when the official values and rankings agree.
    """
    if result.status != "failed":
        return result
    details = result.details if isinstance(result.details, dict) else {}
    buckets = details.get("failureBuckets") or {}
    coverage = buckets.get("coverage") or {}
    source_identity = set(buckets.get("sourceIdentity") or [])
    metadata = set(buckets.get("metadata") or [])
    coverage_checks = set(coverage.get("checks") or [])
    critical_identity = {
        "source_organization", "source_dataset", "source_indicator_code",
        "unit", "ranking_direction",
        "official_name_matches_required_concept",
        "official_name_avoids_excluded_concepts",
        "exports_flow_selected", "world_partner_selected",
        "query_identifies_commodity", "query_identifies_product",
        "query_identifies_activity", "endpoint_identified",
        "country_dimension_identified", "value_field_identified",
        "member_state_scope", "admission_field", "constitutions_endpoint", "in_force_selected", "historic_excluded", "year_enacted_selected",
    }
    critical_metadata = {"unit", "ranking_direction"}
    critical_coverage = {
        "common_year", "source_country_universe", "stored_country_universe",
        "source_snapshot_unique", "stored_snapshot_unique",
    }
    true_integrity_failure = bool(
        result.value_mismatch_count
        or result.ranking_mismatch_count
        or (buckets.get("values") or {}).get("mismatchCount")
        or (buckets.get("rankings") or {}).get("mismatchCount")
        or coverage.get("missingCount")
        or coverage.get("extraCount")
        or source_identity.intersection(critical_identity)
        or metadata.intersection(critical_metadata)
        or coverage_checks.intersection(critical_coverage)
    )
    if true_integrity_failure:
        return result
    warning_details = dict(details)
    warning_details["nonBlockingWarning"] = True
    warning_details["originalStatus"] = "failed"
    warning_details["severity"] = "warning"
    return replace(
        result,
        status="unable_to_verify",
        failure_reason=("Non-blocking audit warning: " + (result.failure_reason or "metadata or source verification drift"))[:1800],
        details=warning_details,
    )

def print_result(result: Any) -> None:
    summary = result_summary(result)
    if result.status == "verified":
        print(f"  verified: {summary['stored']} countries, year {summary['commonYear']}", flush=True)
        return
    label = "quarantined" if result.status == "failed" else "unable to verify"
    kinds = ", ".join(summary["failureTypes"]) or "unclassified"
    print(f"  {label} [{kinds}]", flush=True)
    print(f"    official/stored/compared: {summary['expected']}/{summary['stored']}/{summary['compared']}", flush=True)
    if summary["valueMismatches"] or summary["rankingMismatches"]:
        print(f"    value mismatches: {summary['valueMismatches']}; ranking mismatches: {summary['rankingMismatches']}", flush=True)
    if summary["failureReason"]:
        print(f"    {summary['failureReason']}", flush=True)


def audit_source(slug: str, warehouse: SupabaseWarehouse, *, include_nonplayable: bool = False) -> dict[str, Any]:
    filename, class_name, source_org, category_prefix = SOURCE_SPECS[slug]
    importer_class = load_class(filename, class_name)
    importer = importer_class(warehouse, dry_run=True)
    categories = warehouse.list_categories_for_validation(
        source_organization=source_org,
        playable_only=not include_nonplayable,
    )
    if category_prefix:
        categories = [row for row in categories if str(row.get("id") or "").startswith(category_prefix)]
    run_id = warehouse.create_validation_run(source_org, VALIDATION_VERSION, {
        "sourceSlug": slug,
        "playableOnly": not include_nonplayable,
        "categoryCount": len(categories),
        "auditMode": "official-source-refetch",
    })
    verified = failed = unable = 0
    category_results: list[dict[str, Any]] = []
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
                category_results.append({"categoryId": category_id, "title": category.get("title"), "indicator": code, **result_summary(result)})
                print_result(result)
                continue
            stored_direction = str(category.get("ranking_direction") or candidate.rule.ranking_direction)
            if stored_direction not in {"high", "low"}:
                result = unable_to_verify(
                    f"Stored ranking direction {stored_direction!r} is invalid.",
                    common_year=category.get("common_year"),
                    details={"storedCategoryId": category_id, "sourceIndicatorCode": code},
                )
                warehouse.record_category_validation(category_id, result, run_id=run_id)
                unable += 1
                category_results.append({"categoryId": category_id, "title": category.get("title"), "indicator": code, **result_summary(result)})
                print_result(result)
                continue
            # Ranking direction is a GeoStats presentation choice (for example,
            # "Lowest unemployment"), not a property of the provider series.
            # Preserve that explicit stored choice while independently auditing
            # the official series identity and every value.
            candidate = replace(candidate, rule=replace(candidate.rule, ranking_direction=stored_direction))
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
            result = classify_nonblocking_audit_result(result)
            warehouse.record_category_validation(category_id, result, run_id=run_id)
            category_results.append({"categoryId": category_id, "title": category.get("title"), "indicator": code, **result_summary(result)})
            if result.status == "verified":
                verified += 1
            elif result.status == "failed":
                failed += 1
            else:
                unable += 1
            print_result(result)
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
    return {"source": slug, "selected": len(categories), "verified": verified, "failed": failed, "unable": unable, "categories": category_results}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refetch and audit GeoStats categories against official sources.")
    parser.add_argument("--source", choices=["all", *SOURCE_SPECS], default="all")
    parser.add_argument("--include-nonplayable", action="store_true", help="Audit all imported candidates, not only approved/playable categories.")
    parser.add_argument("--activate", action="store_true", help="Enable fail-closed source-integrity enforcement after the audit.")
    parser.add_argument("--report-dir", default="artifacts/source-integrity", help="Directory for machine-readable and Markdown audit reports.")
    parser.add_argument("--fail-on-source-error", action="store_true", help="Exit nonzero when a selected source fails before completing its audit.")
    parser.add_argument("--fail-on-empty", action="store_true", help="Exit nonzero when a selected source returns zero audited categories.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.")
    warehouse = SupabaseWarehouse(url, key, timeout=180)
    slugs = list(SOURCE_SPECS) if args.source == "all" else [args.source]
    results: list[dict[str, Any]] = []
    source_errors: list[dict[str, str]] = []
    for slug in slugs:
        try:
            results.append(audit_source(slug, warehouse, include_nonplayable=args.include_nonplayable))
        except Exception as error:
            source_errors.append({"source": slug, "error": str(error)})
            print(f"[{slug}] source audit failed before completion: {error}", flush=True)

    has_unable = any(result["unable"] for result in results) or bool(source_errors)
    blockers = warehouse.list_source_integrity_activation_blockers() if args.activate else []
    activation: Any = {"status": "not_requested"}
    activation_failed = False
    if args.activate and has_unable:
        activation = {"status": "skipped", "reason": "At least one selected category or source could not be verified."}
        activation_failed = True
    elif args.activate and blockers:
        activation = {
            "status": "skipped",
            "reason": f"{len(blockers)} currently playable categories are not verified.",
            "blockers": blockers,
        }
        activation_failed = True
    elif args.activate:
        try:
            activation = {"status": "activated", "result": warehouse.activate_source_integrity_enforcement()}
        except Exception as error:
            activation = {"status": "failed", "reason": str(error)}
            activation_failed = True

    try:
        reconciliation: Any = {"status": "completed", "result": warehouse.reconcile_category_playability_v15()}
    except Exception as error:
        reconciliation = {"status": "failed", "reason": str(error)}
        print(f"Playability reconciliation failed: {error}", flush=True)

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "validationVersion": VALIDATION_VERSION,
        "sourceSelection": args.source,
        "includeNonplayable": args.include_nonplayable,
        "results": results,
        "sourceErrors": source_errors,
        "activation": activation,
        "reconciliation": reconciliation,
    }
    report_dir = Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / "source-integrity-report.json").write_text(json.dumps(report, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")
    lines = [
        "# GeoStats source-integrity audit",
        "",
        f"Generated: {report['generatedAt']}",
        f"Validation version: `{VALIDATION_VERSION}`",
        "",
        "| Source | Selected | Verified | Quarantined | Unable |",
        "|---|---:|---:|---:|---:|",
    ]
    for result in results:
        lines.append(f"| {result['source']} | {result['selected']} | {result['verified']} | {result['failed']} | {result['unable']} |")
    if source_errors:
        lines.extend(["", "## Source-level errors"])
        lines.extend(f"- **{item['source']}**: {item['error']}" for item in source_errors)
    failed_categories = [category for result in results for category in result.get("categories", []) if category.get("status") != "verified"]
    if failed_categories:
        lines.extend(["", "## Category issues"])
        for category in failed_categories:
            kinds = ", ".join(category.get("failureTypes") or []) or "unclassified"
            lines.append(f"- **{category.get('title')}** (`{category.get('indicator')}`): {category.get('status')} [{kinds}] — {category.get('failureReason') or 'No reason recorded.'}")
    lines.extend([
        "",
        "## Enforcement",
        "",
        f"`{json.dumps(activation, default=str)}`",
        "",
        "## Playability reconciliation",
        "",
        f"`{json.dumps(reconciliation, default=str)}`",
        "",
    ])
    (report_dir / "source-integrity-report.md").write_text("\n".join(lines), encoding="utf-8")

    print(json.dumps({
        "validationVersion": VALIDATION_VERSION,
        "results": [{key: value for key, value in result.items() if key != "categories"} for result in results],
        "sourceErrors": source_errors,
        "activation": activation,
        "reconciliation": reconciliation,
        "reportDir": str(report_dir),
    }, indent=2, default=str), flush=True)
    # Definite data mismatches are safely quarantined and do not crash the workflow.
    # Source-access gaps or a requested-but-blocked enforcement activation remain failures.
    reconciliation_failed = isinstance(reconciliation, dict) and reconciliation.get("status") == "failed"
    empty_selected_source = bool(results) and any(int(result.get("selected") or 0) == 0 for result in results)
    requested_source_failure = args.fail_on_source_error and bool(source_errors)
    requested_empty_failure = args.fail_on_empty and (empty_selected_source or not results)
    return 1 if activation_failed or reconciliation_failed or requested_source_failure or requested_empty_failure else 0


if __name__ == "__main__":
    raise SystemExit(main())
