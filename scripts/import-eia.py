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

EIA_ROUTE = "https://api.eia.gov/v2/international/data"
EIA_BROWSER = "https://www.eia.gov/opendata/browser/international"
EIA_DOCS = "https://www.eia.gov/opendata/documentation.php"


@dataclass(frozen=True)
class EiaSpec:
    rule: IndicatorRule
    product: tuple[str, ...]
    activity: tuple[str, ...]
    unit: tuple[str, ...]
    product_prefer: tuple[str, ...] = ()
    product_exclude: tuple[str, ...] = ()
    activity_prefer: tuple[str, ...] = ()


def eia_rule(
    key: str,
    title: str,
    icon: str,
    product: tuple[str, ...],
    activity: tuple[str, ...],
    unit: tuple[str, ...],
    *,
    family: str = "Energy",
    value_type: str = "total",
    min_coverage: int = 55,
    product_prefer: tuple[str, ...] = (),
    product_exclude: tuple[str, ...] = (),
    activity_prefer: tuple[str, ...] = (),
) -> EiaSpec:
    return EiaSpec(
        rule=IndicatorRule(
            key=key,
            title=title,
            description=f"{title} according to U.S. Energy Information Administration international data.",
            family=family,
            icon=icon,
            unit="",
            value_type=value_type,  # type: ignore[arg-type]
            ranking_direction="high",
            include=(),
            min_coverage=min_coverage,
            evidence_tier="B",
            source_priority=9,
            specificity_score=96,
            recognizability_score=96,
        ),
        product=product,
        activity=activity,
        unit=unit,
        product_prefer=product_prefer,
        product_exclude=product_exclude,
        activity_prefer=activity_prefer,
    )


ELECTRIC_UNITS = (r"billion kilowatthours|billion kwh|bkwh|terawatt",)
OIL_UNITS = (r"thousand barrels per day|tbpd|million barrels",)
GAS_UNITS = (r"billion cubic feet|bcf",)
COAL_UNITS = (r"million short tons|thousand short tons",)
ENERGY_UNITS = (r"quadrillion btu|trillion btu",)

SPECS: tuple[EiaSpec, ...] = (
    eia_rule("most-crude-oil-produced", "Most crude oil produced", "🛢️", (r"crude oil",), (r"production",), OIL_UNITS, product_prefer=(r"including lease condensate",), product_exclude=(r"reserve|refinery|price",), min_coverage=45),
    eia_rule("most-natural-gas-produced", "Most natural gas produced", "🔥", (r"natural gas",), (r"production",), GAS_UNITS, product_prefer=(r"dry natural gas",), product_exclude=(r"liquid|reserve|price",), min_coverage=60),
    eia_rule("most-coal-produced", "Most coal produced", "⛏️", (r"coal",), (r"production",), COAL_UNITS, product_exclude=(r"electricity|price",), min_coverage=55),
    eia_rule("most-electricity-generated", "Most electricity generated", "⚡", (r"electricity|electric power",), (r"net generation|generation",), ELECTRIC_UNITS, product_prefer=(r"total",), product_exclude=(r"renewable|wind|solar|hydro|nuclear|coal|gas|oil"), min_coverage=130),
    eia_rule("most-renewable-electricity-generated", "Most renewable electricity generated", "♻️", (r"renewable",), (r"net generation|generation",), ELECTRIC_UNITS, product_exclude=(r"capacity|consumption"), min_coverage=110),
    eia_rule("most-hydroelectricity-generated", "Most hydroelectricity generated", "💧", (r"hydro",), (r"net generation|generation",), ELECTRIC_UNITS, product_exclude=(r"capacity|consumption"), min_coverage=85),
    eia_rule("most-wind-electricity-generated", "Most wind electricity generated", "🌬️", (r"wind",), (r"net generation|generation",), ELECTRIC_UNITS, product_exclude=(r"capacity|consumption"), min_coverage=75),
    eia_rule("most-solar-electricity-generated", "Most solar electricity generated", "☀️", (r"solar",), (r"net generation|generation",), ELECTRIC_UNITS, product_exclude=(r"capacity|consumption"), min_coverage=75),
    eia_rule("most-nuclear-electricity-generated", "Most nuclear electricity generated", "☢️", (r"nuclear",), (r"net generation|generation",), ELECTRIC_UNITS, product_exclude=(r"capacity|consumption"), min_coverage=30),
    eia_rule("most-primary-energy-consumed", "Most primary energy consumed", "🔋", (r"primary energy",), (r"consumption",), ENERGY_UNITS, min_coverage=130),
    eia_rule("most-petroleum-consumed", "Most petroleum consumed", "⛽", (r"petroleum|oil",), (r"consumption",), OIL_UNITS + ENERGY_UNITS, product_prefer=(r"petroleum and other liquids",), product_exclude=(r"price|reserve"), min_coverage=115),
    eia_rule("most-natural-gas-consumed", "Most natural gas consumed", "🔥", (r"natural gas",), (r"consumption",), GAS_UNITS + ENERGY_UNITS, product_prefer=(r"dry natural gas",), product_exclude=(r"liquid|price|reserve"), min_coverage=110),
    eia_rule("most-coal-consumed", "Most coal consumed", "🏭", (r"coal",), (r"consumption",), COAL_UNITS + ENERGY_UNITS, product_exclude=(r"electricity|price"), min_coverage=95),
    eia_rule("most-electricity-exported", "Most electricity exported", "🔌", (r"electricity|electric power",), (r"export",), ELECTRIC_UNITS, product_prefer=(r"total",), product_exclude=(r"renewable|wind|solar|hydro|nuclear"), min_coverage=45),
    eia_rule("most-electricity-imported", "Most electricity imported", "🔌", (r"electricity|electric power",), (r"import",), ELECTRIC_UNITS, product_prefer=(r"total",), product_exclude=(r"renewable|wind|solar|hydro|nuclear"), min_coverage=45),
)


