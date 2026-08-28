#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import os
from pathlib import Path
from unittest.mock import patch

from data_pipeline.integrity import units_compatible

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
    {"id": "Afghanistan_2004", "country": "The Islamic Republic of Afghanistan", "country_id": "Afghanistan", "in_force": True, "is_draft": False, "year_enacted": "2004"},
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
assert parsed["AFG"] == 2004  # live service uses formal country labels plus a stable country_id
assert parsed["ARG"] == 1853  # reinstatement must not be mistaken for a new constitution
assert parsed["SSD"] == 2011
assert parsed["KAZ"] == 2026
assert parsed["CHN"] == 1982
assert parsed["VEN"] == 1999
assert "ESP" not in parsed
assert "YEM" not in parsed
assert len(parsed) == 7

un = module.UNMembershipImporter(None, dry_run=True)
uc = un.discover()[0]
assert un.category_id(uc) == "history:un-admission"
assert uc.metadata["measurementType"] == "historical_date"
assert uc.metadata["historicalValueFormat"] == "date"
assert uc.rule.unit == "admission date"
assert uc.metadata["official_unit"] == "admission date"

co = module.ConstituteImporter(None, dry_run=True)
cc = co.discover()[0]
assert co.category_id(cc) == "history:oldest-current-constitution"
assert cc.metadata["measurementType"] == "historical_date"
assert cc.metadata["historicalValueFormat"] == "year"
assert cc.rule.ranking_direction == "low"
# Exercise the Constitute subset path with the small fixture while preserving
# the production minimum-coverage rule on the real candidate definition.
from dataclasses import replace as dc_replace
cc_fixture = dc_replace(cc, rule=dc_replace(cc.rule, min_coverage=2))
with patch.object(co, "_payload", return_value=CONSTITUTE_FIXTURE):
    constitute_rows = co.fetch_observations(cc_fixture)
assert cc_fixture.metadata["eligible_universe_type"] == "defined_subset"
assert cc_fixture.metadata["eligible_country_count"] == len(constitute_rows)
assert set(cc_fixture.metadata["eligible_country_iso3"]) == {row.country_iso3 for row in constitute_rows}
IPU_FIXTURE = {
    "data": [
        {"type": "Parliament", "id": "CA", "attributes": {"parliament_country": {"value": "CA"}, "date_of_independence": {"value": "1982-04-17T00:00:00.000Z"}, "suffrage": {"value": [
            {"national_or_local": {"term": "national"}, "restricted_or_unrestricted": {"term": "restricted"}, "right_to_vote": "1918-01-01T00:00:00.000Z"},
            {"national_or_local": {"term": "national"}, "restricted_or_unrestricted": {"term": "universal"}, "right_to_vote": "1960-01-01T00:00:00.000Z"}
        ]}}},
        {"type": "Parliament", "id": "NZ", "attributes": {"parliament_country": {"value": "NZ"}, "date_of_independence": {"value": None}, "suffrage": {"value": [
            {"national_or_local": {"term": "national"}, "restricted_or_unrestricted": {"term": "universal"}, "right_to_vote": "1893-01-01T00:00:00.000Z"}
        ]}}},
        {"type": "Parliament", "id": "US", "attributes": {"parliament_country": {"value": "US"}, "date_of_independence": {"value": None}, "suffrage": {"value": [
            {"national_or_local": {"term": "national"}, "restricted_or_unrestricted": {"term": "universal"}, "right_to_vote": "1920-01-01T00:00:00.000Z"},
            {"national_or_local": {"term": "national"}, "restricted_or_unrestricted": {"term": "universal"}, "right_to_vote": "1965-01-01T00:00:00.000Z"}
        ]}}},
        {"type": "Parliament", "id": "SS", "attributes": {"parliament_country": {"value": "SS"}, "date_of_independence": {"value": "2011-07-09T00:00:00.000Z"}, "suffrage": {"value": []}}},
        # Compatibility fallback for the older country_name response shape.
        {"attributes": {"country_name": {"value": {"en": "France"}}, "date_of_independence": {"value": None}, "suffrage": {"value": [
            {"national_or_local": {"term": "national"}, "restricted_or_unrestricted": {"term": "universal"}, "right_to_vote": "1944-01-01T00:00:00.000Z"}
        ]}}},
    ]
}
ipu_parsed = module.parse_ipu_historical_payload(IPU_FIXTURE)
assert ipu_parsed["NZL"]["universal_suffrage"] == 1893
assert ipu_parsed["USA"]["universal_suffrage"] == 1920
assert ipu_parsed["CAN"]["universal_suffrage"] == 1960
assert ipu_parsed["SSD"]["independence"] == 2011
assert ipu_parsed["FRA"]["universal_suffrage"] == 1944
assert module.country_alpha2_to_iso3("AD") == "AND"
assert module.country_alpha2_to_iso3("us") == "USA"

