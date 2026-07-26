#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import io
import json
import math
import os
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote, urlencode

from data_pipeline.base import WarehouseImporter
from data_pipeline.countries import normalize_iso3
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

ILO_HOME = "https://ilostat.ilo.org/data/"
ILO_BULK = "https://ilostat.ilo.org/data/bulk/"
TOC_URLS = (
    "https://rplumber.ilo.org/metadata/toc/indicator/?lang=en",
    "https://rplumber.ilo.org/files/indicator/table_of_contents_en.csv",
    "https://webapps.ilo.org/ilostat-files/WEB_bulk_download/indicator/table_of_contents_en.csv",
)


def rule(
    key: str,
    title: str,
    family: str,
    icon: str,
    unit: str,
    value_type: str,
    direction: str,
    include: tuple[str, ...],
    *,
    prefer: tuple[str, ...] = (),
    exclude: tuple[str, ...] = (),
    min_coverage: int = 70,
    evidence: str = "B",
    modeled: float | None = None,
    allowed: tuple[str, ...] = (),
    specificity: int = 90,
    recognizability: int = 90,
) -> IndicatorRule:
    return IndicatorRule(
        key=key,
        title=title,
        description=f"{title} according to ILOSTAT.",
        family=family,
        icon=icon,
        unit=unit,
        value_type=value_type,  # type: ignore[arg-type]
        ranking_direction=direction,  # type: ignore[arg-type]
        include=include,
        prefer=prefer,
        exclude=exclude,
        min_coverage=min_coverage,
        evidence_tier=evidence,  # type: ignore[arg-type]
        modeled_hint=modeled,
        source_priority=10,
        specificity_score=specificity,
        recognizability_score=recognizability,
        allowed_dimension_codes=allowed,
    )


BROAD_AGE = (
    "AGE_YTHADULT_YGE15", "AGE_YTHADULT_Y15-64", "AGE_YTHADULT_YGE15Y64", "AGE_TOTAL",
)
YOUTH_AGE = ("AGE_YTHADULT_Y15-24", "AGE_YTHADULT_Y15T24", "AGE_YTHADULT_Y15-29")
TOTAL_DIMENSIONS = (
    "CLASSIF1_TOTAL", "CLASSIF2_TOTAL", "ECO_SECTOR_TOTAL", "OCU_SKILL_TOTAL", "SOC_TOTAL", "NOC_VALUE_TOTAL",
)
COMMON_EXCLUDES = (
    r"quarterly|monthly|by occupation|by education|by citizenship|by marital status|by rural|by economic class",
    r"number of persons|thousands|index of dissimilarity|distribution by age",
)

