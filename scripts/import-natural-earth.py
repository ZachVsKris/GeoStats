#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
import os
import re
import tempfile
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import shapefile
from pyproj import Geod
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Polygon, shape
from shapely.ops import unary_union

from data_pipeline.base import WarehouseImporter
from data_pipeline.countries import normalize_iso3
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

NE_COUNTRIES = "https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_countries.zip"
NE_PAGE = "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/"
NE_VERSION = "5.1.1"
GEOD = Geod(ellps="WGS84")
STATIC_YEAR = datetime.now(timezone.utc).year


def rule(key: str, title: str, icon: str, unit: str, direction: str, *, min_coverage: int = 150) -> IndicatorRule:
    return IndicatorRule(
        key=key,
        title=title,
        description=f"{title}, derived consistently from Natural Earth 1:10m country geometries.",
        family="Geography",
        icon=icon,
        unit=unit,
        value_type="other",
        ranking_direction=direction,  # type: ignore[arg-type]
        include=(key,),
        min_coverage=min_coverage,
        evidence_tier="B",
        source_priority=15,
        specificity_score=92,
        recognizability_score=94,
    )


RULES: tuple[IndicatorRule, ...] = (
    rule("most-land-neighbors", "Most land-border neighbors", "🤝", "neighboring countries", "high"),
    rule("longest-land-border", "Longest total land border", "🧱", "kilometers", "high"),
    rule("longest-coastline", "Longest coastline", "🌊", "kilometers", "high"),
    rule("most-separate-land-areas", "Most separate land areas", "🏝️", "land areas of at least 25 km²", "high"),
    rule("largest-geographic-span", "Largest geographic span", "↔️", "kilometers", "high"),
    rule("largest-north-south-span", "Largest north-south span", "↕️", "kilometers", "high"),
    rule("northernmost-country", "Northernmost country", "🧭", "degrees north", "high"),
    rule("southernmost-country", "Southernmost country", "🧭", "degrees latitude", "low"),
)


def _iter_polygons(geometry: Any) -> Iterable[Polygon]:
    if isinstance(geometry, Polygon):
        yield geometry
    elif isinstance(geometry, MultiPolygon):
        yield from geometry.geoms


def _exterior_lines(geometry: Any) -> Any:
    lines = [LineString(poly.exterior.coords) for poly in _iter_polygons(geometry) if len(poly.exterior.coords) >= 2]
    if not lines:
        return LineString()
    return lines[0] if len(lines) == 1 else MultiLineString(lines)


def _geodesic_length_km(geometry: Any) -> float:
    if geometry is None or geometry.is_empty:
        return 0.0
    try:
        return abs(float(GEOD.geometry_length(geometry))) / 1000.0
    except Exception:
        total = 0.0
        geoms = getattr(geometry, "geoms", [geometry])
        for item in geoms:
            coords = list(getattr(item, "coords", []))
            if len(coords) >= 2:
                total += abs(GEOD.line_length([c[0] for c in coords], [c[1] for c in coords])) / 1000.0
        return total


def _polygon_area_km2(poly: Polygon) -> float:
    area, _ = GEOD.geometry_area_perimeter(poly)
    return abs(float(area)) / 1_000_000.0


def _all_exterior_coords(geometry: Any) -> list[tuple[float, float]]:
    coords: list[tuple[float, float]] = []
    for poly in _iter_polygons(geometry):
        coords.extend((float(x), float(y)) for x, y, *_ in poly.exterior.coords)
    return coords


