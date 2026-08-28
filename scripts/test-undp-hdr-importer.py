#!/usr/bin/env python3
import importlib.util
import sys
import tempfile
from pathlib import Path

p = Path(__file__).with_name("import-undp-hdr.py")
s = importlib.util.spec_from_file_location("undp", p)
m = importlib.util.module_from_spec(s)
sys.modules[s.name] = m
s.loader.exec_module(m)

assert len(m.SPECS) == 10
assert {spec.aliases[0] for spec in m.SPECS} == {"hdi", "ihdi", "loss", "coef_ineq", "ineq_le", "ineq_edu", "ineq_inc", "gdi", "gii", "phdi"}

with tempfile.TemporaryDirectory() as d:
    f = Path(d) / "hdr25.csv"
    f.write_text(
        "iso3,country,hdi_2022,hdi_2023,ihdi_2023,loss_2023,coef_ineq_2023,ineq_le_2023,ineq_edu_2023,ineq_inc_2023,gdi_2023,gii_2023,phdi_2023\n"
        "USA,United States,0.92,0.94,0.82,12.0,11.0,5.0,10.0,18.0,0.98,0.18,0.80\n"
        "CAN,Canada,,0.93,0.83,11.0,10.0,4.0,9.0,17.0,0.99,0.16,0.81\n",
        encoding="utf-8",
    )
    imp = m.Importer(None, str(f), True)
    hdi = next(x for x in imp.discover() if x.rule.key == "hdi")
    obs = imp.fetch_observations(hdi)
    assert len(obs) == 3
    assert {(o.country_iso3, o.data_year) for o in obs} == {("USA", 2022), ("USA", 2023), ("CAN", 2023)}
    assert sorted(round(o.value, 6) for o in obs if o.data_year == 2023) == [0.93, 0.94]

    inequality = next(x for x in imp.discover() if x.rule.key == "education-inequality")
    inequality_obs = imp.fetch_observations(inequality)
    assert sorted(round(o.value, 6) for o in inequality_obs) == [9.0, 10.0]

    bad = Path(d) / "bad.csv"
    bad.write_text("iso3,country,hdi_2023\nUSA,United States,1.4\n", encoding="utf-8")
    try:
        m.Importer(None, str(bad), True)._data()
        raise AssertionError("range guard failed")
    except RuntimeError:
        pass

print("UNDP HDR importer tests passed.")