RULES: tuple[IndicatorRule, ...] = (
    rule("lowest-unemployment", "Lowest unemployment rate", "Labor", "📉", "% of labor force", "percentage", "low", (r"unemployment rate",), prefer=(r"ilo modelled estimates", r"by sex and age"), exclude=COMMON_EXCLUDES + (r"youth unemployment|long-term",), min_coverage=120, modeled=0.9, allowed=BROAD_AGE),
    rule("highest-labor-force-participation", "Highest labor-force participation", "Labor", "👷", "% of working-age population", "percentage", "high", (r"labour force participation rate|labor force participation rate",), prefer=(r"ilo modelled estimates",), exclude=COMMON_EXCLUDES, min_coverage=120, modeled=0.9, allowed=BROAD_AGE),
    rule("highest-employment-population-ratio", "Highest employment-to-population ratio", "Labor", "💼", "% of working-age population", "percentage", "high", (r"employment-to-population ratio",), prefer=(r"ilo modelled estimates",), exclude=COMMON_EXCLUDES, min_coverage=120, modeled=0.9, allowed=BROAD_AGE),
    rule("lowest-youth-unemployment", "Lowest youth unemployment rate", "Labor", "🧑‍💼", "% of youth labor force", "percentage", "low", (r"unemployment rate",), prefer=(r"youth|15.?24",), exclude=COMMON_EXCLUDES + (r"adult",), min_coverage=100, modeled=0.9, allowed=YOUTH_AGE),
    rule("lowest-neet-rate", "Lowest youth NEET rate", "Labor", "🎒", "% of youth", "percentage", "low", (r"not in employment, education or training|neet",), exclude=COMMON_EXCLUDES, min_coverage=80, allowed=YOUTH_AGE),
    rule("lowest-labor-underutilization", "Lowest labor underutilization", "Labor", "📊", "% of extended labor force", "percentage", "low", (r"combined rate of time-related underemployment and unemployment|labour underutilization.*lu4|labor underutilization.*lu4",), exclude=COMMON_EXCLUDES, min_coverage=65, allowed=BROAD_AGE),
    rule("lowest-time-underemployment", "Lowest time-related underemployment", "Labor", "⏱️", "% of employed people", "percentage", "low", (r"time-related underemployment rate",), exclude=COMMON_EXCLUDES, min_coverage=65, allowed=BROAD_AGE),
    rule("lowest-informal-employment", "Lowest informal-employment rate", "Labor", "🧾", "% of employment", "percentage", "low", (r"informal employment rate",), exclude=COMMON_EXCLUDES, min_coverage=60, allowed=TOTAL_DIMENSIONS),
    rule("lowest-working-poverty", "Lowest working-poverty rate", "Labor", "🪙", "% of employed people", "percentage", "low", (r"working poverty rate",), exclude=COMMON_EXCLUDES, min_coverage=90, modeled=0.9, allowed=BROAD_AGE),
    rule("highest-social-protection-coverage", "Highest social-protection coverage", "Social protection", "🛡️", "% of population", "percentage", "high", (r"population covered by social protection floors|social protection coverage",), exclude=COMMON_EXCLUDES, min_coverage=60, allowed=TOTAL_DIMENSIONS),
    rule("highest-women-management", "Highest share of women in management", "Labor", "👩‍💼", "% of managers", "percentage", "high", (r"women in senior and middle management|women in management",), exclude=COMMON_EXCLUDES, min_coverage=60),
    rule("highest-labor-income-share", "Highest labor-income share of GDP", "Labor", "💵", "% of GDP", "percentage", "high", (r"labour income share|labor income share", r"gdp"), exclude=COMMON_EXCLUDES, min_coverage=80, modeled=0.85),
    rule("highest-output-per-worker", "Highest output per worker", "Economy", "⚙️", "constant PPP dollars", "per_capita", "high", (r"output per worker|labour productivity|labor productivity",), prefer=(r"constant.*ppp|ilo modelled estimates",), exclude=COMMON_EXCLUDES + (r"growth rate",), min_coverage=120, modeled=0.95),
    rule("fastest-productivity-growth", "Fastest labor-productivity growth", "Economy", "📈", "% annual growth", "rate", "high", (r"labour productivity|labor productivity|output per worker", r"growth rate|annual growth"), exclude=COMMON_EXCLUDES, min_coverage=100, modeled=0.95),
    rule("longest-working-week", "Longest average working week", "Labor", "🕒", "hours per week", "other", "high", (r"mean weekly hours actually worked|average weekly hours",), exclude=COMMON_EXCLUDES + (r"monthly earnings",), min_coverage=55, allowed=TOTAL_DIMENSIONS),
    rule("highest-wage-employment-share", "Highest wage-and-salaried employment share", "Labor", "💳", "% of employment", "percentage", "high", (r"employees.*percentage of total employment|wage and salaried workers",), exclude=COMMON_EXCLUDES, min_coverage=90, modeled=0.85, allowed=TOTAL_DIMENSIONS),
    rule("highest-self-employment-share", "Highest self-employment share", "Labor", "🧑‍🔧", "% of employment", "percentage", "high", (r"self-employment.*percentage|self-employed.*percentage",), exclude=COMMON_EXCLUDES, min_coverage=90, modeled=0.85, allowed=TOTAL_DIMENSIONS),
    rule("highest-vulnerable-employment", "Highest vulnerable-employment share", "Labor", "⚠️", "% of employment", "percentage", "high", (r"vulnerable employment",), exclude=COMMON_EXCLUDES, min_coverage=90, modeled=0.85, allowed=TOTAL_DIMENSIONS),
    rule("highest-agricultural-employment", "Highest agricultural-employment share", "Labor", "🌾", "% of employment", "percentage", "high", (r"employment.*economic activity", r"percentage"), prefer=(r"ilo modelled estimates",), exclude=COMMON_EXCLUDES, min_coverage=100, modeled=0.9, allowed=("ECO_SECTOR_AGR", "ECO_AGR", "ISIC4_A")),
    rule("highest-industrial-employment", "Highest industrial-employment share", "Labor", "🏭", "% of employment", "percentage", "high", (r"employment.*economic activity", r"percentage"), prefer=(r"ilo modelled estimates",), exclude=COMMON_EXCLUDES, min_coverage=100, modeled=0.9, allowed=("ECO_SECTOR_IND", "ECO_IND", "ISIC4_BTF")),
    rule("highest-services-employment", "Highest services-employment share", "Labor", "🏢", "% of employment", "percentage", "high", (r"employment.*economic activity", r"percentage"), prefer=(r"ilo modelled estimates",), exclude=COMMON_EXCLUDES, min_coverage=100, modeled=0.9, allowed=("ECO_SECTOR_SER", "ECO_SER", "ISIC4_GTU")),
    rule("lowest-fatal-work-injury-rate", "Lowest fatal workplace-injury rate", "Safety", "⛑️", "per 100,000 workers", "rate", "low", (r"fatal occupational injuries.*rate|fatal work injuries.*rate",), exclude=COMMON_EXCLUDES, min_coverage=45, allowed=TOTAL_DIMENSIONS),
    rule("highest-collective-bargaining", "Highest collective-bargaining coverage", "Labor", "🤝", "% of employees", "percentage", "high", (r"collective bargaining coverage",), exclude=COMMON_EXCLUDES, min_coverage=35),
    rule("highest-unemployment-benefit-coverage", "Highest unemployment-benefit coverage", "Social protection", "🧰", "% of unemployed people", "percentage", "high", (r"unemployment benefits|unemployment cash benefits", r"coverage|recipients"), exclude=COMMON_EXCLUDES + (r"number",), min_coverage=35, allowed=TOTAL_DIMENSIONS),
)


