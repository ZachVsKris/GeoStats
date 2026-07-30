import importlib.util
from pathlib import Path

path = Path(__file__).with_name("vet-expanded-catalog.py")
spec = importlib.util.spec_from_file_location("vetting", path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert module.jaccard("Most gold produced", "Largest gold production") > 0.3
observations = {str(index): float(index) for index in range(100)}
yield_row = {
    "effective_title": "Highest oranges yield",
    "description": "Amount per hectare",
    "unit": "kg/ha",
    "source_organization": "FAOSTAT",
    "validation_status": "verified",
    "hard_gate_ready": True,
    "common_year_coverage": 100,
}
recommendation, score, _ = module.evaluate(yield_row, observations)
assert recommendation == "retire" and score == 0
horse_row = {
    "effective_title": "Largest horse population",
    "description": "Total horse population",
    "unit": "head",
    "source_organization": "FAOSTAT",
    "validation_status": "verified",
    "hard_gate_ready": True,
    "common_year_coverage": 100,
}
recommendation, _, _ = module.evaluate(horse_row, observations)
assert recommendation == "approve"
print("Expanded catalog vetting fixtures passed.")
