#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
import os
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
NE_RIVERS = "https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_rivers_lake_centerlines.zip"
NE_LAKES = "https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_lakes.zip"
NE_GLACIATED = "https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_glaciated_areas.zip"
NE_COUNTRY_PAGE = "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/"
NE_PHYSICAL_PAGE = "https://www.naturalearthdata.com/downloads/10m-physical-vectors/"
NE_LICENSE = "https://www.naturalearthdata.com/about/terms-of-use/"
COUNTRY_VERSION = "5.1.1"
LAYER_VERSIONS = {"countries": COUNTRY_VERSION, "rivers": "5.0.0", "lakes": "5.0.0", "glaciated": "4.0.0"}
GEOD = Geod(ellps="WGS84")
STATIC_YEAR = datetime.now(timezone.utc).year
DERIVATION_VERSION = "geostats-natural-earth-v14.0.0"

LAYER_URLS = {
    "countries": NE_COUNTRIES,
    "rivers": NE_RIVERS,
    "lakes": NE_LAKES,
    "glaciated": NE_GLACIATED,
}


def rule(
    key: str,
    title: str,
    description: str,
    icon: str,
    unit: str,
    direction: str,
    *,
    layer: str = "countries",
    min_coverage: int = 150,
    understandability: int = 92,
    fun: int = 88,
) -> IndicatorRule:
    return IndicatorRule(
        key=key,
        title=title,
        description=description,
        plain_language_description=description,
        technical_definition=f"{description} Calculated by GeoStats from Natural Earth 1:10m versioned vector layers.",
        unit_explanation=unit,
        family="Geography",
        icon=icon,
        unit=unit,
        value_type="other",
        ranking_direction=direction,  # type: ignore[arg-type]
        include=(key,),
        min_coverage=min_coverage,
        evidence_tier="B",
        source_priority=15,
        specificity_score=94,
        recognizability_score=understandability,
        understandability_score=understandability,
        fun_score=fun,
        objective_status="objective",
    )


RULES: tuple[IndicatorRule, ...] = (
    rule("most-land-neighbors", "Most land-border neighbors", "Number of countries sharing a mapped land border.", "🤝", "neighboring countries", "high", fun=96),
    rule("longest-land-border", "Longest total land border", "Combined length of all mapped international land borders.", "🧱", "kilometers", "high", fun=94),
    rule("longest-single-land-border", "Longest single land border", "Length of the country’s longest mapped border with one neighbor.", "🗺️", "kilometers", "high", fun=96),
    rule("longest-coastline", "Longest mapped coastline", "Coastline length measured consistently from Natural Earth’s 1:10m geometry.", "🌊", "kilometers", "high", understandability=97, fun=99),
    rule("highest-coastline-density", "Most coastline for its size", "Mapped coastline kilometers per 1,000 square kilometers of land.", "🏖️", "km per 1,000 km²", "high", understandability=94, fun=97),
    rule("most-separate-land-areas", "Most separate land areas", "Number of separate mapped land pieces covering at least 25 square kilometers.", "🏝️", "land areas", "high", fun=94),
    rule("most-large-land-areas", "Most large separate land areas", "Number of separate mapped land pieces covering at least 100 square kilometers.", "🏝️", "land areas", "high", fun=92),
    rule("largest-continuous-land-area", "Largest continuous land area", "Area of the country’s largest single connected land piece.", "🗺️", "square kilometers", "high", fun=91),
    rule("largest-geographic-span", "Largest geographic span", "Longest straight-line distance between two mapped points in the country.", "↔️", "kilometers", "high", fun=90),
    rule("largest-north-south-span", "Largest north-south span", "Distance between the country’s northernmost and southernmost mapped points.", "↕️", "kilometers", "high", fun=92),
    rule("largest-east-west-span", "Largest east-west span", "Shortest globe-wrapping distance across the country from west to east.", "↔️", "kilometers", "high", fun=90),
    rule("northernmost-country", "Northernmost country", "Latitude of the country’s northernmost mapped point.", "🧭", "degrees north", "high", fun=95),
    rule("southernmost-country", "Southernmost country", "Latitude of the country’s southernmost mapped point.", "🧭", "degrees latitude", "low", fun=95),
    rule("farthest-from-equator", "Farthest from the equator", "Absolute latitude of the country geometry’s center point.", "🌐", "degrees latitude", "high", fun=88),
    rule("largest-geodesic-land-area", "Largest mapped land area", "Land area calculated directly from the same global country geometry.", "🗺️", "square kilometers", "high", fun=90),
    rule("most-mapped-river-length", "Most mapped river length", "Combined length of Natural Earth river lines inside the country.", "🏞️", "kilometers", "high", layer="rivers", fun=96),
    rule("highest-mapped-river-density", "Highest mapped river density", "Mapped river kilometers per 1,000 square kilometers of land.", "💧", "km per 1,000 km²", "high", layer="rivers", fun=92),
    rule("most-mapped-rivers", "Most mapped rivers", "Number of Natural Earth river features crossing the country for at least one kilometer.", "🌊", "river features", "high", layer="rivers", fun=94),
    rule("largest-mapped-lake-area", "Largest total mapped lake area", "Combined area of Natural Earth lakes and reservoirs inside the country.", "🏞️", "square kilometers", "high", layer="lakes", fun=97),
    rule("largest-single-mapped-lake", "Largest mapped lake", "Largest single Natural Earth lake or reservoir area inside the country.", "🌅", "square kilometers", "high", layer="lakes", fun=98),
    rule("most-mapped-lakes", "Most mapped lakes", "Number of Natural Earth lakes covering at least one square kilometer inside the country.", "💦", "lakes", "high", layer="lakes", fun=96),
    rule("highest-mapped-lake-share", "Highest mapped lake coverage", "Share of mapped land area covered by Natural Earth lakes and reservoirs.", "💧", "% of land", "high", layer="lakes", fun=92),
    rule("largest-mapped-glaciated-area", "Largest mapped glaciated area", "Combined Natural Earth glaciated-area polygons inside the country.", "🧊", "square kilometers", "high", layer="glaciated", fun=97),
    rule("highest-mapped-glaciated-share", "Highest mapped glaciated coverage", "Share of mapped land covered by Natural Earth glaciated areas.", "❄️", "% of land", "high", layer="glaciated", fun=95),
)

