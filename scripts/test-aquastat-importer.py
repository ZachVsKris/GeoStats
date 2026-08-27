import csv
import importlib.util
import sys
import tempfile
from pathlib import Path

p = Path(__file__).with_name("import-aquastat.py")
spec = importlib.util.spec_from_file_location("aquastat_importer", p)
m = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = m
spec.loader.exec_module(m)

with tempfile.TemporaryDirectory() as d:
    f = Path(d) / "aquastat.csv"
    fields = ["Country", "Variable", "Year", "Value", "Unit"]
    with f.open("w", newline="", encoding="utf-8") as h:
        w = csv.DictWriter(h, fieldnames=fields)
        w.writeheader()
        fixtures = [
            ("Total renewable water resources per capita", "m3/inhab/year", 1000, 900),
            ("Municipal water withdrawal as percentage of total water withdrawal", "%", 55, 48),
            ("Total actual renewable water resources", "10^9 m3/year", 210, 190),
            ("Total internal renewable water resources", "10^9 m3/year", 205, 185),
            ("Dependency ratio", "%", 2.4, 4.1),
            ("Industrial water withdrawal as % of total water withdrawal", "%", 18, 20),
            ("Groundwater withdrawal as % of total water withdrawal", "%", 22, 24),
            ("Surface water withdrawal as % of total water withdrawal", "%", 78, 76),
            ("Area equipped for irrigation: total", "1000 ha", 2700, 2500),
            ("Produced water: desalinated water", "10^9 m3/year", 0.2, 0.1),
            ("Produced municipal wastewater", "10^9 m3/year", 4.2, 5.1),
            ("Treated municipal wastewater", "10^9 m3/year", 3.9, 4.8),
        ]
        for variable, unit, france, germany in fixtures:
            w.writerow({"Country": "France", "Variable": variable, "Year": 2022, "Value": france, "Unit": unit})
            w.writerow({"Country": "Germany", "Variable": variable, "Year": 2022, "Value": germany, "Unit": unit})
        # Wrong-unit rows must fail closed rather than silently entering the category.
        w.writerow({"Country": "France", "Variable": "Total actual renewable water resources", "Year": 2022, "Value": 999, "Unit": "%"})

    imp = m.Importer(None, str(f), True)
    cats = {c.rule.key: c for c in imp.discover()}
    assert len(cats) == 17
    for key in (
        "total-renewable-water",
        "internal-renewable-water",
        "water-dependency",
        "industrial-water-share",
        "groundwater-withdrawal-share",
        "surface-water-withdrawal-share",
        "irrigation-equipped-area",
        "desalinated-water",
        "municipal-wastewater-produced",
        "municipal-wastewater-treated",
    ):
        assert key in cats

    municipal = cats["municipal-water-share"]
    assert municipal.rule.value_type == "percentage" and municipal.rule.unit == "%"
    assert sorted(o.value for o in imp.fetch_observations(municipal)) == [48.0, 55.0]

    renewable = imp.fetch_observations(cats["total-renewable-water"])
    assert sorted(o.value for o in renewable) == [190.0, 210.0]
    assert all(o.metadata["source_unit"] == "10^9 m3/year" for o in renewable)

print("AQUASTAT importer fixtures passed.")
