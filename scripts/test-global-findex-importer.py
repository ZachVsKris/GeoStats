#!/usr/bin/env python3
import importlib.util,sys,tempfile
from pathlib import Path
p=Path(__file__).with_name('import-global-findex.py');s=importlib.util.spec_from_file_location('gf',p);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
assert len(m.SPECS)==17
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'x.csv';f.write_text('Country Code,Year,Indicator Name,Value\nUSA,2024,Account (% age 15+),95\nCAN,2024,Account (% age 15+),98\nUSA,2021,Account (% age 15+),90\n',encoding='utf-8')
 imp=m.Importer(None,str(f),True);c=next(x for x in imp.discover() if x.rule.key=='account-ownership');obs=imp.fetch_observations(c);assert len(obs)==2 and {o.data_year for o in obs}=={2024}
 bad=Path(d)/'bad.csv';bad.write_text('Country Code,Year,Indicator Name,Value\nUSA,2024,Account (% age 15+),101\n',encoding='utf-8')
 try:m.Importer(None,str(bad),True)._data();raise AssertionError('range guard failed')
 except RuntimeError:pass
print('Global Findex importer tests passed.')
