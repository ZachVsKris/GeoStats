#!/usr/bin/env python3
import importlib.util
from pathlib import Path

path = Path(__file__).with_name("import-unesco.py")
spec = importlib.util.spec_from_file_location("import_unesco", path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert len(module.RULES) >= 30
assert len({rule.key for rule in module.RULES}) == len(module.RULES)
assert all(rule.title.startswith(("Highest ", "Lowest ", "Most ")) for rule in module.RULES)
rows = module._records({"data": {"records": [{"geoUnit": "USA", "year": 2024, "value": 1.0}]}})
assert rows[0]["geoUnit"] == "USA"
assert module._pick({"indicatorId": "CR.1"}, "indicator_id", "indicatorId") == "CR.1"
fake = object.__new__(module.UnescoImporter)
adult = next(rule for rule in module.RULES if rule.key == "highest-adult-literacy")
assert fake._match_score(adult, "Adult literacy rate, population 15 years and older, both sexes (%)", {}) is not None
assert fake._match_score(adult, "Adult literacy rate, female (%)", {}) is None
print("UNESCO importer tests passed.")