def _extreme_points(coords: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if not coords:
        return []
    funcs = (
        lambda p: p[0], lambda p: -p[0], lambda p: p[1], lambda p: -p[1],
        lambda p: p[0] + p[1], lambda p: -(p[0] + p[1]),
        lambda p: p[0] - p[1], lambda p: -(p[0] - p[1]),
    )
    points = {max(coords, key=func) for func in funcs}
    return list(points)


def _max_geodesic_span_km(coords: list[tuple[float, float]]) -> float:
    points = _extreme_points(coords)
    maximum = 0.0
    for index, left in enumerate(points):
        for right in points[index + 1:]:
            _, _, meters = GEOD.inv(left[0], left[1], right[0], right[1])
            maximum = max(maximum, abs(meters) / 1000.0)
    return maximum


def _minimal_longitude_center(longitudes: list[float]) -> float:
    if not longitudes:
        return 0.0
    values = sorted(((value + 360.0) % 360.0) for value in longitudes)
    if len(values) == 1:
        return ((values[0] + 180) % 360) - 180
    gaps = [(values[(i + 1) % len(values)] - values[i]) % 360 for i in range(len(values))]
    gap_index = max(range(len(gaps)), key=gaps.__getitem__)
    start = values[(gap_index + 1) % len(values)]
    span = 360.0 - gaps[gap_index]
    center = (start + span / 2.0) % 360.0
    return ((center + 180.0) % 360.0) - 180.0


def _north_south_span_km(coords: list[tuple[float, float]]) -> float:
    if not coords:
        return 0.0
    min_lat = min(value[1] for value in coords)
    max_lat = max(value[1] for value in coords)
    center_lon = _minimal_longitude_center([value[0] for value in coords])
    _, _, meters = GEOD.inv(center_lon, min_lat, center_lon, max_lat)
    return abs(meters) / 1000.0


def _bounds_overlap(left: tuple[float, float, float, float], right: tuple[float, float, float, float]) -> bool:
    return not (left[2] < right[0] or right[2] < left[0] or left[3] < right[1] or right[3] < left[1])


class NaturalEarthImporter(WarehouseImporter):
    source_organization = "Natural Earth"
    source_dataset = f"Natural Earth 1:10m v{NE_VERSION}"
    source_slug = "climate"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.http = HttpClient(timeout=180, retries=5)
        self._metrics: dict[str, dict[str, tuple[str, float]]] | None = None

    def discover(self) -> list[CandidateDefinition]:
        return [CandidateDefinition(
            rule=concept,
            source_indicator_code=concept.key,
            source_indicator_name=concept.title,
            source_url=NE_PAGE,
            metadata={
                "natural_earth_version": NE_VERSION,
                "natural_earth_scale": "1:10m",
                "static_geography": True,
                "derivation": concept.key,
                "boundary_model": "Natural Earth de facto country boundaries",
            },
        ) for concept in RULES]

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        metrics = self._ensure_metrics()
        values = metrics.get(candidate.rule.key, {})
        observations = [SourceObservation(
            country_iso3=iso3,
            country_name=name,
            data_year=STATIC_YEAR,
            value=value,
            source_url=NE_PAGE,
            source_record_id=f"natural-earth:{NE_VERSION}:{candidate.rule.key}:{iso3}",
            evidence_status="unknown",
            metadata={
                "natural_earth_version": NE_VERSION,
                "static_geography": True,
                "calculation_year": STATIC_YEAR,
                "boundary_model": "Natural Earth de facto country boundaries",
            },
        ) for iso3, (name, value) in values.items() if math.isfinite(value)]
        if len(observations) < 100:
            raise RuntimeError(f"Only {len(observations)} country observations were derived for {candidate.rule.key}.")
        return sorted(observations, key=lambda row: row.country_iso3)

    def _ensure_metrics(self) -> dict[str, dict[str, tuple[str, float]]]:
        if self._metrics is not None:
            return self._metrics
        with tempfile.TemporaryDirectory(prefix="geostats-natural-earth-") as directory:
            archive = Path(directory) / "countries.zip"
            archive.write_bytes(self.http.get_bytes(NE_COUNTRIES, accept="application/zip,*/*"))
            with zipfile.ZipFile(archive) as zipped:
                zipped.extractall(directory)
            shp_files = list(Path(directory).glob("*.shp"))
            if not shp_files:
                raise RuntimeError("Natural Earth archive did not contain a shapefile.")
            geometries, names = self._read_countries(shp_files[0])
        self._metrics = self._derive_metrics(geometries, names)
        return self._metrics

    @staticmethod
    def _read_countries(path: Path) -> tuple[dict[str, Any], dict[str, str]]:
        reader = shapefile.Reader(str(path), encoding="utf-8")
        fields = [field[0] for field in reader.fields[1:]]
        pieces: dict[str, list[Any]] = defaultdict(list)
        names: dict[str, str] = {}
        for shape_record in reader.iterShapeRecords():
            properties = dict(zip(fields, shape_record.record))
            raw_code = next((properties.get(key) for key in ("ADM0_A3", "ISO_A3", "SOV_A3", "GU_A3") if properties.get(key) not in (None, "", "-99")), None)
            iso3 = normalize_iso3(raw_code)
            if not iso3:
                continue
            geometry = shape(shape_record.shape.__geo_interface__)
            if geometry.is_empty:
                continue
            if not geometry.is_valid:
                geometry = geometry.buffer(0)
            if geometry.is_empty:
                continue
            pieces[iso3].append(geometry)
            names[iso3] = str(next((properties.get(key) for key in ("NAME_LONG", "ADMIN", "NAME_EN", "NAME") if properties.get(key)), iso3))
        geometries = {iso3: unary_union(parts) for iso3, parts in pieces.items()}
        if len(geometries) < 180:
            raise RuntimeError(f"Natural Earth normalization produced only {len(geometries)} GeoStats countries.")
        return geometries, names

    @staticmethod
    def _derive_metrics(geometries: dict[str, Any], names: dict[str, str]) -> dict[str, dict[str, tuple[str, float]]]:
        iso_codes = sorted(geometries)
        exteriors = {iso3: _exterior_lines(geometries[iso3]) for iso3 in iso_codes}
        perimeters = {iso3: _geodesic_length_km(exteriors[iso3]) for iso3 in iso_codes}
        border_lengths = {iso3: 0.0 for iso3 in iso_codes}
        neighbor_counts = {iso3: 0 for iso3 in iso_codes}
        for position, left_iso in enumerate(iso_codes):
            left = exteriors[left_iso]
            for right_iso in iso_codes[position + 1:]:
                right = exteriors[right_iso]
                if not _bounds_overlap(left.bounds, right.bounds):
                    continue
                shared = left.intersection(right)
                length = _geodesic_length_km(shared)
                if length < 1.0:
                    continue
                border_lengths[left_iso] += length
                border_lengths[right_iso] += length
                neighbor_counts[left_iso] += 1
                neighbor_counts[right_iso] += 1

        metrics: dict[str, dict[str, tuple[str, float]]] = {rule.key: {} for rule in RULES}
        for iso3 in iso_codes:
            geometry = geometries[iso3]
            coords = _all_exterior_coords(geometry)
            if not coords:
                continue
            name = names.get(iso3, iso3)
            separate_land_areas = sum(_polygon_area_km2(poly) >= 25.0 for poly in _iter_polygons(geometry))
            coastline = max(0.0, perimeters[iso3] - border_lengths[iso3])
            metrics["most-land-neighbors"][iso3] = (name, float(neighbor_counts[iso3]))
            metrics["longest-land-border"][iso3] = (name, border_lengths[iso3])
            metrics["longest-coastline"][iso3] = (name, coastline)
            metrics["most-separate-land-areas"][iso3] = (name, float(separate_land_areas))
            metrics["largest-geographic-span"][iso3] = (name, _max_geodesic_span_km(coords))
            metrics["largest-north-south-span"][iso3] = (name, _north_south_span_km(coords))
            metrics["northernmost-country"][iso3] = (name, max(point[1] for point in coords))
            metrics["southernmost-country"][iso3] = (name, min(point[1] for point in coords))
        return metrics

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"natural-earth:{candidate.rule.key}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import Natural Earth-derived geography categories through GeoStats automatic governance.")
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
    result = NaturalEarthImporter(warehouse, dry_run=args.dry_run).run(limit=args.limit, only_keys=set(args.rule) or None)
    print(result, flush=True)
    return 1 if result["failures"] and result["categories_processed"] == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
