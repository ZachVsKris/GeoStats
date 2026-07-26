#!/usr/bin/env python3
import importlib.util
from pathlib import Path
from shapely.geometry import box

path = Path(__file__).with_name("import-natural-earth.py")
spec = importlib.util.spec_from_file_location("import_natural_earth", path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert len(module.RULES) == 8
assert len({rule.key for rule in module.RULES}) == 8
center = module._minimal_longitude_center([179.0, -179.0, 178.5])
assert abs(abs(center) - 180.0) < 2.0
span = module._max_geodesic_span_km([(0.0, 0.0), (10.0, 0.0), (0.0, 10.0)])
assert 1000 < span < 1700
assert module._bounds_overlap((0, 0, 2, 2), (1, 1, 3, 3))
assert not module._bounds_overlap((0, 0, 1, 1), (2, 2, 3, 3))
metrics = module.NaturalEarthImporter._derive_metrics(
    {"AAA": box(0, 0, 1, 1), "BBB": box(1, 0, 2, 1), "CCC": box(5, 0, 6, 1)},
    {"AAA": "Alpha", "BBB": "Beta", "CCC": "Gamma"},
)
assert metrics["most-land-neighbors"]["AAA"][1] == 1.0
assert metrics["most-land-neighbors"]["BBB"][1] == 1.0
assert metrics["most-land-neighbors"]["CCC"][1] == 0.0
assert metrics["longest-land-border"]["AAA"][1] > 100
print("Natural Earth importer tests passed.")
