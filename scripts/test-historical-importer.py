#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODULE_PATH = HERE / "import-historical-categories.py"
spec = importlib.util.spec_from_file_location("historical_importer", MODULE_PATH)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

UN_FIXTURE = """
<html><body>
<h2>South Sudan</h2><div>Date of Admission: 14-07-2011</div>
<h2>Switzerland</h2><div>Date of Admission: 10-09-2002</div>
<h2>United States of America</h2><div>Date of Admission: 24-10-1945</div>
<h2>China (the People's Republic of)</h2><div>Date of Admission: 24-10-1945</div>
</body></html>
"""
records = module.parse_un_member_states_html(UN_FIXTURE)
assert ("South Sudan", "14-07-2011") in records
assert ("Switzerland", "10-09-2002") in records
assert ("China (the People's Republic of)", "24-10-1945") in records

CONSTITUTE_FIXTURE = [
    {"id": "United_States_of_America_1992", "country": "United States of America", "in_force": True, "is_draft": False, "year_enacted": "1789"},
    {"id": "Argentina_1994", "country": "Argentina", "in_force": True, "is_draft": False, "year_enacted": "1853", "year_reinstated": "1983"},
    {"id": "South_Sudan_2011", "country": "South Sudan", "in_force": True, "is_draft": False, "year_enacted": "2011"},
    {"id": "Kazakhstan_2026", "country": "Kazakhstan", "in_force": True, "is_draft": False, "year_enacted": "2026"},
    {"id": "China_1982", "country": "China (People’s Republic of)", "in_force": True, "is_draft": False, "year_enacted": "1982"},
    {"id": "Venezuela_2009", "country": "Venezuela (Bolivarian Republic of)", "in_force": True, "is_draft": False, "year_enacted": "1999"},
    {"id": "Mars_2024", "country": "Mars", "in_force": True, "is_draft": False, "year_enacted": "2024"},
    {"id": "Spain_1812", "country": "Spain", "in_force": False, "is_draft": False, "year_enacted": "1812"},
    {"id": "Yemen_Draft_2015", "country": "Yemen", "in_force": False, "is_draft": True, "year_enacted": "2015"},
]
parsed = {iso3: year for iso3, year, _ in module.parse_constitute_current_constitutions(CONSTITUTE_FIXTURE)}
assert parsed["USA"] == 1789
assert parsed["ARG"] == 1853  # reinstatement must not be mistaken for a new constitution
assert parsed["SSD"] == 2011
assert parsed["KAZ"] == 2026
assert parsed["CHN"] == 1982
assert parsed["VEN"] == 1999
assert "ESP" not in parsed
assert "YEM" not in parsed
assert len(parsed) == 6

un = module.UNMembershipImporter(None, dry_run=True)
uc = un.discover()[0]
assert un.category_id(uc) == "history:un-admission"
assert uc.metadata["measurementType"] == "historical_date"
assert uc.metadata["historicalValueFormat"] == "date"

co = module.ConstituteImporter(None, dry_run=True)
cc = co.discover()[0]
assert co.category_id(cc) == "history:newest-current-constitution"
assert cc.metadata["measurementType"] == "historical_date"
assert cc.metadata["historicalValueFormat"] == "year"
assert cc.rule.ranking_direction == "high"
print("GeoStats v16.2.2 historical importer tests passed.")
