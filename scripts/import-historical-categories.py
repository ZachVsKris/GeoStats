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
from typing import Any, Iterable
from urllib.parse import quote

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name, country_alpha2_to_iso3, country_name_to_iso3
from data_pipeline.countries import normalize_iso3
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

UN_MEMBER_STATES_URL = "https://www.un.org/about-us/member-states"
UN_MEMBERSHIP_METHOD_URL = "https://www.un.org/en/about-us/about-un-membership"
CONSTITUTE_SERVICE_URL = "https://www.constituteproject.org/service/constitutions?lang=en&historic=false"
CONSTITUTE_CONSTITUTIONS_URL = "https://www.constituteproject.org/constitutions"
CONSTITUTE_DATA_URL = "https://www.constituteproject.org/content/data"
IPU_API_URL = "https://api.data.ipu.org/v1/parliaments?fields=date_of_independence%2Csuffrage%2Ccountry_code%2Cparliament%2Cparliament_country&page%5Bnumber%5D=1&page%5Bsize%5D=1000000"
IPU_COMPARE_URL = "https://data.ipu.org/compare/"
IPU_DATA_DICTIONARY_URL = "https://data.ipu.org/data-dictionary/"
WORLD_BANK_API_TEMPLATE = "https://api.worldbank.org/v2/country/all/indicator/{code}?format=json&per_page=20000&date=1960:{end_year}"
WORLD_BANK_INDICATOR_PAGE = "https://data.worldbank.org/indicator/{code}"
WORLD_BANK_METADATA_PAGE = "https://databank.worldbank.org/metadataglossary/world-development-indicators/series/{code}"
SNAPSHOT_YEAR = datetime.now(timezone.utc).year


def _mark_defined_subset(candidate: CandidateDefinition, rows: list[SourceObservation], rule: str, excluded_reason: str) -> None:
    """Declare the exact source-defined ranked population for a historical category.

    This is not a coverage waiver: WarehouseImporter.validate_eligible_universe
    requires the common-year snapshot to contain every declared ISO3 code.
    """
    ids = sorted({row.country_iso3 for row in rows})
    candidate.metadata.update({
        "eligible_universe_type": "defined_subset",
        "eligible_universe_rule": rule,
        "eligible_country_count": len(ids),
        "eligible_country_iso3": ids,
        "excluded_country_reason": excluded_reason,
    })


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
        country_id = str(row.get("country_id") or "").strip()
        country_name = str(row.get("country") or "").strip()
        year_raw = row.get("year_enacted")
        if (not country_id and not country_name) or year_raw is None or not re.fullmatch(r"\d{4}", str(year_raw).strip()):
            continue
        # Constitute's documented country_id is a stable identifier and is much
        # closer to a canonical country name than many formal ``country`` labels
        # (for example, "Afghanistan" vs "The Islamic Republic of Afghanistan").
        iso3 = country_name_to_iso3(country_id) or country_name_to_iso3(country_name)
        if not iso3:
            continue
        year = int(str(year_raw).strip())
        record_id = str(row.get("id") or f"{country_id or country_name}:{year}")
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
        self.http = HttpClient(timeout=120, retries=5, user_agent="GeoStats/16.2.4 historical importer")
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
                "official_unit": "admission date",
                "measurementType": "historical_date",
                "historicalValueFormat": "date",
                "showObservationYear": False,
                "referenceLabel": "Current UN membership",
                "minimum_year": SNAPSHOT_YEAR,
                "dataset_release": f"UN Member States snapshot {SNAPSHOT_YEAR}",
                "retrieved_at": datetime.now(timezone.utc).isoformat(),
                "derivation_method": "Parse the official UN Member States list and encode each admission date as YYYYMMDD for chronological ranking.",
                "derivation_version": "geostats-v16.2.4-un-membership-v1",
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
        _mark_defined_subset(
            candidate, rows,
            "Current United Nations Member States listed by the official UN Member States directory.",
            "Palestine and the Holy See are in the GeoStats sovereign universe but are not current UN Member States, so they are outside this chronology.",
        )
        return rows

    def category_id(self, candidate: CandidateDefinition) -> str:
        return "history:un-admission"


