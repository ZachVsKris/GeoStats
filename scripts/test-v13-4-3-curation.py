from pathlib import Path
import csv
import json

ROOT = Path(__file__).resolve().parents[1]
rows = list(csv.DictReader((ROOT / "CURATION_DECISIONS_V13_4_3.csv").open()))
assert len(rows) == 726
assert sum(row["decision"] == "approved" for row in rows) == 252
assert sum(row["decision"] == "excluded" for row in rows) == 474
assert len({(row["source_organization"], row["source_indicator_code"], row["category_id"]) for row in rows}) == 726

def find(source, code, category_id=""):
    matches = [
        row for row in rows
        if row["source_organization"] == source
        and row["source_indicator_code"] == code
        and row["category_id"] == category_id
    ]
    assert len(matches) == 1, (source, code, category_id, matches)
    return matches[0]

assert find("World Bank", "AG.LND.PRCP.MM", "rain")["decision"] == "approved"
assert find("World Bank", "AG.LND.PRCP.MM", "dry")["decision"] == "excluded"
assert find("World Bank", "IT.NET.USER.ZS")["decision"] == "excluded"
assert find("World Bank", "EN.GHG.CO2.MT.CE.AR5")["decision"] == "approved"
assert find("Natural Earth", "most-land-neighbors")["decision"] == "approved"
assert find("Natural Earth", "most-separate-land-areas")["decision"] == "excluded"
assert find("WHO", "WHOSIS_000001")["decision"] == "excluded"
assert find("WHO", "WSH_WATER_SAFELY_MANAGED")["decision"] == "approved"
assert find("UNESCO UIS", "XGDP.FSGOV")["decision"] == "approved"
assert find("World Bank", "SE.XPD.TOTL.GD.ZS")["decision"] == "excluded"
assert find("ILOSTAT", "ILR_CBCT_NOC_RT_A")["decision"] == "excluded"

fao = [row for row in rows if row["source_organization"] == "FAOSTAT"]
assert len(fao) == 549
assert sum(row["decision"] == "approved" for row in fao) == 133
assert all("harvested area" not in row["original_title"].lower() for row in fao if row["decision"] == "approved")

payload = json.loads((ROOT / "curation-v13.4.3.json").read_text())
assert payload["reviewed"] == 726
assert payload["approved"] == 252
assert payload["excluded"] == 474

categories = (ROOT / "lib/categories.ts").read_text()
assert '"co2Total"' in categories
assert '"co2PerCapita"' in categories
assert '"methane"' in categories
assert '"eia:most-crude-oil-produced"' in categories
assert 'warehouseSourceIndicatorCode: "most-land-neighbors"' in categories
print("v13.4.3 curation tests passed")
