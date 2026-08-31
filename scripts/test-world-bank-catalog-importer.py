#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
path = ROOT / "scripts" / "import-world-bank-catalog.py"
spec = importlib.util.spec_from_file_location("world_bank_catalog_importer", path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

assert module.SUBJECTIVE_OR_COMPOSITE.search("Happiness score")
assert module.SUBJECTIVE_OR_COMPOSITE.search("Control of Corruption: Estimate")
assert not module.SUBJECTIVE_OR_COMPOSITE.search("Population, total")
assert module._player_title("Population, total", "total").startswith("Largest")
assert module._player_title("Life expectancy at birth", "total").startswith("Highest")
assert module._unit_and_type("Population ages 0-14 (% of total)", "")[1] == "percentage"
assert module._unit_and_type("Mortality rate, per 1,000 live births", "")[1] == "rate"
assert module._unit_and_type("Population, total", "") == ("people", "total")
assert module._unit_and_type("Surface area (sq. km)", "") == ("km²", "total")
assert module._unit_and_type("Service imports (BoP, current US$)", "") == ("USD", "total")
assert "BX.GSR.TRAN.ZS" in module.OWNER_EXCLUDED_INDICATORS
understandable, fun = module._scores("Population, total", "Total population counts all residents.")
assert understandable >= 85 and fun >= 80
technical, technical_fun = module._scores("PPP conversion factor for GDP", "Technical series.")
assert technical < understandable and technical_fun < fun
print("World Bank catalog importer tests passed.")
