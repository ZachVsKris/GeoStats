#!/usr/bin/env python3
import importlib.util,sys,tempfile
from pathlib import Path
p=Path(__file__).with_name('import-undp-hdr.py');s=importlib.util.spec_from_file_location('undp',p);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
assert len(m.SPECS)==15
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'u.csv';f.write_text('Country Code,Year,Variable Code,Value\nUSA,2023,hdi,0.94\nCAN,2023,hdi,0.93\nUSA,2022,hdi,0.92\n',encoding='utf-8')
 imp=m.Importer(None,str(f),True);c=next(x for x in imp.discover() if x.rule.key=='hdi');obs=imp.fetch_observations(c);assert len(obs)==3
 bad=Path(d)/'bad.csv';bad.write_text('Country Code,Year,Variable Code,Value\nUSA,2023,hdi,1.4\n',encoding='utf-8')
 try:m.Importer(None,str(bad),True)._data();raise AssertionError
 except RuntimeError:pass
print('UNDP HDR importer tests passed.')