RULE_LAYER = {
    key: layer
    for layer, keys in {
        "rivers": {"most-mapped-river-length", "highest-mapped-river-density", "most-mapped-rivers"},
        "lakes": {"largest-mapped-lake-area", "largest-single-mapped-lake", "most-mapped-lakes", "highest-mapped-lake-share"},
        "glaciated": {"largest-mapped-glaciated-area", "highest-mapped-glaciated-share"},
    }.items()
    for key in keys
}


def _iter_polygons(geometry: Any) -> Iterable[Polygon]:
    if isinstance(geometry, Polygon):
        yield geometry
    elif isinstance(geometry, MultiPolygon):
        yield from geometry.geoms
    else:
        for item in getattr(geometry, "geoms", []):
            yield from _iter_polygons(item)


def _iter_lines(geometry: Any) -> Iterable[LineString]:
    if isinstance(geometry, LineString):
        yield geometry
    elif isinstance(geometry, MultiLineString):
        yield from geometry.geoms
    else:
        for item in getattr(geometry, "geoms", []):
            yield from _iter_lines(item)


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
        for item in _iter_lines(geometry):
            coords = list(item.coords)
            if len(coords) >= 2:
                total += abs(GEOD.line_length([c[0] for c in coords], [c[1] for c in coords])) / 1000.0
        return total


def _polygon_area_km2(poly: Polygon) -> float:
    area, _ = GEOD.geometry_area_perimeter(poly)
    return abs(float(area)) / 1_000_000.0


def _geodesic_area_km2(geometry: Any) -> float:
    return sum(_polygon_area_km2(poly) for poly in _iter_polygons(geometry))


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
    return list({max(coords, key=func) for func in funcs})


def _max_geodesic_span_km(coords: list[tuple[float, float]]) -> float:
    points = _extreme_points(coords)
    maximum = 0.0
    for index, left in enumerate(points):
        for right in points[index + 1:]:
            _, _, meters = GEOD.inv(left[0], left[1], right[0], right[1])
            maximum = max(maximum, abs(meters) / 1000.0)
    return maximum


def _minimal_longitude_arc(longitudes: list[float]) -> tuple[float, float]:
    if not longitudes:
        return 0.0, 0.0
    values = sorted(((value + 360.0) % 360.0) for value in longitudes)
    if len(values) == 1:
        return values[0], 0.0
    gaps = [(values[(i + 1) % len(values)] - values[i]) % 360 for i in range(len(values))]
    gap_index = max(range(len(gaps)), key=gaps.__getitem__)
    start = values[(gap_index + 1) % len(values)]
    span = 360.0 - gaps[gap_index]
    return start, span