class ConstituteImporter(WarehouseImporter):
    source_organization = "Constitute Project"
    source_dataset = "Constitute in-force constitutions"
    source_slug = "constitute"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False, input_path: str | None = None) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.http = HttpClient(timeout=120, retries=5, user_agent="GeoStats/16.2.4 historical importer")
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
                "derivation_version": "geostats-v16.2.4-constitute-v3",
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
        # Constitute does not currently resolve one unambiguous in-force record
        # for every GeoStats sovereign. Treat the documented, fully observed
        # records as the legitimate ranked universe instead of pretending the
        # missing countries have synthetic dates. This is especially important
        # for a lowest-wins chronology, where missing early dates could corrupt
        # the global ranking.
        _mark_defined_subset(
            candidate, rows,
            "Current countries for which Constitute resolves exactly one unambiguous constitution explicitly marked in_force=true.",
            "Countries without exactly one unambiguous current in-force Constitute record are outside this chronology rather than assigned a synthetic enactment year.",
        )
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
        # Current Parline responses identify the country with ISO alpha-2 in
        # attributes.parliament_country.value (and the Parliament row id).
        # Keep country_name support as a compatibility fallback for fixtures and
        # any older API responses.
        parliament_country = attrs.get("parliament_country") if isinstance(attrs.get("parliament_country"), dict) else {}
        alpha2 = str(parliament_country.get("value") or row.get("id") or "").strip()
        iso3 = country_alpha2_to_iso3(alpha2)

        if not iso3:
            country_attr = attrs.get("country_name") if isinstance(attrs.get("country_name"), dict) else {}
            country_value = country_attr.get("value")
            if isinstance(country_value, dict):
                country_name = str(country_value.get("en") or next(iter(country_value.values()), "")).strip()
            else:
                country_name = str(country_value or "").strip()
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
        self.http = HttpClient(timeout=120, retries=5, user_agent="GeoStats/16.2.4 historical importer")
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
                    "derivation_version": "geostats-v16.2.4-ipu-independence-v2", "input_datasets": [IPU_API_URL],
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
                    "derivation_version": "geostats-v16.2.4-ipu-suffrage-v2", "input_datasets": [IPU_API_URL],
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
        if field == "independence":
            rule = "Countries for which IPU Parline defines a date_of_independence under its post-1940 country-history field."
            excluded = "Countries outside IPU's post-1940 independence field are not part of this ranked chronology."
        else:
            rule = "Countries with an IPU Parline national suffrage record explicitly classified as universal; use the earliest such year per country."
            excluded = "Countries without an explicit IPU national-universal suffrage record are outside this source-defined ranked subset, not assigned a synthetic date."
        _mark_defined_subset(candidate, rows, rule, excluded)
        return rows

    def category_id(self, candidate: CandidateDefinition) -> str:
        if candidate.rule.key == "recent-independence":
            return "history:ipu-recent-independence"
        return "history:ipu-universal-womens-suffrage"



