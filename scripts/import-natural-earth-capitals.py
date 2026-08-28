#!/usr/bin/env python3
"""Natural Earth 1:10m national-capital coordinate categories (v16.2.6).
Countries with multiple ADM0CAP points are omitted rather than arbitrarily choosing a capital.
"""
from __future__ import annotations
import argparse,hashlib,os,tempfile,zipfile
from collections import defaultdict
from pathlib import Path
import shapefile
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name
from data_pipeline.countries import normalize_iso3
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition,IndicatorRule,SourceObservation
from data_pipeline.supabase import SupabaseWarehouse
URL='https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_populated_places.zip';PAGE='https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/';LICENSE='https://www.naturalearthdata.com/about/terms-of-use/';VERSION='5.1.2';YEAR=2026
SPECS=(
 ('northernmost-capital','Northernmost capital','Latitude of the country’s single Natural Earth national-capital point.','degrees north','high'),
 ('southernmost-capital','Southernmost capital','Latitude of the country’s single Natural Earth national-capital point.','degrees latitude','low'),
 ('capital-closest-equator','Capital closest to the Equator','Absolute latitude of the country’s single Natural Earth national-capital point.','degrees from Equator','low'),
)
def _truth(v):return str(v).strip().lower() in {'1','1.0','true','yes','y'} or v is True
def _iso(record):
 for k in ('ADM0_A3','SOV_A3','GU_A3','ISO_A3'):
  x=normalize_iso3(record.get(k))
  if x:return x
 return None
def derive(records):
 by=defaultdict(list)
 for rec,lon,lat in records:
  if not _truth(rec.get('ADM0CAP')):continue
  iso=_iso(rec)
  if iso:by[iso].append((float(lon),float(lat),str(rec.get('NAME') or rec.get('NAMEPAR') or '')))
 # Multiple national-capital rows can reflect officially split capital functions. Omit these countries.
 return {iso:rows[0] for iso,rows in by.items() if len(rows)==1}
class Importer(WarehouseImporter):
 source_organization='Natural Earth';source_dataset='Natural Earth 1:10m Populated Places';source_slug='naturalearth'
 def __init__(self,warehouse,dry_run=False):super().__init__(warehouse,dry_run=dry_run);self.http=HttpClient(timeout=180,retries=5,user_agent='GeoStats/16.2.6 Natural Earth capitals');self._rows=None;self.sha=None
 def _load(self):
  if self._rows is not None:return self._rows
  raw=self.http.get_bytes(URL);self.sha=hashlib.sha256(raw).hexdigest();d=Path(tempfile.mkdtemp(prefix='geostats-capitals-'));z=d/'p.zip';z.write_bytes(raw)
  with zipfile.ZipFile(z) as h:h.extractall(d)
  shp=next(d.rglob('*.shp'));r=shapefile.Reader(str(shp),encoding='latin1');fields=[f[0] for f in r.fields[1:]];records=[]
  for x in r.iterShapeRecords():
   rec=dict(zip(fields,x.record));pts=x.shape.points
   if pts: records.append((rec,pts[0][0],pts[0][1]))
  self._rows=derive(records);return self._rows
 def discover(self):
  out=[]
  for key,title,desc,unit,direction in SPECS:
   r=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=f'{desc} Natural Earth populated places v{VERSION}; countries with more than one ADM0CAP point are omitted.',unit_explanation=unit,family='Geography',icon='🏛️',unit=unit,value_type='other',ranking_direction=direction,include=(key,),min_coverage=175,evidence_tier='B',source_priority=14,specificity_score=97,recognizability_score=99,understandability_score=99,fun_score=98)
   out.append(CandidateDefinition(r,f'CAPITAL:{key}',title,PAGE,{'source_page_url':PAGE,'download_url':URL,'dataset_release':f'Natural Earth Populated Places v{VERSION}','license_name':'Natural Earth public domain','license_url':LICENSE,'source_query':{'layer':'populated_places','scale':'1:10m','ADM0CAP':1,'multiple_capital_policy':'omit'},'derivation_method':r.technical_definition,'derivation_version':'geostats-capitals-v16.2.6','input_datasets':[{'name':'Natural Earth Populated Places','version':VERSION,'url':URL}],'measurementType':'other','broadDomain':'physical-geography','knowledgeCluster':'capitals','strategyFamily':'capital-position','v16_2_6_content_reviewed':True,'showObservationYear':False}))
  return out
 def fetch_observations(self,c):
  rows=self._load();out=[]
  for iso,(lon,lat,name) in rows.items():
   val=abs(lat) if c.rule.key=='capital-closest-equator' else lat
   out.append(SourceObservation(iso,canonical_country_name(iso,iso),YEAR,float(val),PAGE,f'{iso}:{c.rule.key}','official',{'capital_name':name,'longitude':lon,'latitude':lat,'archive_sha256':self.sha}))
  return out
 def category_id(self,c):return f'natural-earth-capital:{c.rule.key}'
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--dry-run',action='store_true');a=ap.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.dry_run).run())
if __name__=='__main__':main()
