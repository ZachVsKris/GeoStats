import importlib.util,sys,tempfile
from pathlib import Path
p=Path(__file__).with_name('import-faostat-land-use.py');s=importlib.util.spec_from_file_location('lu',p);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
assert len(m.SPECS)==10
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'x.csv';f.write_text('Area,Item,Element,Year,Value\nFrance,Agricultural land,Share in Land area,2022,52.1\nFrance,Agricultural land,Area,2022,999\nFrance,Planted forest,Share in Forest land,2022,12.5\n',encoding='utf-8')
 imp=m.Importer(None,str(f),True);cs={c.rule.key:c for c in imp.discover()};assert len(imp.fetch_observations(cs['agricultural-land-share']))==1;assert imp.fetch_observations(cs['agricultural-land-share'])[0].value==52.1;assert imp.fetch_observations(cs['planted-forest-share'])[0].value==12.5
print('FAOSTAT Land Use importer tests passed.')