WORLD_BANK_MILESTONE_SPECS = (
    {
        "key": "majority-urban",
        "category_id": "history:worldbank-majority-urban",
        "title": "Most recently became majority urban",
        "description": "Most recent year a country crossed from below 50% to at least 50% urban population in consecutive World Bank observations.",
        "plain": "Year the country most recently crossed the point where at least half of its population lived in urban areas.",
        "technical": "First consecutive-year crossing of SP.URB.TOTL.IN.ZS from below 50 to at least 50; countries already above 50 at their first observation are omitted.",
        "code": "SP.URB.TOTL.IN.ZS",
        "source_name": "Urban population (% of total population)",
        "threshold": 50.0,
        "crossing_direction": "up",
        "unit_explanation": "Year urban population first reached 50%",
        "icon": "🏙️",
        "min_coverage": 45,
        "knowledgeCluster": "urbanization-history",
    },
    {
        "key": "internet-half",
        "category_id": "history:worldbank-internet-half",
        "title": "Most recently reached 50% internet use",
        "description": "Most recent year a country crossed from below 50% to at least 50% of people using the internet in consecutive World Bank observations.",
        "plain": "Year internet use first reached at least half of the population.",
        "technical": "First consecutive-year crossing of IT.NET.USER.ZS from below 50 to at least 50; left-censored countries are omitted.",
        "code": "IT.NET.USER.ZS",
        "source_name": "Individuals using the Internet (% of population)",
        "threshold": 50.0,
        "crossing_direction": "up",
        "unit_explanation": "Year internet use first reached 50%",
        "icon": "🌐",
        "min_coverage": 80,
        "knowledgeCluster": "internet-adoption-history",
    },
    {
        "key": "electricity-half",
        "category_id": "history:worldbank-electricity-half",
        "title": "Most recently reached 50% electricity access",
        "description": "Most recent year a country crossed from below 50% to at least 50% electricity access in consecutive World Bank observations.",
        "plain": "Year electricity access first reached at least half of the population.",
        "technical": "First consecutive-year crossing of EG.ELC.ACCS.ZS from below 50 to at least 50; left-censored countries are omitted.",
        "code": "EG.ELC.ACCS.ZS",
        "source_name": "Access to electricity (% of population)",
        "threshold": 50.0,
        "crossing_direction": "up",
        "unit_explanation": "Year electricity access first reached 50%",
        "icon": "💡",
        "min_coverage": 35,
        "knowledgeCluster": "electricity-access-history",
    },
    {
        "key": "life-expectancy-70",
        "category_id": "history:worldbank-life-expectancy-70",
        "title": "Most recently reached 70-year life expectancy",
        "description": "Most recent year a country crossed from below 70 to at least 70 years of life expectancy in consecutive World Bank observations.",
        "plain": "Year life expectancy first reached at least 70 years.",
        "technical": "First consecutive-year crossing of SP.DYN.LE00.IN from below 70 to at least 70; left-censored countries are omitted.",
        "code": "SP.DYN.LE00.IN",
        "source_name": "Life expectancy at birth, total (years)",
        "threshold": 70.0,
        "crossing_direction": "up",
        "unit_explanation": "Year life expectancy first reached 70 years",
        "icon": "🫀",
        "min_coverage": 55,
        "knowledgeCluster": "longevity-history",
    },
    {
        "key": "fertility-below-3",
        "category_id": "history:worldbank-fertility-below-3",
        "title": "Most recently fell below 3 births per woman",
        "description": "Most recent year a country's total fertility rate crossed from at least 3 to below 3 births per woman in consecutive World Bank observations.",
        "plain": "Year the fertility rate first fell below 3 births per woman.",
        "technical": "First consecutive-year downward crossing of SP.DYN.TFRT.IN from at least 3 to below 3; left-censored countries are omitted.",
        "code": "SP.DYN.TFRT.IN",
        "source_name": "Fertility rate, total (births per woman)",
        "threshold": 3.0,
        "crossing_direction": "down",
        "unit_explanation": "Year fertility first fell below 3 births per woman",
        "icon": "👶",
        "min_coverage": 70,
        "knowledgeCluster": "fertility-transition-history",
    },
    {
        "key": "under-five-mortality-below-50",
        "category_id": "history:worldbank-under-five-mortality-below-50",
        "title": "Most recently cut under-five mortality below 50",
        "description": "Most recent year under-five mortality crossed from at least 50 to below 50 deaths per 1,000 live births in consecutive World Bank observations.",
        "plain": "Year under-five mortality first fell below 50 deaths per 1,000 live births.",
        "technical": "First consecutive-year downward crossing of SH.DYN.MORT from at least 50 to below 50; left-censored countries are omitted.",
        "code": "SH.DYN.MORT",
        "source_name": "Mortality rate, under-5 (per 1,000 live births)",
        "threshold": 50.0,
        "crossing_direction": "down",
        "unit_explanation": "Year under-five mortality first fell below 50 per 1,000",
        "icon": "🧒",
        "min_coverage": 75,
        "knowledgeCluster": "child-survival-history",
    },
    {
        "key": "infant-mortality-below-25",
        "category_id": "history:worldbank-infant-mortality-below-25",
        "title": "Most recently cut infant mortality below 25",
        "description": "Most recent year infant mortality crossed from at least 25 to below 25 deaths per 1,000 live births in consecutive World Bank observations.",
        "plain": "Year infant mortality first fell below 25 deaths per 1,000 live births.",
        "technical": "First consecutive-year downward crossing of SP.DYN.IMRT.IN from at least 25 to below 25; left-censored countries are omitted.",
        "code": "SP.DYN.IMRT.IN",
        "source_name": "Mortality rate, infant (per 1,000 live births)",
        "threshold": 25.0,
        "crossing_direction": "down",
        "unit_explanation": "Year infant mortality first fell below 25 per 1,000",
        "icon": "🍼",
        "min_coverage": 65,
        "knowledgeCluster": "infant-survival-history",
    },
    {
        "key": "mobile-subscriptions-50",
        "category_id": "history:worldbank-mobile-subscriptions-50",
        "title": "Most recently reached 50 mobile subscriptions per 100 people",
        "description": "Most recent year mobile subscriptions crossed from below 50 to at least 50 per 100 people in consecutive World Bank observations.",
        "plain": "Year mobile subscriptions first reached 50 per 100 people.",
        "technical": "First consecutive-year upward crossing of IT.CEL.SETS.P2 from below 50 to at least 50; left-censored countries are omitted.",
        "code": "IT.CEL.SETS.P2",
        "source_name": "Mobile cellular subscriptions (per 100 people)",
        "threshold": 50.0,
        "crossing_direction": "up",
        "unit_explanation": "Year mobile subscriptions first reached 50 per 100 people",
        "icon": "📱",
        "min_coverage": 100,
        "knowledgeCluster": "mobile-adoption-history",
    },
)


