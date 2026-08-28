#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from numbers import Integral
import os
import tempfile
import zipfile
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import shapefile
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name
from data_pipeline.countries import normalize_iso3
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

USGS_API = "https://earthquake.usgs.gov/fdsnws/event/1/query"
USGS_PAGE = "https://earthquake.usgs.gov/earthquakes/search/"
USGS_DOCS = "https://earthquake.usgs.gov/fdsnws/event/1/"
NE_COUNTRIES = "https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_countries.zip"
NE_COUNTRY_PAGE = "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/"
START_YEAR = 1970
MIN_MAGNITUDE = 6.0
STATIC_YEAR = date.today().year
DATASET_RELEASE = f"USGS ComCat through {STATIC_YEAR}-01-01; M{MIN_MAGNITUDE:g}+ since {START_YEAR}"


RULES = (
    IndicatorRule(
        key="most-major-earthquakes",
        title="Most major earthquakes",
        description=f"Number of magnitude {MIN_MAGNITUDE:g}+ earthquake epicenters inside the country since {START_YEAR}.",
        plain_language_description=f"Number of magnitude {MIN_MAGNITUDE:g}+ earthquake epicenters inside the country since {START_YEAR}.",
        technical_definition="Count of USGS ComCat earthquake events whose epicenter point intersects the Natural Earth 1:10m country land geometry.",
        unit_explanation=f"magnitude {MIN_MAGNITUDE:g}+ earthquakes",
        family="Natural hazards",
        icon="🌎",
        unit="earthquakes",
        value_type="total",
        ranking_direction="high",
        include=("earthquake",),
        min_coverage=45,
        evidence_tier="A",
        source_priority=13,
        specificity_score=98,
        recognizability_score=98,
        understandability_score=98,
        fun_score=98,
        objective_status="objective",
    ),
    IndicatorRule(
        key="strongest-earthquake",
        title="Strongest earthquake",
        description=f"Magnitude of the strongest earthquake epicenter inside the country since {START_YEAR}.",
        plain_language_description=f"Magnitude of the strongest earthquake epicenter inside the country since {START_YEAR}.",
        technical_definition="Maximum USGS ComCat magnitude among earthquake epicenters intersecting the Natural Earth 1:10m country land geometry.",
        unit_explanation="moment magnitude or the catalog’s preferred magnitude",
        family="Natural hazards",
        icon="📈",
        unit="magnitude",
        value_type="other",
        ranking_direction="high",
        include=("magnitude",),
        min_coverage=45,
        evidence_tier="A",
        source_priority=14,
        specificity_score=98,
        recognizability_score=98,
        understandability_score=98,
        fun_score=99,
        objective_status="objective",
    ),
)


class CountryLocator:
    def __init__(self, http: HttpClient):
        temporary = Path(tempfile.mkdtemp(prefix="geostats-usgs-ne-"))
        archive = temporary / "countries.zip"
        archive.write_bytes(http.get_bytes(NE_COUNTRIES))
        with zipfile.ZipFile(archive) as handle:
            handle.extractall(temporary)
        shp = next(temporary.rglob("*.shp"))
        reader = shapefile.Reader(str(shp), encoding="latin1")
        fields = [field[0] for field in reader.fields[1:]]
        geometries = []
        iso_by_index: list[str | None] = []
        for item in reader.iterShapeRecords():
            record = dict(zip(fields, item.record))
            iso3 = None
            for key in ("ADM0_A3", "SOV_A3", "GU_A3", "ISO_A3_EH", "ISO_A3"):
                iso3 = normalize_iso3(record.get(key))
                if iso3:
                    break
            geometry = shape(item.shape.__geo_interface__)
            if not geometry.is_valid:
                geometry = geometry.buffer(0)
            if geometry.is_empty:
                continue
            geometries.append(geometry)
            iso_by_index.append(iso3)
        self.geometries = geometries
        self.iso_by_index = iso_by_index
        self.tree = STRtree(geometries)

    def country_for(self, longitude: float, latitude: float) -> str | None:
        point = Point(longitude, latitude)
        candidates = self.tree.query(point)
        # Shapely 2 may return integer indexes; older behavior returns geometries.
        for candidate in candidates:
            if isinstance(candidate, Integral):
                index = int(candidate)
                geometry = self.geometries[index]
            else:
                geometry = candidate
                try:
                    index = self.geometries.index(geometry)
                except ValueError:
                    continue
            if geometry.covers(point):
                return self.iso_by_index[index]
        return None


