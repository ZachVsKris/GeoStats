#!/usr/bin/env python3
import importlib.util,sys,tempfile
from pathlib import Path
import numpy as np, rasterio, shapefile
from rasterio.transform import from_origin
p=Path(__file__).with_name('import-koppen-geiger.py');s=importlib.util.spec_from_file_location('kg',p);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
assert len(m.GROUPS)==12 and len(m.CLASS_CODES)==30
assert all(not title.endswith('.') and ' share' not in title.lower() for _,title in m.GROUPS.values())
assert all(c.rule.temporal_scope=='climatology' and c.rule.publication_year==2023 for c in m.Importer(None,dry_run=True).discover())
with tempfile.TemporaryDirectory() as d:
 d=Path(d);rp=d/'k.tif';arr=np.array([[4,4,1,1],[6,6,29,30]],dtype='uint8')
 with rasterio.open(rp,'w',driver='GTiff',height=2,width=4,count=1,dtype='uint8',crs='EPSG:4326',transform=from_origin(-2,2,1,1),nodata=0) as ds:ds.write(arr,1)
 shp=d/'c.shp';w=shapefile.Writer(str(shp));w.field('ADM0_A3','C');w.poly([[[-2,0],[0,0],[0,2],[-2,2],[-2,0]]]);w.record('USA');w.poly([[[0,0],[2,0],[2,2],[0,2],[0,0]]]);w.record('CAN');w.close()
 imp=m.Importer(None,str(rp),str(shp),True);des=imp._data()['desert-share'];assert len(des)==2
 usa=next(o for o in des if o.country_iso3=='USA');can=next(o for o in des if o.country_iso3=='CAN');assert 45<usa.value<55 and can.value==0
 div=imp._data()['climate-diversity'];assert next(o for o in div if o.country_iso3=='USA').value==2 and next(o for o in div if o.country_iso3=='CAN').value==3
print('Köppen-Geiger importer tests passed.')