def _normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def _normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    return {_normalize_key(str(key)): value for key, value in row.items()}


def _csv_rows(text: str) -> list[dict[str, Any]]:
    sample = text[:8000]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t;")
    except csv.Error:
        dialect = csv.excel
    return [_normalize_row(dict(row)) for row in csv.DictReader(io.StringIO(text), dialect=dialect)]


def _extract_json_rows(payload: Any) -> list[dict[str, Any]]:
    """Find the first record-like array in an ILO API response.

    The R Plumber endpoints have returned both flat arrays and nested envelopes
    over time, so the importer intentionally tolerates either shape.
    """
    if isinstance(payload, list):
        rows = [row for row in payload if isinstance(row, dict)]
        if rows:
            return [_normalize_row(row) for row in rows]
        for value in payload:
            nested = _extract_json_rows(value)
            if nested:
                return nested
        return []
    if isinstance(payload, dict):
        for key in ("data", "records", "items", "results", "value"):
            if key in payload:
                nested = _extract_json_rows(payload[key])
                if nested:
                    return nested
        for value in payload.values():
            nested = _extract_json_rows(value)
            if nested:
                return nested
    return []


def _payload_rows(raw: bytes) -> list[dict[str, Any]]:
    text = raw.decode("utf-8-sig", errors="replace")
    stripped = text.lstrip()
    if stripped.startswith("{") or stripped.startswith("["):
        rows = _extract_json_rows(json.loads(text))
        if rows:
            return rows
    return _csv_rows(text)


