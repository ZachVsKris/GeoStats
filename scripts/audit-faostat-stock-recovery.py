"""Read-only source extraction; never writes to Supabase or changes approval."""
import csv
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import zipfile

spec = importlib.util.spec_from_file_location("faostat_recovery_importer", Path(__file__).with_name("import-faostat.py"))
importer = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = importer
spec.loader.exec_module(importer)
catalog = json.loads(Path(sys.argv[2]).read_text())
targets = {r["source_query"]["itemCode"]: r for r in catalog if r["id"].startswith(("faostat-qcl-chickens-stocks-", "faostat-qcl-ducks-stocks-", "faostat-qcl-turkeys-stocks-", "faostat-qcl-camels-stocks-"))}
result = {r["id"]: {"year": r["common_year"], "source_query": r["source_query"], "observations": []} for r in targets.values()}
archive = Path(sys.argv[1])
with zipfile.ZipFile(archive) as z:
    member = next(n for n in z.namelist() if n.endswith(".csv"))
    for row in csv.DictReader(io.TextIOWrapper(z.open(member), encoding="utf-8-sig")):
        target = targets.get(row.get("Item Code (CPC)"))
        if not target or row["Element Code"] != target["source_query"]["elementCode"] or row["Year"] != str(target["common_year"]):
            continue
        assert row["Unit"] == target["source_query"]["unit"]
        assert row["Item"] == target["source_query"]["item"]
        iso = importer.m49_to_iso3(row["Area Code (M49)"])
        value = importer.finite_float(row["Value"])
        if not iso or value is None or importer.classify_flag(row["Flag"], "") == "missing":
            continue
        # Independently assert source-unit conversion instead of trusting labels.
        converted = value * (1000 if row["Unit"] == "1000 An" else 1)
        assert converted == importer.display_value(row["Item"], row["Element"], row["Unit"], value)
        result[target["id"]]["observations"].append({"country_iso3": iso,"country_name": importer.canonical_country_name(iso,row["Area"]),"data_year": int(row["Year"]),"value": converted,"source_url": importer.SOURCE_URL,"source_record_id": f"QCL:{row['Item Code (CPC)']}:{row['Element Code']}:{iso}:{row['Year']}","metadata": {"sourceUnit": row["Unit"],"sourceValue": value,"displayUnit": "animals","flag": row["Flag"],"reportingClass": importer.classify_flag(row["Flag"], "")}})
for r in result.values():
    r["observations"].sort(key=lambda o: o["country_iso3"])
    assert len({o["country_iso3"] for o in r["observations"]}) == len(r["observations"])
    r["coverage"] = len(r["observations"])
    r["top20"] = [o["country_iso3"] for o in sorted(r["observations"],key=lambda o:-o["value"])[:20]]
print(json.dumps({"source": importer.FALLBACK_ZIP_URL,"archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),"series":result}))
