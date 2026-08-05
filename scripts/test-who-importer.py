#!/usr/bin/env python3
import importlib.util
from pathlib import Path

module_path = Path(__file__).with_name("import-who.py")
spec = importlib.util.spec_from_file_location("import_who", module_path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert len(module.RULES) >= 50
keys = [rule.key for rule in module.RULES]
assert len(keys) == len(set(keys))
assert all(rule.title.startswith(("Highest ", "Lowest ")) for rule in module.RULES)
assert module.normalize_iso3("USA") == "USA"
assert module.normalize_iso3("XKX") is None

class Fake(module.WhoImporter):
    pass

fake = object.__new__(Fake)
life = next(rule for rule in module.RULES if rule.key == "highest-life-expectancy")
assert fake._match_score(life, "Life expectancy at birth (years)") is not None
assert fake._match_score(life, "Healthy life expectancy at birth (years)") is None
assert fake._year({"TimeDim": 2024}) == 2024
assert fake._numeric({"NumericValue": 72.5}) == 72.5
assert fake._aggregate_row({"SpatialDimType": "COUNTRY", "Dim1": "BTSX", "Dim2": None}, life)
assert not fake._aggregate_row({"SpatialDimType": "COUNTRY", "Dim1": "MLE", "Dim2": None}, life)
print("WHO importer tests passed.")
