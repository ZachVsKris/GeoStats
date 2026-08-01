#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
from collections import defaultdict
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name, country_name_to_iso3
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_PAGE = "https://volcano.si.edu/volcanolist_holocene.cfm"
METHODOLOGY_URL = "https://volcano.si.edu/gvp_votw.cfm"
WFS_BASE = "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows"
TYPE_NAME = "GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes"
DATASET_RELEASE = "Smithsonian Volcanoes of the World v5.3.6, 2026-05-26"
STATIC_YEAR = 2026


RULES = (
    IndicatorRule(
        key="most-holocene-volcanoes",
        title="Most volcanoes",
        description="Number of Smithsonian-listed volcanoes active during the Holocene, approximately the last 12,000 years.",
        plain_language_description="Number of Smithsonian-listed volcanoes active during the last roughly 12,000 years.",
        technical_definition="Count of Holocene volcano records assigned to each country in the Smithsonian Volcanoes of the World database.",
        unit_explanation="Holocene volcanoes",
        family="Geology",
        icon="🌋",
        unit="volcanoes",
        value_type="total",
        ranking_direction="high",
        include=("volcano",),
        min_coverage=45,
        evidence_tier="A",
        source_priority=12,
        specificity_score=98,
        recognizability_score=99,
        understandability_score=99,
        fun_score=99,
        objective_status="objective",
    ),
    IndicatorRule(
        key="highest-volcano",
        title="Highest volcano",
        description="Elevation of the country’s highest Smithsonian-listed Holocene volcano.",
        plain_language_description="Elevation of the country’s highest volcano active during the last roughly 12,000 years.",
        technical_definition="Maximum elevation among Holocene volcano records assigned to each country in the Smithsonian Volcanoes of the World database.",
        unit_explanation="meters above sea level",
        family="Geology",
        icon="🌋",
        unit="meters",
        value_type="other",
        ranking_direction="high",
        include=("elevation",),
        min_coverage=45,
        evidence_tier="A",
        source_priority=13,
        specificity_score=98,
        recognizability_score=98,
        understandability_score=98,
        fun_score=98,
        objective_status="objective",
    ),
)


def _norm(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _first(properties: dict[str, Any], aliases: set[str]) -> Any:
    for key, value in properties.items():
        if _norm(key) in aliases and value not in (None, ""):
            return value
    return None


def _as_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return None


def _country_parts(value: Any) -> list[str]:
    raw = str(value or "").strip()
    if not raw:
        return []
    return [part.strip() for part in re.split(r"\s*(?:,|;|/)\s*", raw, flags=re.I) if part.strip()]


class SmithsonianVolcanoImporter(WarehouseImporter):
    source_organization = "Smithsonian GVP"
    source_dataset = "Volcanoes of the World: Holocene Volcanoes"
    source_slug = "smithsoniangvp"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False):
        super().__init__(warehouse, dry_run=dry_run)
        self._features: list[dict[str, Any]] | None = None

    def _load_features(self) -> list[dict[str, Any]]:
        if self._features is not None:
            return self._features
        url = WFS_BASE + "?" + urlencode({
            "service": "WFS",
            "version": "1.0.0",
            "request": "GetFeature",
            "typeName": TYPE_NAME,
            "outputFormat": "application/json",
        })
        request = Request(url, headers={"User-Agent": "GeoStats/15.5 Smithsonian volcano importer"})
        with urlopen(request, timeout=240) as response:
            payload = json.load(response)
        features = payload.get("features") if isinstance(payload, dict) else None
        if not isinstance(features, list) or len(features) < 500:
            raise RuntimeError(f"Smithsonian WFS returned only {len(features or [])} volcano features.")
        self._features = [feature for feature in features if isinstance(feature, dict)]
        return self._features

    def _country_metrics(self) -> dict[str, dict[str, Any]]:
        metrics: dict[str, dict[str, Any]] = defaultdict(lambda: {"count": 0, "max_elevation": None, "country": ""})
        country_aliases = {
            "country", "countryname", "countries", "locationcountry",
            "primarycountry", "countryterritory",
        }
        elevation_aliases = {
            "elevation", "elevationm", "elevationmeters", "elevm", "summitelevation",
        }
        name_aliases = {"volcanoname", "volcano", "primaryvolcanoname", "name"}
        for feature in self._load_features():
            properties = feature.get("properties") if isinstance(feature.get("properties"), dict) else {}
            country_value = _first(properties, country_aliases)
            elevation = _as_float(_first(properties, elevation_aliases))
            volcano_name = str(_first(properties, name_aliases) or feature.get("id") or "")
            for country_name in _country_parts(country_value):
                iso3 = country_name_to_iso3(country_name)
                if not iso3:
                    continue
                item = metrics[iso3]
                item["count"] += 1
                item["country"] = canonical_country_name(iso3, country_name)
                if elevation is not None and (item["max_elevation"] is None or elevation > item["max_elevation"]):
                    item["max_elevation"] = elevation
                    item["highest_volcano"] = volcano_name
        if len(metrics) < 40:
            raise RuntimeError(f"Only {len(metrics)} GeoStats countries matched Smithsonian volcano records.")
        return metrics

    def discover(self) -> list[CandidateDefinition]:
        return [
            CandidateDefinition(
                rule=rule,
                source_indicator_code=f"GVP_HOLOCENE_{rule.key.upper().replace('-', '_')}",
                source_indicator_name=rule.title,
                source_url=SOURCE_PAGE,
                metadata={
                    "source_page_url": SOURCE_PAGE,
                    "exact_query_url": WFS_BASE,
                    "api_url": WFS_BASE,
                    "dataset_release": DATASET_RELEASE,
                    "license_name": "Smithsonian Institution Terms of Use",
                    "license_url": "https://www.si.edu/termsofuse",
                    "minimum_year": STATIC_YEAR,
                    "source_query": {
                        "service": "WFS",
                        "typeName": TYPE_NAME,
                        "referencePeriod": "Holocene (~12,000 years)",
                        "metric": rule.key,
                    },
                    "methodology_url": METHODOLOGY_URL,
                    "broadDomain": "geology",
                    "knowledgeCluster": "volcanoes",
                    "strategyFamily": "volcanic-geography",
                },
            )
            for rule in RULES
        ]

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"smithsonian-gvp:{candidate.rule.key}"

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        metric_key = "count" if candidate.rule.key == "most-holocene-volcanoes" else "max_elevation"
        observations: list[SourceObservation] = []
        for iso3, item in self._country_metrics().items():
            value = item.get(metric_key)
            if value is None:
                continue
            observations.append(SourceObservation(
                country_iso3=iso3,
                country_name=str(item["country"]),
                data_year=STATIC_YEAR,
                value=float(value),
                source_url=SOURCE_PAGE,
                source_record_id=f"{iso3}:{candidate.rule.key}",
                evidence_status="official",
                metadata={
                    "reference_period": "Holocene (~12,000 years)",
                    "highest_volcano": item.get("highest_volcano"),
                    "wfs_type_name": TYPE_NAME,
                },
            ))
        return observations


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", action="append", default=[])
    args = parser.parse_args()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not args.dry_run and (not url or not key):
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.")
    warehouse = None if args.dry_run else SupabaseWarehouse(url or "", key or "")
    result = SmithsonianVolcanoImporter(warehouse, dry_run=args.dry_run).run(only_keys=set(args.only) or None)
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
