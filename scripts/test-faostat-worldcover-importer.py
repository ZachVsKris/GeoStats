import importlib.util,sys,tempfile
from pathlib import Path
p=Path(__file__).with_name('import-faostat-worldcover.py');s=importlib.util.spec_from_file_location('wc',p);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
assert len(m.TITLES)==9 and len(m.BLOCKED_TRACKER_CONCEPTS)==1
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'x.csv';lines=['Area,Item,Element,Year,Value'];items=['Tree cover','Shrubland','Cropland','Built-up','Bare / sparse vegetation','Snow and ice','Permanent water bodies','Herbaceous wetland','Mangroves','Grassland']
 for i,item in enumerate(items):lines.append(f'France,{item},Area,2021,{10 if i==0 else 1}')
 f.write_text('\n'.join(lines)+'\n',encoding='utf-8');imp=m.Importer(None,str(f),True);cs={c.rule.key:c for c in imp.discover()};obs=imp.fetch_observations(cs['tree-cover-share']);assert len(obs)==1;assert 52<obs[0].value<53
 # remove one denominator class -> fail closed/no observations
 f2=Path(d)/'y.csv';f2.write_text('\n'.join(lines[:-1])+'\n',encoding='utf-8');imp2=m.Importer(None,str(f2),True);assert imp2.fetch_observations(cs['tree-cover-share'])==[]
print('FAOSTAT WorldCover importer tests passed.')