def _minimal_longitude_center(longitudes: list[float]) -> float:
    start, span = _minimal_longitude_arc(longitudes)
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


def _east_west_span_km(coords: list[tuple[float, float]]) -> float:
    if not coords:
        return 0.0
    start, span = _minimal_longitude_arc([value[0] for value in coords])
    center_lat = (min(value[1] for value in coords) + max(value[1] for value in coords)) / 2.0
    start_lon = ((start + 180.0) % 360.0) - 180.0
    end_lon = (((start + span) % 360.0) + 180.0) % 360.0 - 180.0
    _, _, meters = GEOD.inv(start_lon, center_lat, end_lon, center_lat)
    return abs(meters) / 1000.0


def _bounds_overlap(left: tuple[float, float, float, float], right: tuple[float, float, float, float]) -> bool:
    return not (left[2] < right[0] or right[2] < left[0] or left[3] < right[1] or right[3] < left[1])


def _valid_geometry(raw: Any) -> Any | None:
    geometry = shape(raw.__geo_interface__) if hasattr(raw, "__geo_interface__") else raw
    if geometry is None or geometry.is_empty:
        return None
    if not geometry.is_valid:
        geometry = geometry.buffer(0)
    return None if geometry.is_empty else geometry


class NaturalEarthImporter(WarehouseImporter):
    source_organization = "Natural Earth"
    source_dataset = "Natural Earth 1:10m cultural and physical vectors"
    source_slug = "naturalearth"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.http = HttpClient(timeout=180, retries=5, user_agent="GeoStats/14.0 Natural-Earth spatial importer")
        self._metrics: dict[str, dict[str, tuple[str, float]]] | None = None
        self._layer_errors: dict[str, str] = {}

    def discover(self) -> list[CandidateDefinition]:
        discovered: list[CandidateDefinition] = []
        for concept in RULES:
            layer = RULE_LAYER.get(concept.key, "countries")
            download_url = LAYER_URLS[layer]
            discovered.append(CandidateDefinition(
                rule=concept,
                source_indicator_code=concept.key,
                source_indicator_name=concept.title,
                source_url=download_url,
                metadata={
                    "source_page_url": NE_PHYSICAL_PAGE if layer != "countries" else NE_COUNTRY_PAGE,
                    "download_url": download_url,
                    "exact_query_url": None,
                    "dataset_release": f"Natural Earth {layer} v{LAYER_VERSIONS[layer]}",
                    "retrieved_at": datetime.now(timezone.utc).isoformat(),
                    "license_name": "Natural Earth public domain",
                    "license_url": NE_LICENSE,
                    "natural_earth_version": LAYER_VERSIONS[layer],
                    "natural_earth_scale": "1:10m",
                    "static_geography": True,
                    "derivation": concept.key,
                    "derivation_method": concept.technical_definition,
                    "derivation_version": DERIVATION_VERSION,
                    "input_datasets": [{"name": f"Natural Earth {layer}", "version": LAYER_VERSIONS[layer], "url": download_url}],
                    "source_query": {"layer": layer, "scale": "1:10m", "boundary_model": "de facto country boundaries"},
                    "boundary_model": "Natural Earth de facto country boundaries",
                    "layer": layer,
                },
            ))
        return discovered

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        metrics = self._ensure_metrics()
        layer = str(candidate.metadata.get("layer") or "countries")
        if layer in self._layer_errors:
            raise RuntimeError(f"Natural Earth {layer} layer could not be processed: {self._layer_errors[layer]}")
        values = metrics.get(candidate.rule.key, {})
        observations = [SourceObservation(
            country_iso3=iso3,
            country_name=name,
            data_year=STATIC_YEAR,
            value=value,
            source_url=str(candidate.metadata.get("download_url") or candidate.source_url),
            source_record_id=f"natural-earth:{layer}:{LAYER_VERSIONS[layer]}:{candidate.rule.key}:{iso3}",
            evidence_status="unknown",
            metadata={
                "natural_earth_version": LAYER_VERSIONS[layer],
                "natural_earth_layer": layer,
                "natural_earth_scale": "1:10m",
                "static_geography": True,
                "calculation_year": STATIC_YEAR,
                "boundary_model": "Natural Earth de facto country boundaries",
                "derivation_version": DERIVATION_VERSION,
                "derivation_method": candidate.rule.technical_definition,
            },
        ) for iso3, (name, value) in values.items() if math.isfinite(value)]
        if len(observations) < 100:
            raise RuntimeError(f"Only {len(observations)} country observations were derived for {candidate.rule.key}.")
        return sorted(observations, key=lambda row: row.country_iso3)

    def _download_shapefile(self, directory: Path, layer: str) -> Path:
        archive = directory / f"{layer}.zip"
        archive.write_bytes(self.http.get_bytes(LAYER_URLS[layer], accept="application/zip,*/*"))
        target = directory / layer
        target.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive) as zipped:
            zipped.extractall(target)
        shp_files = list(target.rglob("*.shp"))
        if not shp_files:
            raise RuntimeError(f"Natural Earth {layer} archive did not contain a shapefile.")
        return shp_files[0]

    def _ensure_metrics(self) -> dict[str, dict[str, tuple[str, float]]]:
        if self._metrics is not None:
            return self._metrics
        with tempfile.TemporaryDirectory(prefix="geostats-natural-earth-") as raw_directory:
            directory = Path(raw_directory)
            country_path = self._download_shapefile(directory, "countries")
            geometries, names = self._read_countries(country_path)
            feature_layers: dict[str, list[Any]] = {}
            for layer in ("rivers", "lakes", "glaciated"):
                try:
                    path = self._download_shapefile(directory, layer)
                    feature_layers[layer] = self._read_feature_geometries(path)
                except Exception as error:
                    self._layer_errors[layer] = str(error)
                    feature_layers[layer] = []
                    print(f"Natural Earth optional layer warning ({layer}): {error}", flush=True)
        self._metrics = self._derive_metrics(geometries, names, feature_layers)
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
            geometry = _valid_geometry(shape_record.shape)
            if geometry is None:
                continue
            pieces[iso3].append(geometry)
            names[iso3] = str(next((properties.get(key) for key in ("NAME_LONG", "ADMIN", "NAME_EN", "NAME") if properties.get(key)), iso3))
        geometries = {iso3: unary_union(parts) for iso3, parts in pieces.items()}
        if len(geometries) < 180:
            raise RuntimeError(f"Natural Earth normalization produced only {len(geometries)} GeoStats countries.")
        return geometries, names

    @staticmethod
    def _read_feature_geometries(path: Path) -> list[Any]:
        reader = shapefile.Reader(str(path), encoding="utf-8")
        geometries: list[Any] = []
        for raw in reader.iterShapes():
            geometry = _valid_geometry(raw)
            if geometry is not None:
                geometries.append(geometry)
        if not geometries:
            raise RuntimeError(f"No usable geometries were found in {path.name}.")
        return geometries

    @staticmethod
    def _derive_metrics(
        geometries: dict[str, Any],
        names: dict[str, str],
        feature_layers: dict[str, list[Any]] | None = None,
    ) -> dict[str, dict[str, tuple[str, float]]]:
        feature_layers = feature_layers or {}
        iso_codes = sorted(geometries)
        exteriors = {iso3: _exterior_lines(geometries[iso3]) for iso3 in iso_codes}
        perimeters = {iso3: _geodesic_length_km(exteriors[iso3]) for iso3 in iso_codes}
        land_areas = {iso3: _geodesic_area_km2(geometries[iso3]) for iso3 in iso_codes}
        border_lengths = {iso3: 0.0 for iso3 in iso_codes}
        longest_single_borders = {iso3: 0.0 for iso3 in iso_codes}
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
                longest_single_borders[left_iso] = max(longest_single_borders[left_iso], length)
                longest_single_borders[right_iso] = max(longest_single_borders[right_iso], length)
                neighbor_counts[left_iso] += 1
                neighbor_counts[right_iso] += 1

        metrics: dict[str, dict[str, tuple[str, float]]] = {concept.key: {} for concept in RULES}
        for iso3 in iso_codes:
            geometry = geometries[iso3]
            coords = _all_exterior_coords(geometry)
            if not coords:
                continue
            name = names.get(iso3, iso3)
            area = land_areas[iso3]
            polygon_areas = [_polygon_area_km2(poly) for poly in _iter_polygons(geometry)]
            separate_land_areas = sum(piece_area >= 25.0 for piece_area in polygon_areas)
            large_land_areas = sum(piece_area >= 100.0 for piece_area in polygon_areas)
            largest_continuous_area = max(polygon_areas, default=0.0)
            coastline = max(0.0, perimeters[iso3] - border_lengths[iso3])
            centroid_lat = abs(float(geometry.centroid.y))
            metrics["most-land-neighbors"][iso3] = (name, float(neighbor_counts[iso3]))
            metrics["longest-land-border"][iso3] = (name, border_lengths[iso3])
            metrics["longest-single-land-border"][iso3] = (name, longest_single_borders[iso3])
            metrics["longest-coastline"][iso3] = (name, coastline)
            metrics["highest-coastline-density"][iso3] = (name, coastline / area * 1000.0 if area else 0.0)
            metrics["most-separate-land-areas"][iso3] = (name, float(separate_land_areas))
            metrics["most-large-land-areas"][iso3] = (name, float(large_land_areas))
            metrics["largest-continuous-land-area"][iso3] = (name, largest_continuous_area)
            metrics["largest-geographic-span"][iso3] = (name, _max_geodesic_span_km(coords))
            metrics["largest-north-south-span"][iso3] = (name, _north_south_span_km(coords))
            metrics["largest-east-west-span"][iso3] = (name, _east_west_span_km(coords))
            metrics["northernmost-country"][iso3] = (name, max(point[1] for point in coords))
            metrics["southernmost-country"][iso3] = (name, min(point[1] for point in coords))
            metrics["farthest-from-equator"][iso3] = (name, centroid_lat)
            metrics["largest-geodesic-land-area"][iso3] = (name, area)

        def aggregate_lines(features: list[Any]) -> tuple[dict[str, float], dict[str, int]]:
            totals = {iso3: 0.0 for iso3 in iso_codes}
            counts = {iso3: 0 for iso3 in iso_codes}
            for iso3 in iso_codes:
                country = geometries[iso3]
                for feature in features:
                    if not _bounds_overlap(country.bounds, feature.bounds):
                        continue
                    clipped = country.intersection(feature)
                    length = _geodesic_length_km(clipped)
                    if length >= 1.0:
                        totals[iso3] += length
                        counts[iso3] += 1
            return totals, counts

        def aggregate_polygons(features: list[Any]) -> tuple[dict[str, float], dict[str, int], dict[str, float]]:
            totals = {iso3: 0.0 for iso3 in iso_codes}
            counts = {iso3: 0 for iso3 in iso_codes}
            largest = {iso3: 0.0 for iso3 in iso_codes}
            for iso3 in iso_codes:
                country = geometries[iso3]
                for feature in features:
                    if not _bounds_overlap(country.bounds, feature.bounds):
                        continue
                    clipped = country.intersection(feature)
                    area = _geodesic_area_km2(clipped)
                    if area >= 1.0:
                        totals[iso3] += area
                        counts[iso3] += 1
                        largest[iso3] = max(largest[iso3], area)
            return totals, counts, largest

        river_lengths, river_counts = aggregate_lines(feature_layers.get("rivers", []))
        lake_areas, lake_counts, lake_largest = aggregate_polygons(feature_layers.get("lakes", []))
        glacier_areas, _, _ = aggregate_polygons(feature_layers.get("glaciated", []))

        for iso3 in iso_codes:
            name = names.get(iso3, iso3)
            area = land_areas[iso3]
            metrics["most-mapped-river-length"][iso3] = (name, river_lengths[iso3])
            metrics["highest-mapped-river-density"][iso3] = (name, river_lengths[iso3] / area * 1000.0 if area else 0.0)
            metrics["most-mapped-rivers"][iso3] = (name, float(river_counts[iso3]))
            metrics["largest-mapped-lake-area"][iso3] = (name, lake_areas[iso3])
            metrics["largest-single-mapped-lake"][iso3] = (name, lake_largest[iso3])
            metrics["most-mapped-lakes"][iso3] = (name, float(lake_counts[iso3]))
            metrics["highest-mapped-lake-share"][iso3] = (name, lake_areas[iso3] / area * 100.0 if area else 0.0)
            metrics["largest-mapped-glaciated-area"][iso3] = (name, glacier_areas[iso3])
            metrics["highest-mapped-glaciated-share"][iso3] = (name, glacier_areas[iso3] / area * 100.0 if area else 0.0)
        return metrics

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"natural-earth:{candidate.rule.key}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import reproducible Natural Earth country and physical-geography candidates.")
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
