#!/usr/bin/env python3
import importlib.util,sys,tempfile
from pathlib import Path
p=Path(__file__).with_name('import-fao-fra-2025.py');s=importlib.util.spec_from_file_location('fra',p);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
assert len(m.SPECS)==16
assert len(m.DESCRIPTIONS)==16 and all(len(v)>40 for v in m.DESCRIPTIONS.values())
assert next(x for x in m.SPECS if x.key=='forest-share').title=='Highest % of land covered by forest'
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'fra.csv';f.write_text('Country Code,Year,Indicator,Value\nBRA,2025,Forest area (% of land area),59.0\nCAN,2025,Forest area (% of land area),38.7\n',encoding='utf-8')
 imp=m.Importer(None,str(f),True);c=next(x for x in imp.discover() if x.rule.key=='forest-share');obs=imp.fetch_observations(c);assert len(obs)==2
 bad=Path(d)/'bad.csv';bad.write_text('Country Code,Year,Indicator,Value\nBRA,2025,Forest area (% of land area),101\n',encoding='utf-8')
 try:m.Importer(None,str(bad),True)._data();raise AssertionError
 except RuntimeError:pass
print('FAO FRA 2025 importer tests passed.')
