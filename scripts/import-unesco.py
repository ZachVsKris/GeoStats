#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
import os
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote, urlencode

from data_pipeline.base import WarehouseImporter
from data_pipeline.countries import normalize_iso3
from data_pipeline.http import JsonHttpClient
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

UIS_API = "https://api.uis.unesco.org/api/public"
UIS_DOCS = "https://api.uis.unesco.org/api/public/documentation/"
UIS_BROWSER = "https://databrowser.uis.unesco.org/"


def _patterns(value: tuple[str, ...] | str, *, field: str, key: str) -> tuple[str, ...]:
    patterns = (value,) if isinstance(value, str) else tuple(value)
    for pattern in patterns:
        try:
            re.compile(pattern, re.IGNORECASE)
        except re.error as exc:
            raise ValueError(f"Invalid {field} regex for {key}: {pattern!r}: {exc}") from exc
    return patterns


def rule(
    key: str,
    title: str,
    family: str,
    icon: str,
    unit: str,
    value_type: str,
    direction: str,
    include: tuple[str, ...] | str,
    *,
    prefer: tuple[str, ...] | str = (),
    exclude: tuple[str, ...] | str = (),
    min_coverage: int = 70,
    evidence: str = "A",
    specificity: int = 90,
    recognizability: int = 90,
) -> IndicatorRule:
    return IndicatorRule(
        key=key,
        title=title,
        description=f"{title} according to the UNESCO Institute for Statistics.",
        family=family,
        icon=icon,
        unit=unit,
        value_type=value_type,  # type: ignore[arg-type]
        ranking_direction=direction,  # type: ignore[arg-type]
        include=_patterns(include, field="include", key=key),
        prefer=_patterns(prefer, field="prefer", key=key),
        exclude=_patterns(exclude, field="exclude", key=key),
        min_coverage=min_coverage,
        evidence_tier=evidence,  # type: ignore[arg-type]
        source_priority=12,
        specificity_score=specificity,
        recognizability_score=recognizability,
    )


COMMON_EXCLUDES = (
    r"\bmale\b|\bfemale\b|boys|girls|gender parity|wealth quintile|rural|urban|disability|immigrant|native-born",
    r"private institutions|public institutions|official school age population|number of pupils|number of students|number of teachers",
    r"benchmark|target|adjusted gender parity|coefficient of variation|percentage point gap",
)

