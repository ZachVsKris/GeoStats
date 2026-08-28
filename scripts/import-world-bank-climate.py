#!/usr/bin/env python3
"""World Bank Climate Change Knowledge Portal CRU climatology importer.

For each GeoStats country, compute a 1991-2020 mean from the same CRU TS country
aggregation. Temperature uses annual mean tas; precipitation uses annual pr.
"""
from __future__ import annotations
import argparse,csv,io,json,os,re
from collections import defaultdict
from pathlib import Path
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import CANONICAL_COUNTRY_NAMES,canonical_country_name
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition,IndicatorRule,SourceObservation
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='World Bank Climate Change Knowledge Portal';SOURCE_DATASET='CRU TS 4.09 + ERA5 0.25° observed/reanalysis climatology';SOURCE_PAGE='https://climateknowledgeportal.worldbank.org/';METHOD='https://climateknowledgeportal.worldbank.org/metadata';ERA5_DOC='https://worldbank.github.io/climateknowledgeportal/docs/collections/era5-x0.25.html';START=1991;END=2020
API='https://cckpapi.worldbank.org/cckp/v1/cru-x0.5_timeseries_{var}_timeseries_annual_1901-2024_mean_historical_cru_ts4.09_mean/{iso3}?_format=json'

def _collect_year_values(obj,out):
 if isinstance(obj,dict):
  # common shape: {"1991": 12.3, ...}
  for k,v in obj.items():
   m=re.match(r'^((?:19|20)\d{2})(?:-\d{2})?$',str(k))
   if m:
    try: out[int(m.group(1))]=float(v)
    except: pass
   elif isinstance(v,(dict,list)): _collect_year_values(v,out)
  # record shape
  year=obj.get('year') or obj.get('Year') or obj.get('time')
  value=obj.get('value') or obj.get('Value') or obj.get('mean')
  try:
   y=int(str(year)[:4]); vv=float(value)
   if 1900<=y<=2100: out[y]=vv
  except: pass
 elif isinstance(obj,list):
  for v in obj:_collect_year_values(v,out)

def _series(payload):
 out={};_collect_year_values(payload,out);return out

def load_input(path):
 # Normalized fixture/offline format: ISO3,Year,Tas,Pr
 rows=defaultdict(lambda:{'tas':{},'pr':{},'txx':{},'tnn':{},'fd':{},'tr':{}})
 with Path(path).open(encoding='utf-8-sig') as h:
  for r in csv.DictReader(h):
   iso=str(r.get('ISO3') or r.get('iso3') or '').upper();
   try:y=int(r.get('Year') or r.get('year'))
   except:continue
   for var,col in [('tas','Tas'),('pr','Pr'),('txx','Txx'),('tnn','Tnn'),('fd','Fd'),('tr','Tr')]:
    try:rows[iso][var][y]=float(r.get(col) if r.get(col) not in (None,'') else r.get(var))
    except:pass
 return rows

