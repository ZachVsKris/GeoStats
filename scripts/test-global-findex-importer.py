#!/usr/bin/env python3
import importlib.util
import sys
import tempfile
from pathlib import Path

p = Path(__file__).with_name("import-global-findex.py")
s = importlib.util.spec_from_file_location("gf", p)
m = importlib.util.module_from_spec(s)
sys.modules[s.name] = m
s.loader.exec_module(m)

assert len(m.SPECS) == 2
assert {spec.aliases[0] for spec in m.SPECS} == {"account_t_d", "merchant_pay"}

with tempfile.TemporaryDirectory() as d:
    f = Path(d) / "findex2025.csv"
    f.write_text(
        "countrynewwb,codewb,year,group,group2,account_t_d,merchant_pay\n"
        "United States,USA,2024,all,all,0.95,0.82\n"
        "Canada,CAN,2024,all,all,0.98,0.86\n"
        "United States,USA,2024,women,all,0.91,0.78\n"
        "United States,USA,2021,all,all,0.90,0.75\n",
        encoding="utf-8",
    )
    imp = m.Importer(None, str(f), True)
    account = next(x for x in imp.discover() if x.rule.key == "account-ownership")
    obs = imp.fetch_observations(account)
    assert len(obs) == 2
    assert {o.data_year for o in obs} == {2024}
    assert {o.country_iso3 for o in obs} == {"USA", "CAN"}
    assert sorted(round(o.value, 6) for o in obs) == [95.0, 98.0]

    merchant = next(x for x in imp.discover() if x.rule.key == "digital-merchant-payment")
    merchant_obs = imp.fetch_observations(merchant)
    assert sorted(round(o.value, 6) for o in merchant_obs) == [82.0, 86.0]

    bad = Path(d) / "bad.csv"
    bad.write_text("countrynewwb,codewb,year,group,group2,account_t_d\nUnited States,USA,2024,all,all,1.01\n", encoding="utf-8")
    try:
        m.Importer(None, str(bad), True)._data()
        raise AssertionError("range guard failed")
    except RuntimeError:
        pass

print("Global Findex importer tests passed.")
