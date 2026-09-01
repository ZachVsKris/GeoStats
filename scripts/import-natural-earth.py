#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
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
NE_OCEAN = "https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_ocean.zip"
NE_COUNTRY_PAGE = "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/"
NE_PHYSICAL_PAGE = "https://www.naturalearthdata.com/downloads/10m-physical-vectors/"
NE_LICENSE = "https://www.naturalearthdata.com/about/terms-of-use/"
COUNTRY_VERSION = "5.1.1"
LAYER_VERSIONS = {"countries": COUNTRY_VERSION, "rivers": "5.0.0", "lakes": "5.0.0", "glaciated": "4.0.0", "ocean": "5.0.0"}
GEOD = Geod(ellps="WGS84")
STATIC_YEAR = 2022  # Stable reference year for the pinned Natural Earth v5.x release family; UI shows the dataset version instead.
DERIVATION_VERSION = "geostats-natural-earth-v16.2.7-physical-v1"
STABLE_DECIMALS = 6

LAYER_URLS = {
    "countries": NE_COUNTRIES,
    "rivers": NE_RIVERS,
    "lakes": NE_LAKES,
    "glaciated": NE_GLACIATED,
    "ocean": NE_OCEAN,
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
    value_type: str = "other",
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
        value_type=value_type,  # type: ignore[arg-type]
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
    rule("northernmost-country", "Northernmost country", "Latitude of the country’s northernmost land point.", "🧭", "degrees north", "high", understandability=99, fun=99),
    rule("southernmost-country", "Southernmost country", "Latitude of the country’s southernmost land point.", "🧭", "degrees latitude", "low", understandability=99, fun=99),
    rule("largest-north-south-span", "Largest north to south span", "Distance between the country’s southernmost and northernmost land points.", "↕️", "kilometers", "high", understandability=96, fun=96),
    rule("largest-east-west-span", "Largest east to west span", "Width from the country’s westernmost to easternmost land, accounting for the date line.", "↔️", "kilometers", "high", understandability=94, fun=94),
    rule("largest-tropical-land-area", "Largest tropical land area", "Land area between the Tropic of Cancer and Tropic of Capricorn.", "🌴", "square kilometers", "high", fun=96),
    rule("largest-arctic-land-area", "Largest Arctic land area", "Land area north of the Arctic Circle.", "❄️", "square kilometers", "high", fun=94),
    rule("most-land-neighbors", "Most bordering countries", "Number of countries sharing a land border.", "🤝", "neighboring countries", "high", fun=96),
    rule("longest-average-land-border", "Longest average land border", "Average land border length per neighboring country, among countries with a land border.", "🧭", "kilometers per neighbor", "high", min_coverage=120, fun=96),
    rule("highest-land-border-density", "Most land border for its size", "Land border length per 1,000 square kilometers of land.", "🧩", "km per 1,000 km²", "high", fun=95),
    rule("landlocked-most-neighbors", "Most neighbors among landlocked countries", "Number of land-border neighbors, restricted to countries with no Natural Earth ocean-boundary coastline.", "🧭", "neighboring countries", "high", min_coverage=16, fun=94),
    rule("landlocked-fewest-neighbors", "Fewest neighbors among landlocked countries", "Number of land-border neighbors, restricted to countries with no Natural Earth ocean-boundary coastline.", "🧭", "neighboring countries", "low", min_coverage=16, fun=92),
    rule("longest-land-border", "Longest total land border", "Combined length of all international land borders.", "🧱", "kilometers", "high", fun=94),
    rule("longest-single-land-border", "Longest border with one neighboring country", "Total length of the country’s longest shared land border with one neighboring country.", "🗺️", "kilometers", "high", fun=96),
    rule("longest-coastline", "Longest coastline", "Coastline length measured consistently from Natural Earth’s 1:10m geometry.", "🌊", "kilometers", "high", understandability=97, fun=99),
    rule("highest-coastline-density", "Most coastline for its size", "Coastline length per 1,000 square kilometers of land.", "🏖️", "km per 1,000 km²", "high", understandability=94, fun=97),
    rule("largest-continuous-land-area", "Largest continuous land area", "Area of the country’s largest single connected land piece.", "🗺️", "square kilometers", "high", fun=91),
    rule("largest-geodesic-land-area", "Largest land area calculated from country borders", "Land area calculated consistently from the global country border layer.", "🗺️", "square kilometers", "high", fun=90),
    rule("most-mapped-river-length", "Longest river network", "Combined length of Natural Earth river lines inside the country.", "🏞️", "kilometers", "high", layer="rivers", fun=96),
    rule("highest-mapped-river-density", "Highest river density", "Length of major rivers per 1,000 square kilometers of land.", "💧", "km per 1,000 km²", "high", layer="rivers", fun=92),
    rule("most-mapped-rivers", "Most rivers", "Number of Natural Earth river features crossing the country for at least one kilometer.", "🌊", "river features", "high", layer="rivers", fun=94),
    rule("largest-mapped-lake-area", "Largest total lake and reservoir area", "Combined area of lakes and reservoirs inside the country.", "🏞️", "square kilometers", "high", layer="lakes", fun=97, value_type="total"),
    rule("largest-single-mapped-lake", "Largest lake or reservoir", "Area of the largest single lake or reservoir inside the country.", "🌅", "square kilometers", "high", layer="lakes", fun=98, value_type="total"),
    rule("most-mapped-lakes", "Most lakes", "Number of Natural Earth lakes covering at least one square kilometer inside the country.", "💦", "lakes", "high", layer="lakes", fun=96),
    rule("highest-mapped-lake-share", "Highest % of land covered by lakes and reservoirs", "Percentage of country land covered by lakes and reservoirs.", "💧", "% of land", "high", layer="lakes", fun=92, value_type="percentage"),
    rule("largest-mapped-glaciated-area", "Largest area covered by glaciers", "Combined area of glaciers and ice caps inside the country.", "🧊", "square kilometers", "high", layer="glaciated", fun=97, value_type="total"),
    rule("highest-mapped-glaciated-share", "Highest % of land covered by glaciers", "Percentage of country land covered by glaciers and ice caps.", "❄️", "% of land", "high", layer="glaciated", fun=95, value_type="percentage"),
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

LANDLOCKED_ELIGIBILITY_RULE = "Countries with no Natural Earth ocean-boundary coastline in the pinned 1:10m country/ocean geometry."
ELIGIBLE_UNIVERSES = {
    "landlocked-most-neighbors": {
        "rule": LANDLOCKED_ELIGIBILITY_RULE,
        "selector": "Natural Earth country geometry has zero boundary length intersecting the pinned Natural Earth ocean polygon",
        "excluded": "Country has a Natural Earth ocean-boundary coastline and is therefore not landlocked under this reproducible geometry rule.",
    },
    "landlocked-fewest-neighbors": {
        "rule": LANDLOCKED_ELIGIBILITY_RULE,
        "selector": "Natural Earth country geometry has zero boundary length intersecting the pinned Natural Earth ocean polygon",
        "excluded": "Country has a Natural Earth ocean-boundary coastline and is therefore not landlocked under this reproducible geometry rule.",
    },
    "longest-average-land-border": {
        "rule": "Countries sharing at least one mapped land border of one kilometer or more in the pinned Natural Earth 1:10m country geometry.",
        "selector": "At least one other canonical-country exterior intersects the country exterior for one geodesic kilometer or more",
        "excluded": "Country has no mapped land-border neighbor under the pinned Natural Earth geometry rule.",
    },
}
DEFINED_SUBSET_RULES = set(ELIGIBLE_UNIVERSES)


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


def _country_iso3(properties: dict[str, Any]) -> str | None:
    """Resolve the map-unit/country identity before any sovereign grouping.

    Natural Earth exposes both ISO/map-unit and administering-sovereign fields.
    Choosing ADM0_A3 first incorrectly merged French, Dutch and Norwegian
    dependencies into distant sovereign geometries.
    """
    raw_code = next((
        properties.get(key)
        for key in ("ISO_A3_EH", "ISO_A3", "ADM0_A3", "GU_A3", "SOV_A3")
        if properties.get(key) not in (None, "", "-99")
    ), None)
    return normalize_iso3(raw_code)


class NaturalEarthImporter(WarehouseImporter):
    source_organization = "Natural Earth"
    source_dataset = "Natural Earth 1:10m cultural and physical vectors"
    source_slug = "naturalearth"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.http = HttpClient(timeout=180, retries=5, user_agent="GeoStats/15.9.2 Natural-Earth spatial importer")
        self._metrics: dict[str, dict[str, tuple[str, float]]] | None = None
        self._layer_errors: dict[str, str] = {}
        self._layer_hashes: dict[str, str] = {}

    def discover(self) -> list[CandidateDefinition]:
        discovered: list[CandidateDefinition] = []
        for concept in RULES:
            layer = RULE_LAYER.get(concept.key, "countries")
            download_url = LAYER_URLS[layer]
            eligible_universe = ELIGIBLE_UNIVERSES.get(concept.key)
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
                    "source_query": {
                        "layer": layer,
                        "scale": "1:10m",
                        "boundary_model": "ISO/map-unit country geometry; dependent territories are not unioned into the administering sovereign",
                    },
                    "broadDomain": "physical-geography",
                    "knowledgeCluster": "physical-geography",
                    "strategyFamily": concept.key,
                    "v16_2_6_content_reviewed": concept.key in {
                        "northernmost-country", "southernmost-country", "largest-north-south-span",
                        "largest-east-west-span", "largest-tropical-land-area", "largest-arctic-land-area", "most-land-neighbors",
                        "landlocked-most-neighbors", "landlocked-fewest-neighbors",
                        "longest-land-border", "longest-single-land-border", "longest-average-land-border",
                        "highest-land-border-density", "longest-coastline",
                        "highest-coastline-density", "largest-continuous-land-area", "largest-geodesic-land-area"
                    } or concept.key in {
                        "largest-mapped-lake-area", "largest-single-mapped-lake", "highest-mapped-lake-share",
                        "largest-mapped-glaciated-area", "highest-mapped-glaciated-share",
                    },
                    "inventory_scope_warning": (
                        "Natural Earth physical feature layers are cartographic selections, not exhaustive inventories; river/lake/glacier feature-count categories remain review-only."
                        if layer != "countries" else None
                    ),
                    "boundary_model": "ISO/map-unit country geometry; dependent territories are not unioned into the administering sovereign",
                    "territory_policy": "Use ISO_A3_EH/ISO_A3 map-unit identity first. Distant dependencies with their own codes are excluded from the administering sovereign's geometry.",
                    "referenceLabel": f"Natural Earth {layer} v{LAYER_VERSIONS[layer]}",
                    "showObservationYear": False,
                    "layer": layer,
                    "eligible_universe_type": "defined_subset" if eligible_universe else "universal",
                    "eligible_universe_rule": eligible_universe["rule"] if eligible_universe else "GeoStats canonical current-country universe",
                    "eligible_universe_selector": eligible_universe["selector"] if eligible_universe else None,
                    "excluded_country_reason": eligible_universe["excluded"] if eligible_universe else None,
                },
            ))
        return discovered

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        metrics = self._ensure_metrics()
        layer = str(candidate.metadata.get("layer") or "countries")
        candidate.metadata["archive_sha256"] = self._layer_hashes.get(layer)
        candidate.metadata["stable_decimals"] = STABLE_DECIMALS
        if layer in self._layer_errors:
            raise RuntimeError(f"Natural Earth {layer} layer could not be processed: {self._layer_errors[layer]}")
        if candidate.rule.key in {"longest-coastline", "highest-coastline-density", "landlocked-most-neighbors", "landlocked-fewest-neighbors"}:
            if "ocean" in self._layer_errors:
                raise RuntimeError(f"Natural Earth ocean layer could not be processed: {self._layer_errors['ocean']}")
            if not self._layer_hashes.get("ocean"):
                raise RuntimeError("Natural Earth ocean archive hash is missing; coastline/landlocked metrics fail closed.")
            candidate.metadata["ocean_archive_sha256"] = self._layer_hashes.get("ocean")
        values = metrics.get(candidate.rule.key, {})
        if candidate.rule.key in DEFINED_SUBSET_RULES:
            eligible = sorted(values)
            candidate.metadata["eligible_country_count"] = len(eligible)
            candidate.metadata["eligible_country_iso3"] = eligible
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
                "reference_year": STATIC_YEAR,
                "reference_label": f"Natural Earth {layer} v{LAYER_VERSIONS[layer]}",
                "show_observation_year": False,
                "boundary_model": "ISO/map-unit country geometry; dependent territories are not unioned into the administering sovereign",
                "territory_policy": "Use ISO_A3_EH/ISO_A3 first; do not merge separately coded dependencies into the administering sovereign.",
                "derivation_version": DERIVATION_VERSION,
                "derivation_method": candidate.rule.technical_definition,
                "archive_sha256": self._layer_hashes.get(layer),
                "stable_decimals": STABLE_DECIMALS,
            },
        ) for iso3, (name, value) in values.items() if math.isfinite(value)]
        minimum_observations = 16 if candidate.rule.key in DEFINED_SUBSET_RULES else 100
        if len(observations) < minimum_observations:
            raise RuntimeError(
                f"Only {len(observations)} country observations were derived for {candidate.rule.key}; "
                f"minimum is {minimum_observations} for its eligible-universe type."
            )
        return sorted(observations, key=lambda row: row.country_iso3)

    def _download_shapefile(self, directory: Path, layer: str) -> Path:
        archive = directory / f"{layer}.zip"
        payload = self.http.get_bytes(LAYER_URLS[layer], accept="application/zip,*/*")
        self._layer_hashes[layer] = hashlib.sha256(payload).hexdigest()
        archive.write_bytes(payload)
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
            for layer in ("rivers", "lakes", "glaciated", "ocean"):
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
            iso3 = _country_iso3(properties)
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
        land_areas = {iso3: _geodesic_area_km2(geometries[iso3]) for iso3 in iso_codes}
        ocean_features = feature_layers.get("ocean", [])
        ocean_boundary = unary_union([feature.boundary for feature in ocean_features]) if ocean_features else None
        tropical_band = Polygon([(-180.0,-23.4366),(180.0,-23.4366),(180.0,23.4366),(-180.0,23.4366),(-180.0,-23.4366)])
        arctic_band = Polygon([(-180.0,66.5628),(180.0,66.5628),(180.0,90.0),(-180.0,90.0),(-180.0,66.5628)])
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
            largest_continuous_area = max(polygon_areas, default=0.0)
            coastline = _geodesic_length_km(exteriors[iso3].intersection(ocean_boundary)) if ocean_boundary is not None else 0.0
            tropical_area = _geodesic_area_km2(geometry.intersection(tropical_band))
            arctic_area = _geodesic_area_km2(geometry.intersection(arctic_band))
            metrics["largest-tropical-land-area"][iso3] = (name, tropical_area)
            metrics["largest-arctic-land-area"][iso3] = (name, arctic_area)
            metrics["most-land-neighbors"][iso3] = (name, float(neighbor_counts[iso3]))
            metrics["longest-land-border"][iso3] = (name, border_lengths[iso3])
            metrics["longest-single-land-border"][iso3] = (name, longest_single_borders[iso3])
            if neighbor_counts[iso3] > 0:
                metrics["longest-average-land-border"][iso3] = (name, border_lengths[iso3] / neighbor_counts[iso3])
            metrics["highest-land-border-density"][iso3] = (name, border_lengths[iso3] / area * 1000.0 if area else 0.0)
            metrics["longest-coastline"][iso3] = (name, coastline)
            metrics["highest-coastline-density"][iso3] = (name, coastline / area * 1000.0 if area else 0.0)
            metrics["largest-continuous-land-area"][iso3] = (name, largest_continuous_area)
            metrics["largest-geodesic-land-area"][iso3] = (name, area)
            latitudes = [point[1] for point in coords]
            metrics["northernmost-country"][iso3] = (name, max(latitudes))
            metrics["southernmost-country"][iso3] = (name, min(latitudes))
            metrics["largest-north-south-span"][iso3] = (name, _north_south_span_km(coords))
            metrics["largest-east-west-span"][iso3] = (name, _east_west_span_km(coords))

        if ocean_boundary is not None:
            for iso3 in iso_codes:
                name = names.get(iso3, iso3)
                coastline = metrics["longest-coastline"].get(iso3, (name, 0.0))[1]
                if coastline <= 0.1:
                    metrics["landlocked-most-neighbors"][iso3] = (name, float(neighbor_counts[iso3]))
                    metrics["landlocked-fewest-neighbors"][iso3] = (name, float(neighbor_counts[iso3]))

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
        return {
            metric: {iso3: (name, round(float(value), STABLE_DECIMALS)) for iso3, (name, value) in rows.items()}
            for metric, rows in metrics.items()
        }

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"natural-earth:{candidate.rule.key}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import reproducible Natural Earth country and physical-geography candidates.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--minimum-successes", type=int, default=len(RULES), help="Exit nonzero if fewer categories are imported.")
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
    requested = len(set(args.rule)) if args.rule else (len(RULES) if args.limit is None else min(args.limit, len(RULES)))
    minimum = min(max(0, args.minimum_successes), requested)
    successes = int(result["categories_processed"])
    if successes < minimum:
        print(f"Natural Earth import failed its completeness gate: {successes} < {minimum}.", flush=True)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
