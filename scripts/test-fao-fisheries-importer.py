import csv,importlib.util,sys,tempfile
from pathlib import Path
p=Path(__file__).with_name('import-fao-fisheries.py'); spec=importlib.util.spec_from_file_location('fao_fisheries_importer',p); m=importlib.util.module_from_spec(spec); sys.modules[spec.name]=m; spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
    f=Path(d)/'fish.csv'
    with f.open('w',newline='',encoding='utf-8') as h:
        w=csv.DictWriter(h,fieldnames=['Country ISO3','Country','Year','Capture tonnes','Aquaculture tonnes']); w.writeheader()
        w.writerow({'Country ISO3':'FRA','Country':'France','Year':2022,'Capture tonnes':500,'Aquaculture tonnes':300})
        w.writerow({'Country ISO3':'DEU','Country':'Germany','Year':2022,'Capture tonnes':400,'Aquaculture tonnes':200})
    imp=m.Importer(None,str(f),True); assert len(imp.rows)==2
    cats={c.rule.key:c for c in imp.discover()}; assert set(cats)=={'capture-tonnes','aquaculture-tonnes','combined-tonnes'}
    obs=imp.fetch_observations(cats['combined-tonnes']); assert sorted(o.value for o in obs)==[600.0,800.0]
print('FAO fisheries importer fixtures passed.')
