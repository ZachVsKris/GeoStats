import importlib.util,tempfile,sys,csv
from pathlib import Path
p=Path(__file__).with_name('import-wto-services.py');spec=importlib.util.spec_from_file_location('wtoservices',p);m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'wto.csv'
 with f.open('w',newline='') as h:
  w=csv.DictWriter(h,fieldnames=['reporter iso3','reporter','year','sector','flow','value','unit']);w.writeheader();w.writerow({'reporter iso3':'FRA','reporter':'France','year':2025,'sector':'Total commercial services','flow':'Exports','value':'300','unit':'US dollars billion'});w.writerow({'reporter iso3':'FRA','reporter':'France','year':2025,'sector':'Total commercial services','flow':'Imports','value':'250','unit':'US dollars billion'})
 imp=m.Importer(None,str(f),True);assert len(imp.rows)==1 and imp.rows[0][3]==550e9;c=imp.discover()[0];assert len(imp.fetch_observations(c))==1
print('WTO services importer fixtures passed.')
