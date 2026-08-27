#!/usr/bin/env python3
import importlib.util
import sys
from pathlib import Path
from shapely.geometry import LineString, box

path = Path(__file__).with_name("import-natural-earth.py")
spec = importlib.util.spec_from_file_location("import_natural_earth", path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

assert len(module.RULES) >= 16
assert len({rule.key for rule in module.RULES}) == len(module.RULES)
center = module._minimal_longitude_center([179.0, -179.0, 178.5])
assert abs(abs(center) - 180.0) < 2.0
span = module._max_geodesic_span_km([(0.0, 0.0), (10.0, 0.0), (0.0, 10.0)])
assert 1000 < span < 1700
assert module._bounds_overlap((0, 0, 2, 2), (1, 1, 3, 3))
assert not module._bounds_overlap((0, 0, 1, 1), (2, 2, 3, 3))
metrics = module.NaturalEarthImporter._derive_metrics(
    {"AAA": box(0, 0, 1, 1), "BBB": box(1, 0, 2, 1), "CCC": box(5, 0, 6, 1)},
    {"AAA": "Alpha", "BBB": "Beta", "CCC": "Gamma"},
    {
        "rivers": [LineString([(0, .5), (2, .5)])],
        "lakes": [box(.25, .25, .75, .75)],
        "glaciated": [box(5.25, .25, 5.75, .75)],
        "ocean": [box(-10, -10, 0, 10), box(6, -10, 10, 10)],
    },
)
assert metrics["most-land-neighbors"]["AAA"][1] == 1.0
assert metrics["most-land-neighbors"]["BBB"][1] == 1.0
assert metrics["most-land-neighbors"]["CCC"][1] == 0.0
assert metrics["longest-coastline"]["AAA"][1] > 100
assert "BBB" in metrics["landlocked-most-neighbors"]
assert metrics["largest-tropical-land-area"]["AAA"][1] > 10000
assert metrics["largest-arctic-land-area"]["AAA"][1] == 0.0
assert metrics["longest-land-border"]["AAA"][1] > 100
assert metrics["longest-single-land-border"]["AAA"][1] > 100
assert metrics["most-mapped-river-length"]["AAA"][1] > 50
assert metrics["largest-mapped-lake-area"]["AAA"][1] > 1000
assert metrics["largest-mapped-glaciated-area"]["CCC"][1] > 1000
assert metrics["largest-continuous-land-area"]["AAA"][1] > 10000

# v16.2.6 restores the straightforward latitude/axis-span concepts only after the
# importer stopped unioning distant dependencies into administering sovereigns.
# The approximate all-directions geographic-diameter concept remains retired.
restored = {"largest-north-south-span", "largest-east-west-span", "northernmost-country", "southernmost-country"}
assert restored.issubset({rule.key for rule in module.RULES})
retired = {"largest-geographic-span", "farthest-from-equator", "most-separate-land-areas", "most-large-land-areas"}
assert retired.isdisjoint({rule.key for rule in module.RULES})
assert metrics["northernmost-country"]["AAA"][1] == 1.0
assert metrics["southernmost-country"]["AAA"][1] == 0.0
assert metrics["largest-north-south-span"]["AAA"][1] > 100
assert metrics["largest-east-west-span"]["AAA"][1] > 100
assert module._country_iso3({"ISO_A3_EH": "FRA", "ADM0_A3": "FRA"}) == "FRA"
assert module._country_iso3({"ISO_A3_EH": "GLP", "ADM0_A3": "FRA"}) is None

print("Natural Earth importer tests passed.")
