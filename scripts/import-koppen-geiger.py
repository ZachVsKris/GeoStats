#!/usr/bin/env python3
from __future__ import annotations
import argparse,hashlib,os,tempfile,zipfile
from pathlib import Path
from typing import Any
import numpy as np
import shapefile
from pyproj import Geod
from rasterio import open as rio_open
from rasterio.mask import mask as rio_mask
from shapely.geometry import shape,mapping
from shapely.ops import unary_union
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name
from data_pipeline.countries import normalize_iso3
from data_pipeline.models import CandidateDefinition,IndicatorRule,SourceObservation
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='Beck et al.';SOURCE_DATASET='Köppen-Geiger 1991–2020 climate classification';SOURCE_PAGE='https://doi.org/10.1038/s41597-023-02549-6';REFERENCE_YEAR=2020
GEOD=Geod(ellps='WGS84')
CLASS_CODES={'Af':1,'Am':2,'Aw':3,'BWh':4,'BWk':5,'BSh':6,'BSk':7,'Csa':8,'Csb':9,'Csc':10,'Cwa':11,'Cwb':12,'Cwc':13,'Cfa':14,'Cfb':15,'Cfc':16,'Dsa':17,'Dsb':18,'Dsc':19,'Dsd':20,'Dwa':21,'Dwb':22,'Dwc':23,'Dwd':24,'Dfa':25,'Dfb':26,'Dfc':27,'Dfd':28,'ET':29,'EF':30}
GROUPS={
 'desert-share':({4,5},'Highest percentage of land with a desert climate'),
 'arid-share':({4,5,6,7},'Highest percentage of land with an arid climate'),
 'steppe-share':({6,7},'Highest percentage of land with a steppe climate'),
 'tropical-rainforest-share':({1},'Highest percentage of land with a tropical rainforest climate'),
 'tropical-monsoon-share':({2},'Highest percentage of land with a tropical monsoon climate'),
 'tropical-savanna-share':({3},'Highest percentage of land with a tropical savanna climate'),
 'temperate-share':(set(range(8,17)),'Highest percentage of land with a temperate climate'),
 'mediterranean-share':({8,9,10},'Highest percentage of land with a Mediterranean climate'),
 'continental-share':(set(range(17,29)),'Highest percentage of land with a continental climate'),
 'polar-share':({29,30},'Highest percentage of land with a polar climate'),
 'tundra-share':({29},'Highest percentage of land with a tundra climate'),
 'ice-cap-share':({30},'Highest percentage of land with an ice-cap climate'),
}

# Player copy mirrors Table 1 of Beck et al. (2023). The classification uses
# 0 C, rather than the older -3 C convention, to separate temperate and cold
# climates. MAP is mean annual precipitation. The aridity threshold in mm is
# 20 x mean annual temperature, plus 280 when at least 70% of rain falls in the
# warmer six months, plus 0 when at least 70% falls in the colder six months,
# and plus 140 otherwise.
CLIMATE_DEFINITIONS={
 'desert-share':'Share of land where annual rainfall is below half the Köppen–Geiger aridity limit: 20× mean annual °C, plus 280 mm for summer rain, 0 mm for winter rain, or 140 mm otherwise',
 'arid-share':'Share of land where annual rainfall is below the Köppen–Geiger aridity limit: 20× mean annual °C, plus 280 mm for summer rain, 0 mm for winter rain, or 140 mm otherwise',
 'steppe-share':'Share of land receiving at least half, but less than all, of the Köppen–Geiger aridity limit: 20× mean annual °C, plus 280 mm for summer rain, 0 mm for winter rain, or 140 mm otherwise',
 'tropical-rainforest-share':'Share of land where every month averages at least 18°C and the driest month receives at least 60 mm of rain',
 'tropical-monsoon-share':'Share of land where every month averages at least 18°C and the driest month receives under 60 mm but at least 100 minus annual rainfall divided by 25',
 'tropical-savanna-share':'Share of land where every month averages at least 18°C and the driest month receives under 60 mm and less than 100 minus annual rainfall divided by 25',
 'temperate-share':'Share of non-arid land where the coldest month averages above 0°C but below 18°C and the warmest month averages above 10°C',
 'mediterranean-share':'Share of temperate land where the driest summer month receives under 40 mm and less than one-third the rain of the wettest winter month',
 'continental-share':'Share of non-arid land where the coldest month averages 0°C or below and the warmest month averages above 10°C',
 'polar-share':'Share of non-arid land where the warmest month averages 10°C or below',
 'tundra-share':'Share of non-arid land where the warmest month averages above 0°C but no more than 10°C',
 'ice-cap-share':'Share of non-arid land where even the warmest month averages 0°C or below',
}