def _first(row: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        normalized = _normalize_key(key)
        if normalized in row and row[normalized] not in (None, ""):
            return row[normalized]
    return None


class IlostatImporter(WarehouseImporter):
    source_organization = "ILOSTAT"
    source_dataset = "ILOSTAT bulk download"
    source_slug = "ilostat"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.http = HttpClient(timeout=180, retries=5)
        self.country_names: dict[str, str] = {}
        self._dataset_cache: dict[str, list[dict[str, Any]]] = {}

    def discover(self) -> list[CandidateDefinition]:
        catalog = self._load_toc()
        discovered: list[CandidateDefinition] = []
        unmatched: list[str] = []
        for concept in RULES:
            ranked: list[tuple[int, dict[str, Any], str, str]] = []
            for row in catalog:
                dataset_id = str(_first(row, "id") or "").strip()
                label = str(_first(row, "indicator.label", "indicator_label", "label", "title") or "").strip()
                frequency = str(_first(row, "freq", "frequency") or "").upper()
                if not dataset_id or not label:
                    continue
                if frequency and frequency != "A" and not dataset_id.endswith("_A"):
                    continue
                score = self._match_score(concept, label, dataset_id)
                if score is not None:
                    ranked.append((score, row, dataset_id, label))
            if not ranked:
                unmatched.append(concept.key)
                continue
            ranked.sort(key=lambda item: (-item[0], len(item[3]), item[3]))
            score, row, dataset_id, label = ranked[0]
            discovered.append(CandidateDefinition(
                rule=concept,
                source_indicator_code=dataset_id,
                source_indicator_name=label,
                source_url=self._data_url(dataset_id, format_value=".csv"),
                metadata={
                    "ilostat_catalog_match_score": score,
                    "ilostat_indicator": _first(row, "indicator"),
                    "ilostat_data_start": _first(row, "data.start", "data_start"),
                    "ilostat_data_end": _first(row, "data.end", "data_end"),
                    "ilostat_last_update": _first(row, "last.update", "last_update"),
                    "ilostat_bulk_docs": ILO_BULK,
                },
            ))
        print(f"Resolved {len(discovered)} ILOSTAT concepts; {len(unmatched)} unmatched.", flush=True)
        if unmatched:
            print("Unmatched ILOSTAT concepts: " + ", ".join(unmatched), flush=True)
        return discovered

    def _load_toc(self) -> list[dict[str, Any]]:
        errors: list[str] = []
        for url in TOC_URLS:
            try:
                rows = _payload_rows(self.http.get_bytes(url, accept="application/json,text/csv,*/*"))
                if rows and any(_first(row, "id") for row in rows):
                    return rows
                errors.append(f"{url}: no dataset ids")
            except Exception as error:
                errors.append(f"{url}: {error}")
        raise RuntimeError("Could not load ILOSTAT table of contents. " + " | ".join(errors))

    @staticmethod
    def _match_score(concept: IndicatorRule, label: str, dataset_id: str) -> int | None:
        if any(re.search(pattern, label, re.IGNORECASE) for pattern in concept.exclude):
            return None
        if not all(re.search(pattern, label, re.IGNORECASE) for pattern in concept.include):
            return None
        score = 100 + sum(24 for pattern in concept.prefer if re.search(pattern, label, re.IGNORECASE))
        upper_id = dataset_id.upper()
        if "_NOC_" in upper_id:
            score += 20
        if upper_id.endswith("_A"):
            score += 8
        score -= sum(token in upper_id for token in ("_SEX_", "_AGE_", "_ECO_", "_OCU_", "_EDU_")) * 5
        score -= max(0, len(label) - 125) // 3
        return score

    @staticmethod
    def _data_url(dataset_id: str, *, format_value: str) -> str:
        params = urlencode({
            "id": dataset_id,
            "lang": "en",
            "type": "both",
            "format": format_value,
            "channel": "ilostat",
        })
        return f"https://rplumber.ilo.org/data/indicator/?{params}"

    def _load_dataset(self, dataset_id: str) -> list[dict[str, Any]]:
        cached = self._dataset_cache.get(dataset_id)
        if cached is not None:
            return cached
        urls = (
            self._data_url(dataset_id, format_value=".csv"),
            self._data_url(dataset_id, format_value=".csv.gz"),
            f"https://rplumber.ilo.org/files/indicator/{quote(dataset_id, safe='')}.csv.gz",
            f"https://webapps.ilo.org/ilostat-files/WEB_bulk_download/indicator/{quote(dataset_id, safe='')}.csv.gz",
        )
        errors: list[str] = []
        for url in urls:
            try:
                rows = _payload_rows(self.http.get_bytes(url, accept="text/csv,application/gzip,application/json,*/*"))
                if rows:
                    self._dataset_cache[dataset_id] = rows
                    return rows
                errors.append(f"{url}: empty")
            except Exception as error:
                errors.append(f"{url}: {error}")
        raise RuntimeError("Could not load ILOSTAT dataset. " + " | ".join(errors))

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        rows = self._load_dataset(candidate.source_indicator_code)
        normalized: dict[tuple[str, int], SourceObservation] = {}
        max_year = 0
        current_year = datetime.now(timezone.utc).year
        for index, row in enumerate(rows):
            iso3 = normalize_iso3(_first(row, "ref_area", "ref_area.code", "ref_area_code"))
            if not iso3 or not self._aggregate_row(row, candidate.rule):
                continue
            raw_time = str(_first(row, "time", "year") or "")
            match = re.fullmatch(r"(?:19|20)\d{2}", raw_time.strip())
            if not match:
                continue
            year = int(match.group(0))
            try:
                value = float(str(_first(row, "obs_value", "value", "obs.value") or "").replace(",", ""))
            except (TypeError, ValueError):
                continue
            if not math.isfinite(value) or year > current_year + 1:
                continue
            max_year = max(max_year, year)
            country_name = str(_first(row, "ref_area.label", "ref_area_label") or iso3).strip()
            self.country_names[iso3] = country_name
            evidence = self._evidence_status(candidate, row)
            observation = SourceObservation(
                country_iso3=iso3,
                country_name=country_name,
                data_year=year,
                value=value,
                source_url=candidate.source_url,
                source_record_id=f"{candidate.source_indicator_code}:{iso3}:{year}:{index}",
                evidence_status=evidence,
                metadata={
                    "ilostat_dataset_id": candidate.source_indicator_code,
                    "ilostat_indicator_name": candidate.source_indicator_name,
                    "source": _first(row, "source", "source.label", "source_label"),
                    "sex": _first(row, "sex", "sex.label", "sex_label"),
                    "classif1": _first(row, "classif1", "classif1.label", "classif1_label"),
                    "classif2": _first(row, "classif2", "classif2.label", "classif2_label"),
                    "obs_status": _first(row, "obs_status", "obs_status.label", "obs_status_label"),
                    "note_source": _first(row, "note_source", "note_indicator", "note_classif"),
                },
            )
            key = (iso3, year)
            current = normalized.get(key)
            if current is None or self._priority(observation) > self._priority(current):
                normalized[key] = observation
        minimum_year = max(1995, max_year - 12)
        observations = [row for row in normalized.values() if row.data_year >= minimum_year]
        if len(observations) < 20:
            raise RuntimeError(f"Only {len(observations)} usable aggregate country-year observations were found.")
        return sorted(observations, key=lambda row: (row.data_year, row.country_iso3))

    @staticmethod
    def _is_total_dimension(raw: Any, label: Any) -> bool:
        code = str(raw or "").strip().upper()
        text = str(label or "").strip().lower()
        if not code and not text:
            return True
        if any(token in code for token in ("_TOTAL", "_TOTL", "_ALL")) or code in {"TOTAL", "ALL", "NOC", "SEX_T"}:
            return True
        if text in {"total", "all", "all ages", "both sexes", "not elsewhere classified", "no classification"}:
            return True
        return text.startswith("total ") or text.endswith(" total")

    @staticmethod
    def _matches_allowed_dimension(raw: Any, label: Any, allowed: set[str]) -> bool:
        code = str(raw or "").strip().upper()
        text = str(label or "").strip().lower()
        if code in allowed:
            return True
        # Current and legacy ILOSTAT releases have used slightly different codes
        # for the same broad age and economic-sector classifications. Labels are
        # used only as a constrained fallback, never as an unconstrained match.
        if any("YGE15" in value or "Y15-64" in value or "Y15T64" in value for value in allowed):
            if "15 years and over" in text or "15+" in text or "15-64" in text or "15 to 64" in text:
                return True
        if any("Y15-24" in value or "Y15T24" in value or "Y15-29" in value for value in allowed):
            if "15-24" in text or "15 to 24" in text or "15–24" in text or "15-29" in text or "15 to 29" in text:
                return True
        if any("AGR" in value or value.endswith("ISIC4_A") for value in allowed) and "agricultur" in text:
            return True
        if any("IND" in value or value.endswith("ISIC4_BTF") for value in allowed) and ("industr" in text or "mining" in text or "manufactur" in text):
            return True
        if any("SER" in value or value.endswith("ISIC4_GTU") for value in allowed) and "service" in text:
            return True
        return False

    def _aggregate_row(self, row: dict[str, Any], concept: IndicatorRule) -> bool:
        best = str(_first(row, "best_source", "best.source") or "").strip().lower()
        if best and best not in {"1", "true", "yes", "y"}:
            return False
        sex_code = _first(row, "sex")
        sex_label = _first(row, "sex.label", "sex_label")
        if not self._is_total_dimension(sex_code, sex_label):
            return False

        allowed = {value.upper() for value in concept.allowed_dimension_codes}
        dimensions: list[tuple[Any, Any]] = []
        matched_required_dimension = False
        for prefix in ("classif1", "classif2"):
            raw = _first(row, prefix)
            label = _first(row, f"{prefix}.label", f"{prefix}_label")
            if raw in (None, "") and label in (None, ""):
                continue
            dimensions.append((raw, label))
            if allowed and self._matches_allowed_dimension(raw, label, allowed):
                matched_required_dimension = True
                continue
            if not self._is_total_dimension(raw, label):
                return False

        # For concepts that request a specific subgroup (for example youth or
        # agriculture), do not silently accept the all-ages/all-sectors row.
        if allowed and dimensions and not matched_required_dimension:
            return False
        return True

    @staticmethod
    def _evidence_status(candidate: CandidateDefinition, row: dict[str, Any]) -> str:
        text = " ".join(str(value or "") for value in (
            candidate.source_indicator_name,
            _first(row, "source", "source.label", "source_label"),
            _first(row, "obs_status", "obs_status.label", "obs_status_label"),
            _first(row, "note_source", "note_indicator", "note_classif"),
        )).lower()
        if any(token in text for token in ("ilo modelled", "modelled", "modeled", "projection")):
            return "modeled"
        if any(token in text for token in ("estimate", "estimated", "imputed")):
            return "estimated"
        if any(token in text for token in ("survey", "census", "administrative", "registry", "official")):
            return "official"
        return "unknown"

    @staticmethod
    def _priority(row: SourceObservation) -> int:
        return {"official": 4, "estimated": 3, "modeled": 2, "unknown": 1}[row.evidence_status]

    def category_id(self, candidate: CandidateDefinition) -> str:
        safe = re.sub(r"[^A-Za-z0-9._-]+", "-", candidate.source_indicator_code).strip("-")
        return f"ilostat:{safe}:{candidate.rule.key}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import curated ILOSTAT indicators through GeoStats automatic governance.")
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
    result = IlostatImporter(warehouse, dry_run=args.dry_run).run(limit=args.limit, only_keys=set(args.rule) or None)
    print(result, flush=True)
    return 1 if result["failures"] and result["categories_processed"] == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
