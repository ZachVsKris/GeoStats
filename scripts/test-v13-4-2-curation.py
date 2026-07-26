#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / "curation-v13.4.2.json").read_text())
assert data["reviewed"] == 453
assert data["retained"] == 205
assert data["rulesReviewed"] == 453
assert data["rulesApproved"] == 205
assert data["rulesExcluded"] == 248
assert len(data["faostat"]) == 133
assert sum(len(rows) for rows in data["retainedBySource"].values()) == 205
for row in data["faostat"]:
    text = row["title"].lower()
    for forbidden in ("harvested area", "producing animals", "laying animals", "n.e.c.", "offal", "equivalent", "hides", "unrendered fat"):
        assert forbidden not in text, (forbidden, row)
    assert row["conceptGroup"].startswith("faostat-item-")
assert "SP.RUR.TOTL" in data["excluded"]["World Bank"]
assert "population:coa:asylum_seekers" in data["excluded"]["UNHCR"]
assert "ROFST.MOD.2" in data["excluded"]["UNESCO UIS"]
categories = (ROOT / "lib/categories.ts").read_text()
assert categories.count("warehouseExternal({") >= 150
assert "const CURATED_WORLD_BANK_CATEGORY_IDS" in categories
assert "const CURATED_EXISTING_WAREHOUSE_IDS" in categories
assert "CURATED_WORLD_BANK_CATEGORY_IDS.has(category.id)" in categories
assert "similarityGroup: \"vaccination-coverage\"" in categories
print("v13.4.2 editorial curation rules passed")
