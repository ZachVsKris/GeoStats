#!/usr/bin/env python3
import importlib.util,sys,tempfile
from pathlib import Path
p=Path(__file__).with_name('import-world-bank-infrastructure.py');s=importlib.util.spec_from_file_location('wbi',p);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
assert len(m.SPECS)==12
assert m.BY_KEY['internet-use'][2]=='IT.NET.USER.ZS'
assert m.BY_KEY['container-port-traffic'][2]=='IS.SHP.GOOD.TU'
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'x.csv';f.write_text('Country Code,Year,Indicator Code,Value\nUSA,2023,IT.NET.USER.ZS,97\nCAN,2023,IT.NET.USER.ZS,96\n',encoding='utf-8')
 imp=m.Importer(None,str(f),True); c=next(x for x in imp.discover() if x.rule.key=='internet-use'); obs=imp.fetch_observations(c);assert len(obs)==2 and {o.country_iso3 for o in obs}=={'USA','CAN'}
 bad=Path(d)/'bad.csv';bad.write_text('Country Code,Year,Indicator Code,Value\nUSA,2023,IT.NET.USER.ZS,101\n',encoding='utf-8')
 try:m.Importer(None,str(bad),True);raise AssertionError('range guard failed')
 except RuntimeError:pass
print('WDI infrastructure importer tests passed.')
