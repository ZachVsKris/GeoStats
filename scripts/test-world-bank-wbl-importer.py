import importlib.util,sys,tempfile
from pathlib import Path
p=Path(__file__).with_name('import-world-bank-wbl.py');s=importlib.util.spec_from_file_location('wbl',p);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
assert len(m.SPECS)==13
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'w.csv';f.write_text('Economy,Country Code,Legal Frameworks score,Safety score\nFrance,FRA,88,90\nCanada,CAN,92,95\n',encoding='utf-8');imp=m.Importer(None,str(f),True);cs={c.rule.key:c for c in imp.discover()};assert len(imp.fetch_observations(cs['legal-overall']))==2;assert max(o.value for o in imp.fetch_observations(cs['safety']))==95
print('WBL importer tests passed.')
