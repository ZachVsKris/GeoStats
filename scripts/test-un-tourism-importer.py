import importlib.util,tempfile,sys,csv
from pathlib import Path
p=Path(__file__).with_name('import-un-tourism.py');spec=importlib.util.spec_from_file_location('untourismdirect',p);m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'tourism.csv'
 with f.open('w',newline='') as h:
  w=csv.DictWriter(h,fieldnames=['iso3','country','year','international tourist arrivals','international tourism receipts usd','tourism share of exports']);w.writeheader();w.writerow({'iso3':'FRA','country':'France','year':2024,'international tourist arrivals':'100000000','international tourism receipts usd':'70000000000','tourism share of exports':'8.2'})
 imp=m.Importer(None,str(f),True);assert len(imp.rows)==1;cs={c.rule.key:c for c in imp.discover()};assert all(len(imp.fetch_observations(c))==1 for c in cs.values())
print('UN Tourism importer fixtures passed.')
