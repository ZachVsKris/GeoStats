#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

from data_pipeline.base import WarehouseImporter
from data_pipeline.countries import normalize_iso3
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

UNHCR_API = "https://api.unhcr.org/population/v1"
UNHCR_DATA_FINDER = "https://www.unhcr.org/refugee-statistics/"
UNHCR_DOCS = "https://api.unhcr.org/docs/refugee-statistics.html"


@dataclass(frozen=True)
class UnhcrSpec:
    rule: IndicatorRule
    endpoint: str
    dimension: str
    value_keys: tuple[str, ...]


def unhcr_rule(
    key: str,
    title: str,
    icon: str,
    endpoint: str,
    dimension: str,
    value_keys: tuple[str, ...],
    *,
    family: str = "Displacement",
    min_coverage: int = 40,
) -> UnhcrSpec:
    return UnhcrSpec(
        rule=IndicatorRule(
            key=key,
            title=title,
            description=f"{title} according to UNHCR Refugee Data Finder statistics.",
            family=family,
            icon=icon,
            unit="people",
            value_type="total",
            ranking_direction="high",
            include=(),
            min_coverage=min_coverage,
            evidence_tier="A",
            source_priority=7,
            specificity_score=96,
            recognizability_score=95,
        ),
        endpoint=endpoint,
        dimension=dimension,
        value_keys=value_keys,
    )


SPECS: tuple[UnhcrSpec, ...] = (
    unhcr_rule("most-refugees-hosted", "Most refugees hosted", "🏠", "population", "coa", ("refugees", "refugee", "ref"), min_coverage=115),
    unhcr_rule("most-refugees-originating", "Most refugees originating", "🧳", "population", "coo", ("refugees", "refugee", "ref"), min_coverage=100),
    unhcr_rule("most-asylum-seekers-hosted", "Most asylum seekers hosted", "📋", "population", "coa", ("asylum_seekers", "asylumSeekers", "asy"), min_coverage=90),
    unhcr_rule("most-asylum-seekers-originating", "Most asylum seekers originating", "📝", "population", "coo", ("asylum_seekers", "asylumSeekers", "asy"), min_coverage=80),
    unhcr_rule("most-internally-displaced-people", "Most internally displaced people", "⛺", "population", "coa", ("idps", "idp"), min_coverage=30),
    unhcr_rule("most-stateless-people", "Most stateless people", "🪪", "population", "coa", ("stateless", "sta"), min_coverage=35),
    unhcr_rule("most-other-people-needing-protection", "Most other people needing international protection", "🛟", "population", "coa", ("oip", "other_people_in_need_of_international_protection"), min_coverage=25),
    unhcr_rule("most-asylum-applications-received", "Most asylum applications received", "📨", "asylum-applications", "coa", ("applied", "applications", "asylum_applications", "value"), min_coverage=75),
    unhcr_rule("most-asylum-applications-by-origin", "Most asylum applications by origin", "📤", "asylum-applications", "coo", ("applied", "applications", "asylum_applications", "value"), min_coverage=70),
    unhcr_rule("most-refugees-returned-home", "Most refugees returned home", "🏡", "solutions", "coo", ("returned_refugees", "returnedRefugees", "ret"), min_coverage=35),
    unhcr_rule("most-returned-idps", "Most internally displaced people returned", "↩️", "solutions", "coa", ("returned_idps", "returnedIdps", "rtd"), min_coverage=25),
    unhcr_rule("most-refugees-naturalized", "Most refugees naturalized", "🪪", "solutions", "coa", ("naturalization", "naturalized", "nat"), min_coverage=20),
)


