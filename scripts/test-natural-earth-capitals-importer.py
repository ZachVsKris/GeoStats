import importlib.util,sys
from pathlib import Path
p=Path(__file__).with_name('import-natural-earth-capitals.py');spec=importlib.util.spec_from_file_location('caps',p);m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
rows=[({'ADM0CAP':1,'ADM0_A3':'FRA','NAME':'Paris'},2.3,48.9),({'ADM0CAP':1,'ADM0_A3':'ZAF','NAME':'Pretoria'},28,-25),({'ADM0CAP':1,'ADM0_A3':'ZAF','NAME':'Cape Town'},18,-33),({'ADM0CAP':0,'ADM0_A3':'USA','NAME':'New York'},-74,40)]
d=m.derive(rows);assert d['FRA'][2]=='Paris';assert 'ZAF' not in d and 'USA' not in d
imp=m.Importer(None,True);cs=imp.discover();assert len(cs)==3 and all(c.metadata['source_query']['multiple_capital_policy']=='omit' for c in cs)
print('Natural Earth capitals importer fixtures passed.')
