#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import io
import os
import re
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Iterable
from urllib.request import Request, urlopen

from openpyxl import load_workbook

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name, country_name_to_iso3
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_URL = "https://www.pewresearch.org/wp-content/uploads/sites/20/2025/06/Religious-Composition-2010-2020-dataset.zip"
SOURCE_PAGE = "https://www.pewresearch.org/dataset/dataset-of-global-religious-composition-estimates-for-2010-and-2020/"
FEATURE_PAGE = "https://www.pewresearch.org/religion/feature/religious-composition-by-country-2010-2020/"
METHODOLOGY_URL = "https://www.pewresearch.org/religion/2025/06/09/how-the-global-religious-landscape-changed-from-2010-to-2020-methodology/"
DATASET_RELEASE = "Pew global religious composition estimates, updated 2026-02-12"
REFERENCE_YEAR = 2020

GROUPS = {
    "christian": ("Christian", "✝️"),
    "muslim": ("Muslim", "☪️"),
    "hindu": ("Hindu", "🕉️"),
    "buddhist": ("Buddhist", "☸️"),
    "unaffiliated": ("religiously unaffiliated", "◯"),
}


def rule(key: str, title: str, icon: str, *, diversity: bool = False) -> IndicatorRule:
    description = (
        "Pew Research Center’s 2020 Religious Diversity Index score."
        if diversity
        else f"Estimated share of the population identifying as {title.removeprefix('Highest ').lower()} in 2020."
    )
    return IndicatorRule(
        key=key,
        title=title,
        description=description,
        plain_language_description=description,
        technical_definition=(
            "Religious-composition estimates synthesized from censuses, surveys, population registers "
            "and demographic estimation. Results are estimates, not exact counts."
        ),
        unit_explanation="Religious Diversity Index" if diversity else "% of population",
        family="Religion",
        icon=icon,
        unit="diversity index" if diversity else "% of population",
        value_type="index" if diversity else "percentage",
        ranking_direction="high",
        include=(key,),
        min_coverage=160,
        evidence_tier="B",
        source_priority=18,
        specificity_score=96,
        recognizability_score=96,
        understandability_score=96,
        fun_score=90 if diversity else 94,
        objective_status="objective",
        modeled_hint=1.0,
    )


RULES = [
    rule(f"{key}-share", f"Highest {label} share", icon)
    for key, (label, icon) in GROUPS.items()
] + [
    rule("religious-diversity", "Most religiously diverse", "🕊️", diversity=True),
]


def _norm(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _download(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "GeoStats/15.5 religion importer"})
    with urlopen(request, timeout=180) as response:
        return response.read()


def _extract_input(path_or_url: str | None) -> Path:
    if path_or_url and Path(path_or_url).exists():
        return Path(path_or_url)
    raw = _download(path_or_url or SOURCE_URL)
    temporary = Path(tempfile.mkdtemp(prefix="geostats-pew-"))
    archive = temporary / "religion.zip"
    archive.write_bytes(raw)
    with zipfile.ZipFile(archive) as handle:
        handle.extractall(temporary)
    candidates = [
        item for item in temporary.rglob("*")
        if item.suffix.lower() in {".xlsx", ".xlsm", ".csv"}
        and not item.name.startswith("~$")
    ]
    if not candidates:
        raise RuntimeError("Pew download did not contain an XLSX or CSV data file.")
    return max(candidates, key=lambda item: item.stat().st_size)


def _find_header(rows: list[list[Any]]) -> tuple[int, list[str]]:
    for index, row in enumerate(rows[:40]):
        headers = [_norm(value) for value in row]
        combined = " | ".join(headers)
        if "country" in combined and (
            "christian" in combined or "muslim" in combined or "religious diversity" in combined
        ):
            return index, headers
    raise RuntimeError("Could not locate the Pew country-data header row.")


def _field_score(header: str, metric: str) -> int:
    score = 0
    if metric in header:
        score += 10
    if "2020" in header:
        score += 6
    if any(token in header for token in ("percent", "percentage", "share", "pct", "%")):
        score += 5
    if any(token in header for token in ("number", "count", "population")):
        score -= 4
    if "2010" in header and "2020" not in header:
        score -= 8
    return score


def _resolve_column(headers: list[str], metric: str, *, diversity: bool = False) -> int | None:
    scored: list[tuple[int, int]] = []
    for index, header in enumerate(headers):
        if diversity:
            if "diversity" not in header or "rank" in header or "level" in header:
                continue
            score = 15 + (5 if "index" in header or "score" in header else 0) + (4 if "2020" in header else 0)
        else:
            if metric not in header:
                continue
            score = _field_score(header, metric)
        scored.append((score, index))
    return max(scored)[1] if scored else None


def _country_column(headers: list[str]) -> int:
    for index, header in enumerate(headers):
        if header in {"country", "country territory", "country or territory", "name"}:
            return index
    for index, header in enumerate(headers):
        if "country" in header:
            return index
    raise RuntimeError("Could not locate the country column in the Pew dataset.")


def _year_column(headers: list[str]) -> int | None:
    for index, header in enumerate(headers):
        if header in {"year", "reference year"}:
            return index
    return None