def _first(row: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return row[key]
    lowered = {str(key).lower(): value for key, value in row.items()}
    for key in keys:
        value = lowered.get(key.lower())
        if value not in (None, ""):
            return value
    return None


def _number(value: Any) -> float | None:
    if value in (None, "", "*", "-"):
        return None
    text = str(value).replace(",", "").strip()
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        number = float(match.group(0))
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def _page(payload: Any) -> tuple[list[dict[str, Any]], int | None, int | None]:
    if not isinstance(payload, dict):
        return [], None, None
    raw = payload.get("items") or payload.get("data") or payload.get("results") or payload.get("result") or []
    if isinstance(raw, dict):
        raw = raw.get("items") or raw.get("data") or []
    rows = [row for row in raw if isinstance(row, dict)] if isinstance(raw, list) else []
    max_pages_raw = payload.get("maxPages") or payload.get("max_pages") or payload.get("last_page") or payload.get("pages")
    current_raw = payload.get("page") or payload.get("current_page")
    try:
        max_pages = int(max_pages_raw) if max_pages_raw is not None else None
    except (TypeError, ValueError):
        max_pages = None
    try:
        current = int(current_raw) if current_raw is not None else None
    except (TypeError, ValueError):
        current = None
    return rows, max_pages, current


def _country(row: dict[str, Any], dimension: str) -> tuple[str | None, str]:
    if dimension == "coo":
        raw = _first(row, "coo_iso", "cooISO", "coo", "origin_iso", "country_of_origin_iso")
        name = str(_first(row, "coo_name", "cooName", "origin_name", "country_of_origin") or "")
    else:
        raw = _first(row, "coa_iso", "coaISO", "coa", "asylum_iso", "country_of_asylum_iso")
        name = str(_first(row, "coa_name", "coaName", "asylum_name", "country_of_asylum") or "")
    iso3 = normalize_iso3(raw)
    return iso3, name or (iso3 or "")


class UnhcrImporter(WarehouseImporter):
    source_organization = "UNHCR"
    source_dataset = "Refugee Data Finder"
    source_slug = "unhcr"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.http = HttpClient(timeout=120, retries=5, user_agent="GeoStats/13.3 UNHCR importer")
        self.cache: dict[tuple[str, str], list[dict[str, Any]]] = {}

    def discover(self) -> list[CandidateDefinition]:
        return [
            CandidateDefinition(
                rule=spec.rule,
                source_indicator_code=f"{spec.endpoint}:{spec.dimension}:{spec.value_keys[0]}",
                source_indicator_name=f"{spec.endpoint} / {spec.dimension} / {spec.value_keys[0]}",
                source_url=UNHCR_DATA_FINDER,
                metadata={
                    "endpoint": spec.endpoint,
                    "dimension": spec.dimension,
                    "value_keys": list(spec.value_keys),
                    "documentation": UNHCR_DOCS,
                },
            )
            for spec in SPECS
        ]

    def _fetch_dataset(self, endpoint: str, dimension: str) -> list[dict[str, Any]]:
        cache_key = (endpoint, dimension)
        if cache_key in self.cache:
            return self.cache[cache_key]
        now = datetime.now(timezone.utc).year
        limit = 2000
        page_number = 1
        rows: list[dict[str, Any]] = []
        while True:
            params = {
                "limit": limit,
                "page": page_number,
                "yearFrom": max(2022, now - 5),
                "yearTo": now,
                "cf_type": "ISO",
                f"{dimension}_all": "true",
            }
            url = f"{UNHCR_API}/{endpoint}/?{urlencode(params)}"
            page_rows, max_pages, current = _page(self.http.get_json(url))
            rows.extend(page_rows)
            if not page_rows or len(page_rows) < limit:
                break
            if max_pages is not None and page_number >= max_pages:
                break
            if current is not None and max_pages is not None and current >= max_pages:
                break
            page_number += 1
            if page_number > 100:
                raise RuntimeError(f"UNHCR pagination exceeded 100 pages for {endpoint}/{dimension}.")
        if not rows:
            raise RuntimeError(f"UNHCR returned no rows for {endpoint}/{dimension}.")
        self.cache[cache_key] = rows
        return rows

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        endpoint = str(candidate.metadata["endpoint"])
        dimension = str(candidate.metadata["dimension"])
        value_keys = tuple(str(value) for value in candidate.metadata["value_keys"])
        rows = self._fetch_dataset(endpoint, dimension)
        totals: dict[tuple[str, int], dict[str, Any]] = {}
        for index, row in enumerate(rows):
            iso3, country_name = _country(row, dimension)
            if not iso3:
                continue
            year_raw = _first(row, "year", "period", "data_year")
            match = re.search(r"(?:19|20)\d{2}", str(year_raw or ""))
            if not match:
                continue
            year = int(match.group(0))
            value = _number(_first(row, *value_keys))
            if value is None or value <= 0:
                continue
            key = (iso3, year)
            current = totals.setdefault(key, {"value": 0.0, "country_name": country_name, "rows": 0})
            current["value"] += value
            current["rows"] += 1

        observations = [
            SourceObservation(
                country_iso3=iso3,
                country_name=str(values["country_name"]),
                data_year=year,
                value=float(values["value"]),
                source_url=candidate.source_url,
                source_record_id=f"{candidate.source_indicator_code}:{iso3}:{year}",
                evidence_status="official",
                metadata={
                    "endpoint": endpoint,
                    "dimension": dimension,
                    "value_field": value_keys[0],
                    "aggregated_rows": values["rows"],
                },
            )
            for (iso3, year), values in totals.items()
        ]
        if len(observations) < 15:
            raise RuntimeError(f"Only {len(observations)} usable UNHCR country-year observations were found for {candidate.rule.key}.")
        return sorted(observations, key=lambda row: (row.data_year, row.country_iso3))

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"unhcr:{candidate.rule.key}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import curated UNHCR displacement categories into GeoStats quarantine.")
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
    result = UnhcrImporter(warehouse, dry_run=args.dry_run).run(limit=args.limit, only_keys=set(args.rule) or None)
    print(result, flush=True)
    return 1 if result["failures"] and result["categories_processed"] == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
