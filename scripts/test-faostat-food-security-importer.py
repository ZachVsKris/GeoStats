#!/usr/bin/env python3
import importlib.util,sys,tempfile
from pathlib import Path
p=Path(__file__).with_name('import-faostat-food-security.py');s=importlib.util.spec_from_file_location('fs',p);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
assert len(m.SPECS)==15
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'fs.csv';f.write_text('Area,Year,Item,Unit,Value\nUnited States,2021-2023,Prevalence of undernourishment (percent) (3-year average),%,2.5\nCanada,2021-2023,Prevalence of undernourishment (percent) (3-year average),%,3.0\n',encoding='utf-8')
 imp=m.Importer(None,str(f),True);c=next(x for x in imp.discover() if x.rule.key=='undernourishment-prevalence');obs=imp.fetch_observations(c);assert len(obs)==2 and {o.data_year for o in obs}=={2023} and all(o.metadata['reference_period']=='2021-2023' for o in obs)
 bad=Path(d)/'bad.csv';bad.write_text('Area,Year,Item,Unit,Value\nUnited States,2021-2023,Prevalence of undernourishment (percent) (3-year average),million,2.5\n',encoding='utf-8')
 try:m.Importer(None,str(bad),True)._parse();raise AssertionError
 except RuntimeError:pass
print('FAOSTAT Food Security importer tests passed.')