CLIMATE_TECHNICAL_DEFINITIONS={
 'desert-share':'Area-weighted share in BWh or BWk: MAP < 5 × Pthreshold',
 'arid-share':'Area-weighted share in BWh, BWk, BSh, or BSk: MAP < 10 × Pthreshold',
 'steppe-share':'Area-weighted share in BSh or BSk: 5 × Pthreshold ≤ MAP < 10 × Pthreshold',
 'tropical-rainforest-share':'Area-weighted share in Af: not B, Tcold ≥ 18°C, and Pdry ≥ 60 mm/month',
 'tropical-monsoon-share':'Area-weighted share in Am: not B or Af, Tcold ≥ 18°C, and Pdry ≥ 100 − MAP/25',
 'tropical-savanna-share':'Area-weighted share in Aw: not B or Af, Tcold ≥ 18°C, and Pdry < 100 − MAP/25',
 'temperate-share':'Area-weighted share in C classes: not B, Thot > 10°C, and 0°C < Tcold < 18°C',
 'mediterranean-share':'Area-weighted share in Csa, Csb, or Csc: C-class criteria plus Psdry < 40 mm/month and Psdry < Pwwet/3',
 'continental-share':'Area-weighted share in D classes: not B, Thot > 10°C, and Tcold ≤ 0°C',
 'polar-share':'Area-weighted share in E classes: not B and Thot ≤ 10°C',
 'tundra-share':'Area-weighted share in ET: not B and 0°C < Thot ≤ 10°C',
 'ice-cap-share':'Area-weighted share in EF: not B and Thot ≤ 0°C',
}
DIVERSITY_TITLE='Most climate types'
def _sha(path):
 h=hashlib.sha256();
 with open(path,'rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def _shp_path(path_value,tmp):
 p=Path(path_value)
 if p.suffix.lower()=='.zip':
  with zipfile.ZipFile(p) as z:z.extractall(tmp)
  shps=list(Path(tmp).rglob('*.shp'))
  if len(shps)!=1:raise RuntimeError(f'Expected exactly one country shapefile in archive, found {len(shps)}')
  return shps[0]
 return p
def _iso(rec,fields):
 for k in ('ADM0_A3','ISO_A3','SOV_A3','GU_A3','WB_A3'):
  if k in fields:
   code=normalize_iso3(rec[fields[k]])
   if code:return code
 return None
def _cell_area_m2(transform,row):
 # Pixel area varies by latitude in a geographic raster; longitude does not affect ellipsoidal rectangle area materially.
 x0=transform.c; x1=x0+transform.a; y_top=transform.f+row*transform.e; y_bottom=y_top+transform.e
 area,_=GEOD.polygon_area_perimeter([x0,x1,x1,x0],[y_top,y_top,y_bottom,y_bottom]);return abs(area)
def aggregate_country_classes(raster_path,countries_path):
 out={};tmp=tempfile.TemporaryDirectory()
 try:
  shp=_shp_path(countries_path,tmp.name);reader=shapefile.Reader(str(shp),encoding='utf-8');fields={f[0]:i for i,f in enumerate(reader.fields[1:])}
  geometries={}
  for sr in reader.iterShapeRecords():
   iso=_iso(sr.record,fields)
   if not iso:continue
   geom=shape(sr.shape.__geo_interface__)
   if geom.is_empty:continue
   geometries.setdefault(iso,[]).append(geom)
  with rio_open(raster_path) as src:
   if src.crs is None or not src.crs.is_geographic:raise RuntimeError('Köppen-Geiger raster must use a geographic lon/lat CRS for the area-weighted release path.')
   for iso,parts in sorted(geometries.items()):
    geom=unary_union(parts)
    coverage_method='pixel_centers_within_sovereign_geometry'
    try:data,tr=rio_mask(src,[mapping(geom)],crop=True,filled=False,indexes=1,all_touched=False)
    except ValueError:continue
    arr=np.ma.asarray(data);valid=(~np.ma.getmaskarray(arr)) & (arr>=1) & (arr<=30)
    if not valid.any():
     # A handful of sovereign microstates/islands are smaller than one 1-km
     # cell. Include intersecting cells only for those otherwise uncovered
     # polygons and record the fallback explicitly in every observation.
     try:data,tr=rio_mask(src,[mapping(geom)],crop=True,filled=False,indexes=1,all_touched=True)
     except ValueError:continue
     arr=np.ma.asarray(data);valid=(~np.ma.getmaskarray(arr)) & (arr>=1) & (arr<=30)
     coverage_method='all_touched_tiny_country_fallback'
    if not valid.any():continue
    weights=np.zeros(arr.shape,dtype='float64')
    for r in range(arr.shape[0]):weights[r,:]=_cell_area_m2(tr,r)
    total=float(weights[valid].sum())
    if total<=0:continue
    areas={code:float(weights[valid & (arr==code)].sum()) for code in range(1,31)}
    out[iso]={'total_m2':total,'areas_m2':areas,'coverage_method':coverage_method}
  return out
 finally:tmp.cleanup()
class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='koppengeiger'
 def __init__(self,warehouse,raster_path=None,countries_path=None,dry_run=False):super().__init__(warehouse,dry_run=dry_run);self.raster_path=raster_path;self.countries_path=countries_path;self._metrics=None
 def _data(self):
  if self._metrics is not None:return self._metrics
  if not self.raster_path or not self.countries_path:raise RuntimeError('Köppen-Geiger importer requires --input official 1991-2020 raster and --countries pinned sovereign-country shapefile.')
  raw=aggregate_country_classes(self.raster_path,self.countries_path);rh=_sha(self.raster_path);ch=_sha(self.countries_path)
  out={k:[] for k in [*GROUPS,'climate-diversity']}
  for iso,d in sorted(raw.items()):
   total=d['total_m2'];areas=d['areas_m2'];name=canonical_country_name(iso,iso);meta={'source_file_sha256':rh,'country_geometry_sha256':ch,'reference_period':'1991-2020','pixel_area_weighting':'WGS84 geodesic row-cell area','coverage_method':d['coverage_method'],'classification_codes':CLASS_CODES}
   shares={code:100.0*area/total for code,area in areas.items()}
   if abs(sum(shares.values())-100)>1e-6:raise RuntimeError(f'{iso}: climate class shares do not sum to 100')
   for key,(codes,title) in GROUPS.items():
    val=sum(shares[c] for c in codes);out[key].append(SourceObservation(iso,name,REFERENCE_YEAR,val,SOURCE_PAGE,f'KOPPEN:{key}:{iso}','official',{**meta,'included_codes':sorted(codes)}))
   diversity=sum(1 for v in shares.values() if v>=1.0-1e-12);out['climate-diversity'].append(SourceObservation(iso,name,REFERENCE_YEAR,float(diversity),SOURCE_PAGE,f'KOPPEN:climate-diversity:{iso}','official',{**meta,'threshold_share_pct':1.0}))
  self._metrics=out;return out
 def discover(self):
  out=[]
  for key,(codes,title) in GROUPS.items():
   labels=tuple(k for k,v in CLASS_CODES.items() if v in codes);desc=CLIMATE_DEFINITIONS[key]
   technical=f"{CLIMATE_TECHNICAL_DEFINITIONS[key]}; exact classes {labels}; WGS84 geodesic pixel-area weighting"
   rule=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=technical,unit_explanation='% of classified land',family='Climate',icon='🌦️',unit='% of land',value_type='percentage',ranking_direction='high',include=labels,min_coverage=180,evidence_tier='A',source_priority=10,specificity_score=100,recognizability_score=96,understandability_score=98,fun_score=98,temporal_scope='climatology',publication_year=2023)
   out.append(CandidateDefinition(rule,f'KOPPEN:{key}',title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'reference_period':'1991-2020','minimum_year':REFERENCE_YEAR,'dataset_release':'Scientific Data 2023 climate normal','license_name':'CC BY 4.0','license_url':'https://creativecommons.org/licenses/by/4.0/','source_query':{'raster_release':'1991-2020','included_classes':labels,'aggregation':'geodesic area-weighted share by sovereign country'},'official_raster_input_required':True,'pinned_country_geometry_required':True,'included_classes':labels,'area_weighted':True,'measurementType':'share','broadDomain':'climate','knowledgeCluster':'climate-classification','strategyFamily':f'koppen-climate:{key.removesuffix("-share")}','definition_standard':'Beck et al. 2023 Table 1','derivation_method':'Geodesic area-weighted intersection of the published 1-km classification raster with canonical sovereign geometry','derivation_version':'geostats-v16.3.0-koppen-v3','manual_review_required':True,'v16_2_6_content_reviewed':True}))
  desc='Number of Köppen-Geiger climate types covering at least 1% of the country’s land'
  rule=IndicatorRule(key='climate-diversity',title=DIVERSITY_TITLE,description=desc,plain_language_description=desc,technical_definition='Number of exact Köppen-Geiger classes 1–30 covering at least 1% of the country’s mapped land area, using WGS84 geodesic pixel-area weighting.',unit_explanation='climate types covering ≥1% of land',family='Climate',icon='🌈',unit='climate types',value_type='count',ranking_direction='high',include=tuple(CLASS_CODES),min_coverage=180,evidence_tier='A',source_priority=10,specificity_score=100,recognizability_score=94,understandability_score=95,fun_score=99,temporal_scope='climatology',publication_year=2023)
  out.append(CandidateDefinition(rule,'KOPPEN:climate-diversity',DIVERSITY_TITLE,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'reference_period':'1991-2020','minimum_year':REFERENCE_YEAR,'dataset_release':'Scientific Data 2023 climate normal','license_name':'CC BY 4.0','license_url':'https://creativecommons.org/licenses/by/4.0/','source_query':{'raster_release':'1991-2020','classes':'1-30','minimum_country_share_pct':1.0,'aggregation':'count classes by sovereign country'},'official_raster_input_required':True,'pinned_country_geometry_required':True,'class_share_threshold_pct':1.0,'area_weighted':True,'measurementType':'total','broadDomain':'climate','knowledgeCluster':'climate-classification','strategyFamily':'koppen-climate-diversity','definition_standard':'Beck et al. 2023 Table 1','derivation_method':'Count of published 1-km Köppen-Geiger classes covering at least 1% of canonical sovereign geometry','derivation_version':'geostats-v16.3.0-koppen-v3','manual_review_required':True,'v16_2_6_content_reviewed':True}))
  return out
 def fetch_observations(self,c):return self._data().get(c.rule.key,[])
 def category_id(self,c):return f'koppen-geiger:{c.rule.key}'
def main():
 p=argparse.ArgumentParser();p.add_argument('--input');p.add_argument('--countries');p.add_argument('--dry-run',action='store_true');p.add_argument('--only',action='append',default=[]);a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.countries,a.dry_run).run(only_keys=set(a.only) or None))
if __name__=='__main__':main()
