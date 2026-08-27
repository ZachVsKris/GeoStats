import importlib.util,tempfile,sys,csv
from pathlib import Path
p=Path(__file__).with_name('import-un-desa-migrant-stock.py');spec=importlib.util.spec_from_file_location('undesamigrant',p);m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'ims.csv'
 with f.open('w',newline='') as h:
  w=csv.DictWriter(h,fieldnames=['iso3','country','year','international migrant stock','percentage of population']);w.writeheader();w.writerow({'iso3':'FRA','country':'France','year':2024,'international migrant stock':'9000000','percentage of population':'13.2'});w.writerow({'iso3':'DEU','country':'Germany','year':2024,'international migrant stock':'16000000','percentage of population':'19'})
 imp=m.Importer(None,str(f),True);assert len(imp.rows)==2;cs={c.rule.key:c for c in imp.discover()};assert len(imp.fetch_observations(cs['migrant-stock']))==2;assert len(imp.fetch_observations(cs['migrant-share']))==2
print('UN DESA migrant-stock importer fixtures passed.')
