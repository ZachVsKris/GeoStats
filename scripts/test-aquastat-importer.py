import csv
import importlib.util
import tempfile
from pathlib import Path

path = Path(__file__).with_name("import-aquastat.py")
spec = importlib.util.spec_from_file_location("aquastat_importer", path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as directory:
    input_path = Path(directory) / "aquastat.csv"
    with input_path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["Country", "Variable", "Year", "Value"])
        writer.writeheader()
        writer.writerow({"Country": "France", "Variable": "Level of water stress", "Year": 2022, "Value": 12})
        writer.writerow({"Country": "Germany", "Variable": "Total water withdrawal", "Year": 2022, "Value": 30})
    importer = module.Importer(None, str(input_path), True)
    assert len(importer.rows) == 2
    assert len(importer.discover()) == 6
print("AQUASTAT importer fixtures passed.")
