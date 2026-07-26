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

COMTRADE_PREVIEW = "https://comtradeapi.un.org/public/v1/preview/C/A/HS"
COMTRADE_DATA = "https://comtradeapi.un.org/data/v1/get/C/A/HS"
COMTRADE_SITE = "https://comtradeplus.un.org/"


@dataclass(frozen=True)
class TradeSpec:
    rule: IndicatorRule
    commodity_codes: tuple[str, ...]


def trade_rule(
    key: str,
    title: str,
    icon: str,
    codes: tuple[str, ...],
    *,
    family: str = "Trade",
    min_coverage: int = 55,
    specificity: int = 96,
    recognizability: int = 96,
) -> TradeSpec:
    return TradeSpec(
        rule=IndicatorRule(
            key=key,
            title=title,
            description=f"{title} by annual merchandise export value according to UN Comtrade.",
            family=family,
            icon=icon,
            unit="current US$",
            value_type="total",
            ranking_direction="high",
            include=(),
            min_coverage=min_coverage,
            evidence_tier="A",
            source_priority=8,
            specificity_score=specificity,
            recognizability_score=recognizability,
        ),
        commodity_codes=codes,
    )


SPECS: tuple[TradeSpec, ...] = (
    trade_rule("most-coffee-exported", "Largest coffee exports", "☕", ("0901",), min_coverage=80),
    trade_rule("most-tea-exported", "Largest tea exports", "🍵", ("0902",), min_coverage=65),
    trade_rule("most-rice-exported", "Largest rice exports", "🍚", ("1006",), min_coverage=65),
    trade_rule("most-wheat-exported", "Largest wheat exports", "🌾", ("1001",), min_coverage=60),
    trade_rule("most-cocoa-beans-exported", "Largest cocoa-bean exports", "🍫", ("1801",), min_coverage=45),
    trade_rule("most-chocolate-exported", "Largest chocolate exports", "🍫", ("1806",), min_coverage=85),
    trade_rule("most-bananas-exported", "Largest banana exports", "🍌", ("0803",), min_coverage=55),
    trade_rule("most-wine-exported", "Largest wine exports", "🍷", ("2204",), min_coverage=75),
    trade_rule("most-cars-exported", "Largest car exports", "🚗", ("8703",), min_coverage=80),
    trade_rule("most-pharmaceuticals-exported", "Largest pharmaceutical exports", "💊", ("30",), min_coverage=100),
    trade_rule("most-electrical-equipment-exported", "Largest electrical-equipment exports", "🔌", ("85",), min_coverage=120),
    trade_rule("most-clothing-exported", "Largest clothing exports", "👕", ("61", "62"), min_coverage=105),
    trade_rule("most-crude-oil-exported", "Largest crude-oil exports", "🛢️", ("2709",), min_coverage=45),
    trade_rule("most-gold-exported", "Largest gold exports", "🥇", ("7108",), min_coverage=60),
    trade_rule("most-aircraft-exported", "Largest aircraft exports", "✈️", ("88",), min_coverage=55),
)


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("data", "dataset", "results", "items"):
        value = payload.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, dict)]
    return []


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


class ComtradeImporter(WarehouseImporter):
    source_organization = "UN Comtrade"
    source_dataset = "International Merchandise Trade Statistics"
    source_slug = "comtrade"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.http = HttpClient(timeout=120, retries=5, user_agent="GeoStats/13.3 UN-Comtrade importer")
        self.subscription_key = os.environ.get("COMTRADE_API_KEY", "").strip()

    def discover(self) -> list[CandidateDefinition]:
        return [
            CandidateDefinition(
                rule=spec.rule,
                source_indicator_code="+".join(spec.commodity_codes),
                source_indicator_name=f"HS {', '.join(spec.commodity_codes)} exports to World",
                source_url=COMTRADE_SITE,
                metadata={
                    "commodity_codes": list(spec.commodity_codes),
                    "flow_code": "X",
                    "partner_code": "0",
                    "classification": "HS",
                    "api_mode": "keyed" if self.subscription_key else "preview",
                },
            )
            for spec in SPECS
        ]

    def _url(self, commodity_code: str, year: int) -> str:
        base = COMTRADE_DATA if self.subscription_key else COMTRADE_PREVIEW
        params: list[tuple[str, str]] = [
            ("period", str(year)),
            ("reporterCode", "all"),
            ("flowCode", "X"),
            ("partnerCode", "0"),
            ("partner2Code", "0"),
            ("cmdCode", commodity_code),
            ("customsCode", "C00"),
            ("motCode", "0"),
            ("maxRecords", "500"),
        ]
        if self.subscription_key:
            params.append(("subscription-key", self.subscription_key))
        return f"{base}?{urlencode(params)}"

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        codes = tuple(str(code) for code in candidate.metadata.get("commodity_codes", []))
        now = datetime.now(timezone.utc).year
        first_year = max(2022, now - 5)
        by_country_year: dict[tuple[str, int], dict[str, Any]] = {}

        for year in range(first_year, now):
            for code in codes:
                url = self._url(code, year)
                payload = self.http.get_json(url)
                data = _rows(payload)
                for index, row in enumerate(data):
                    iso3 = normalize_iso3(_first(row, "reporterISO", "reporterIso", "reporterISO3", "reporterCodeISOAlpha3"))
                    if not iso3:
                        continue
                    period_raw = _first(row, "period", "refYear", "year")
                    match = re.search(r"(?:19|20)\d{2}", str(period_raw or year))
                    period = int(match.group(0)) if match else year
                    value = _number(_first(row, "primaryValue", "tradeValue", "TradeValue", "fobvalue", "cifvalue"))
                    if value is None or value <= 0:
                        continue
                    key = (iso3, period)
                    current = by_country_year.setdefault(key, {
                        "value": 0.0,
                        "country_name": str(_first(row, "reporterDesc", "reporterName") or iso3),
                        "records": [],
                    })
                    current["value"] += value
                    current["records"].append(str(_first(row, "id", "aggregateLevel") or f"{code}:{index}"))

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
                    "hs_codes": list(codes),
                    "flow": "exports",
                    "partner": "World",
                    "trade_value_basis": "primaryValue",
                    "component_records": len(values["records"]),
                },
            )
            for (iso3, year), values in by_country_year.items()
        ]
        if len(observations) < 20:
            raise RuntimeError(f"Only {len(observations)} usable UN Comtrade country-year observations were found.")
        return sorted(observations, key=lambda row: (row.data_year, row.country_iso3))

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"comtrade:{candidate.rule.key}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import curated UN Comtrade export categories into GeoStats quarantine.")
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
    result = ComtradeImporter(warehouse, dry_run=args.dry_run).run(limit=args.limit, only_keys=set(args.rule) or None)
    print(result, flush=True)
    return 1 if result["failures"] and result["categories_processed"] == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
