#!/usr/bin/env python3
"""Import GeoStats' first source-audited historical/date categories.

The values are historical dates/years, but every observation is stored under a
single current snapshot year so countries remain directly comparable. The actual
historical value is the numeric observation value:
  * UN admission: YYYYMMDD
  * Constitution adoption: YYYY
"""
from __future__ import annotations

import argparse
import html
import os
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name, country_name_to_iso3
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

UN_MEMBER_STATES_URL = "https://www.un.org/about-us/member-states"
UN_MEMBERSHIP_METHOD_URL = "https://www.un.org/en/about-us/about-un-membership"
CONSTITUTE_SERVICE_URL = "https://www.constituteproject.org/service/constitutions?lang=en&historic=false"
CONSTITUTE_CONSTITUTIONS_URL = "https://www.constituteproject.org/constitutions"
CONSTITUTE_DATA_URL = "https://www.constituteproject.org/content/data"
IPU_API_URL = "https://api.data.ipu.org/v1/parliaments?fields=country_name%2Cdate_of_independence%2Csuffrage%2Cparliament_country&page%5Bnumber%5D=1&page%5Bsize%5D=1000000"
IPU_COMPARE_URL = "https://data.ipu.org/compare/"
IPU_DATA_DICTIONARY_URL = "https://data.ipu.org/data-dictionary/"
SNAPSHOT_YEAR = datetime.now(timezone.utc).year


class _UNMemberParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_heading = False
        self.heading_parts: list[str] = []
        self.current_country: str | None = None
        self.records: list[tuple[str, str]] = []
        self._text_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs):
        if tag.lower() in {"h2", "h3"}:
            self.in_heading = True
            self.heading_parts = []

    def handle_endtag(self, tag: str):
        if tag.lower() in {"h2", "h3"} and self.in_heading:
            value = " ".join("".join(self.heading_parts).split())
            if value:
                self.current_country = value
            self.in_heading = False

    def handle_data(self, data: str):
        if self.in_heading:
            self.heading_parts.append(data)
        self._text_parts.append(data)


def parse_un_member_states_html(raw: str) -> list[tuple[str, str]]:
    """Return (country name, DD-MM-YYYY) from the official UN member list."""
    parser = _UNMemberParser()
    parser.feed(raw)
    # Drupal markup varies. Pair a country heading with the first admission date
    # before the next country heading using a second, markup-tolerant scan.
    cleaned = re.sub(r"<script\b.*?</script>|<style\b.*?</style>", " ", raw, flags=re.I | re.S)
    chunks = re.split(r"(?i)<h[23][^>]*>", cleaned)
    records: list[tuple[str, str]] = []
    for chunk in chunks[1:]:
        m_end = re.search(r"(?i)</h[23]>", chunk)
        if not m_end:
            continue
        title = html.unescape(re.sub(r"<[^>]+>", " ", chunk[:m_end.start()]))
        title = " ".join(title.split())
        body = html.unescape(re.sub(r"<[^>]+>", " ", chunk[m_end.end():]))
        m_date = re.search(r"Date\s+of\s+Admission\s*:\s*(\d{2}-\d{2}-\d{4})", body, re.I)
        if title and m_date:
            records.append((title, m_date.group(1)))
    if records:
        return records

    # Last-resort parser for simplified/text fixtures.
    text = html.unescape(re.sub(r"<[^>]+>", "\n", raw))
    matches = re.finditer(r"(?m)^\s*([^\n]{2,90})\s*\n(?:\s*\n)*\s*Date\s+of\s+Admission\s*:\s*(\d{2}-\d{2}-\d{4})", text, re.I)
    return [(" ".join(m.group(1).split()), m.group(2)) for m in matches]


