import csv
import importlib.util
import tempfile
from pathlib import Path

path = Path(__file__).with_name("import-usgs-minerals.py")
spec = importlib.util.spec_from_file_location("minerals_importer", path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as directory:
    input_path = Path(directory) / "minerals.csv"
    with input_path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["Country", "Commodity", "Year", "Mine production", "Unit"])
        writer.writeheader()
        writer.writerow({"Country": "France", "Commodity": "Gold", "Year": 2023, "Mine production": 4, "Unit": "metric tonnes"})
        writer.writerow({"Country": "Germany", "Commodity": "Bauxite", "Year": 2023, "Mine production": 8, "Unit": "metric tonnes"})
    importer = module.Importer(None, str(input_path), True)
    assert {candidate.rule.key for candidate in importer.discover()} == {"gold"}
print("USGS minerals importer fixtures passed.")