def parse_world_bank_series(payload: Any) -> dict[str, dict[int, float]]:
    """Return annual World Bank values for current GeoStats countries only."""
    rows = payload[1] if isinstance(payload, list) and len(payload) > 1 and isinstance(payload[1], list) else []
    result: dict[str, dict[int, float]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        iso3 = normalize_iso3(row.get("countryiso3code"))
        if not iso3 or row.get("value") is None:
            continue
        try:
            year = int(row.get("date"))
            value = float(row.get("value"))
        except (TypeError, ValueError):
            continue
        result.setdefault(iso3, {})[year] = value
    return result


def observed_threshold_crossing_years(
    series: dict[str, dict[int, float]],
    threshold: float,
    direction: str = "up",
) -> dict[str, int]:
    """Find exact annual threshold crossings without inventing dates across gaps.

    ``up`` includes only a year Y where Y is >= threshold and Y-1 is present
    and below it. ``down`` is the mirror image: Y is below threshold and Y-1
    is present and >= it. Countries already beyond the threshold at their first
    source observation are left-censored and intentionally omitted.
    """
    if direction not in {"up", "down"}:
        raise ValueError(f"Unsupported crossing direction: {direction}")
    crossings: dict[str, int] = {}
    for iso3, values in series.items():
        for year in sorted(values):
            previous = values.get(year - 1)
            if previous is None:
                continue
            current = values[year]
            crossed = (current >= threshold and previous < threshold) if direction == "up" else (current < threshold and previous >= threshold)
            if crossed:
                crossings[iso3] = year
                break
    return crossings


class WorldBankHistoricalMilestonesImporter(WarehouseImporter):
    source_organization = "World Bank"
    source_dataset = "World Development Indicators: historical threshold milestones"
    source_slug = "worldbankhistory"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False, payloads: dict[str, Any] | None = None) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.http = HttpClient(timeout=180, retries=5, user_agent="GeoStats/16.2.4 historical milestone importer")
        self.payloads = payloads or {}
        self._series: dict[str, dict[str, dict[int, float]]] = {}

    def _load_series(self, code: str) -> dict[str, dict[int, float]]:
        if code in self._series:
            return self._series[code]
        payload = self.payloads.get(code)
        if payload is None:
            url = WORLD_BANK_API_TEMPLATE.format(code=quote(code, safe=""), end_year=SNAPSHOT_YEAR)
            payload = self.http.get_json(url)
        self._series[code] = parse_world_bank_series(payload)
        return self._series[code]

    def discover(self) -> list[CandidateDefinition]:
        now = datetime.now(timezone.utc).isoformat()
        candidates: list[CandidateDefinition] = []
        for spec in WORLD_BANK_MILESTONE_SPECS:
            code = str(spec["code"])
            rule = IndicatorRule(
                key=str(spec["key"]),
                title=str(spec["title"]),
                description=str(spec["description"]),
                plain_language_description=str(spec["plain"]),
                technical_definition=str(spec["technical"]),
                unit_explanation=str(spec["unit_explanation"]),
                family="History",
                icon=str(spec["icon"]),
                unit="milestone year",
                value_type="other",
                ranking_direction="high",
                include=(),
                min_coverage=int(spec["min_coverage"]),
                evidence_tier="A",
                source_priority=8,
                specificity_score=98,
                recognizability_score=96,
                understandability_score=98,
                fun_score=94,
            )
            candidates.append(CandidateDefinition(
                rule=rule,
                source_indicator_code=f"MILESTONE:{code}:{float(spec['threshold']):g}",
                source_indicator_name=f"Historical threshold crossing derived from {code}",
                source_url=WORLD_BANK_INDICATOR_PAGE.format(code=code),
                metadata={
                    "source_page_url": WORLD_BANK_INDICATOR_PAGE.format(code=code),
                    "methodology_url": WORLD_BANK_METADATA_PAGE.format(code=code),
                    "api_url": WORLD_BANK_API_TEMPLATE.format(code=code, end_year=SNAPSHOT_YEAR),
                    "underlying_indicator_name": spec["source_name"],
                    "source_query": {
                        "indicator": code,
                        "threshold": spec["threshold"],
                        "crossing_direction": spec.get("crossing_direction", "up"),
                        "crossing_rule": (
                            "Y >= threshold and Y-1 < threshold; consecutive annual observations required"
                            if spec.get("crossing_direction", "up") == "up"
                            else "Y < threshold and Y-1 >= threshold; consecutive annual observations required"
                        ),
                    },
                    "official_unit": "milestone year",
                    "measurementType": "historical_date",
                    "historicalValueFormat": "year",
                    "showObservationYear": False,
                    "referenceLabel": "World Development Indicators historical series",
                    "minimum_year": SNAPSHOT_YEAR,
                    "dataset_release": f"World Development Indicators retrieved {SNAPSHOT_YEAR}",
                    "retrieved_at": now,
                    "derivation_method": "Find the first exact consecutive-year threshold crossing; omit left-censored and never-crossed countries; rank the observed crossing years from most recent to oldest.",
                    "derivation_version": "geostats-v16.2.7-world-bank-milestones-v2",
                    "broadDomain": "history",
                    "knowledgeCluster": spec["knowledgeCluster"],
                    "strategyFamily": str(spec["key"]),
                },
            ))
        return candidates

    def category_id(self, candidate: CandidateDefinition) -> str:
        for spec in WORLD_BANK_MILESTONE_SPECS:
            if spec["key"] == candidate.rule.key:
                return str(spec["category_id"])
        raise KeyError(candidate.rule.key)

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        spec = next(item for item in WORLD_BANK_MILESTONE_SPECS if item["key"] == candidate.rule.key)
        code = str(spec["code"])
        direction = str(spec.get("crossing_direction", "up"))
        crossings = observed_threshold_crossing_years(self._load_series(code), float(spec["threshold"]), direction)
        rows = [SourceObservation(
            country_iso3=iso3,
            country_name=canonical_country_name(iso3),
            data_year=SNAPSHOT_YEAR,
            value=float(year),
            source_url=WORLD_BANK_INDICATOR_PAGE.format(code=code),
            source_record_id=f"WDI:{code}:{iso3}:crossing:{year}",
            evidence_status="official",
            metadata={"indicator": code, "threshold": spec["threshold"], "crossing_direction": direction, "crossing_year": year},
        ) for iso3, year in sorted(crossings.items())]
        if len(rows) < candidate.rule.min_coverage:
            raise RuntimeError(
                f"World Bank {code} produced only {len(rows)} exact consecutive-year milestone crossings; "
                f"{candidate.rule.min_coverage} are required."
            )
        _mark_defined_subset(
            candidate, rows,
            f"Countries with an observed exact consecutive-year {direction} crossing of {code} at {float(spec['threshold']):g}; left-censored and never-crossed countries are excluded.",
            "No exact observed threshold-crossing year exists under the published derivation rule; no synthetic or censored date is assigned.",
        )
        return rows

def _warehouse() -> SupabaseWarehouse:
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.")
    return SupabaseWarehouse(url, key)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import source-audited historical GeoStats categories.")
    parser.add_argument("--source", choices=("all", "unmembership", "constitute", "ipu", "worldbankhistory"), default="all")
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
    if args.source in {"all", "worldbankhistory"}:
        importers.append(WorldBankHistoricalMilestonesImporter(warehouse, dry_run=args.dry_run))
    failures = []
    for importer in importers:
        result = importer.run()
        print(result, flush=True)
        expected = 2 if importer.source_slug == "ipu" else (len(WORLD_BANK_MILESTONE_SPECS) if importer.source_slug == "worldbankhistory" else 1)
        if result.get("categories_processed") != expected or result.get("failures"):
            failures.append((importer.source_slug, result))
    if args.require_complete and failures:
        print(f"Historical import incomplete: {failures}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