class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='worldbankclimate'
 def __init__(self,warehouse,input_path=None,dry_run=False):
  super().__init__(warehouse,dry_run=dry_run);self.http=HttpClient(timeout=120,retries=4,user_agent='GeoStats/16.2.6 CCKP');self.data=load_input(input_path) if input_path else None;self.cache={}
 def discover(self):
  specs=[
   ('hottest','Hottest country','Highest 1991–2020 annual mean temperature.','°C','high','tas','CRU TS 4.09'),
   ('coldest','Coldest country','Lowest 1991–2020 annual mean temperature.','°C','low','tas','CRU TS 4.09'),
   ('wettest','Wettest country','Highest 1991–2020 average annual precipitation.','mm/year','high','pr','CRU TS 4.09'),
   ('driest','Driest country','Lowest 1991–2020 average annual precipitation.','mm/year','low','pr','CRU TS 4.09'),
   ('highest-annual-extreme-heat','Highest annual extreme temperature','Highest 1991–2020 mean of annual maximum daily temperature (TXx).','°C','high','txx','ERA5 x0.25'),
   ('lowest-annual-extreme-cold','Lowest annual minimum temperature','Lowest 1991–2020 mean of annual minimum daily temperature (TNn).','°C','low','tnn','ERA5 x0.25'),
   ('most-frost-days','Most frost days','Highest 1991–2020 average annual frost-day count (FD).','days/year','high','fd','ERA5 x0.25'),
   ('most-tropical-nights','Most tropical nights','Highest 1991–2020 average annual tropical-night count (TR).','days/year','high','tr','ERA5 x0.25'),
  ]
  out=[]
  for key,title,desc,unit,direction,var,dataset in specs:
   source_code=f'CRU-TS4.09:{var}:{START}-{END}' if dataset.startswith('CRU') else f'ERA5-x0.25:{var}:{START}-{END}'
   technical=f'Country-level {dataset} annual {var}, averaged across {START}-{END}.'
   r=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=technical,unit_explanation=unit,family='Climate',icon='🌡️' if var in {'tas','txx','tnn'} else '🌧️',unit=unit,value_type='other',ranking_direction=direction,include=(var,),min_coverage=175,evidence_tier='A',source_priority=5,specificity_score=99,recognizability_score=99,understandability_score=99,fun_score=99)
   meta={'source_page_url':SOURCE_PAGE,'methodology_url':METHOD,'dataset_release':dataset,'source_query':{'variable':var,'years':[START,END],'aggregation':'country annual indicator then 30-year mean'},'measurementType':'other','broadDomain':'physical-geography','knowledgeCluster':'climate','strategyFamily':f'climate-{var}','v16_2_6_content_reviewed':True,'manual_review_required':True}
   if dataset.startswith('CRU'): meta['api_url']=API.format(var=var,iso3='{ISO3}')
   else: meta.update({'collection':'era5-x0.25','collection_documentation':ERA5_DOC,'official_bulk_input_required':True,'no_unverified_json_endpoint_fallback':True})
   out.append(CandidateDefinition(r,source_code,title,SOURCE_PAGE,meta))
  return out
 def _country_series(self,iso,var):
  if self.data is not None:return self.data.get(iso,{}).get(var,{})
  if var in {'txx','tnn','fd','tr'}:
   raise RuntimeError('ERA5 extremes require a supplied official normalized input; no unverified CCKP JSON endpoint is used.')
  key=(iso,var)
  if key not in self.cache:self.cache[key]=_series(self.http.get_json(API.format(var=var,iso3=iso)))
  return self.cache[key]
 def fetch_observations(self,c):
  var=next((v for v in ('tas','pr','txx','tnn','fd','tr') if f':{v}:' in c.source_indicator_code),None);out=[]
  if var is None: raise RuntimeError(f'Unknown climate variable for {c.source_indicator_code}')
  for iso in CANONICAL_COUNTRY_NAMES:
   s=self._country_series(iso,var); vals=[s[y] for y in range(START,END+1) if y in s]
   if len(vals)!=30: continue
   out.append(SourceObservation(iso,canonical_country_name(iso,iso),END,sum(vals)/30.0,SOURCE_PAGE,f'{var}:{iso}:{START}-{END}','official',{'period_start':START,'period_end':END,'years':30}))
  if len(out) < c.rule.min_coverage:
   raise RuntimeError(f'CCKP {var} produced only {len(out)} complete {START}-{END} country climatologies; expected at least {c.rule.min_coverage}.')
  return out
 def category_id(self,c):return f'worldbankclimate:{c.rule.key}'


# Current CCKP ERA5 x0.25 documentation does not publish these tracker indicators.
# They are explicit source-family blockers, not candidates, so no CMIP6/modelled substitute
# or invented endpoint can silently satisfy the observational/reanalysis tracker row.
UNSUPPORTED_ERA5_TRACKER_CONCEPTS = {
 'most-ice-days': {'title':'Most ice days','reason':'ERA5 x0.25 collection does not list an ice-days (ID) indicator.'},
 'most-hot-days': {'title':'Most very hot days',"reason":"ERA5 x0.25 collection does not list the tracker's very-hot-days indicator."},
 'most-hot-humid-days': {'title':'Most hot and humid days',"reason":"ERA5 x0.25 collection does not list the tracker's hot-and-humid-days indicator."},
 'longest-warm-spells': {'title':'Longest warm spells','reason':'ERA5 x0.25 collection does not list warm-spell duration (WSDI) for this path.'},
}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--input',help='Optional normalized ISO3,Year,Tas,Pr CSV for reproducible/offline run');ap.add_argument('--dry-run',action='store_true');a=ap.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run())
if __name__=='__main__':main()
