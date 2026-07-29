#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))


def load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / filename)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


migration = (ROOT / "supabase/migrations/020_transparency_playability_spatial_expansion.sql").read_text()
run_sql = (ROOT / "RUN_THIS_IN_SUPABASE_FOR_V14.sql").read_text()
assert migration == run_sql, "Top-level v14 SQL must match migration 020 exactly"

for token in (
    "plain_language_description text",
    "technical_definition text",
    "exact_query_url text",
    "download_url text",
    "derivation_method text",
    "input_datasets jsonb",
    "verifiability_score smallint",
    "understandability_score smallint",
    "fun_score smallint",
    "objective_status text",
    "player_quality_status text",
    "apply_category_player_quality",
    "apply_category_governance",
    "Awaiting v14 editorial review",
    "geostats_snapshot",
    "pregnancy|childbirth",
    "GeoStats only uses objective",
):
    assert token in migration, token

for subjective in (
    "happiness",
    "corruption perception",
    "democracy index",
    "freedom index",
    "global peace",
    "human development index",
    "composite score",
):
    assert subjective in migration.lower(), subjective

world_bank = load("test_v14_world_bank", "import-world-bank-catalog.py")
natural_earth = load("test_v14_natural_earth", "import-natural-earth.py")
comtrade = load("test_v14_comtrade", "import-comtrade.py")

assert "--limit" in (SCRIPTS / "import-world-bank-catalog.py").read_text()
assert "SUBJECTIVE_OR_COMPOSITE" in (SCRIPTS / "import-world-bank-catalog.py").read_text()
assert "list_source_indicator_codes" in (SCRIPTS / "import-world-bank-catalog.py").read_text()
assert world_bank._player_title("Population, total", "total") == "Largest population, total"
assert len(natural_earth.RULES) >= 24
assert len({rule.key for rule in natural_earth.RULES}) == len(natural_earth.RULES)
assert "largest-continuous-land-area" in {rule.key for rule in natural_earth.RULES}
assert "largest-mapped-reef-area" not in {rule.key for rule in natural_earth.RULES}, "Reef ownership requires maritime boundaries and must not be inferred from land polygons"
assert len(comtrade.SPECS) >= 50
assert len({spec.rule.key for spec in comtrade.SPECS}) == len(comtrade.SPECS)

from data_pipeline.descriptions import plain_language_description
assert "pregnancy or childbirth" in plain_language_description("Lowest maternal mortality", "per 100,000 live births", "Countries ranked by maternal mortality according to WHO.")
assert "not in employment, education, or training" in plain_language_description("Lowest youth NEET rate", "% of youth", "Lowest youth NEET rate according to ILOSTAT.")
assert "can exceed 100%" in plain_language_description("Highest primary-school enrollment", "gross enrollment ratio (%)", "Highest primary-school enrollment according to UNESCO.")

print("v14 transparency, objective-data, expansion, and clarity checks passed")