def parse_constitute_current_constitutions(payload) -> list[tuple[str, int, str]]:
    """Return one currently-in-force constitution adoption year per GeoStats country.

    Constitute's documented ``constitutions`` service exposes explicit ``in_force``
    and ``year_enacted`` fields. We deliberately use those fields rather than
    inferring the current constitution from the site's historical chronology.
    """
    if not isinstance(payload, list):
        raise RuntimeError("Constitute constitutions service returned a non-list payload.")
    current: dict[str, tuple[int, str]] = {}
    duplicates: dict[str, list[str]] = {}
    for row in payload:
        if not isinstance(row, dict):
            continue
        if row.get("in_force") is not True:
            continue
        if row.get("in_draft") is True or row.get("is_draft") is True:
            continue
        country = str(row.get("country") or row.get("country_id") or "").strip()
        year_raw = row.get("year_enacted")
        if not country or year_raw is None or not re.fullmatch(r"\d{4}", str(year_raw).strip()):
            continue
        iso3 = country_name_to_iso3(country)
        if not iso3:
            continue
        year = int(str(year_raw).strip())
        record_id = str(row.get("id") or f"{country}:{year}")
        prior = current.get(iso3)
        if prior is not None and prior != (year, record_id):
            duplicates.setdefault(iso3, [prior[1]]).append(record_id)
            # Multiple simultaneous in-force constitutional texts would make the
            # single-year category ambiguous, so omit that country rather than
            # silently choosing one.
            current.pop(iso3, None)
            continue
        if iso3 not in duplicates:
            current[iso3] = (year, record_id)
    return [(iso3, year, record_id) for iso3, (year, record_id) in sorted(current.items())]


class UNMembershipImporter(WarehouseImporter):
    source_organization = "United Nations"
    source_dataset = "United Nations Member States admission dates"
    source_slug = "unmembership"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False, input_path: str | None = None) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.http = HttpClient(timeout=120, retries=5, user_agent="GeoStats/16.2.3 historical importer")
        self.input_path = input_path

    def discover(self) -> list[CandidateDefinition]:
        rule = IndicatorRule(
            key="most-recent-un-admission",
            title="Most recently admitted to the UN",
            description="Date each current UN Member State was admitted to the United Nations.",
            plain_language_description="Date each current UN Member State was admitted to the United Nations.",
            technical_definition="Official date of admission to United Nations membership for each current UN Member State.",
            unit_explanation="Calendar date of admission to UN membership",
            family="History",
            icon="🌐",
            unit="admission date",
            value_type="other",
            ranking_direction="high",
            include=(),
            min_coverage=185,
            evidence_tier="A",
            source_priority=5,
            specificity_score=100,
            recognizability_score=96,
            understandability_score=98,
            fun_score=92,
        )
        return [CandidateDefinition(
            rule=rule,
            source_indicator_code="UN_MEMBER_ADMISSION_DATE",
            source_indicator_name="UN Member State date of admission",
            source_url=UN_MEMBER_STATES_URL,
            metadata={
                "source_page_url": UN_MEMBER_STATES_URL,
                "methodology_url": UN_MEMBERSHIP_METHOD_URL,
                "source_query": {"page": "member-states", "field": "Date of Admission", "population": "current Member States"},
                "official_unit": "calendar date",
                "measurementType": "historical_date",
                "historicalValueFormat": "date",
                "showObservationYear": False,
                "referenceLabel": "Current UN membership",
                "minimum_year": SNAPSHOT_YEAR,
                "dataset_release": f"UN Member States snapshot {SNAPSHOT_YEAR}",
                "retrieved_at": datetime.now(timezone.utc).isoformat(),
                "derivation_method": "Parse the official UN Member States list and encode each admission date as YYYYMMDD for chronological ranking.",
                "derivation_version": "geostats-v16.2.3-un-membership-v1",
            },
        )]

    def _raw(self) -> str:
        return Path(self.input_path).read_text(encoding="utf-8") if self.input_path else self.http.get_text(UN_MEMBER_STATES_URL, accept="text/html,*/*")

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        rows: list[SourceObservation] = []
        unresolved: list[str] = []
        for source_name, raw_date in parse_un_member_states_html(self._raw()):
            iso3 = country_name_to_iso3(source_name)
            if not iso3:
                unresolved.append(source_name)
                continue
            day, month, year = (int(part) for part in raw_date.split("-"))
            value = float(year * 10000 + month * 100 + day)
            rows.append(SourceObservation(
                country_iso3=iso3,
                country_name=canonical_country_name(iso3, source_name),
                data_year=SNAPSHOT_YEAR,
                value=value,
                source_url=UN_MEMBER_STATES_URL,
                source_record_id=f"UN-MEMBER:{iso3}:{raw_date}",
                evidence_status="official",
                metadata={"admission_date": raw_date, "source_country_name": source_name},
            ))
        if len(rows) < candidate.rule.min_coverage:
            raise RuntimeError(f"UN Member States parser resolved only {len(rows)} countries; unresolved sample: {unresolved[:8]}")
        return rows

    def category_id(self, candidate: CandidateDefinition) -> str:
        return "history:un-admission"