def _extract_response(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict) and isinstance(payload.get("response"), dict):
        return payload["response"]
    return payload if isinstance(payload, dict) else {}


def _api_error(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    for key in ("error", "error_description", "message"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            nested = value.get("message") or value.get("description") or value.get("error")
            if nested not in (None, ""):
                return str(nested)
    response = payload.get("response")
    if isinstance(response, dict):
        for key in ("error", "error_description", "message"):
            value = response.get(key)
            if value not in (None, ""):
                return str(value)
    return None


def _facet_entries(payload: Any) -> list[dict[str, str]]:
    response = _extract_response(payload)
    raw = response.get("facets") or response.get("data") or response.get("items") or []
    if isinstance(raw, dict):
        raw = raw.get("facets") or raw.get("data") or raw.get("items") or []
    rows: list[dict[str, str]] = []
    if not isinstance(raw, list):
        return rows
    for item in raw:
        if not isinstance(item, dict):
            continue
        identifier = item.get("id") or item.get("value") or item.get("code") or item.get("facetId")
        name = item.get("name") or item.get("description") or item.get("label") or item.get("alias")
        if identifier not in (None, "") and name not in (None, ""):
            rows.append({"id": str(identifier), "name": str(name)})
    return rows


def _data_rows(payload: Any) -> tuple[list[dict[str, Any]], int | None]:
    response = _extract_response(payload)
    raw = response.get("data") or response.get("items") or []
    rows = [row for row in raw if isinstance(row, dict)] if isinstance(raw, list) else []
    total_raw = response.get("total")
    try:
        total = int(total_raw) if total_raw is not None else None
    except (TypeError, ValueError):
        total = None
    return rows, total


def _match(entry: dict[str, str], include: tuple[str, ...], prefer: tuple[str, ...], exclude: tuple[str, ...] = ()) -> int | None:
    name = entry["name"]
    if any(re.search(pattern, name, re.IGNORECASE) for pattern in exclude):
        return None
    if not all(re.search(pattern, name, re.IGNORECASE) for pattern in include):
        return None
    score = 100 + sum(25 for pattern in prefer if re.search(pattern, name, re.IGNORECASE))
    score -= max(0, len(name) - 70) // 3
    return score


def _best(entries: list[dict[str, str]], include: tuple[str, ...], prefer: tuple[str, ...] = (), exclude: tuple[str, ...] = ()) -> dict[str, str] | None:
    ranked = [(score, entry) for entry in entries if (score := _match(entry, include, prefer, exclude)) is not None]
    if not ranked:
        return None
    ranked.sort(key=lambda item: (-item[0], item[1]["name"]))
    return ranked[0][1]


def _number(value: Any) -> float | None:
    if value in (None, "", "--", "NA", "N/A"):
        return None
    try:
        result = float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


class EiaImporter(WarehouseImporter):
    source_organization = "U.S. EIA"
    source_dataset = "International Energy Data"
    source_slug = "eia"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.api_key = os.environ.get("EIA_API_KEY", "").strip()
        self.http = HttpClient(timeout=120, retries=5, user_agent="GeoStats/13.3.1 EIA importer")
        self._catalog_cache: dict[str, list[dict[str, str]]] | None = None

    def _require_key(self) -> None:
        if not self.api_key:
            raise RuntimeError("EIA_API_KEY is required. Register for a free EIA Open Data API key and add it as a GitHub Actions repository secret.")

    def _catalog_url(self, *, offset: int, length: int) -> str:
        now = datetime.now(timezone.utc).year
        params: list[tuple[str, str]] = [
            ("api_key", self.api_key),
            ("frequency", "annual"),
            ("data[]", "value"),
            ("start", str(max(2022, now - 4))),
            ("sort[0][column]", "period"),
            ("sort[0][direction]", "desc"),
            ("offset", str(offset)),
            ("length", str(length)),
        ]
        return f"{EIA_ROUTE}/?{urlencode(params)}"

    def _catalog_facets_from_data(self) -> dict[str, list[dict[str, str]]]:
        if self._catalog_cache is not None:
            return self._catalog_cache
        products: dict[str, str] = {}
        activities: dict[str, str] = {}
        offset = 0
        length = 5000
        unchanged_pages = 0
        previous_counts = (-1, -1)
        while offset < 50000:
            payload = self.http.get_json(self._catalog_url(offset=offset, length=length))
            error = _api_error(payload)
            if error:
                raise RuntimeError(f"EIA catalog request failed: {error}")
            rows, total = _data_rows(payload)
            for row in rows:
                product_id = row.get("productId") or row.get("productid")
                product_name = row.get("productName") or row.get("productDescription")
                activity_id = row.get("activityId") or row.get("activityid")
                activity_name = row.get("activityName") or row.get("activityDescription")
                if product_id not in (None, "") and product_name not in (None, ""):
                    products[str(product_id)] = str(product_name)
                if activity_id not in (None, "") and activity_name not in (None, ""):
                    activities[str(activity_id)] = str(activity_name)
            counts = (len(products), len(activities))
            unchanged_pages = unchanged_pages + 1 if counts == previous_counts else 0
            previous_counts = counts
            offset += len(rows)
            if not rows or len(rows) < length or (total is not None and offset >= total):
                break
            # The current international catalog has only a few dozen products and
            # activities. Once two full pages add no new values, more history will
            # not improve concept resolution.
            if unchanged_pages >= 2 and len(products) >= 20 and len(activities) >= 8:
                break
        self._catalog_cache = {
            "productId": [{"id": key, "name": value} for key, value in sorted(products.items())],
            "activityId": [{"id": key, "name": value} for key, value in sorted(activities.items())],
        }
        return self._catalog_cache

    def _facet(self, name: str) -> list[dict[str, str]]:
        self._require_key()
        url = f"{EIA_ROUTE}/facet/{name}/?{urlencode({'api_key': self.api_key, 'offset': 0, 'length': 5000})}"
        payload = self.http.get_json(url)
        error = _api_error(payload)
        if error:
            raise RuntimeError(f"EIA {name} facet request failed: {error}")
        entries = _facet_entries(payload)
        if entries:
            return entries
        print(f"EIA returned no {name} facet entries; deriving the catalog from recent international data rows.", flush=True)
        entries = self._catalog_facets_from_data().get(name, [])
        if not entries:
            response = _extract_response(payload)
            raise RuntimeError(
                f"EIA returned no {name} facet entries and no fallback values. "
                f"Response fields: {sorted(response.keys())}"
            )
        return entries

    def discover(self) -> list[CandidateDefinition]:
        products = self._facet("productId")
        activities = self._facet("activityId")
        discovered: list[CandidateDefinition] = []
        unmatched: list[str] = []
        for spec in SPECS:
            product = _best(products, spec.product, spec.product_prefer, spec.product_exclude)
            activity = _best(activities, spec.activity, spec.activity_prefer)
            if not product or not activity:
                unmatched.append(spec.rule.key)
                continue
            discovered.append(CandidateDefinition(
                rule=spec.rule,
                source_indicator_code=f"{product['id']}:{activity['id']}",
                source_indicator_name=f"{product['name']} — {activity['name']}",
                source_url=EIA_BROWSER,
                metadata={
                    "product_id": product["id"],
                    "product_name": product["name"],
                    "activity_id": activity["id"],
                    "activity_name": activity["name"],
                    "accepted_unit_patterns": list(spec.unit),
                    "documentation": EIA_DOCS,
                },
            ))
        print(f"Resolved {len(discovered)} EIA concepts; {len(unmatched)} unmatched.", flush=True)
        if unmatched:
            print("Unmatched EIA concepts: " + ", ".join(unmatched), flush=True)
        if not discovered:
            raise RuntimeError("EIA catalog resolution produced no candidates.")
        return discovered

    def _data_url(self, candidate: CandidateDefinition, *, offset: int, length: int) -> str:
        now = datetime.now(timezone.utc).year
        params: list[tuple[str, str]] = [
            ("api_key", self.api_key),
            ("frequency", "annual"),
            ("data[]", "value"),
            ("facets[productId][]", str(candidate.metadata["product_id"])),
            ("facets[activityId][]", str(candidate.metadata["activity_id"])),
            ("start", str(max(2015, now - 12))),
            ("end", str(now)),
            ("sort[0][column]", "period"),
            ("sort[0][direction]", "desc"),
            ("offset", str(offset)),
            ("length", str(length)),
        ]
        return f"{EIA_ROUTE}/?{urlencode(params)}"

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        self._require_key()
        patterns = tuple(str(value) for value in candidate.metadata.get("accepted_unit_patterns", []))
        all_rows: list[dict[str, Any]] = []
        offset = 0
        length = 5000
        while True:
            rows, total = _data_rows(self.http.get_json(self._data_url(candidate, offset=offset, length=length)))
            all_rows.extend(rows)
            offset += len(rows)
            if not rows or len(rows) < length or (total is not None and offset >= total):
                break
            if offset > 50000:
                raise RuntimeError("EIA pagination exceeded 50,000 rows for one candidate.")

        # A product/activity pair can be published in multiple units. Choose one unit
        # for the whole category before building observations so values are never mixed.
        unit_keys: dict[str, set[tuple[str, int]]] = {}
        unit_pattern_index: dict[str, int] = {}
        available_units: set[str] = set()
        for row in all_rows:
            iso3 = normalize_iso3(row.get("countryRegionId") or row.get("countryId") or row.get("iso3"))
            match = re.search(r"(?:19|20)\d{2}", str(row.get("period") or row.get("year") or ""))
            value = _number(row.get("value"))
            unit = str(row.get("unit") or row.get("unitName") or row.get("value-units") or row.get("units") or "").strip()
            if unit:
                available_units.add(unit)
            if not iso3 or not match or value is None or value < 0 or not unit:
                continue
            matched_indexes = [index for index, pattern in enumerate(patterns) if re.search(pattern, unit, re.IGNORECASE)]
            if patterns and not matched_indexes:
                continue
            unit_keys.setdefault(unit, set()).add((iso3, int(match.group(0))))
            unit_pattern_index[unit] = min(matched_indexes) if matched_indexes else 0

        if not unit_keys:
            raise RuntimeError(f"No EIA unit matched this category. Available units: {sorted(available_units)[:20]}")
        qualified_units = [unit for unit, keys in unit_keys.items() if len(keys) >= candidate.rule.min_coverage]
        unit_pool = qualified_units or list(unit_keys)
        selected_unit = sorted(
            unit_pool,
            key=lambda unit: (unit_pattern_index.get(unit, 999), -len(unit_keys[unit]), unit.lower()),
        )[0]

        normalized: dict[tuple[str, int], SourceObservation] = {}
        for index, row in enumerate(all_rows):
            iso3 = normalize_iso3(row.get("countryRegionId") or row.get("countryId") or row.get("iso3"))
            if not iso3:
                continue
            match = re.search(r"(?:19|20)\d{2}", str(row.get("period") or row.get("year") or ""))
            if not match:
                continue
            year = int(match.group(0))
            value = _number(row.get("value"))
            if value is None or value < 0:
                continue
            unit = str(row.get("unit") or row.get("unitName") or row.get("value-units") or row.get("units") or "").strip()
            if unit != selected_unit:
                continue
            text = " ".join(str(row.get(key) or "") for key in ("description", "productName", "activityName", "unit")).lower()
            status = "estimated" if "estimate" in text else "official"
            observation = SourceObservation(
                country_iso3=iso3,
                country_name=str(row.get("countryRegionName") or row.get("countryName") or iso3),
                data_year=year,
                value=value,
                source_url=candidate.source_url,
                source_record_id=str(row.get("seriesId") or f"{candidate.source_indicator_code}:{iso3}:{year}:{index}"),
                evidence_status=status,
                metadata={
                    "product_id": candidate.metadata["product_id"],
                    "activity_id": candidate.metadata["activity_id"],
                    "unit": unit,
                },
            )
            key = (iso3, year)
            current = normalized.get(key)
            if current is None or (current.evidence_status != "official" and status == "official"):
                normalized[key] = observation

        if len(normalized) < 20:
            raise RuntimeError(
                f"Only {len(normalized)} usable EIA country-year rows were found in selected unit {selected_unit!r}. "
                f"Available units: {sorted(available_units)[:20]}"
            )

        candidate.metadata["selected_unit"] = selected_unit
        return sorted(normalized.values(), key=lambda row: (row.data_year, row.country_iso3))

    def build_category_row(self, candidate, quality, category_id: str) -> dict[str, object]:
        row = super().build_category_row(candidate, quality, category_id)
        row["unit"] = str(candidate.metadata.get("selected_unit") or "EIA reported unit")
        return row

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"eia:{candidate.rule.key}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import curated EIA international energy categories through GeoStats automatic governance.")
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
    result = EiaImporter(warehouse, dry_run=args.dry_run).run(limit=args.limit, only_keys=set(args.rule) or None)
    print(result, flush=True)
    return 1 if result["failures"] and result["categories_processed"] == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