RULES: tuple[IndicatorRule, ...] = (
    rule("highest-adult-literacy", "Highest adult literacy rate", "Education", "📖", "% of adults", "percentage", "high", (r"adult literacy rate",), prefer=(r"population aged 15 years and older|15\+",), exclude=COMMON_EXCLUDES, min_coverage=80),
    rule("highest-youth-literacy", "Highest youth literacy rate", "Education", "📚", "% of youth", "percentage", "high", (r"youth literacy rate",), prefer=(r"15.?24",), exclude=COMMON_EXCLUDES, min_coverage=80),
    rule("highest-primary-completion", "Highest primary-school completion rate", "Education", "🎓", "% of students", "percentage", "high", (r"completion rate", r"primary"), exclude=COMMON_EXCLUDES + (r"lower secondary|upper secondary",), min_coverage=90),
    rule("highest-lower-secondary-completion", "Highest lower-secondary completion rate", "Education", "🎓", "% of students", "percentage", "high", (r"completion rate", r"lower secondary"), exclude=COMMON_EXCLUDES, min_coverage=80),
    rule("highest-upper-secondary-completion", "Highest upper-secondary completion rate", "Education", "🎓", "% of students", "percentage", "high", (r"completion rate", r"upper secondary"), exclude=COMMON_EXCLUDES, min_coverage=70),
    rule("highest-primary-enrollment", "Highest primary-school enrollment", "Education", "🏫", "gross enrollment ratio (%)", "percentage", "high", (r"gross enrolment ratio|gross enrollment ratio", r"primary"), exclude=COMMON_EXCLUDES + (r"pre-primary|secondary",), min_coverage=100),
    rule("highest-secondary-enrollment", "Highest secondary-school enrollment", "Education", "🏫", "gross enrollment ratio (%)", "percentage", "high", (r"gross enrolment ratio|gross enrollment ratio", r"secondary"), exclude=COMMON_EXCLUDES + (r"lower secondary|upper secondary|post-secondary",), min_coverage=90),
    rule("highest-tertiary-enrollment", "Highest tertiary enrollment", "Education", "🎓", "gross enrollment ratio (%)", "percentage", "high", (r"gross enrolment ratio|gross enrollment ratio", r"tertiary"), exclude=COMMON_EXCLUDES, min_coverage=90),
    rule("highest-preprimary-enrollment", "Highest pre-primary enrollment", "Education", "🧸", "gross enrollment ratio (%)", "percentage", "high", (r"gross enrolment ratio|gross enrollment ratio", r"pre-primary"), exclude=COMMON_EXCLUDES, min_coverage=80),
    rule("lowest-primary-out-of-school", "Lowest primary out-of-school rate", "Education", "🚸", "% of children", "percentage", "low", (r"out-of-school rate", r"primary"), exclude=COMMON_EXCLUDES + (r"lower secondary|upper secondary",), min_coverage=80),
    rule("lowest-lower-secondary-out-of-school", "Lowest lower-secondary out-of-school rate", "Education", "🚸", "% of adolescents", "percentage", "low", (r"out-of-school rate", r"lower secondary"), exclude=COMMON_EXCLUDES, min_coverage=70),
    rule("lowest-upper-secondary-out-of-school", "Lowest upper-secondary out-of-school rate", "Education", "🚸", "% of youth", "percentage", "low", (r"out-of-school rate", r"upper secondary"), exclude=COMMON_EXCLUDES, min_coverage=60),
    rule("lowest-primary-pupil-teacher-ratio", "Lowest primary pupil-teacher ratio", "Education", "👩‍🏫", "pupils per teacher", "rate", "low", (r"pupil.?teacher ratio", r"primary"), exclude=COMMON_EXCLUDES + (r"pre-primary|secondary",), min_coverage=90),
    rule("lowest-secondary-pupil-teacher-ratio", "Lowest secondary pupil-teacher ratio", "Education", "👩‍🏫", "students per teacher", "rate", "low", (r"pupil.?teacher ratio|student.?teacher ratio", r"secondary"), exclude=COMMON_EXCLUDES + (r"primary|tertiary",), min_coverage=70),
    rule("highest-trained-primary-teachers", "Highest share of trained primary teachers", "Education", "🧑‍🏫", "% of teachers", "percentage", "high", (r"trained teachers", r"primary"), exclude=COMMON_EXCLUDES + (r"pre-primary|secondary",), min_coverage=60),
    rule("highest-primary-survival", "Highest survival to the last grade of primary school", "Education", "🏁", "% of students", "percentage", "high", (r"survival rate", r"last grade", r"primary"), exclude=COMMON_EXCLUDES, min_coverage=60),
    rule("lowest-primary-repetition", "Lowest primary-school repetition rate", "Education", "🔁", "% of students", "percentage", "low", (r"repetition rate", r"primary"), exclude=COMMON_EXCLUDES + (r"secondary",), min_coverage=70),
    rule("highest-early-learning-participation", "Highest early-learning participation", "Education", "🧩", "% of children", "percentage", "high", (r"participation rate", r"organized learning"), exclude=COMMON_EXCLUDES, min_coverage=60),
    rule("highest-reading-proficiency-primary", "Highest primary reading proficiency", "Education", "📘", "% reaching minimum proficiency", "percentage", "high", (r"minimum proficiency", r"reading", r"end of primary|primary education"), exclude=COMMON_EXCLUDES + (r"lower secondary",), min_coverage=50, evidence="B"),
    rule("highest-math-proficiency-primary", "Highest primary mathematics proficiency", "Education", "➗", "% reaching minimum proficiency", "percentage", "high", (r"minimum proficiency", r"mathematics|math", r"end of primary|primary education"), exclude=COMMON_EXCLUDES + (r"lower secondary",), min_coverage=50, evidence="B"),
    rule("highest-reading-proficiency-lower-secondary", "Highest lower-secondary reading proficiency", "Education", "📗", "% reaching minimum proficiency", "percentage", "high", (r"minimum proficiency", r"reading", r"lower secondary"), exclude=COMMON_EXCLUDES, min_coverage=45, evidence="B"),
    rule("highest-math-proficiency-lower-secondary", "Highest lower-secondary mathematics proficiency", "Education", "📐", "% reaching minimum proficiency", "percentage", "high", (r"minimum proficiency", r"mathematics|math", r"lower secondary"), exclude=COMMON_EXCLUDES, min_coverage=45, evidence="B"),
    rule("highest-school-electricity", "Highest school electricity access", "Infrastructure", "⚡", "% of primary schools", "percentage", "high", (r"schools", r"electricity", r"primary"), exclude=COMMON_EXCLUDES + (r"lower secondary|upper secondary",), min_coverage=50),
    rule("highest-school-internet", "Highest school internet access", "Technology", "🌐", "% of primary schools", "percentage", "high", (r"schools", r"internet", r"primary"), exclude=COMMON_EXCLUDES + (r"lower secondary|upper secondary",), min_coverage=45),
    rule("highest-school-computers", "Highest school computer access", "Technology", "💻", "% of primary schools", "percentage", "high", (r"schools", r"computers|computer", r"primary"), exclude=COMMON_EXCLUDES + (r"lower secondary|upper secondary",), min_coverage=45),
    rule("highest-school-drinking-water", "Highest school drinking-water access", "Infrastructure", "🚰", "% of primary schools", "percentage", "high", (r"schools", r"drinking water", r"primary"), exclude=COMMON_EXCLUDES + (r"lower secondary|upper secondary",), min_coverage=50),
    rule("highest-school-sanitation", "Highest school sanitation access", "Infrastructure", "🚻", "% of primary schools", "percentage", "high", (r"schools", r"sanitation", r"primary"), exclude=COMMON_EXCLUDES + (r"lower secondary|upper secondary",), min_coverage=50),
    rule("highest-school-handwashing", "Highest school handwashing access", "Infrastructure", "🧼", "% of primary schools", "percentage", "high", (r"schools", r"handwashing", r"primary"), exclude=COMMON_EXCLUDES + (r"lower secondary|upper secondary",), min_coverage=45),
    rule("highest-education-spending-gdp", "Highest education spending share of GDP", "Government", "🏛️", "% of GDP", "percentage", "high", (r"government expenditure on education", r"percentage of gdp|% of gdp"), exclude=COMMON_EXCLUDES, min_coverage=70),
    rule("highest-education-budget-share", "Highest education share of government spending", "Government", "💰", "% of government spending", "percentage", "high", (r"government expenditure on education", r"total government expenditure"), exclude=COMMON_EXCLUDES, min_coverage=70),
    rule("highest-rd-spending", "Highest research-and-development spending", "Science", "🔬", "% of GDP", "percentage", "high", (r"research and development expenditure|gross domestic expenditure on r.?d", r"percentage of gdp|% of gdp"), exclude=COMMON_EXCLUDES, min_coverage=60),
    rule("most-researchers", "Most researchers per million people", "Science", "🧪", "per million people", "rate", "high", (r"researchers", r"per million"), exclude=COMMON_EXCLUDES + (r"female|headcount",), min_coverage=55),
    rule("most-rd-technicians", "Most R&D technicians per million people", "Science", "🧑‍🔬", "per million people", "rate", "high", (r"technicians", r"research and development|r.?d", r"per million"), exclude=COMMON_EXCLUDES, min_coverage=45),
    rule("highest-stem-graduate-share", "Highest STEM graduate share", "Education", "🧬", "% of graduates", "percentage", "high", (r"graduates", r"science.*technology.*engineering.*mathematics|stem", r"percentage|share"), exclude=COMMON_EXCLUDES + (r"number",), min_coverage=50),
    rule("highest-vocational-enrollment-share", "Highest vocational enrollment share", "Education", "🛠️", "% of secondary students", "percentage", "high", (r"vocational", r"secondary", r"percentage|share"), exclude=COMMON_EXCLUDES + (r"number",), min_coverage=55),
    rule("most-international-students-hosted", "Most international students hosted", "Education", "🌍", "students", "total", "high", (r"internationally mobile students", r"host|inbound|destination"), exclude=COMMON_EXCLUDES + (r"percentage|ratio",), min_coverage=50, specificity=82),
    rule("highest-outbound-student-mobility", "Highest outbound student mobility", "Education", "✈️", "% of tertiary students", "percentage", "high", (r"outbound mobility ratio|outbound mobile students.*percentage",), exclude=COMMON_EXCLUDES, min_coverage=55),
)

