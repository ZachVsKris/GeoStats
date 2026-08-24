#!/usr/bin/env python3
"""Network-backed regression against the pinned Natural Earth country layer.

This is deliberately separate from synthetic unit fixtures. It verifies the
actual archive used by production and sanity of retained geography rankings.
Identity-policy edge cases are asserted deterministically here and in the
synthetic importer test rather than relying on a particular pinned layer row.
GitHub Actions runs it before the app build.
"""
from __future__ import annotations

import importlib.util
import math
import tempfile
from pathlib import Path

import shapefile

MODULE_PATH = Path(__file__).with_name("import-natural-earth.py")
spec = importlib.util.spec_from_file_location("geostats_natural_earth", MODULE_PATH)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert module.COUNTRY_VERSION == "5.1.1"
retired = {
    "largest-geographic-span",
    "largest-north-south-span",
    "largest-east-west-span",
    "northernmost-country",
    "southernmost-country",
    "farthest-from-equator",
    "most-separate-land-areas",
    "most-large-land-areas",
}
assert retired.isdisjoint({rule.key for rule in module.RULES})

importer = module.NaturalEarthImporter(None, dry_run=True)
with tempfile.TemporaryDirectory(prefix="geostats-ne-real-") as directory_name:
    directory = Path(directory_name)
    country_path = importer._download_shapefile(directory, "countries")
    assert len(importer._layer_hashes.get("countries", "")) == 64

    reader = shapefile.Reader(str(country_path), encoding="utf-8")
    fields = [field[0] for field in reader.fields[1:]]
    assert {"ISO_A3_EH", "ISO_A3", "ADM0_A3"}.issubset(fields)

    # Exercise the identity policy deterministically. Whether the pinned real
    # layer happens to contain a row that distinguishes these branches is not a
    # stable property of Natural Earth's data and must not make CI flaky.
    assert module._country_iso3({"ISO_A3_EH": "FRA", "ADM0_A3": "FRA"}) == "FRA"
    assert module._country_iso3({"ISO_A3_EH": "GLP", "ADM0_A3": "FRA"}) is None

    geometries, names = importer._read_countries(country_path)
    assert 190 <= len(geometries) <= 195
    assert all(code in geometries for code in ("RUS", "CAN", "USA", "CHN", "BRA", "AUS", "FRA", "NLD"))

    metrics = importer._derive_metrics(geometries, names, {})
    area = metrics["largest-geodesic-land-area"]
    continuous = metrics["largest-continuous-land-area"]
    neighbors = metrics["most-land-neighbors"]

    area_top_ten = [code for code, _ in sorted(area.items(), key=lambda item: item[1][1], reverse=True)[:10]]
    continuous_top_five = [code for code, _ in sorted(continuous.items(), key=lambda item: item[1][1], reverse=True)[:5]]
    neighbor_top_five = [code for code, _ in sorted(neighbors.items(), key=lambda item: item[1][1], reverse=True)[:5]]

    assert "RUS" in area_top_ten and "CAN" in area_top_ten
    assert len({"USA", "CHN", "BRA", "AUS"}.intersection(area_top_ten)) >= 3
    assert "FRA" not in area_top_ten and "NLD" not in area_top_ten
    assert "RUS" in continuous_top_five
    assert {"CHN", "RUS"}.intersection(neighbor_top_five)
    assert max(value for _, value in neighbors.values()) >= 12
    assert area["FRA"][1] < 1_000_000
    assert area["NLD"][1] < 100_000

    for concept in module.RULES:
        values = metrics.get(concept.key, {})
        if concept.key in {"most-mapped-river-length", "highest-mapped-river-density", "most-mapped-rivers", "largest-mapped-lake-area", "largest-single-mapped-lake", "most-mapped-lakes", "highest-mapped-lake-share", "largest-mapped-glaciated-area", "highest-mapped-glaciated-share"}:
            continue
        assert len(values) >= 180, f"{concept.key} returned only {len(values)} countries."
        assert all(math.isfinite(value) for _, value in values.values())

print("GeoStats v16.2.3 real Natural Earth regression passed.")
