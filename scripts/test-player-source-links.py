#!/usr/bin/env python3
from __future__ import annotations

from data_pipeline.player_source_links import exact_url_for, human_readable_external_url

assert human_readable_external_url("https://data.worldbank.org/indicator/SP.POP.TOTL")
assert human_readable_external_url("https://databrowser.uis.unesco.org/browser/EDUCATION/UIS-SDG4Monitoring")
for unsafe in (
    "http://data.worldbank.org/indicator/SP.POP.TOTL",
    "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json",
    "https://example.org/data.csv",
    "https://example.org/download/file",
    "https://example.org/table?format=json",
    "https://example.org/table?download=1",
    "https://example.org/table?attachment=true",
    "https://comtradeapi.un.org/public/v1/preview/C/A/HS",
):
    assert not human_readable_external_url(unsafe), unsafe

world_bank = exact_url_for("worldbank", "SP.POP.TOTL")
assert world_bank.status == "exact"
assert world_bank.score == 100
assert world_bank.url == "https://data.worldbank.org/indicator/SP.POP.TOTL"

faostat = exact_url_for("faostat", "QCL:'01460:5412")
assert faostat.status == "general"
assert faostat.score == 70
assert faostat.url == "https://www.fao.org/faostat/en/"

unesco = exact_url_for("unesco", "CR.MOD.1", {
    "source_page_url": "https://databrowser.uis.unesco.org/browser/EDUCATION/CR.MOD.1",
})
assert unesco.status == "exact"
assert unesco.score == 100

print("GeoStats v14.4 player-source URL policy tests passed.")
