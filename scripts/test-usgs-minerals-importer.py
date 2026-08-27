import csv,importlib.util,sys,tempfile
from pathlib import Path
p=Path(__file__).with_name('import-usgs-minerals.py'); spec=importlib.util.spec_from_file_location('usgs_minerals_importer',p); m=importlib.util.module_from_spec(spec); sys.modules[spec.name]=m; spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
    f=Path(d)/'minerals.csv'
    with f.open('w',newline='',encoding='utf-8') as h:
        w=csv.DictWriter(h,fieldnames=['Country','Commodity','Year','Production','Unit']); w.writeheader()
        w.writerow({'Country':'Australia','Commodity':'Lithium','Year':2023,'Production':86000,'Unit':'metric tonnes'})
        w.writerow({'Country':'Chile','Commodity':'Lithium','Year':2023,'Production':44000,'Unit':'metric tonnes'})
        w.writerow({'Country':'Australia','Commodity':'Lithium reserves','Year':2023,'Production':1000000,'Unit':'metric tonnes'})
    imp=m.Importer(None,str(f),True); assert len(imp.rows)==2
    cats={c.rule.key:c for c in imp.discover()}; assert 'lithium' in cats
    obs=imp.fetch_observations(cats['lithium']); assert len(obs)==2 and max(o.value for o in obs)==86000
print('USGS minerals importer fixtures passed.')
