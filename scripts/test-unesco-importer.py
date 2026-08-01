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
for rule in module.RULES:
    for field in ("include", "prefer", "exclude"):
        patterns = getattr(rule, field)
        assert isinstance(patterns, tuple), (rule.key, field, type(patterns))
        for pattern in patterns:
            module.re.compile(pattern, module.re.IGNORECASE)
outbound = next(rule for rule in module.RULES if rule.key == "highest-outbound-student-mobility")
assert outbound.include == (r"outbound mobility ratio|outbound mobile students.*percentage",)
assert all(rule.title.startswith(("Highest ", "Lowest ", "Most ")) for rule in module.RULES)
rows = module._records({"data": {"records": [{"geoUnit": "USA", "year": 2024, "value": 1.0}]}})
assert rows[0]["geoUnit"] == "USA"
assert module._pick({"indicatorId": "CR.1"}, "indicator_id", "indicatorId") == "CR.1"
assert module._pick({"indicatorCode": "CR.1"}, "indicatorCode", "indicatorId") == "CR.1"
fake = object.__new__(module.UnescoImporter)
adult = next(rule for rule in module.RULES if rule.key == "highest-adult-literacy")
assert fake._match_score(adult, "Adult literacy rate, population 15 years and older, both sexes (%)", {}) is not None
assert fake._match_score(adult, "Adult literacy rate, female (%)", {}) is None
class FakeHttp:
    def get_json(self, url):
        if url.endswith("/definitions/indicators"):
            return [{
                "indicatorCode": "LR.AG15T99",
                "name": "Adult literacy rate, population aged 15 years and older, both sexes (%)",
                "theme": "EDUCATION",
                "dataAvailability": {"totalRecordCount": 1200, "geoUnits": {"types": ["NATIONAL"]}},
            }]
        if url.endswith("/definitions/geounits"):
            return [{"id": "USA", "name": "United States", "type": "NATIONAL"}]
        raise AssertionError(url)

fake_importer = module.UnescoImporter(None, dry_run=True)
fake_importer.http = FakeHttp()
discovered = fake_importer.discover()
assert discovered
assert discovered[0].source_indicator_code == "LR.AG15T99"
print("UNESCO importer tests passed.")
