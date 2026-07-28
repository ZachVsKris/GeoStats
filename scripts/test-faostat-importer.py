#!/usr/bin/env python3
"""Deterministic tests for the FAOSTAT adaptive gate and staging rules."""
from __future__ import annotations

import csv
import importlib.util
import sys
import tempfile
import zipfile
from pathlib import Path

import pycountry

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("geostats_faostat_importer", ROOT / "scripts" / "import-faostat.py")
assert SPEC and SPEC.loader
IMPORTER = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = IMPORTER
SPEC.loader.exec_module(IMPORTER)


def write_series(writer, countries, item_code, item, flag, description, *, count=None, clustered=False):
    selected = countries if count is None else countries[:count]
    for year in (2024, 2025):
        for index, country in enumerate(selected):
            value = 100 if clustered else (index + 1) * 100 + year
            writer.writerow([
                country.numeric, country.name, item_code, item, "5510", "Production",
                year, "t", value, flag, description, "",
            ])


def main() -> None:
    assert "Authorization" not in IMPORTER.SupabaseRest("https://example.supabase.co", "sb_secret_test").headers
    assert "Authorization" in IMPORTER.SupabaseRest("https://example.supabase.co", "legacy.jwt.key").headers
    countries = [country for country in pycountry.countries if country.alpha_3 in IMPORTER.UN_ISO3][:190]

    with tempfile.TemporaryDirectory(prefix="geostats-faostat-test-") as temporary:
        directory = Path(temporary)
        csv_path = directory / "Production_Crops_Livestock_E_All_Data_(Normalized).csv"
        with csv_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow([
                "Area Code (M49)", "Area", "Item Code (CPC)", "Item", "Element Code", "Element",
                "Year", "Unit", "Value", "Flag", "Flag Description", "Note",
            ])
            write_series(writer, countries, "0111", "Wheat", "A", "Official data")
            write_series(writer, countries, "0991", "Clustered crop", "A", "Official data", clustered=True)
            write_series(writer, countries, "0992", "Modeled crop", "E", "FAO estimate")
            write_series(writer, countries, "0993", "Unknown crop", "", "")
            write_series(writer, countries, "0994", "Specialized crop", "E", "FAO estimate", count=70)
            write_series(writer, countries, "0995", "Narrow crop", "A", "Official data", count=59)
            # Aggregate and missing records must not enter the warehouse snapshot.
            writer.writerow(["001", "World", "0111", "Wheat", "5510", "Production", 2025, "t", 999999, "A", "Official data", ""])
            writer.writerow([countries[0].numeric, countries[0].name, "0996", "Missing crop", "5510", "Production", 2025, "t", "", "M", "Missing value", ""])

        archive_path = directory / "qcl.zip"
        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.write(csv_path, csv_path.name)
        connection, staged = IMPORTER.build_sqlite(archive_path, directory / "qcl.sqlite")
        candidates = IMPORTER.category_candidates(connection)
        connection.close()

    expected_staged = 190 * 2 * 4 + 70 * 2 + 59 * 2
    assert staged == expected_staged, staged
    assert len(candidates) == 6, len(candidates)
    by_item = {candidate["item"]: candidate for candidate in candidates}

    assert by_item["Wheat"]["auto_qualified"] is True
    assert by_item["Modeled crop"]["auto_qualified"] is True
    assert by_item["Modeled crop"]["modeled_share"] == 1
    assert by_item["Modeled crop"]["documented_share"] == 1
    assert by_item["Specialized crop"]["coverage"] == 70
    assert by_item["Specialized crop"]["auto_qualified"] is True

    assert by_item["Narrow crop"]["auto_qualified"] is False
    assert "coverage" in by_item["Narrow crop"]["quality_details"]["failedChecks"]
    assert by_item["Clustered crop"]["auto_qualified"] is False
    assert by_item["Clustered crop"]["cluster"] < IMPORTER.MIN_CLUSTERING_SCORE
    assert by_item["Unknown crop"]["auto_qualified"] is False
    assert by_item["Unknown crop"]["provenance_status"] == "uncertain"
    assert "documentedEvidence" in by_item["Unknown crop"]["quality_details"]["failedChecks"]

    assert IMPORTER.faostat_concept_group("Cereals, primary", "Production") == "cerealProduction"
    assert IMPORTER.faostat_concept_group("Cereals, primary", "Yield") == "cerealYield"
    assert IMPORTER.faostat_concept_group("Wheat", "Production") != IMPORTER.faostat_concept_group("Wheat", "Yield")
    print("FAOSTAT adaptive importer tests passed.")


def test_catalog_never_selects_trade_archive():
    catalog = [
        {
            "dataset": "Crops and livestock products",
            "download": "https://bulks-faostat.fao.org/production/Trade_CropsLivestockIndicators_E_All_Data_(Normalized).zip",
        },
        {
            "dataset": "Production: Crops and livestock products (QCL)",
            "download": "https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_(Normalized).zip",
        },
    ]
    selected = IMPORTER.locate_qcl_zip(catalog)
    assert "Production_Crops_Livestock" in selected
    assert "Trade_" not in selected


def test_catalog_falls_back_when_only_trade_archive_exists():
    catalog = [{
        "dataset": "Trade crops and livestock indicators",
        "download": "https://bulks-faostat.fao.org/production/Trade_CropsLivestockIndicators_E_All_Data_(Normalized).zip",
    }]
    assert IMPORTER.locate_qcl_zip(catalog) == IMPORTER.FALLBACK_ZIP_URL


if __name__ == "__main__":
    main()
    test_catalog_never_selects_trade_archive()
    test_catalog_falls_back_when_only_trade_archive_exists()
