import csv
import importlib.util
import sys
import tempfile
from pathlib import Path

p = Path(__file__).with_name("import-who-ghed.py")
spec = importlib.util.spec_from_file_location("whoghed", p)
m = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = m
spec.loader.exec_module(m)

with tempfile.TemporaryDirectory() as d:
    f = Path(d) / "ghed.csv"
    fields = ["code", "country", "year", "indicator", "unit", "value"]
    fixtures = [
        ("Current health expenditure (CHE) per capita in US dollars", "US dollars", "6500"),
        ("Domestic General Government Health Expenditure (GGHE-D) as % Gross Domestic Product (GDP)", "%", "8.1"),
        ("Domestic Private Health Expenditure (PVT-D) as % Current Health Expenditure (CHE)", "%", "21"),
        ("External Health Expenditure (EXT) as % Current Health Expenditure (CHE)", "%", "2.2"),
        ("Domestic General Government Health Expenditure (GGHE-D) as % General Government Expenditure (GGE)", "%", "17"),
        ("Domestic General Government Health Expenditure (GGHE-D) per Capita in US$", "US dollars", "5100"),
        ("Domestic General Government Health Expenditure (GGHE-D) as % Current Health Expenditure (CHE)", "%", "76"),
        ("Domestic Private Health Expenditure (PVT-D) per Capita in US$", "US dollars", "1400"),
        ("External Health Expenditure (EXT) per Capita in US$", "US dollars", "120"),
        ("Out-of-Pocket Expenditure (OOP) as % Current Health Expenditure (CHE)", "%", "9.5"),
        ("Out-of-Pocket Expenditure (OOP) per Capita in US$", "US dollars", "620"),
    ]
    with f.open("w", newline="") as h:
        w = csv.DictWriter(h, fieldnames=fields)
        w.writeheader()
        for indicator, unit, value in fixtures:
            w.writerow({"code": "FRA", "country": "France", "year": 2023, "indicator": indicator, "unit": unit, "value": value})
        # A plausible-looking but wrong-unit row must fail closed.
        w.writerow({"code": "DEU", "country": "Germany", "year": 2023, "indicator": fixtures[1][0], "unit": "US dollars", "value": "7000"})

    imp = m.Importer(None, str(f), True)
    assert len(imp.discover()) == 11
    assert len(imp.rows) == 11
    candidates = {c.rule.key: c for c in imp.discover()}
    assert candidates["gghe-gdp"].rule.value_type == "percentage"
    assert candidates["oop-pc-usd"].rule.value_type == "per_capita"
    assert len(imp.fetch_observations(candidates["gghe-gdp"])) == 1
    assert imp.fetch_observations(candidates["oop-pc-usd"])[0].value == 620

    # Wide extracts remain supported without generic-value guessing.
    wide = Path(d) / "ghed-wide.csv"
    with wide.open("w", newline="") as h:
        w = csv.DictWriter(h, fieldnames=["code", "country", "year", "che_pc_usd", "oop_pc_usd"])
        w.writeheader()
        w.writerow({"code": "FRA", "country": "France", "year": 2023, "che_pc_usd": "6500", "oop_pc_usd": "620"})
    wide_imp = m.Importer(None, str(wide), True)
    assert {r[0] for r in wide_imp.rows} == {"health-spending-per-person", "oop-pc-usd"}

print("WHO GHED importer fixtures passed.")