class ConstituteImporter(WarehouseImporter):
    source_organization = "Constitute Project"
    source_dataset = "Constitute in-force constitutions"
    source_slug = "constitute"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False, input_path: str | None = None) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.http = HttpClient(timeout=120, retries=5, user_agent="GeoStats/16.2.3 historical importer")
        self.input_path = input_path

    def discover(self) -> list[CandidateDefinition]:
        rule = IndicatorRule(
            key="oldest-current-constitution",
            title="Oldest current constitution",
            description="Enactment year of the constitution currently listed as in force by the Constitute Project.",
            plain_language_description="Enactment year of the constitution currently listed as in force by the Constitute Project.",
            technical_definition="year_enacted for each constitution explicitly marked in_force=true by Constitute's documented constitutions service.",
            unit_explanation="Year the currently in-force constitution was enacted",
            family="History",
            icon="📜",
            unit="adoption year",
            value_type="other",
            ranking_direction="low",
            include=(),
            min_coverage=150,
            evidence_tier="A",
            source_priority=6,
            specificity_score=96,
            recognizability_score=93,
            understandability_score=96,
            fun_score=90,
        )
        return [CandidateDefinition(
            rule=rule,
            source_indicator_code="CURRENT_IN_FORCE_CONSTITUTION_YEAR",
            source_indicator_name="In-force constitution year_enacted",
            source_url=CONSTITUTE_SERVICE_URL,
            metadata={
                "source_page_url": CONSTITUTE_CONSTITUTIONS_URL,
                "methodology_url": CONSTITUTE_DATA_URL,
                "source_query": {"endpoint": "service/constitutions", "historic": False, "in_force": True, "field": "year_enacted"},
                "official_unit": "year",
                "measurementType": "historical_date",
                "historicalValueFormat": "year",
                "showObservationYear": False,
                "referenceLabel": "Constitute in-force constitutions",
                "minimum_year": SNAPSHOT_YEAR,
                "dataset_release": f"Constitute in-force constitutions snapshot {SNAPSHOT_YEAR}",
                "retrieved_at": datetime.now(timezone.utc).isoformat(),
                "derivation_method": "Use year_enacted only for Constitute constitution records explicitly marked in_force=true; omit ambiguous duplicate in-force records.",
                "derivation_version": "geostats-v16.2.3-constitute-v2",
                "input_datasets": [CONSTITUTE_SERVICE_URL],
            },
        )]

    def _payload(self):
        if self.input_path:
            import json
            return json.loads(Path(self.input_path).read_text(encoding="utf-8"))
        return self.http.get_json(CONSTITUTE_SERVICE_URL)

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        parsed = parse_constitute_current_constitutions(self._payload())
        rows = [SourceObservation(
            country_iso3=iso3,
            country_name=canonical_country_name(iso3),
            data_year=SNAPSHOT_YEAR,
            value=float(year),
            source_url=CONSTITUTE_CONSTITUTIONS_URL,
            source_record_id=f"CONSTITUTE:{record_id}",
            evidence_status="official",
            metadata={"constitution_enactment_year": year, "constitute_record_id": record_id},
        ) for iso3, year, record_id in parsed]
        if len(rows) < candidate.rule.min_coverage:
            raise RuntimeError(f"Constitute in-force constitutions service resolved only {len(rows)} unambiguous current-country records.")
        return rows

    def category_id(self, candidate: CandidateDefinition) -> str:
        return "history:oldest-current-constitution"