BAD_NAME = re.compile(
    r"\b(male|female|boys|girls|wealth|quintile|rural|urban|disability|immigrant|native-born|private institutions|public institutions|benchmark|target)\b",
    re.IGNORECASE,
)


def _records(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("records", "data", "items", "results", "value"):
        value = payload.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, dict)]
        if isinstance(value, dict):
            nested = _records(value)
            if nested:
                return nested
    return []


def _pick(row: dict[str, Any], *names: str) -> Any:
    lowered = {str(key).lower().replace("_", ""): value for key, value in row.items()}
    for name in names:
        if name in row:
            return row[name]
        normalized = name.lower().replace("_", "")
        if normalized in lowered:
            return lowered[normalized]
    return None


class UnescoImporter(WarehouseImporter):
    source_organization = "UNESCO UIS"
    source_dataset = "UIS Data Browser"
    source_slug = "unesco"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.http = JsonHttpClient(timeout=150, retries=5)
        self.country_names: dict[str, str] = {}
        self.national_entities: set[str] = set()

    def discover(self) -> list[CandidateDefinition]:
        catalog = _records(self.http.get_json(f"{UIS_API}/definitions/indicators"))
        entities = _records(self.http.get_json(f"{UIS_API}/definitions/geounits"))
        self._load_entities(entities)
        used: set[str] = set()
        discovered: list[CandidateDefinition] = []
        unmatched: list[str] = []
        for concept in RULES:
            ranked: list[tuple[int, dict[str, Any], str, str]] = []
            for row in catalog:
                code = str(_pick(row, "indicatorCode", "indicatorId", "indicator_id", "id", "code") or "").strip()
                name = str(_pick(row, "indicatorName", "indicator_name", "name", "label", "title") or "").strip()
                if not code or not name or code in used:
                    continue
                score = self._match_score(concept, name, row)
                if score is not None:
                    ranked.append((score, row, code, name))
            if not ranked:
                unmatched.append(concept.key)
                continue
            ranked.sort(key=lambda item: (-item[0], len(item[3]), item[3]))
            score, row, code, name = ranked[0]
            used.add(code)
            discovered.append(CandidateDefinition(
                rule=concept,
                source_indicator_code=code,
                source_indicator_name=name,
                source_url=f"{UIS_BROWSER}?indicator={quote(code, safe='')}",
                metadata={
                    "uis_catalog_match_score": score,
                    "uis_theme": _pick(row, "theme"),
                    "uis_last_update": _pick(row, "lastDataUpdate", "last_data_update"),
                    "uis_api_docs": UIS_DOCS,
                },
            ))
        print(f"Resolved {len(discovered)} UNESCO concepts; {len(unmatched)} unmatched.", flush=True)
        if unmatched:
            print("Unmatched UNESCO concepts: " + ", ".join(unmatched), flush=True)
        if catalog and not discovered:
            sample_keys = sorted({str(key) for row in catalog[:3] for key in row.keys()})
            raise RuntimeError(
                "UNESCO returned an indicator catalog, but no concepts could be resolved. "
                f"Catalog rows: {len(catalog)}; sample fields: {sample_keys}."
            )
        if not catalog:
            raise RuntimeError("UNESCO returned an empty or unrecognized indicator catalog.")
        return discovered

    def _load_entities(self, rows: list[dict[str, Any]]) -> None:
        for row in rows:
            code = normalize_iso3(_pick(row, "geoUnit", "entityId", "geo_unit", "id", "code"))
            entity_type = str(_pick(row, "geoUnitType", "entityType", "entity_type", "type") or "NATIONAL").upper()
            name = str(_pick(row, "geoUnitName", "entityName", "entity_name", "name", "label") or "").strip()
            if code and entity_type in {"NATIONAL", "COUNTRY", ""}:
                self.national_entities.add(code)
                self.country_names[code] = name or code

    def _match_score(self, concept: IndicatorRule, name: str, row: dict[str, Any]) -> int | None:
        if any(re.search(pattern, name, re.IGNORECASE) for pattern in concept.exclude):
            return None
        if not all(re.search(pattern, name, re.IGNORECASE) for pattern in concept.include):
            return None
        score = 100 + sum(22 for pattern in concept.prefer if re.search(pattern, name, re.IGNORECASE))
        if BAD_NAME.search(name):
            score -= 55
        entity_types = str(_pick(row, "entityTypes", "entity_types") or "").upper()
        if entity_types and "NATIONAL" not in entity_types:
            score -= 40
        availability = _pick(row, "dataAvailability", "data_availability")
        if isinstance(availability, dict):
            count = availability.get("totalRecordCount") or availability.get("recordCount") or availability.get("total") or 0
            try:
                score += min(12, int(count) // 1000)
            except (TypeError, ValueError):
                pass
        score -= max(0, len(name) - 110) // 3
        return score

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        current_year = datetime.now(timezone.utc).year
        params = urlencode({"indicator": candidate.source_indicator_code})
        payload = self.http.get_json(f"{UIS_API}/data/indicators?{params}")
        rows = _records(payload)
        normalized: dict[tuple[str, int], SourceObservation] = {}
        max_year = 0
        for index, row in enumerate(rows):
            iso3 = normalize_iso3(_pick(row, "geoUnit", "entityId", "entity_id", "geo_unit"))
            if not iso3 or (self.national_entities and iso3 not in self.national_entities):
                continue
            try:
                year = int(float(str(_pick(row, "year", "time", "timePeriod") or "")))
                value = float(str(_pick(row, "value", "numericValue", "obs_value") or "").replace(",", ""))
            except (TypeError, ValueError):
                continue
            if not math.isfinite(value) or year < 1900 or year > current_year + 1:
                continue
            max_year = max(max_year, year)
            evidence = self._evidence_status(candidate.source_indicator_name, row)
            observation = SourceObservation(
                country_iso3=iso3,
                country_name=self.country_names.get(iso3, iso3),
                data_year=year,
                value=value,
                source_url=candidate.source_url,
                source_record_id=str(_pick(row, "id", "recordId") or f"{candidate.source_indicator_code}:{iso3}:{year}:{index}"),
                evidence_status=evidence,
                metadata={
                    "uis_indicator_id": candidate.source_indicator_code,
                    "uis_indicator_name": candidate.source_indicator_name,
                    "uis_version": _pick(row, "version"),
                    "uis_footnote": _pick(row, "footnote", "notes"),
                },
            )
            key = (iso3, year)
            current = normalized.get(key)
            if current is None or self._priority(observation) > self._priority(current):
                normalized[key] = observation
        minimum_year = max(1995, max_year - 12)
        observations = [row for row in normalized.values() if row.data_year >= minimum_year]
        if len(observations) < 20:
            raise RuntimeError(f"Only {len(observations)} usable national country-year observations were found.")
        return sorted(observations, key=lambda row: (row.data_year, row.country_iso3))

    @staticmethod
    def _evidence_status(name: str, row: dict[str, Any]) -> str:
        text = " ".join(str(value or "") for value in (name, _pick(row, "nature", "method", "footnote", "notes"))).lower()
        if any(token in text for token in ("modelled", "modeled", "projection")):
            return "modeled"
        if any(token in text for token in ("estimate", "estimated", "imputed")):
            return "estimated"
        return "official"

    @staticmethod
    def _priority(row: SourceObservation) -> int:
        return {"official": 4, "estimated": 3, "modeled": 2, "unknown": 1}[row.evidence_status]

    def category_id(self, candidate: CandidateDefinition) -> str:
        safe = re.sub(r"[^A-Za-z0-9._-]+", "-", candidate.source_indicator_code).strip("-")
        return f"unesco:{safe}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import curated UNESCO UIS indicators into GeoStats quarantine.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
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
    result = UnescoImporter(warehouse, dry_run=args.dry_run).run(limit=args.limit, only_keys=set(args.rule) or None)
    print(result, flush=True)
    return 1 if result["failures"] and result["categories_processed"] == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
