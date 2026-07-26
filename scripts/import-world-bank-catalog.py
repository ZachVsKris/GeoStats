#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
import os
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

from data_pipeline.base import WarehouseImporter
from data_pipeline.countries import normalize_iso3
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

CATALOG_URL = "https://api.worldbank.org/v2/indicator?format=json&per_page=25000"
INDICATOR_PAGE = "https://data.worldbank.org/indicator/{code}"
API_TEMPLATE = "https://api.worldbank.org/v2/country/all/indicator/{code}?format=json&per_page=20000&date={start}:{end}"
METADATA_TEMPLATE = "https://databank.worldbank.org/metadataglossary/world-development-indicators/series/{code}"
LICENSE_URL = "https://datacatalog.worldbank.org/public-licenses"
CURRENT_YEAR = datetime.now(timezone.utc).year

SUBJECTIVE_OR_COMPOSITE = re.compile(
    r"happiness|perception|democracy|freedom|peace index|prosperity|competitiveness|governance indicator|"
    r"voice and accountability|political stability|rule of law|control of corruption|government effectiveness|"
    r"regulatory quality|ease of doing business|human development index|composite (?:score|index)|expert assessment|ranking score",
    re.I,
)
UNSUITABLE = re.compile(
    r"metadata|footnote|survey mean|standard error|confidence interval|sample size|number of observations|"
    r"quintile|decile|percentile|male to female ratio of|female to male ratio of|location code|classification code|\bindex\b|\bscore\b",
    re.I,
)
TECHNICAL = re.compile(
    r"\b(?:PPP conversion factor|net barter|dependency ratio|gross capital formation|broad money|"
    r"labor underutilization|DALY|HALE|constant LCU|current LCU|Atlas method|maternal mortality|gross enrollment|net enrollment|\bGNI\b|value added|current account|debt service|terms of trade|capital formation|broad money)\b",
    re.I,
)

FAMILY_MAP = {
    "Agriculture & Rural Development": ("Agriculture", "🌾"),
    "Aid Effectiveness": ("Economy", "💰"),
    "Climate Change": ("Climate", "🌦️"),
    "Economy & Growth": ("Economy", "💰"),
    "Education": ("Education", "🎓"),
    "Energy & Mining": ("Energy", "⚡"),
    "Environment": ("Environment", "🌍"),
    "External Debt": ("Economy", "💳"),
    "Financial Sector": ("Economy", "🏦"),
    "Gender": ("Population", "👥"),
    "Health": ("Health", "⚕️"),
    "Infrastructure": ("Infrastructure", "🏗️"),
    "Labor & Social Protection": ("Labor", "👷"),
    "Poverty": ("Economy", "💵"),
    "Private Sector": ("Economy", "🏭"),
    "Public Sector": ("Government", "🏛️"),
    "Science & Technology": ("Technology", "💻"),
    "Social Development": ("Population", "👥"),
    "Trade": ("Trade", "📦"),
    "Urban Development": ("Infrastructure", "🏙️"),
}


def _rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list) and len(payload) > 1 and isinstance(payload[1], list):
        return [row for row in payload[1] if isinstance(row, dict)]
    if isinstance(payload, dict):
        for key in ("data", "results", "items"):
            if isinstance(payload.get(key), list):
                return [row for row in payload[key] if isinstance(row, dict)]
    return []