class UsgsEarthquakeImporter(WarehouseImporter):
    source_organization = "USGS"
    source_dataset = "ANSS Comprehensive Earthquake Catalog (ComCat)"
    source_slug = "usgs"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False):
        super().__init__(warehouse, dry_run=dry_run)
        self.http = HttpClient(timeout=240, retries=6, user_agent="GeoStats/15.5 USGS earthquake importer")
        self._events: list[dict[str, Any]] | None = None
        self._metrics: dict[str, dict[str, Any]] | None = None

    def _load_events(self) -> list[dict[str, Any]]:
        if self._events is not None:
            return self._events
        events: list[dict[str, Any]] = []
        for start in range(START_YEAR, STATIC_YEAR + 1, 10):
            end = min(start + 10, STATIC_YEAR + 1)
            url = USGS_API + "?" + urlencode({
                "format": "geojson",
                "starttime": f"{start}-01-01",
                "endtime": f"{end}-01-01",
                "minmagnitude": MIN_MAGNITUDE,
                "eventtype": "earthquake",
                "orderby": "time-asc",
                "limit": 20000,
            })
            payload = self.http.get_json(url)
            features = payload.get("features") if isinstance(payload, dict) else None
            if not isinstance(features, list):
                raise RuntimeError(f"USGS returned an invalid feature collection for {start}-{end}.")
            if len(features) >= 20000:
                raise RuntimeError(f"USGS decade query {start}-{end} hit the 20,000-event limit; split the period further.")
            events.extend(feature for feature in features if isinstance(feature, dict))
        if len(events) < 1000:
            raise RuntimeError(f"USGS returned only {len(events)} M{MIN_MAGNITUDE:g}+ earthquakes since {START_YEAR}.")
        self._events = events
        return events

    def _country_metrics(self) -> dict[str, dict[str, Any]]:
        if self._metrics is not None:
            return self._metrics
        locator = CountryLocator(self.http)
        metrics: dict[str, dict[str, Any]] = defaultdict(lambda: {"count": 0, "max_magnitude": None, "event_id": None})
        for feature in self._load_events():
            geometry = feature.get("geometry") if isinstance(feature.get("geometry"), dict) else {}
            coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
            properties = feature.get("properties") if isinstance(feature.get("properties"), dict) else {}
            if not isinstance(coordinates, list) or len(coordinates) < 2:
                continue
            try:
                longitude, latitude = float(coordinates[0]), float(coordinates[1])
                magnitude = float(properties.get("mag"))
            except (TypeError, ValueError):
                continue
            iso3 = locator.country_for(longitude, latitude)
            if not iso3:
                continue
            item = metrics[iso3]
            item["count"] += 1
            if item["max_magnitude"] is None or magnitude > item["max_magnitude"]:
                item["max_magnitude"] = magnitude
                item["event_id"] = feature.get("id")
                item["event_url"] = properties.get("url")
        if len(metrics) < 40:
            raise RuntimeError(f"Only {len(metrics)} countries contained M{MIN_MAGNITUDE:g}+ earthquake epicenters.")
        self._metrics = metrics
        return metrics

    def discover(self) -> list[CandidateDefinition]:
        return [
            CandidateDefinition(
                rule=rule,
                source_indicator_code=f"USGS_COMCAT_{rule.key.upper().replace('-', '_')}_{START_YEAR}_{STATIC_YEAR}",
                source_indicator_name=rule.title,
                source_url=USGS_PAGE,
                metadata={
                    "source_page_url": USGS_PAGE,
                    "exact_query_url": USGS_API,
                    "api_url": USGS_API,
                    "dataset_release": DATASET_RELEASE,
                    "license_name": "U.S. Geological Survey data",
                    "license_url": "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
                    "minimum_year": STATIC_YEAR,
                    "source_query": {
                        "startYear": START_YEAR,
                        "endYearExclusive": STATIC_YEAR + 1,
                        "minimumMagnitude": MIN_MAGNITUDE,
                        "eventType": "earthquake",
                        "countryAttribution": "Natural Earth 1:10m land geometry",
                        "metric": rule.key,
                    },
                    "methodology_url": USGS_DOCS,
                    "derivation_method": "Point-in-polygon assignment of USGS earthquake epicenters to Natural Earth country land geometry.",
                    "derivation_version": "geostats-usgs-v15.5",
                    "input_datasets": [USGS_API, NE_COUNTRIES],
                    "broadDomain": "natural-hazards",
                    "knowledgeCluster": "earthquakes",
                    "strategyFamily": "seismic-activity",
                },
            )
            for rule in RULES
        ]

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"usgs:{candidate.rule.key}-since-{START_YEAR}"

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        metric = "count" if candidate.rule.key == "most-major-earthquakes" else "max_magnitude"
        observations: list[SourceObservation] = []
        for iso3, item in self._country_metrics().items():
            value = item.get(metric)
            if value is None:
                continue
            observations.append(SourceObservation(
                country_iso3=iso3,
                country_name=canonical_country_name(iso3),
                data_year=STATIC_YEAR,
                value=float(value),
                source_url=USGS_PAGE,
                source_record_id=f"{iso3}:{candidate.rule.key}:{START_YEAR}-{STATIC_YEAR}",
                evidence_status="official",
                metadata={
                    "minimum_magnitude": MIN_MAGNITUDE,
                    "start_year": START_YEAR,
                    "end_year": STATIC_YEAR,
                    "country_attribution": "epicenter inside Natural Earth 1:10m land geometry",
                    "strongest_event_id": item.get("event_id"),
                    "strongest_event_url": item.get("event_url"),
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
    result = UsgsEarthquakeImporter(warehouse, dry_run=args.dry_run).run(only_keys=set(args.only) or None)
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
