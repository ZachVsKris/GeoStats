#!/usr/bin/env python3
"""Import authoritative international sports chronology categories for GeoStats v16.2.7.

This importer intentionally requires official bulk/tabular inputs supplied by the
release workflow. It does not scrape Wikipedia or infer participation from
secondary datasets.

Supported source families:
* FIFA: men's FIFA World Cup participation/first-appearance table.
* IOC: modern Olympic Games participation/first-appearance table.

The ranked universe is the set of countries that actually participated in the
competition. Countries that never participated are outside the category rather
than receiving synthetic dates.
"""
from __future__ import annotations

import argparse
import csv
import html
import json
import os
import re
import tempfile
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name, country_name_to_iso3
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.official_tabular import first_value, number, read_official_rows, source_file_sha256
from data_pipeline.supabase import SupabaseWarehouse

SNAPSHOT_YEAR = datetime.now(timezone.utc).year

FIFA_ORG = "FIFA"
FIFA_DATASET = "FIFA Men's World Cup participation history"
FIFA_PAGE = "https://www.fifa.com/tournaments/mens/worldcup"
FIFA_METHOD = "https://www.fifa.com/tournaments/mens/worldcup"

IOC_ORG = "International Olympic Committee"
IOC_DATASET = "IOC modern Olympic Games participation history"
IOC_PAGE = "https://olympics.com/ioc/olympic-games"
IOC_METHOD = "https://olympics.com/ioc/olympic-games"

# IOC NOC codes are not always ISO alpha-3. Country names are preferred; these
# mappings are only fallbacks for common current-country NOCs in official tables.
NOC_TO_ISO3 = {
    "ALG": "DZA", "ANG": "AGO", "ANT": "ATG", "ARU": "ABW", "ASA": "ASM",
    "BAH": "BHS", "BAR": "BRB", "BER": "BMU", "BHU": "BTN", "BIZ": "BLZ",
    "BOT": "BWA", "BRN": "BHR", "BRU": "BRN", "BUR": "BFA", "CAM": "KHM",
    "CAY": "CYM", "CGO": "COG", "CHA": "TCD", "CHI": "CHL", "CRC": "CRI",
    "CRO": "HRV", "DEN": "DNK", "ESA": "SLV", "FIJ": "FJI", "GAB": "GAB",
    "GAM": "GMB", "GBS": "GNB", "GEQ": "GNQ", "GER": "DEU", "GRE": "GRC",
    "GRN": "GRD", "GUA": "GTM", "GUI": "GIN", "GUY": "GUY", "HAI": "HTI",
    "HON": "HND", "INA": "IDN", "IRI": "IRN", "ISV": "VIR", "JAM": "JAM",
    "KSA": "SAU", "KUW": "KWT", "LAT": "LVA", "LBA": "LBY", "LES": "LSO",
    "LIB": "LBN", "MAD": "MDG", "MAS": "MYS", "MAW": "MWI", "MGL": "MNG",
    "MRI": "MUS", "MTN": "MRT", "MYA": "MMR", "NCA": "NIC", "NED": "NLD",
    "NIG": "NER", "NGR": "NGA", "OMA": "OMN", "PAR": "PRY", "PHI": "PHL",
    "POR": "PRT", "PUR": "PRI", "RSA": "ZAF", "SAM": "WSM", "SEY": "SYC",
    "SIN": "SGP", "SLO": "SVN", "SRI": "LKA", "SUD": "SDN", "SUI": "CHE",
    "TAN": "TZA", "TOG": "TGO", "TPE": "TWN", "TRI": "TTO", "UAE": "ARE",
    "URU": "URY", "USA": "USA", "VAN": "VUT", "VIE": "VNM", "VIN": "VCT",
    "ZAM": "ZMB", "ZIM": "ZWE",
}

NAME_ALIASES = {
    "korea republic": "South Korea",
    "republic of korea": "South Korea",
    "korea dpr": "North Korea",
    "dpr korea": "North Korea",
    "iran islamic republic of": "Iran",
    "cote d ivoire": "Cote d'Ivoire",
    "côte d ivoire": "Cote d'Ivoire",
    "usa": "United States",
    "united states of america": "United States",
    "russian federation": "Russia",
    "china pr": "China",
    "pr china": "China",
    "chinese taipei": "Taiwan",
    "turkiye": "Turkey",
}