def _text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _slug(code: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", code.lower()).strip("-")


def _first_sentence(value: str, fallback: str) -> str:
    text = _text(value)
    if not text:
        return fallback.rstrip(".") + "."
    sentence = re.split(r"(?<=[.!?])\s+", text, maxsplit=1)[0]
    if len(sentence) > 210:
        sentence = sentence[:207].rsplit(" ", 1)[0] + "…"
    return sentence


def _unit_and_type(name: str, unit: str) -> tuple[str, str]:
    haystack = f"{name} {unit}".lower()
    cleaned = unit or "reported value"
    if "%" in haystack or "percent" in haystack or "share of" in haystack:
        return (unit or "%", "percentage")
    if "per capita" in haystack or "per person" in haystack:
        return (unit or "per person", "per_capita")
    if re.search(r"per (?:1,?000|100,?000|million)| mortality rate| incidence| prevalence| rate", haystack):
        return (unit or "rate", "rate")
    if re.search(r"index|score", haystack):
        return (unit or "index value", "index")
    return (cleaned, "total")


def _player_title(name: str, value_type: str) -> str:
    clean = re.sub(r"\s*\([^)]*\)\s*$", "", _text(name)).strip()
    if re.match(r"^(highest|lowest|largest|most|fastest)\b", clean, re.I):
        return clean
    lower = clean.lower()
    if any(token in lower for token in ("growth", "annual change", "increase")):
        prefix = "Fastest"
    elif value_type == "total" and any(token in lower for token in (
        "population", "area", "production", "output", "exports", "imports", "number of", "volume", "value added",
    )):
        prefix = "Largest"
    else:
        prefix = "Highest"
    return f"{prefix} {clean[0].lower() + clean[1:] if clean else 'reported value'}"


def _family(row: dict[str, Any]) -> tuple[str, str]:
    topics = row.get("topics")
    if isinstance(topics, list):
        for topic in topics:
            label = _text(topic.get("value") if isinstance(topic, dict) else topic)
            if label in FAMILY_MAP:
                return FAMILY_MAP[label]
    return ("Development", "📊")


def _scores(name: str, note: str) -> tuple[int, int]:
    words = re.findall(r"[A-Za-z0-9]+", name)
    understandability = 92
    if len(words) > 12:
        understandability -= 12
    if TECHNICAL.search(name):
        understandability -= 30
    if re.search(r"\b[A-Z]{3,}\b", name):
        understandability -= 10
    if len(note) > 500:
        understandability -= 4
    fun = 78
    if TECHNICAL.search(name):
        fun -= 30
    if re.search(r"population|birth|death|life expectancy|forest|water|electricity|trade|food|school|internet|road|air|rail|energy", name, re.I):
        fun += 10
    return max(30, min(100, understandability)), max(25, min(100, fun))


class WorldBankCatalogImporter(WarehouseImporter):
    source_organization = "World Bank"
    source_dataset = "World Development Indicators"
    source_slug = "worldbank"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.http = HttpClient(timeout=120, retries=5, user_agent="GeoStats/14.0 World-Bank catalog importer")

    def discover(self) -> list[CandidateDefinition]:
        catalog = _rows(self.http.get_json(CATALOG_URL))
        candidates: list[CandidateDefinition] = []
        for row in catalog:
            code = _text(row.get("id"))
            name = _text(row.get("name"))
            source = row.get("source") if isinstance(row.get("source"), dict) else {}
            source_id = _text(source.get("id"))
            source_name = _text(source.get("value"))
            if not code or not name:
                continue
            # WDI is source 2. Some API responses omit the id but retain the name.
            if source_id not in ("", "2") and "World Development Indicators" not in source_name:
                continue
            if SUBJECTIVE_OR_COMPOSITE.search(name) or UNSUITABLE.search(name):
                continue
            raw_unit = _text(row.get("unit"))
            unit, value_type = _unit_and_type(name, raw_unit)
            family, icon = _family(row)
            note = _text(row.get("sourceNote") or row.get("source_note"))
            description = _first_sentence(note, f"{name}, reported using the World Bank indicator definition")
            understandability, fun = _scores(name, note)
            exact_api = API_TEMPLATE.format(code=quote(code, safe=""), start=2022, end=CURRENT_YEAR)
            candidates.append(CandidateDefinition(
                rule=IndicatorRule(
                    key=f"wb-{_slug(code)}",
                    title=_player_title(name, value_type),
                    description=description,
                    plain_language_description=description,
                    technical_definition=note or name,
                    unit_explanation=unit,
                    family=family,
                    icon=icon,
                    unit=unit,
                    value_type=value_type,  # type: ignore[arg-type]
                    ranking_direction="high",
                    include=(code,),
                    min_coverage=100,
                    evidence_tier="B",
                    source_priority=11,
                    specificity_score=88,
                    recognizability_score=understandability,
                    understandability_score=understandability,
                    fun_score=fun,
                    objective_status="objective",
                ),
                source_indicator_code=code,
                source_indicator_name=name,
                source_url=INDICATOR_PAGE.format(code=quote(code, safe="")),
                metadata={
                    "source_page_url": INDICATOR_PAGE.format(code=quote(code, safe="")),
                    "exact_query_url": exact_api,
                    "api_url": exact_api,
                    "methodology_url": METADATA_TEMPLATE.format(code=quote(code, safe="")),
                    "source_query": {"indicator": code, "country": "all", "date": f"2022:{CURRENT_YEAR}"},
                    "dataset_release": f"World Development Indicators catalog retrieved {datetime.now(timezone.utc).date().isoformat()}",
                    "retrieved_at": datetime.now(timezone.utc).isoformat(),
                    "license_name": "World Bank Dataset Terms of Use",
                    "license_url": LICENSE_URL,
                    "source_indicator_name": name,
                    "source_note": note,
                    "catalog_source_id": source_id,
                    "catalog_source_name": source_name,
                    "auto_discovered": True,
                },
            ))
        # Do not create a second warehouse row for indicators already handled by
        # the hand-curated World Bank library. New catalog indicators still enter
        # as candidates and must pass every v14 gate.
        if self.warehouse is not None and not self.dry_run:
            existing_codes = self.warehouse.list_source_indicator_codes(self.source_organization)
            candidates = [candidate for candidate in candidates if candidate.source_indicator_code not in existing_codes]
        # Stable order makes limited/incremental imports reproducible.
        return sorted(candidates, key=lambda candidate: candidate.source_indicator_code)

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        url = API_TEMPLATE.format(code=quote(candidate.source_indicator_code, safe=""), start=2022, end=CURRENT_YEAR)
        rows = _rows(self.http.get_json(url))
        observations: list[SourceObservation] = []
        seen: dict[tuple[str, int], float] = {}
        for row in rows:
            iso3 = normalize_iso3(row.get("countryiso3code"))
            if not iso3:
                continue
            try:
                year = int(row.get("date"))
                value = float(row.get("value"))
            except (TypeError, ValueError):
                continue
            if year < 2022 or not math.isfinite(value):
                continue
            key = (iso3, year)
            if key in seen and abs(seen[key] - value) > 1e-9:
                raise RuntimeError(f"Contradictory World Bank values for {candidate.source_indicator_code} {iso3} {year}.")
            seen[key] = value
            country = row.get("country") if isinstance(row.get("country"), dict) else {}
            observations.append(SourceObservation(
                country_iso3=iso3,
                country_name=_text(country.get("value")) or iso3,
                data_year=year,
                value=value,
                source_url=candidate.source_url,
                source_record_id=f"{candidate.source_indicator_code}:{iso3}:{year}",
                evidence_status="unknown",
                metadata={
                    "api_url": url,
                    "indicator": candidate.source_indicator_code,
                    "source_record": row.get("obs_status") or row.get("decimal"),
                },
            ))
        if not observations:
            raise RuntimeError(f"No 2022-current country observations for {candidate.source_indicator_code}.")
        return observations

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"worldbank-catalog:{_slug(candidate.source_indicator_code)}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import a broad objective World Development Indicators candidate catalog.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=500, help="Maximum candidates per run; use 0 for all discovered candidates.")
    parser.add_argument("--rule", action="append", default=[])
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    warehouse: SupabaseWarehouse | None = None
    if not args.dry_run:
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
        if not url or not key:
            raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.")
        warehouse = SupabaseWarehouse(url, key)
    limit = None if args.limit == 0 else args.limit
    result = WorldBankCatalogImporter(warehouse, dry_run=args.dry_run).run(limit=limit, only_keys=set(args.rule) or None)
    print(result, flush=True)
    return 1 if result["failures"] and result["categories_processed"] == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