def parse_ipu_historical_payload(payload) -> dict[str, dict[str, int]]:
    """Extract broad country-history milestones from the official IPU Parline API.

    Returns per-ISO3 values for:
      * independence: year of independence where IPU records one (post-1940 scope)
      * universal_suffrage: earliest national record explicitly marked universal
    """
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
        raise RuntimeError("IPU Parline API returned an unexpected payload.")
    result: dict[str, dict[str, int]] = {}
    for row in payload["data"]:
        if not isinstance(row, dict):
            continue
        attrs = row.get("attributes") if isinstance(row.get("attributes"), dict) else {}
        country_attr = attrs.get("country_name") if isinstance(attrs.get("country_name"), dict) else {}
        country_value = country_attr.get("value")
        if isinstance(country_value, dict):
            country_name = str(country_value.get("en") or next(iter(country_value.values()), "")).strip()
        else:
            country_name = str(country_value or "").strip()
        if not country_name:
            continue
        iso3 = country_name_to_iso3(country_name)
        if not iso3:
            continue
        values = result.setdefault(iso3, {})

        independence_attr = attrs.get("date_of_independence") if isinstance(attrs.get("date_of_independence"), dict) else {}
        independence_value = independence_attr.get("value")
        if isinstance(independence_value, str):
            match = re.match(r"^(\d{4})-", independence_value)
            if match:
                values["independence"] = int(match.group(1))

        suffrage_attr = attrs.get("suffrage") if isinstance(attrs.get("suffrage"), dict) else {}
        suffrage_values = suffrage_attr.get("value") if isinstance(suffrage_attr.get("value"), list) else []
        universal_years: list[int] = []
        for record in suffrage_values:
            if not isinstance(record, dict):
                continue
            national = record.get("national_or_local")
            restricted = record.get("restricted_or_unrestricted")
            national_term = national.get("term") if isinstance(national, dict) else national
            restricted_term = restricted.get("term") if isinstance(restricted, dict) else restricted
            raw_date = record.get("right_to_vote")
            if str(national_term).lower() != "national" or str(restricted_term).lower() != "universal" or not isinstance(raw_date, str):
                continue
            match = re.match(r"^(\d{4})-", raw_date)
            if match:
                universal_years.append(int(match.group(1)))
        if universal_years:
            values["universal_suffrage"] = min(universal_years)
    return result


