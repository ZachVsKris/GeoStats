import csv
import importlib.util
import tempfile
from pathlib import Path

path = Path(__file__).with_name("import-fao-fisheries.py")
spec = importlib.util.spec_from_file_location("fisheries_importer", path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as directory:
    input_path = Path(directory) / "fisheries.csv"
    with input_path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["country_iso3", "country_name", "year", "capture_tonnes", "aquaculture_tonnes"])
        writer.writeheader()
        writer.writerow({"country_iso3": "FRA", "country_name": "France", "year": 2023, "capture_tonnes": 10, "aquaculture_tonnes": 5})
    importer = module.Importer(None, str(input_path), True)
    assert len(importer.discover()) == 3
    combined = next(candidate for candidate in importer.discover() if candidate.rule.key == "combined-tonnes")
    assert importer.fetch_observations(combined)[0].value == 15
print("FAO fisheries importer fixtures passed.")