def _as_number(value: Any) -> float | None:
    if value in (None, "", "—", "-", "NA", "N/A"):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).strip().replace(",", "").replace("%", "")
    cleaned = cleaned.replace("<", "").replace(">", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _as_percent(value: Any) -> float | None:
    number = _as_number(value)
    if number is None:
        return None
    if 0 <= number <= 1:
        number *= 100
    return number if 0 <= number <= 100 else None


def _load_rows(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() == ".csv":
        with path.open(newline="", encoding="utf-8-sig") as handle:
            raw_rows = [list(row) for row in csv.reader(handle)]
        return _parse_rows(raw_rows)

    workbook = load_workbook(path, read_only=True, data_only=True)
    best: list[dict[str, Any]] = []
    errors: list[str] = []
    for sheet in workbook.worksheets:
        rows = [list(row) for row in sheet.iter_rows(values_only=True)]
        try:
            parsed = _parse_rows(rows)
        except RuntimeError as error:
            errors.append(f"{sheet.title}: {error}")
            continue
        if len(parsed) > len(best):
            best = parsed
    if not best:
        raise RuntimeError("No usable country sheet found. " + "; ".join(errors[:5]))
    return best


def _parse_rows(rows: list[list[Any]]) -> list[dict[str, Any]]:
    header_index, headers = _find_header(rows)
    country_index = _country_column(headers)
    year_index = _year_column(headers)
    metric_columns = {key: _resolve_column(headers, key) for key in GROUPS}
    diversity_column = _resolve_column(headers, "diversity", diversity=True)
    if not any(index is not None for index in metric_columns.values()) and diversity_column is None:
        raise RuntimeError("No 2020 religious-share or diversity columns were found.")

    parsed: list[dict[str, Any]] = []
    for row in rows[header_index + 1:]:
        if country_index >= len(row):
            continue
        country = str(row[country_index] or "").strip()
        if not country:
            continue
        if year_index is not None and year_index < len(row):
            year = _as_number(row[year_index])
            if year is not None and int(year) != REFERENCE_YEAR:
                continue
        iso3 = country_name_to_iso3(country)
        if not iso3:
            continue
        item: dict[str, Any] = {
            "iso3": iso3,
            "country": canonical_country_name(iso3, country),
        }
        for key, column in metric_columns.items():
            if column is not None and column < len(row):
                item[f"{key}_share"] = _as_percent(row[column])
        if diversity_column is not None and diversity_column < len(row):
            item["religious_diversity"] = _as_number(row[diversity_column])
        if any(value is not None for key, value in item.items() if key not in {"iso3", "country"}):
            parsed.append(item)
    if len(parsed) < 100:
        raise RuntimeError(f"Only {len(parsed)} GeoStats countries were parsed; expected at least 100.")
    return parsed


class PewReligionImporter(WarehouseImporter):
    source_organization = "Pew Research Center"
    source_dataset = "Global Religious Composition Estimates for 2010 and 2020"
    source_slug = "pewreligion"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, input_path: str | None = None, dry_run: bool = False):
        super().__init__(warehouse, dry_run=dry_run)
        self.input_path = input_path
        self._rows: list[dict[str, Any]] | None = None

    def rows(self) -> list[dict[str, Any]]:
        if self._rows is None:
            self._rows = _load_rows(_extract_input(self.input_path))
        return self._rows

    def discover(self) -> list[CandidateDefinition]:
        available = set().union(*(row.keys() for row in self.rows()))
        result: list[CandidateDefinition] = []
        for item in RULES:
            metric = item.key.replace("-", "_")
            if metric not in available:
                continue
            result.append(CandidateDefinition(
                rule=item,
                source_indicator_code=f"PEW_RELIGION_2020_{metric.upper()}",
                source_indicator_name=item.title,
                source_url=FEATURE_PAGE,
                metadata={
                    "source_page_url": FEATURE_PAGE,
                    "exact_query_url": FEATURE_PAGE,
                    "download_url": SOURCE_URL,
                    "api_url": None,
                    "dataset_release": DATASET_RELEASE,
                    "license_name": "Pew Research Center Terms of Use",
                    "license_url": "https://www.pewresearch.org/terms-and-conditions/",
                    "minimum_year": 2020,
                    "source_query": {
                        "referenceYear": REFERENCE_YEAR,
                        "metric": metric,
                        "estimate": True,
                    },
                    "methodology_url": METHODOLOGY_URL,
                    "broadDomain": "culture",
                    "knowledgeCluster": "religious-composition",
                    "strategyFamily": "religious-composition",
                    "estimatedData": True,
                },
            ))
        return result

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"pew-religion:{candidate.rule.key}"

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        metric = candidate.rule.key.replace("-", "_")
        observations: list[SourceObservation] = []
        for row in self.rows():
            value = row.get(metric)
            if value is None:
                continue
            observations.append(SourceObservation(
                country_iso3=str(row["iso3"]),
                country_name=str(row["country"]),
                data_year=REFERENCE_YEAR,
                value=float(value),
                source_url=FEATURE_PAGE,
                source_record_id=f"{row['iso3']}:{REFERENCE_YEAR}:{metric}",
                evidence_status="estimated",
                metadata={
                    "reference_year": REFERENCE_YEAR,
                    "metric": metric,
                    "estimate": True,
                    "source_page": SOURCE_PAGE,
                },
            ))
        return observations


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", help="Optional local Pew XLSX/CSV/ZIP file. Otherwise the official ZIP is downloaded.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", action="append", default=[])
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    warehouse = None if args.dry_run else SupabaseWarehouse(url or "", key or "")
    if not args.dry_run and (not url or not key):
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.")

    result = PewReligionImporter(warehouse, input_path=args.input, dry_run=args.dry_run).run(
        only_keys=set(args.only) or None,
    )
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
