import importlib.util,sys,tempfile
from pathlib import Path
p=Path(__file__).with_name('import-jmp-wash.py');s=importlib.util.spec_from_file_location('jmp',p);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
assert len(m.SPECS)==13
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'j.csv';f.write_text('ISO3,Year,Residence,Service type,Service level,Value\nFRA,2022,National,drinking water,At least basic,99\nFRA,2022,National,drinking water,Limited service,0.4\nFRA,2022,National,drinking water,Unimproved,0.4\nFRA,2022,National,drinking water,Surface water,0.2\nFRA,2022,Urban,drinking water,At least basic,100\nCAN,2022,National,hygiene,Basic service,95\n',encoding='utf-8')
 imp=m.Importer(None,str(f),True);cs={c.rule.key:c for c in imp.discover()};obs=imp.fetch_observations(cs['water-basic']);assert len(obs)==1 and obs[0].country_iso3=='FRA';assert imp.fetch_observations(cs['hygiene-basic'])[0].value==95
 bad=Path(d)/'bad.csv';bad.write_text('ISO3,Year,Residence,Service type,Service level,Value\nFRA,2022,National,drinking water,At least basic,90\nFRA,2022,National,drinking water,Limited service,5\nFRA,2022,National,drinking water,Unimproved,5\nFRA,2022,National,drinking water,Surface water,5\n',encoding='utf-8')
 try:m.Importer(None,str(bad),True)._parse();raise AssertionError('ladder guard failed')
 except RuntimeError:pass
print('JMP importer tests passed.')