ipu = module.IPUHistoricalImporter(None, dry_run=True)
ipu_candidates = {candidate.rule.key: candidate for candidate in ipu.discover()}
assert ipu.category_id(ipu_candidates["recent-independence"]) == "history:ipu-recent-independence"
assert ipu.category_id(ipu_candidates["universal-womens-suffrage"]) == "history:ipu-universal-womens-suffrage"
assert ipu_candidates["recent-independence"].rule.ranking_direction == "high"
assert ipu_candidates["universal-womens-suffrage"].rule.ranking_direction == "low"
assert all(candidate.metadata["measurementType"] == "historical_date" for candidate in ipu_candidates.values())
assert "country_name" not in module.IPU_API_URL
assert "parliament_country" in module.IPU_API_URL

# v16.2.7 chronology categories may define a legitimate ranked subset, but the
# subset itself must be explicit and completely covered. This metadata is what
# lets lowest-wins history (for example women's suffrage) pass completeness
# without inventing dates for countries outside the source-defined universe.
sample_rows = [
    module.SourceObservation("USA", "United States", module.SNAPSHOT_YEAR, 1920.0, "https://example.test", "USA", "official"),
    module.SourceObservation("NZL", "New Zealand", module.SNAPSHOT_YEAR, 1893.0, "https://example.test", "NZL", "official"),
]
subset_candidate = ipu_candidates["universal-womens-suffrage"]
module._mark_defined_subset(subset_candidate, sample_rows, "Fixture source-defined suffrage subset.", "No explicit source record.")
assert subset_candidate.metadata["eligible_universe_type"] == "defined_subset"
assert subset_candidate.metadata["eligible_country_count"] == 2
assert subset_candidate.metadata["eligible_country_iso3"] == ["NZL", "USA"]

# v16.2.4 broad World Bank historical milestones use only exact consecutive-year
# crossings. Left-censored countries and gaps are omitted rather than assigned a
# false historical date.
WB_ROWS = [
    {"countryiso3code": "USA", "date": "2000", "value": 49.0},
    {"countryiso3code": "USA", "date": "2001", "value": 50.1},
    {"countryiso3code": "CAN", "date": "1999", "value": 48.0},
    {"countryiso3code": "CAN", "date": "2000", "value": 49.8},
    {"countryiso3code": "CAN", "date": "2001", "value": 51.0},
    {"countryiso3code": "FRA", "date": "2000", "value": 55.0},  # left-censored
    {"countryiso3code": "DEU", "date": "2000", "value": 45.0},
    {"countryiso3code": "DEU", "date": "2002", "value": 55.0},  # gap: not exact
    {"countryiso3code": "WLD", "date": "2001", "value": 50.0},  # aggregate
]
wb_series = module.parse_world_bank_series([{}, WB_ROWS])
wb_crossings = module.observed_threshold_crossing_years(wb_series, 50.0, "up")
assert wb_crossings == {"CAN": 2001, "USA": 2001}
wb_down = module.observed_threshold_crossing_years({
    "USA": {2000: 3.2, 2001: 2.9},
    "CAN": {2000: 2.8, 2001: 2.7},  # left-censored: no crossing
    "DEU": {2000: 3.2, 2002: 2.8},  # gap: not exact
}, 3.0, "down")
assert wb_down == {"USA": 2001}

