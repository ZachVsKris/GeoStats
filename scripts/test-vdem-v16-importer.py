#!/usr/bin/env python3
import importlib.util,sys,tempfile
from pathlib import Path
p=Path(__file__).with_name('import-vdem-v16.py');s=importlib.util.spec_from_file_location('vd',p);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
assert len(m.SPECS)==15 and next(x for x in m.SPECS if x.key=='rule-law').aliases==('v2x_rule',)
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'v.csv';f.write_text('Country,Country Code,Year,v2x_polyarchy,v2x_corr\nUnited States,USA,2025,0.81,0.12\nCanada,CAN,2025,0.88,0.08\nUnited States,USA,2024,0.80,0.13\n',encoding='utf-8')
 imp=m.Importer(None,str(f),True);c=next(x for x in imp.discover() if x.rule.key=='electoral-democracy');obs=imp.fetch_observations(c);assert len(obs)==2 and {o.data_year for o in obs}=={2025}
 bad=Path(d)/'bad.csv';bad.write_text('Country,Country Code,Year,v2x_polyarchy\nUnited States,USA,2025,1.2\n',encoding='utf-8')
 try:m.Importer(None,str(bad),True)._data();raise AssertionError
 except RuntimeError:pass
print('V-Dem v16 importer tests passed.')
