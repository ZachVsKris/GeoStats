import csv,importlib.util,tempfile,sys
from dataclasses import replace
from pathlib import Path
p=Path(__file__).with_name('import-world-bank-climate.py');spec=importlib.util.spec_from_file_location('cckp',p);m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'c.csv'
 with f.open('w',newline='') as h:
  w=csv.DictWriter(h,fieldnames=['ISO3','Year','Tas','Pr','Txx','Tnn','Fd','Tr']);w.writeheader()
  for y in range(1991,2021):w.writerow({'ISO3':'FRA','Year':y,'Tas':10+(y-1991)*.01,'Pr':800,'Txx':35,'Tnn':-5,'Fd':20,'Tr':15})
 imp=m.Importer(None,str(f),True);cs={c.rule.key:c for c in imp.discover()}; assert len(cs)==8
 # Single-country fixtures lower only the test candidate's coverage floor; production
 # keeps the fail-loud >=175-country contract.
 one=lambda c: replace(c,rule=replace(c.rule,min_coverage=1))
 assert len(imp.fetch_observations(one(cs['hottest'])))==1;assert imp.fetch_observations(one(cs['wettest']))[0].value==800
 assert imp.fetch_observations(one(cs['highest-annual-extreme-heat']))[0].value==35
 assert imp.fetch_observations(one(cs['most-frost-days']))[0].value==20
assert len(m.UNSUPPORTED_ERA5_TRACKER_CONCEPTS)==4
assert 'most-ice-days' in m.UNSUPPORTED_ERA5_TRACKER_CONCEPTS
assert m._series({'data':{'1991':1.2,'1992':2.3}})=={1991:1.2,1992:2.3}
assert m._series({'data':{'ESP':{'1991-07':1.2,'1992-07':2.3}}})=={1991:1.2,1992:2.3}
print('World Bank climate importer fixtures passed.')
