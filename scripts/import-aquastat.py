#!/usr/bin/env python3
"""Curated FAO AQUASTAT Main Database importer for GeoStats v16.2.6.

The importer accepts an official AQUASTAT bulk CSV (or a URL supplied by the
release workflow), resolves a deliberately small player-facing catalog against
official variable labels, and preserves one common unit per category. Missing
countries are never manually filled and are not redefined as an eligible subset.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import os
import re
from pathlib import Path
from urllib.request import Request, urlopen

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name, country_name_to_iso3
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_ORG = "FAO AQUASTAT"
SOURCE_DATASET = "AQUASTAT Main Database"
SOURCE_PAGE = "https://www.fao.org/aquastat/en/databases/maindatabase/"
METHODOLOGY = "https://www.fao.org/aquastat/en/overview/methodology/"

# key: title, definition, GeoStats unit, value type, family, minimum common-year coverage
SPECS = {
    "renewable-water-per-person": (
        "Renewable water per person",
        "Renewable internal freshwater resources available per person.",
        "m³/person",
        "per_capita",
        "Water resources",
        80,
    ),
    "total-renewable-water": (
        "Most renewable water resources",
        "Total actual renewable water resources available annually.",
        "km³/year",
        "total",
        "Water resources",
        100,
    ),
    "internal-renewable-water": (
        "Most internally generated renewable water",
        "Renewable water resources generated within the country.",
        "km³/year",
        "total",
        "Water resources",
        100,
    ),
    "water-dependency": (
        "Highest dependence on external water",
        "Largest share of renewable water resources originating outside the country.",
        "%",
        "percentage",
        "Water resources",
        100,
    ),
    "water-stress": (
        "Highest water stress",
        "Freshwater withdrawals as a share of available renewable freshwater resources.",
        "%",
        "percentage",
        "Water use",
        100,
    ),
    "total-water-withdrawal": (
        "Most freshwater withdrawn",
        "Total annual freshwater withdrawals.",
        "km³/year",
        "total",
        "Water use",
        90,
    ),
    "agricultural-water-share": (
        "Highest agricultural share of water use",
        "Agriculture’s share of total freshwater withdrawals.",
        "%",
        "percentage",
        "Water use",
        90,
    ),
    "industrial-water-share": (
        "Highest industrial share of water use",
        "Industry’s share of total water withdrawals.",
        "%",
        "percentage",
        "Water use",
        90,
    ),
    "municipal-water-share": (
        "Highest domestic share of water use",
        "Municipal and domestic water withdrawals as a share of total water withdrawals.",
        "%",
        "percentage",
        "Water use",
        90,
    ),
    "groundwater-withdrawal-share": (
        "Highest groundwater share of water withdrawals",
        "Groundwater withdrawals as a share of total water withdrawals.",
        "%",
        "percentage",
        "Water use",
        80,
    ),
    "surface-water-withdrawal-share": (
        "Highest surface-water share of water withdrawals",
        "Surface-water withdrawals as a share of total water withdrawals.",
        "%",
        "percentage",
        "Water use",
        80,
    ),
    "irrigated-cropland-share": (
        "Highest irrigated cropland share",
        "Share of cultivated land equipped for irrigation.",
        "%",
        "percentage",
        "Irrigation",
        90,
    ),
    "irrigation-equipped-area": (
        "Largest area equipped for irrigation",
        "Total land area equipped for irrigation.",
        "1000 ha",
        "total",
        "Irrigation",
        90,
    ),
    "dam-capacity": (
        "Largest dam capacity",
        "Total capacity of large dams.",
        "km³",
        "total",
        "Water infrastructure",
        80,
    ),
    "desalinated-water": (
        "Most desalinated water produced",
        "Annual volume of desalinated water produced.",
        "km³/year",
        "total",
        "Water infrastructure",
        80,
    ),
    "municipal-wastewater-produced": (
        "Most municipal wastewater produced",
        "Annual volume of municipal wastewater produced.",
        "km³/year",
        "total",
        "Wastewater",
        80,
    ),
    "municipal-wastewater-treated": (
        "Most municipal wastewater treated",
        "Annual volume of municipal wastewater receiving treatment.",
        "km³/year",
        "total",
        "Wastewater",
        80,
    ),
}

ALIASES = {
    "renewable-water-per-person": [
        "total renewable water resources per capita",
        "renewable water resources per capita",
    ],
    "total-renewable-water": [
        "total actual renewable water resources",
        "total renewable water resources",
    ],
    "internal-renewable-water": [
        "total internal renewable water resources",
        "internal renewable water resources",
    ],
    "water-dependency": ["dependency ratio", "water dependency ratio"],
    "water-stress": [
        "sdg 6.4.2 water stress",
        "level of water stress",
        "freshwater withdrawal as percentage of total renewable water resources",
    ],
    "total-water-withdrawal": ["total water withdrawal", "total freshwater withdrawal"],
    "agricultural-water-share": [
        "agricultural water withdrawal as percentage of total water withdrawal",
        "agricultural water withdrawal as % of total water withdrawal",
    ],
    "industrial-water-share": [
        "industrial water withdrawal as percentage of total water withdrawal",
        "industrial water withdrawal as % of total water withdrawal",
    ],
    "municipal-water-share": [
        "municipal water withdrawal as percentage of total water withdrawal",
        "municipal water withdrawal as % of total water withdrawal",
        "domestic water withdrawal as percentage of total water withdrawal",
    ],
    "groundwater-withdrawal-share": [
        "groundwater withdrawal as percentage of total water withdrawal",
        "groundwater withdrawal as % of total water withdrawal",
        "groundwater withdrawal as percentage of total freshwater withdrawal",
    ],
    "surface-water-withdrawal-share": [
        "surface water withdrawal as percentage of total water withdrawal",
        "surface water withdrawal as % of total water withdrawal",
        "surface water withdrawal as percentage of total freshwater withdrawal",
    ],
    "irrigated-cropland-share": [
        "area equipped for irrigation as percentage of cultivated area",
        "percentage of cultivated area equipped for irrigation",
    ],
    "irrigation-equipped-area": [
        "area equipped for irrigation total",
        "total area equipped for irrigation",
        "area equipped for full control irrigation total",
    ],
    "dam-capacity": ["total dam capacity", "total capacity of dams"],
    "desalinated-water": [
        "produced water desalinated water",
        "desalinated water produced",
        "desalinated water",
    ],
    "municipal-wastewater-produced": [
        "produced municipal wastewater",
        "municipal wastewater produced",
    ],
    "municipal-wastewater-treated": [
        "treated municipal wastewater",
        "municipal wastewater treated",
        "municipal wastewater receiving treatment",
    ],
}

EXPECTED_UNITS = {
    "%": (r"^%$", r"percent"),
    "km³/year": (r"km3 year", r"10 9 m3 year", r"billion m3 year"),
    "km³": (r"km3", r"10 9 m3", r"billion m3"),
    "m³/person": (r"m3 inhab", r"m3 person", r"m3 capita"),
    "1000 ha": (r"1000 ha", r"thousand ha"),
}


def norm(value: object) -> str:
    return re.sub(r"[^a-z0-9%]+", " ", str(value or "").lower()).strip()


def resolve(name: object) -> str | None:
    normalized_name = norm(name)
    matches: list[tuple[int, str]] = []
    for key, aliases in ALIASES.items():
        for alias in aliases:
            normalized_alias = norm(alias)
            if normalized_alias and (normalized_alias in normalized_name or normalized_name in normalized_alias):
                matches.append((len(normalized_alias), key))
    # Prefer the most specific official label. This prevents generic aliases such
    # as "total water withdrawal" from stealing percentage-share indicators.
    return max(matches)[1] if matches else None


def unit_matches(geostats_unit: str, source_unit: object) -> bool:
    if source_unit in (None, ""):
        return True
    candidate = norm(source_unit).replace("³", "3")
    return any(re.search(pattern, candidate, re.IGNORECASE) for pattern in EXPECTED_UNITS.get(geostats_unit, ()))


def load(path_or_url: str) -> list[tuple[str, str, int, float, str, str]]:
    if Path(path_or_url).exists():
        raw = Path(path_or_url).read_bytes()
    elif path_or_url:
        raw = urlopen(Request(path_or_url, headers={"User-Agent": "GeoStats/16.2.6"}), timeout=240).read()
    else:
        raise RuntimeError("Provide --input with an official AQUASTAT bulk CSV or URL.")

    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig", "replace")))
    out: list[tuple[str, str, int, float, str, str]] = []
    for row in reader:
        lower = {norm(key): value for key, value in row.items()}
        country = next((value for key, value in lower.items() if key in {"area", "country", "country name"}), None)
        variable = next((value for key, value in lower.items() if key in {"variable name", "variable", "indicator", "indicator name"}), None)
        year_raw = next((value for key, value in lower.items() if key == "year"), None)
        value_raw = next((value for key, value in lower.items() if key == "value"), None)
        source_unit = next((value for key, value in lower.items() if key in {"unit", "units"}), "") or ""
        key = resolve(variable)
        iso3 = country_name_to_iso3(str(country or ""))
        if not key or not iso3 or year_raw in (None, ""):
            continue
        try:
            year = int(float(str(year_raw)))
            value = float(str(value_raw).replace(",", ""))
        except (TypeError, ValueError):
            continue
        geostats_unit = SPECS[key][2]
        if not unit_matches(geostats_unit, source_unit):
            continue
        out.append((key, iso3, year, value, str(variable or ""), str(source_unit)))
    return out


def input_sha256(value: str) -> str:
    path = Path(value)
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else ""


class Importer(WarehouseImporter):
    source_organization = SOURCE_ORG
    source_dataset = SOURCE_DATASET
    source_slug = "aquastat"

    def __init__(self, warehouse: SupabaseWarehouse | None, input_path: str, dry_run: bool = False) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.rows = load(input_path)
        self.source_sha256 = input_sha256(input_path)

    def discover(self) -> list[CandidateDefinition]:
        out: list[CandidateDefinition] = []
        for key, (title, desc, unit, value_type, family, min_coverage) in SPECS.items():
            rule = IndicatorRule(
                key=key,
                title=title,
                description=desc,
                plain_language_description=desc,
                technical_definition=desc,
                unit_explanation=unit,
                family=family,
                icon="💧",
                unit=unit,
                value_type=value_type,  # type: ignore[arg-type]
                ranking_direction="high",
                include=(key,),
                min_coverage=min_coverage,
                evidence_tier="A",
                source_priority=14,
                specificity_score=96,
                recognizability_score=94,
                understandability_score=94,
                fun_score=90,
            )
            out.append(
                CandidateDefinition(
                    rule,
                    f"AQUASTAT:{key}",
                    title,
                    SOURCE_PAGE,
                    {
                        "source_page_url": SOURCE_PAGE,
                        "methodology_url": METHODOLOGY,
                        "broadDomain": "water",
                        "knowledgeCluster": family.lower().replace(" ", "-"),
                        "strategyFamily": key,
                        "boardDescription": desc,
                        "source_file_sha256": self.source_sha256,
                        "source_query": {"variable_aliases": ALIASES[key], "expected_unit": unit},
                        "measurementType": "share" if value_type == "percentage" else value_type,
                        "v16_2_6_content_reviewed": True,
                    },
                )
            )
        return out

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        return [
            SourceObservation(
                iso3,
                canonical_country_name(iso3, iso3),
                year,
                value,
                SOURCE_PAGE,
                f"{candidate.rule.key}:{iso3}:{year}",
                "official",
                {"source_variable": variable, "source_unit": source_unit},
            )
            for key, iso3, year, value, variable, source_unit in self.rows
            if key == candidate.rule.key
        ]

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"aquastat:{candidate.rule.key}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not args.dry_run and (not url or not key):
        raise SystemExit("Set Supabase secrets.")
    print(Importer(None if args.dry_run else SupabaseWarehouse(url, key), args.input, args.dry_run).run())


if __name__ == "__main__":
    main()