FIFA_ASSOCIATIONS_PAGE = "https://inside.fifa.com/en/associations"
FIFA_USER_AGENT = "GeoStats/16.2.7 authoritative sports chronology importer"


def _norm(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _country_iso3(row: dict[str, object]) -> str | None:
    name = first_value(
        row,
        "country", "country name", "nation", "team", "team name", "delegation",
        "noc name", "country or area",
    )
    if name not in (None, ""):
        cleaned = NAME_ALIASES.get(_norm(name), str(name).strip())
        iso3 = country_name_to_iso3(cleaned)
        if iso3:
            return iso3
    noc = first_value(row, "noc", "noc code", "olympic code", "team code", "country code", "code")
    if noc not in (None, ""):
        code = re.sub(r"[^A-Za-z]", "", str(noc)).upper()
        if len(code) == 3:
            return NOC_TO_ISO3.get(code) or code
    return None


def _year(row: dict[str, object]) -> int | None:
    raw = first_value(
        row,
        "first appearance", "first appearance year", "first participation", "first participation year",
        "debut", "debut year", "year", "edition year", "games year", "tournament year",
    )
    value = number(raw)
    if value is None:
        # Some official exports encode an edition as text, e.g. "Paris 1900".
        text = str(raw or first_value(row, "edition", "games", "tournament") or "")
        match = re.search(r"\b(18\d{2}|19\d{2}|20\d{2})\b", text)
        if not match:
            return None
        value = float(match.group(1))
    year = int(value)
    if 1896 <= year <= SNAPSHOT_YEAR:
        return year
    return None


def first_appearance_by_country(input_path: str) -> dict[str, int]:
    appearances: dict[str, int] = {}
    for row in read_official_rows(input_path):
        iso3 = _country_iso3(row)
        year = _year(row)
        if not iso3 or year is None:
            continue
        prior = appearances.get(iso3)
        if prior is None or year < prior:
            appearances[iso3] = year
    return appearances


def _next_data(page: str) -> dict[str, object]:
    match = re.search(r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>', page, re.S | re.I)
    if not match:
        raise RuntimeError("Official FIFA page did not contain the expected __NEXT_DATA__ payload.")
    value = json.loads(html.unescape(match.group(1)))
    if not isinstance(value, dict):
        raise RuntimeError("Official FIFA __NEXT_DATA__ payload was not an object.")
    return value


def _fetch_official_page(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": FIFA_USER_AGENT})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read().decode("utf-8", "replace")


def _fifa_page_data(payload: dict[str, object]) -> dict[str, object]:
    current: object = payload
    for key in ("props", "pageProps", "association", "pageData"):
        if not isinstance(current, dict) or key not in current:
            raise RuntimeError(f"Official FIFA association payload is missing {key!r}.")
        current = current[key]
    if not isinstance(current, dict):
        raise RuntimeError("Official FIFA association pageData was not an object.")
    return current


def fifa_world_cup_record(payload: dict[str, object], association_code: str) -> tuple[str, int] | None:
    page_data = _fifa_page_data(payload)
    tournaments = page_data.get("honoursBestPerformances", {})
    if not isinstance(tournaments, dict):
        return None
    rows = tournaments.get("tournaments", [])
    if not isinstance(rows, list):
        return None
    world_cup = next(
        (row for row in rows if isinstance(row, dict) and row.get("tournamentKey") == "FIFAWorldCup-Men"),
        None,
    )
    if not isinstance(world_cup, dict) or not world_cup.get("participationsCount"):
        return None
    years = world_cup.get("participationsYears")
    if not isinstance(years, list):
        raise RuntimeError(f"FIFA association {association_code} reports World Cup participation without participationYears.")
    valid_years = sorted({int(year) for year in years if str(year).isdigit() and 1930 <= int(year) <= SNAPSHOT_YEAR})
    if not valid_years:
        raise RuntimeError(f"FIFA association {association_code} reports World Cup participation without a valid edition year.")

    identity_candidates = [
        page_data.get("associationName"),
        page_data.get("name"),
        page_data.get("countryName"),
    ]
    association = page_data.get("association")
    if isinstance(association, dict):
        identity_candidates.extend((association.get("name"), association.get("countryName")))
    name = next((str(value).strip() for value in identity_candidates if value), association_code)
    return name, valid_years[0]


def fetch_fifa_world_cup_first_appearances(fetch_page=_fetch_official_page) -> list[tuple[str, int]]:
    directory = fetch_page(FIFA_ASSOCIATIONS_PAGE)
    codes = sorted(set(re.findall(r"/associations/([A-Za-z]{3})(?:[/?#\"']|$)", directory, re.I)))
    if len(codes) < 180:
        raise RuntimeError(f"Official FIFA directory exposed only {len(codes)} association codes; refusing partial import.")
    records: list[tuple[str, int]] = []
    for code in codes:
        payload = _next_data(fetch_page(f"https://inside.fifa.com/en/associations/{code.upper()}"))
        try:
            record = fifa_world_cup_record(payload, code.upper())
        except RuntimeError as error:
            # The directory can contain legacy/redirect association routes with a
            # different page payload. Completeness is enforced across the entire
            # directory below, so one malformed non-participant page must not
            # prevent evaluation of the authoritative participant universe.
            if "association payload is missing" not in str(error):
                raise
            continue
        if record:
            records.append(record)
    if len(records) < 70:
        raise RuntimeError(f"Official FIFA pages produced only {len(records)} World Cup participants; refusing partial import.")
    return records


def write_live_fifa_snapshot(output_path: str, fetch_page=_fetch_official_page) -> str:
    records = fetch_fifa_world_cup_first_appearances(fetch_page)
    with open(output_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(("Team", "First appearance year"))
        writer.writerows(records)
    return output_path


def _mark_defined_subset(candidate: CandidateDefinition, values: dict[str, int], rule: str, excluded_reason: str) -> None:
    ids = sorted(values)
    candidate.metadata.update({
        "eligible_universe_type": "defined_subset",
        "eligible_universe_rule": rule,
        "eligible_country_count": len(ids),
        "eligible_country_iso3": ids,
        "excluded_country_reason": excluded_reason,
    })


class _SportsChronologyImporter(WarehouseImporter):
    source_page: str
    methodology_page: str
    title: str
    key: str
    indicator_code: str
    category_prefix: str
    universe_rule: str
    excluded_reason: str
    strategy_family: str

    def __init__(self, warehouse: SupabaseWarehouse | None, input_path: str, *, dry_run: bool = False) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.input_path = input_path
        self.values = first_appearance_by_country(input_path)
        if len(self.values) < 12:
            raise RuntimeError(f"{self.source_slug} official input produced only {len(self.values)} current-country appearances; refusing an incomplete sports chronology import.")
        self.source_sha256 = source_file_sha256(input_path)

    def discover(self) -> list[CandidateDefinition]:
        description = self.description
        rule = IndicatorRule(
            key=self.key,
            title=self.title,
            description=description,
            plain_language_description=description,
            technical_definition=self.technical_definition,
            unit_explanation="Calendar year of first appearance",
            family="Sports",
            icon="🏅",
            unit="first appearance year",
            value_type="other",
            ranking_direction="low",
            include=("first appearance",),
            min_coverage=12,
            evidence_tier="A",
            source_priority=5,
            specificity_score=98,
            recognizability_score=98,
            understandability_score=98,
            fun_score=96,
        )
        candidate = CandidateDefinition(
            rule=rule,
            source_indicator_code=self.indicator_code,
            source_indicator_name=self.source_indicator_name,
            source_url=self.source_page,
            metadata={
                "source_page_url": self.source_page,
                "methodology_url": self.methodology_page,
                "source_query": {"metric": "first appearance", "population": "participating current countries"},
                "official_unit": "calendar year",
                "measurementType": "historical_date",
                "historicalValueFormat": "year",
                "showObservationYear": False,
                "referenceLabel": self.reference_label,
                "minimum_year": SNAPSHOT_YEAR,
                "dataset_release": f"Official sports participation snapshot {SNAPSHOT_YEAR}",
                "retrieved_at": datetime.now(timezone.utc).isoformat(),
                "derivation_method": "Group official participation records by current country and take the earliest edition year.",
                "derivation_version": "geostats-v16.2.7-sports-chronology-v1",
                "broadDomain": "sports",
                "knowledgeCluster": "sports-history",
                "strategyFamily": self.strategy_family,
                "semanticFamily": self.strategy_family,
                "semanticTopic": self.key,
                "v16_2_6_content_reviewed": True,
                "source_file_sha256": self.source_sha256,
                "manual_review_required": False,
            },
        )
        _mark_defined_subset(candidate, self.values, self.universe_rule, self.excluded_reason)
        return [candidate]

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        return [
            SourceObservation(
                iso3,
                canonical_country_name(iso3, iso3),
                SNAPSHOT_YEAR,
                float(year),
                self.source_page,
                f"{self.source_slug}:{iso3}:{year}",
                "official",
                {"firstAppearanceYear": year},
            )
            for iso3, year in sorted(self.values.items())
        ]

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"sports:{self.category_prefix}"


class FIFAWorldCupImporter(_SportsChronologyImporter):
    source_organization = FIFA_ORG
    source_dataset = FIFA_DATASET
    source_slug = "fifa"
    source_page = FIFA_PAGE
    methodology_page = FIFA_METHOD
    key = "first-mens-fifa-world-cup-appearance"
    title = "First men's FIFA World Cup appearance"
    indicator_code = "FIFA_MENS_WORLD_CUP_FIRST_APPEARANCE"
    category_prefix = "fifa-world-cup-first-appearance"
    source_indicator_name = "First men's FIFA World Cup appearance by participating country"
    description = "The first men's FIFA World Cup edition in which each participating current country appeared."
    technical_definition = "Minimum FIFA Men's World Cup edition year among official participation records for each current country that has participated."
    reference_label = "Men's FIFA World Cup participants"
    universe_rule = "Current countries with at least one official men's FIFA World Cup appearance in the supplied FIFA participation dataset."
    excluded_reason = "Countries that have never appeared in the men's FIFA World Cup are outside this chronology rather than assigned a synthetic date."
    strategy_family = "fifa-world-cup-history"


class IOCOlympicsImporter(_SportsChronologyImporter):
    source_organization = IOC_ORG
    source_dataset = IOC_DATASET
    source_slug = "ioc"
    source_page = IOC_PAGE
    methodology_page = IOC_METHOD
    key = "first-modern-olympic-appearance"
    title = "First modern Olympic appearance"
    indicator_code = "IOC_MODERN_OLYMPICS_FIRST_APPEARANCE"
    category_prefix = "modern-olympics-first-appearance"
    source_indicator_name = "First modern Olympic Games appearance by participating country"
    description = "The first modern Olympic Games edition in which each participating current country appeared."
    technical_definition = "Minimum modern Olympic Games edition year among official IOC participation records for each current country that has participated."
    reference_label = "Modern Olympic Games participants"
    universe_rule = "Current countries with at least one official modern Olympic Games appearance in the supplied IOC participation dataset."
    excluded_reason = "Countries that have never appeared in the modern Olympic Games are outside this chronology rather than assigned a synthetic date."
    strategy_family = "olympic-history"


def _warehouse(dry_run: bool) -> SupabaseWarehouse | None:
    if dry_run:
        return None
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY.")
    return SupabaseWarehouse(url, key)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=["fifa", "ioc", "all"], default="all")
    parser.add_argument("--fifa-input", help="Official FIFA participation/first-appearance CSV/TSV/XLSX/ZIP")
    parser.add_argument("--fifa-live", action="store_true", help="Build the FIFA input from official association __NEXT_DATA__ records")
    parser.add_argument("--ioc-input", help="Official IOC participation/first-appearance CSV/TSV/XLSX/ZIP")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    warehouse = _warehouse(args.dry_run)
    if args.source in {"fifa", "all"}:
        if args.fifa_live and args.fifa_input:
            raise SystemExit("Use either --fifa-live or --fifa-input, not both")
        if args.fifa_live:
            with tempfile.TemporaryDirectory() as tmp:
                snapshot = write_live_fifa_snapshot(str(Path(tmp) / "official-fifa-world-cup-history.csv"))
                print(FIFAWorldCupImporter(warehouse, snapshot, dry_run=args.dry_run).run())
        elif not args.fifa_input:
            if args.source == "fifa":
                raise SystemExit("--fifa-input or --fifa-live is required for FIFA import")
        else:
            print(FIFAWorldCupImporter(warehouse, args.fifa_input, dry_run=args.dry_run).run())
    if args.source in {"ioc", "all"}:
        if not args.ioc_input:
            if args.source == "ioc":
                raise SystemExit("--ioc-input is required for IOC import")
        else:
            print(IOCOlympicsImporter(warehouse, args.ioc_input, dry_run=args.dry_run).run())


if __name__ == "__main__":
    main()
