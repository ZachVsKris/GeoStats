#!/usr/bin/env python3
"""Curated IMF WEO importer for GeoStats v16.2.6.

Uses a fixed historical year from the April 2026 WEO bulk database and exact
Subject Descriptor + Units pairs.  Forecast years are never used.  Subject names
that appear in multiple unit systems (notably GDP per capita) are disambiguated by
unit before a row can enter the warehouse candidate set.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import os
import re
from pathlib import Path

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name, country_name_to_iso3
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_ORG = "International Monetary Fund"
SOURCE_DATASET = "World Economic Outlook Database, April 2026"
SOURCE_PAGE = "https://www.imf.org/en/Publications/WEO/weo-database/2026/April"
METHOD = "https://www.imf.org/en/Publications/WEO/weo-database/2026/April/select-aggr-data"
YEAR = 2024

# key: title, definition, display unit, value type, direction, exact WEO subject,
# required substring of WEO Units after normalization, minimum coverage.
SPECS = {
    "gdp-per-person": (
        "Highest GDP per person",
        "Gross domestic product per person at current prices in current US dollars.",
        "US dollars per person",
        "per_capita",
        "high",
        "Gross domestic product per capita, current prices",
        "u s dollars",
        175,
    ),
    "real-gdp-growth": (
        "Fastest economic growth",
        "Annual percent change in real gross domestic product.",
        "%",
        "rate",
        "high",
        "Gross domestic product, constant prices",
        "percent change",
        175,
    ),
    "inflation": (
        "Highest inflation",
        "Annual percent change in average consumer prices.",
        "%",
        "rate",
        "high",
        "Inflation, average consumer prices",
        "percent change",
        175,
    ),
    "ppp-gdp-per-person": (
        "Highest GDP per person at purchasing power parity",
        "Gross domestic product per person at current purchasing-power-parity international dollars.",
        "international dollars per person",
        "per_capita",
        "high",
        "Gross domestic product per capita, current prices",
        "purchasing power parity international dollars",
        175,
    ),
    "end-period-inflation": (
        "Highest year-end inflation",
        "Annual percent change in end-of-period consumer prices.",
        "%",
        "rate",
        "high",
        "Inflation, end of period consumer prices",
        "percent change",
        175,
    ),
    "government-debt": (
        "Highest government debt",
        "General government gross debt as a share of gross domestic product.",
        "% of GDP",
        "percentage",
        "high",
        "General government gross debt",
        "percent of gdp",
        160,
    ),
    "government-balance": (
        "Largest government budget surplus",
        "General government net lending or borrowing as a share of gross domestic product.",
        "% of GDP",
        "percentage",
        "high",
        "General government net lending/borrowing",
        "percent of gdp",
        160,
    ),
    "government-revenue": (
        "Highest government revenue share",
        "General government revenue as a share of gross domestic product.",
        "% of GDP",
        "percentage",
        "high",
        "General government revenue",
        "percent of gdp",
        160,
    ),
    "government-expenditure": (
        "Highest government spending share",
        "General government total expenditure as a share of gross domestic product.",
        "% of GDP",
        "percentage",
        "high",
        "General government total expenditure",
        "percent of gdp",
        160,
    ),
    "current-account": (
        "Largest current-account surplus",
        "Current-account balance as a share of gross domestic product.",
        "% of GDP",
        "percentage",
        "high",
        "Current account balance",
        "percent of gdp",
        175,
    ),
    "national-savings": (
        "Highest national savings rate",
        "Gross national savings as a share of gross domestic product.",
        "% of GDP",
        "percentage",
        "high",
        "Gross national savings",
        "percent of gdp",
        160,
    ),
    "investment": (
        "Highest investment rate",
        "Total investment as a share of gross domestic product.",
        "% of GDP",
        "percentage",
        "high",
        "Total investment",
        "percent of gdp",
        160,
    ),
    "export-volume-growth": (
        "Fastest export growth",
        "Annual percent change in the volume of exports of goods and services.",
        "%",
        "rate",
        "high",
        "Volume of exports of goods and services",
        "percent change",
        160,
    ),
    "import-volume-growth": (
        "Fastest import growth",
        "Annual percent change in the volume of imports of goods and services.",
        "%",
        "rate",
        "high",
        "Volume of imports of goods and services",
        "percent change",
        160,
    ),
}


def norm(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def load(path_or_url):
    raw = (
        Path(path_or_url).read_bytes()
        if Path(path_or_url).exists()
        else HttpClient(timeout=240, retries=5, user_agent="GeoStats/16.2.6 IMF").get_bytes(path_or_url)
    )
    text = raw.decode("utf-8-sig", "replace")
    sample = text[:10000]
    delimiter = "\t" if sample.count("\t") > sample.count(",") else ","
    rows = []
    for row in csv.DictReader(io.StringIO(text), delimiter=delimiter):
        mapped = {norm(k): v for k, v in row.items()}
        iso3 = str(mapped.get("iso") or "").upper().strip()
        country = mapped.get("country")
        if len(iso3) != 3:
            iso3 = country_name_to_iso3(country) or ""
        subject = norm(mapped.get("subject descriptor"))
        units = norm(mapped.get("units"))
        try:
            value = float(str(row.get(str(YEAR)) or mapped.get(str(YEAR)) or "").replace(",", ""))
        except (TypeError, ValueError):
            continue
        if not iso3:
            continue
        for key, (_, _, _, _, _, source_subject, expected_units, _) in SPECS.items():
            if norm(source_subject) == subject and norm(expected_units) in units:
                rows.append((key, iso3, country or iso3, value, str(mapped.get("subject descriptor") or source_subject), str(mapped.get("units") or "")))
    return rows


def input_sha256(value):
    path = Path(value)
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else ""


class Importer(WarehouseImporter):
    source_organization = SOURCE_ORG
    source_dataset = SOURCE_DATASET
    source_slug = "imfweo"

    def __init__(self, warehouse, input_path, dry_run=False):
        super().__init__(warehouse, dry_run=dry_run)
        self.rows = load(input_path)
        self.source_sha256 = input_sha256(input_path)

    def discover(self):
        out = []
        for key, (title, desc, unit, value_type, direction, subject, expected_units, min_coverage) in SPECS.items():
            icon = "💵" if value_type == "per_capita" else "📈"
            rule = IndicatorRule(
                key=key,
                title=title,
                description=desc,
                plain_language_description=desc,
                technical_definition=f"{subject}, IMF WEO April 2026, historical {YEAR} observation; units: {expected_units}.",
                unit_explanation=unit,
                family="Economy",
                icon=icon,
                unit=unit,
                value_type=value_type,
                ranking_direction=direction,
                include=(subject,),
                min_coverage=min_coverage,
                evidence_tier="A",
                source_priority=4,
                specificity_score=98,
                recognizability_score=99,
                understandability_score=98,
                fun_score=94,
            )
            out.append(
                CandidateDefinition(
                    rule,
                    f"WEO2026APR:{key}:{YEAR}",
                    subject,
                    SOURCE_PAGE,
                    {
                        "source_page_url": SOURCE_PAGE,
                        "methodology_url": METHOD,
                        "dataset_release": "WEO April 2026",
                        "source_query": {
                            "subject": subject,
                            "year": YEAR,
                            "historical_only": True,
                            "expected_units": expected_units,
                        },
                        "minimum_year": YEAR,
                        "measurementType": value_type,
                        "broadDomain": "economy",
                        "knowledgeCluster": key,
                        "strategyFamily": key,
                        "v16_2_6_content_reviewed": True,
                        "source_file_sha256": self.source_sha256,
                    },
                )
            )
        return out

    def fetch_observations(self, candidate):
        return [
            SourceObservation(
                iso3,
                canonical_country_name(iso3, country),
                YEAR,
                value,
                SOURCE_PAGE,
                f"{key}:{iso3}:{YEAR}",
                "official",
                {"source_indicator": source_indicator, "source_unit": source_unit},
            )
            for key, iso3, country, value, source_indicator, source_unit in self.rows
            if key == candidate.rule.key
        ]

    def category_id(self, candidate):
        return f"imfweo:{candidate.rule.key}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Official WEO all-country CSV/TSV download")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not args.dry_run and (not url or not key):
        raise SystemExit("Set Supabase secrets.")
    print(Importer(None if args.dry_run else SupabaseWarehouse(url, key), args.input, args.dry_run).run())


if __name__ == "__main__":
    main()