wb_payloads = {}
for spec_row in module.WORLD_BANK_MILESTONE_SPECS:
    code = spec_row["code"]
    threshold = float(spec_row["threshold"])
    fixture_rows = []
    # Give every candidate enough exact crossings for its configured fixture test,
    # while still exercising ISO filtering and consecutive-year logic.
    for index, iso3 in enumerate(["USA", "CAN", "FRA", "DEU", "GBR", "JPN", "BRA", "ARG", "MEX", "CHL"]):
        year = 2000 + index
        direction = spec_row.get("crossing_direction", "up")
        before, after = ((threshold - 1, threshold + 1) if direction == "up" else (threshold + 1, threshold - 1))
        fixture_rows.extend([
            {"countryiso3code": iso3, "date": str(year - 1), "value": before},
            {"countryiso3code": iso3, "date": str(year), "value": after},
        ])
    wb_payloads[code] = [{}, fixture_rows]

wb = module.WorldBankHistoricalMilestonesImporter(None, dry_run=True, payloads=wb_payloads)
wb_candidates = {candidate.rule.key: candidate for candidate in wb.discover()}
assert set(wb_candidates) == {
    "majority-urban", "internet-half", "electricity-half", "life-expectancy-70",
    "fertility-below-3", "under-five-mortality-below-50",
    "infant-mortality-below-25", "mobile-subscriptions-50",
}
assert wb.category_id(wb_candidates["majority-urban"]) == "history:worldbank-majority-urban"
assert wb.category_id(wb_candidates["internet-half"]) == "history:worldbank-internet-half"
assert wb.category_id(wb_candidates["electricity-half"]) == "history:worldbank-electricity-half"
assert wb.category_id(wb_candidates["life-expectancy-70"]) == "history:worldbank-life-expectancy-70"
assert wb.category_id(wb_candidates["fertility-below-3"]) == "history:worldbank-fertility-below-3"
assert wb.category_id(wb_candidates["under-five-mortality-below-50"]) == "history:worldbank-under-five-mortality-below-50"
assert wb.category_id(wb_candidates["infant-mortality-below-25"]) == "history:worldbank-infant-mortality-below-25"
assert wb.category_id(wb_candidates["mobile-subscriptions-50"]) == "history:worldbank-mobile-subscriptions-50"
assert wb_candidates["fertility-below-3"].metadata["source_query"]["crossing_direction"] == "down"
assert all(candidate.rule.ranking_direction == "high" for candidate in wb_candidates.values())
assert all(candidate.metadata["measurementType"] == "historical_date" for candidate in wb_candidates.values())
assert all(candidate.rule.unit == "milestone year" for candidate in wb_candidates.values())

for candidate in [uc, cc, *ipu_candidates.values(), *wb_candidates.values()]:
    assert units_compatible(
        candidate.rule.unit,
        candidate.rule.unit,
        candidate.source_indicator_name,
        candidate.metadata.get("official_unit"),
    ), f"Historical unit metadata is incompatible for {candidate.rule.key}"

# The production workflow must be able to construct its Supabase client from
# GitHub Actions secrets. This regression protects the non-dry-run path, which
# parser-only fixtures do not otherwise exercise.
with patch.dict(os.environ, {
    "SUPABASE_URL": "https://example.supabase.co/",
    "SUPABASE_SECRET_KEY": "test-service-role-key",
}, clear=True):
    warehouse = module._warehouse()
    assert warehouse.base == "https://example.supabase.co"
    assert warehouse.key == "test-service-role-key"

with patch.dict(os.environ, {
    "SUPABASE_URL": "https://example.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "legacy-service-role-key",
}, clear=True):
    warehouse = module._warehouse()
    assert warehouse.key == "legacy-service-role-key"

print("GeoStats v16.2.7 historical importer tests passed.")
