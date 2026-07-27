#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

from data_pipeline.base import WarehouseImporter
from data_pipeline.countries import normalize_iso3
from data_pipeline.http import HttpClient, HttpStatusError
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

COMTRADE_PREVIEW = "https://comtradeapi.un.org/public/v1/preview/C/A/HS"
COMTRADE_DATA = "https://comtradeapi.un.org/data/v1/get/C/A/HS"
COMTRADE_SITE = "https://comtradeplus.un.org/"


class ComtradeQuotaExhausted(RuntimeError):
    stop_import = True

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
            description=f"Annual export value of {title.removeprefix('Largest ').removesuffix(' exports').lower()} shipped from each country to the world.",
            plain_language_description=f"Annual export value of {title.removeprefix('Largest ').removesuffix(' exports').lower()} shipped from each country to the world.",
            technical_definition=f"UN Comtrade merchandise exports to World for HS code{'s' if len(codes) > 1 else ''} {', '.join(codes)}, measured by annual trade value.",
            unit_explanation="Current US dollars of exports",
            understandability_score=94,
            fun_score=88,
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
    # Food, crops, and drinks
    trade_rule("most-coffee-exported", "Largest coffee exports", "☕", ("0901",), min_coverage=80),
    trade_rule("most-tea-exported", "Largest tea exports", "🍵", ("0902",), min_coverage=65),
    trade_rule("most-rice-exported", "Largest rice exports", "🍚", ("1006",), min_coverage=65),
    trade_rule("most-wheat-exported", "Largest wheat exports", "🌾", ("1001",), min_coverage=60),
    trade_rule("most-maize-exported", "Largest maize exports", "🌽", ("1005",), min_coverage=55),
    trade_rule("most-soybeans-exported", "Largest soybean exports", "🫘", ("1201",), min_coverage=45),
    trade_rule("most-cocoa-beans-exported", "Largest cocoa-bean exports", "🍫", ("1801",), min_coverage=45),
    trade_rule("most-chocolate-exported", "Largest chocolate exports", "🍫", ("1806",), min_coverage=85),
    trade_rule("most-bananas-exported", "Largest banana exports", "🍌", ("0803",), min_coverage=55),
    trade_rule("most-citrus-exported", "Largest citrus-fruit exports", "🍊", ("0805",), min_coverage=70),
    trade_rule("most-apples-pears-exported", "Largest apple-and-pear exports", "🍎", ("0808",), min_coverage=70),
    trade_rule("most-potatoes-exported", "Largest potato exports", "🥔", ("0701",), min_coverage=65),
    trade_rule("most-tomatoes-exported", "Largest tomato exports", "🍅", ("0702",), min_coverage=55),
    trade_rule("most-fish-exported", "Largest fish exports", "🐟", ("03",), min_coverage=100),
    trade_rule("most-beef-exported", "Largest beef exports", "🥩", ("0201", "0202"), min_coverage=55),
    trade_rule("most-poultry-exported", "Largest poultry-meat exports", "🍗", ("0207",), min_coverage=65),
    trade_rule("most-cheese-exported", "Largest cheese exports", "🧀", ("0406",), min_coverage=75),
    trade_rule("most-sugar-exported", "Largest sugar exports", "🍬", ("1701",), min_coverage=65),
    trade_rule("most-olive-oil-exported", "Largest olive-oil exports", "🫒", ("1509",), min_coverage=55),
    trade_rule("most-spices-exported", "Largest spice exports", "🌶️", ("09",), min_coverage=95),
    trade_rule("most-wine-exported", "Largest wine exports", "🍷", ("2204",), min_coverage=75),
    trade_rule("most-beer-exported", "Largest beer exports", "🍺", ("2203",), min_coverage=80),

    # Energy and raw materials
    trade_rule("most-crude-oil-exported", "Largest crude-oil exports", "🛢️", ("2709",), min_coverage=45),
    trade_rule("most-natural-gas-exported", "Largest natural-gas exports", "🔥", ("2711",), min_coverage=50),
    trade_rule("most-coal-exported", "Largest coal exports", "⚫", ("2701",), min_coverage=45),
    trade_rule("most-electricity-exported", "Largest electricity exports", "⚡", ("2716",), min_coverage=45),
    trade_rule("most-gold-exported", "Largest gold exports", "🥇", ("7108",), min_coverage=60),
    trade_rule("most-copper-exported", "Largest copper exports", "🟠", ("74",), min_coverage=90),
    trade_rule("most-aluminum-exported", "Largest aluminum exports", "🔩", ("76",), min_coverage=95),
    trade_rule("most-iron-steel-exported", "Largest iron-and-steel exports", "🏗️", ("72", "73"), min_coverage=105),
    trade_rule("most-wood-exported", "Largest wood exports", "🪵", ("44",), min_coverage=105),
    trade_rule("most-paper-exported", "Largest paper exports", "📄", ("48",), min_coverage=110),
    trade_rule("most-cotton-exported", "Largest cotton exports", "🧵", ("52",), min_coverage=75),

    # Manufactured goods and technology
    trade_rule("most-cars-exported", "Largest car exports", "🚗", ("8703",), min_coverage=80),
    trade_rule("most-motorcycles-exported", "Largest motorcycle exports", "🏍️", ("8711",), min_coverage=65),
    trade_rule("most-ships-exported", "Largest ship exports", "🚢", ("89",), min_coverage=65),
    trade_rule("most-aircraft-exported", "Largest aircraft exports", "✈️", ("88",), min_coverage=55),
    trade_rule("most-pharmaceuticals-exported", "Largest pharmaceutical exports", "💊", ("30",), min_coverage=100),
    trade_rule("most-medical-optical-exported", "Largest medical-and-optical equipment exports", "🔬", ("90",), min_coverage=105),
    trade_rule("most-chemicals-exported", "Largest chemical exports", "🧪", ("28", "29", "38"), min_coverage=115),
    trade_rule("most-plastics-exported", "Largest plastics exports", "🧴", ("39",), min_coverage=115),
    trade_rule("most-electrical-equipment-exported", "Largest electrical-equipment exports", "🔌", ("85",), min_coverage=120),
    trade_rule("most-machinery-exported", "Largest machinery exports", "⚙️", ("84",), min_coverage=120),
    trade_rule("most-computers-exported", "Largest computer exports", "💻", ("8471",), min_coverage=85),
    trade_rule("most-phones-exported", "Largest telephone exports", "📱", ("8517",), min_coverage=90),
    trade_rule("most-integrated-circuits-exported", "Largest computer-chip exports", "💾", ("8542",), min_coverage=65),
    trade_rule("most-clothing-exported", "Largest clothing exports", "👕", ("61", "62"), min_coverage=105),
    trade_rule("most-footwear-exported", "Largest footwear exports", "👟", ("64",), min_coverage=90),
    trade_rule("most-furniture-exported", "Largest furniture exports", "🪑", ("94",), min_coverage=105),
    trade_rule("most-toys-exported", "Largest toy exports", "🧸", ("9503",), min_coverage=80),
    trade_rule("most-sports-equipment-exported", "Largest sports-equipment exports", "⚽", ("9506",), min_coverage=80),
    trade_rule("most-ceramics-exported", "Largest ceramic exports", "🏺", ("69",), min_coverage=85),
    trade_rule("most-glass-exported", "Largest glass exports", "🪟", ("70",), min_coverage=95),
    trade_rule("most-rubber-products-exported", "Largest rubber-product exports", "🛞", ("40",), min_coverage=100),
    trade_rule("most-railway-equipment-exported", "Largest railway-equipment exports", "🚆", ("86",), min_coverage=55),
)


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


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
    validation = payload.get("validation")
    if isinstance(validation, dict):
        status = validation.get("status")
        message = validation.get("message") or validation.get("description")
        if status not in (None, True, "OK", "ok", "valid") and message:
            return str(message)
    return None


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
        self.http = HttpClient(timeout=120, retries=6, user_agent="GeoStats/14.1 UN-Comtrade importer")
        self.subscription_key = os.environ.get("COMTRADE_API_KEY", "").strip()
        self.request_delay = max(0.0, float(os.environ.get("COMTRADE_REQUEST_DELAY_SECONDS", "1.25")))
        self._last_request_at = 0.0

    def _require_key(self) -> None:
        if not self.subscription_key:
            raise RuntimeError(
                "COMTRADE_API_KEY is required for GeoStats global country rankings. "
                "The public preview endpoint requires a specific reporter and cannot supply the all-country extract used here."
            )

    def discover(self) -> list[CandidateDefinition]:
        self._require_key()
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
                    "api_mode": "keyed",
                    "source_page_url": COMTRADE_SITE,
                    "api_url": COMTRADE_DATA,
                    "source_query": {
                        "period": "latest completed years from 2022",
                        "reporterCode": "all reporters",
                        "flowCode": "X",
                        "partnerCode": "0 (World)",
                        "cmdCode": list(spec.commodity_codes),
                        "classification": "HS",
                    },
                    "methodology_url": "https://unstats.un.org/unsd/trade/eg-imts/IMTS%202010%20(English).pdf",
                    "license_name": "UN Comtrade data terms",
                    "license_url": "https://comtradeplus.un.org/TermsOfUse",
                    "dataset_release": f"UN Comtrade accessed {datetime.now(timezone.utc).date().isoformat()}",
                },
            )
            for spec in SPECS
        ]

    def _url(self, commodity_code: str, year: int) -> str:
        self._require_key()
        base = COMTRADE_DATA
        # UN Comtrade uses an empty reporter selector for an all-reporter query.
        # The literal value "all" is invalid and returns HTTP 400. Keep optional
        # breakdown facets out of the request unless they are actually needed.
        params: list[tuple[str, str]] = [
            ("period", str(year)),
            ("reporterCode", ""),
            ("flowCode", "X"),
            ("partnerCode", "0"),
            ("cmdCode", commodity_code),
            ("maxRecords", "250000"),
            ("format", "JSON"),
            ("breakdownMode", "classic"),
            ("includeDesc", "true"),
        ]
        params.append(("subscription-key", self.subscription_key))
        return f"{base}?{urlencode(params)}"

    def _get_json(self, url: str) -> Any:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.request_delay:
            time.sleep(self.request_delay - elapsed)
        try:
            return self.http.get_json(url)
        except HttpStatusError as error:
            if error.status == 403 and "quota" in str(error).lower():
                raise ComtradeQuotaExhausted(
                    "UN Comtrade quota is exhausted. Imported categories were saved; rerun later to continue with the remaining categories."
                ) from error
            raise
        finally:
            self._last_request_at = time.monotonic()

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        codes = tuple(str(code) for code in candidate.metadata.get("commodity_codes", []))
        now = datetime.now(timezone.utc).year
        first_year = max(2022, now - 5)

        # Fetch the newest complete common year first. GeoStats only needs one
        # comparable country snapshot; downloading every recent year wastes quota.
        for year in range(now - 1, first_year - 1, -1):
            by_country: dict[str, dict[str, Any]] = {}
            for code in codes:
                url = self._url(code, year)
                payload = self._get_json(url)
                error = _api_error(payload)
                if error:
                    if "quota" in error.lower():
                        raise ComtradeQuotaExhausted(
                            "UN Comtrade quota is exhausted. Imported categories were saved; rerun later to continue."
                        )
                    raise RuntimeError(f"UN Comtrade rejected HS {code} for {year}: {error}")
                data = _rows(payload)
                if not data:
                    print(f"UN Comtrade returned no rows for HS {code} in {year}.", flush=True)
                for index, row in enumerate(data):
                    iso3 = normalize_iso3(_first(row, "reporterISO", "reporterIso", "reporterISO3", "reporterCodeISOAlpha3"))
                    if not iso3:
                        continue
                    value = _number(_first(row, "primaryValue", "tradeValue", "TradeValue", "fobvalue", "cifvalue"))
                    if value is None or value <= 0:
                        continue
                    current = by_country.setdefault(iso3, {
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
                for iso3, values in by_country.items()
            ]
            if len(observations) >= candidate.rule.min_coverage:
                return sorted(observations, key=lambda row: row.country_iso3)
            print(
                f"UN Comtrade HS {', '.join(codes)} has {len(observations)} countries in {year}; "
                f"trying the previous year (minimum {candidate.rule.min_coverage}).",
                flush=True,
            )

        raise RuntimeError(
            f"No completed year since {first_year} reached the {candidate.rule.min_coverage}-country coverage requirement."
        )

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"comtrade:{candidate.rule.key}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import curated UN Comtrade export categories through GeoStats automatic governance.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--minimum-successes", type=int, default=0, help="Optional minimum successful categories for this run.")
    parser.add_argument("--require-complete", action="store_true", help="Fail unless every selected missing category imports in this run.")
    parser.add_argument("--refresh-existing", action="store_true", help="Re-import categories already present instead of resuming only missing categories.")
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

    importer = ComtradeImporter(warehouse, dry_run=args.dry_run)
    selected_keys = set(args.rule)
    if warehouse is not None and not args.refresh_existing and not selected_keys:
        existing_codes = warehouse.list_source_indicator_codes(importer.source_organization)
        selected_keys = {
            spec.rule.key for spec in SPECS
            if "+".join(spec.commodity_codes) not in existing_codes
        }
        print(f"Resume mode: {len(SPECS) - len(selected_keys)} categories already exist; {len(selected_keys)} remain.", flush=True)
        if not selected_keys:
            print("All 55 UN Comtrade categories are already present. Nothing to import.", flush=True)
            return 0

    result = importer.run(limit=args.limit, only_keys=selected_keys or None)
    print(result, flush=True)
    requested = len(selected_keys) if selected_keys else (len(SPECS) if args.limit is None else min(args.limit, len(SPECS)))
    successes = int(result["categories_processed"])
    minimum = requested if args.require_complete else min(max(0, args.minimum_successes), requested)
    if successes < minimum:
        print(f"UN Comtrade import did not meet the requested run minimum: {successes} < {minimum}.", flush=True)
        return 1
    if successes == 0 and result.get("failures") and not result.get("stopped_reason"):
        print("UN Comtrade imported no categories because of non-quota errors.", flush=True)
        return 1
    remaining = max(0, requested - successes)
    if remaining:
        print(f"Partial success: {successes} categories imported and saved; up to {remaining} remain for a later run.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