class IPUHistoricalImporter(WarehouseImporter):
    source_organization = "Inter-Parliamentary Union"
    source_dataset = "IPU Parline country history fields"
    source_slug = "ipu"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False, input_path: str | None = None) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.http = HttpClient(timeout=120, retries=5, user_agent="GeoStats/16.2.3 historical importer")
        self.input_path = input_path

    def discover(self) -> list[CandidateDefinition]:
        common = {
            "family": "History",
            "value_type": "other",
            "include": (),
            "evidence_tier": "A",
            "source_priority": 6,
            "specificity_score": 98,
            "recognizability_score": 96,
            "understandability_score": 98,
            "fun_score": 95,
        }
        independence = IndicatorRule(
            key="recent-independence",
            title="Most recently became independent",
            description="Year of independence for countries that became independent after 1940, using the IPU Parline country-history field.",
            plain_language_description="Year the country became independent, for countries whose independence occurred after 1940.",
            technical_definition="IPU Parline date_of_independence; the IPU defines this field for countries that became independent after 1940.",
            unit_explanation="Year of independence",
            icon="🕊️", unit="independence year", ranking_direction="high", min_coverage=90,
            **common,
        )
        suffrage = IndicatorRule(
            key="universal-womens-suffrage",
            title="Earliest universal women’s suffrage",
            description="Earliest year IPU records national voting rights for women as universal rather than restricted.",
            plain_language_description="Year women first had universal voting rights in national elections.",
            technical_definition="Minimum IPU Parline suffrage.right_to_vote year where national_or_local=national and restricted_or_unrestricted=universal.",
            unit_explanation="Year universal national women’s suffrage was achieved",
            icon="🗳️", unit="suffrage year", ranking_direction="low", min_coverage=160,
            **common,
        )
        now = datetime.now(timezone.utc).isoformat()
        return [
            CandidateDefinition(
                rule=independence,
                source_indicator_code="DATE_OF_INDEPENDENCE_POST_1940",
                source_indicator_name="Date of independence",
                source_url=IPU_API_URL,
                metadata={
                    "source_page_url": IPU_COMPARE_URL,
                    "methodology_url": IPU_DATA_DICTIONARY_URL,
                    "source_query": {"endpoint": "v1/parliaments", "field": "date_of_independence", "scope": "countries independent after 1940"},
                    "official_unit": "year", "measurementType": "historical_date", "historicalValueFormat": "year",
                    "showObservationYear": False, "referenceLabel": "IPU Parline country history",
                    "minimum_year": SNAPSHOT_YEAR, "dataset_release": f"IPU Parline snapshot {SNAPSHOT_YEAR}", "retrieved_at": now,
                    "derivation_method": "Read IPU date_of_independence and retain its year. The source field is explicitly limited to countries independent after 1940.",
                    "derivation_version": "geostats-v16.2.3-ipu-independence-v1", "input_datasets": [IPU_API_URL],
                    "boardDescription": "Year of independence for countries independent after 1940.",
                },
            ),
            CandidateDefinition(
                rule=suffrage,
                source_indicator_code="UNIVERSAL_NATIONAL_WOMENS_SUFFRAGE_YEAR",
                source_indicator_name="Women’s right to vote: national universal suffrage",
                source_url=IPU_API_URL,
                metadata={
                    "source_page_url": IPU_COMPARE_URL,
                    "methodology_url": IPU_DATA_DICTIONARY_URL,
                    "source_query": {"endpoint": "v1/parliaments", "field": "suffrage.right_to_vote", "national_or_local": "national", "restricted_or_unrestricted": "universal", "selection": "earliest"},
                    "official_unit": "year", "measurementType": "historical_date", "historicalValueFormat": "year",
                    "showObservationYear": False, "referenceLabel": "IPU Parline women’s suffrage history",
                    "minimum_year": SNAPSHOT_YEAR, "dataset_release": f"IPU Parline snapshot {SNAPSHOT_YEAR}", "retrieved_at": now,
                    "derivation_method": "For each country, choose the earliest IPU national suffrage record explicitly classified as universal.",
                    "derivation_version": "geostats-v16.2.3-ipu-suffrage-v1", "input_datasets": [IPU_API_URL],
                    "boardDescription": "Year women first had universal voting rights nationally.",
                },
            ),
        ]

    def _payload(self):
        if self.input_path:
            import json
            return json.loads(Path(self.input_path).read_text(encoding="utf-8"))
        return self.http.get_json(IPU_API_URL)

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        parsed = parse_ipu_historical_payload(self._payload())
        field = "independence" if candidate.rule.key == "recent-independence" else "universal_suffrage"
        rows = [SourceObservation(
            country_iso3=iso3,
            country_name=canonical_country_name(iso3),
            data_year=SNAPSHOT_YEAR,
            value=float(values[field]),
            source_url=IPU_COMPARE_URL,
            source_record_id=f"IPU:{field}:{iso3}:{values[field]}",
            evidence_status="official",
            metadata={field: values[field], "ipu_field": candidate.source_indicator_code},
        ) for iso3, values in sorted(parsed.items()) if field in values]
        if len(rows) < candidate.rule.min_coverage:
            raise RuntimeError(f"IPU Parline {field} resolved only {len(rows)} countries; expected at least {candidate.rule.min_coverage}.")
        return rows

    def category_id(self, candidate: CandidateDefinition) -> str:
        if candidate.rule.key == "recent-independence":
            return "history:ipu-recent-independence"
        return "history:ipu-universal-womens-suffrage"


def _warehouse() -> SupabaseWarehouse:
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.")
    return SupabaseWarehouse(url, key)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import source-audited historical GeoStats categories.")
    parser.add_argument("--source", choices=("all", "unmembership", "constitute", "ipu"), default="all")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--un-input")
    parser.add_argument("--constitute-input")
    parser.add_argument("--ipu-input")
    parser.add_argument("--require-complete", action="store_true", help="Fail if either selected source cannot import its category.")
    args = parser.parse_args(argv)
    warehouse = None if args.dry_run else _warehouse()
    importers: list[WarehouseImporter] = []
    if args.source in {"all", "unmembership"}:
        importers.append(UNMembershipImporter(warehouse, dry_run=args.dry_run, input_path=args.un_input))
    if args.source in {"all", "constitute"}:
        importers.append(ConstituteImporter(warehouse, dry_run=args.dry_run, input_path=args.constitute_input))
    if args.source in {"all", "ipu"}:
        importers.append(IPUHistoricalImporter(warehouse, dry_run=args.dry_run, input_path=args.ipu_input))
    failures = []
    for importer in importers:
        result = importer.run()
        print(result, flush=True)
        expected = 2 if importer.source_slug == "ipu" else 1
        if result.get("categories_processed") != expected or result.get("failures"):
            failures.append((importer.source_slug, result))
    if args.require_complete and failures:
        print(f"Historical import incomplete: {failures}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


if __name__ == "__main__":
    raise SystemExit(main())
