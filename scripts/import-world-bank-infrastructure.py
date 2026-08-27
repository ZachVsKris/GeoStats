#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, os
from collections import defaultdict
from pathlib import Path
from typing import Any

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name
from data_pipeline.countries import normalize_iso3
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_ORG='World Bank WDI Infrastructure & Connectivity'
SOURCE_DATASET='World Development Indicators'
SOURCE_PAGE='https://data.worldbank.org/'
API='https://api.worldbank.org/v2/country/all/indicator/{code}?format=json&per_page=20000&date=1990:2026'

# key, title, code, unit, value_type, min, max
SPECS=(
 ('internet-use','Highest internet-use share','IT.NET.USER.ZS','% of population','percentage',0,100),
 ('electricity-access','Highest electricity access','EG.ELC.ACCS.ZS','% of population','percentage',0,100),
 ('rural-electricity-access','Highest rural electricity access','EG.ELC.ACCS.RU.ZS','% of rural population','percentage',0,100),
 ('urban-electricity-access','Highest urban electricity access','EG.ELC.ACCS.UR.ZS','% of urban population','percentage',0,100),
 ('renewable-electricity-share','Largest renewable share of electricity generation','EG.ELC.RNEW.ZS','% of electricity output','percentage',0,100),
 ('coal-electricity-share','Largest coal share of electricity generation','EG.ELC.COAL.ZS','% of electricity output','percentage',0,100),
 ('nuclear-electricity-share','Largest nuclear share of electricity generation','EG.ELC.NUCL.ZS','% of electricity output','percentage',0,100),
 ('grid-losses','Highest electricity grid losses','EG.ELC.LOSS.ZS','% of electricity output','percentage',-100,200),
 ('air-passengers','Most air passengers carried','IS.AIR.PSGR','passengers','total',0,None),
 ('rail-network','Longest rail network','IS.RRS.TOTL.KM','route-km','total',0,None),
 ('rail-passengers','Most rail passenger travel','IS.RRS.PASG.KM','million passenger-km','total',0,None),
 ('container-port-traffic','Most container port traffic','IS.SHP.GOOD.TU','TEU','total',0,None),
)
BY_KEY={s[0]:s for s in SPECS}; BY_CODE={s[2]:s for s in SPECS}

def _json_rows(payload:Any):
 if isinstance(payload,list) and len(payload)>1 and isinstance(payload[1],list): return payload[1]
 return []

def _guard(spec,value):
 lo,hi=spec[5],spec[6]
 value=float(value)
 if lo is not None and value < lo-1e-9: raise RuntimeError(f'{spec[0]} value below range: {value}')
 if hi is not None and value > hi+1e-9: raise RuntimeError(f'{spec[0]} value above range: {value}')
 return value

def _load_offline(path:str):
 data=defaultdict(dict)
 with Path(path).open(encoding='utf-8-sig') as h:
  for row in csv.DictReader(h):
   code=str(row.get('Indicator Code') or row.get('indicator_code') or '').strip()
   if code not in BY_CODE: continue
   iso=normalize_iso3(row.get('Country Code') or row.get('ISO3') or row.get('country_code'))
   if not iso: continue
   try: year=int(float(row.get('Year') or row.get('year'))); value=_guard(BY_CODE[code],float(row.get('Value') or row.get('value')))
   except (ValueError,TypeError): continue
   key=(iso,year); prior=data[code].get(key)
   if prior is not None and abs(prior-value)>1e-9: raise RuntimeError(f'{code}: contradictory duplicate for {iso} {year}')
   data[code][key]=value
 return data

class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG; source_dataset=SOURCE_DATASET; source_slug='worldbankinfra'
 def __init__(self,warehouse,input_path=None,dry_run=False):
  super().__init__(warehouse,dry_run=dry_run); self.http=HttpClient(timeout=120,retries=4,user_agent='GeoStats/16.2.6 WDI infrastructure'); self.input_path=input_path; self.offline=_load_offline(input_path) if input_path else None; self.cache={}
 def discover(self):
  out=[]
  for key,title,code,unit,vtype,_lo,_hi in SPECS:
   desc=f'{title} using the exact World Development Indicators series {code}.'
   rule=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=f'World Bank WDI series {code}; one common country-year only.',unit_explanation=unit,family='Infrastructure',icon='🏗️',unit=unit,value_type=vtype,ranking_direction='high',include=(code,),min_coverage=90,evidence_tier='A',source_priority=5,specificity_score=99,recognizability_score=94,understandability_score=94,fun_score=88)
   out.append(CandidateDefinition(rule,code,title,f'https://data.worldbank.org/indicator/{code}',{'source_page_url':SOURCE_PAGE,'api_url':API.format(code=code),'source_query':{'indicator_code':code},'manual_review_required':True,'v16_2_6_content_reviewed':True,'denominator_basis':unit if unit.startswith('%') else None,'strict_indicator_code':code}))
  return out
 def _series(self,code):
  if self.offline is not None:return self.offline.get(code,{})
  if code not in self.cache:
   rows={}
   for row in _json_rows(self.http.get_json(API.format(code=code))):
    iso=normalize_iso3(row.get('countryiso3code'))
    if not iso or row.get('value') is None: continue
    try: year=int(row.get('date')); value=_guard(BY_CODE[code],row.get('value'))
    except (ValueError,TypeError): continue
    key=(iso,year); prior=rows.get(key)
    if prior is not None and abs(prior-value)>1e-9: raise RuntimeError(f'{code}: contradictory duplicate for {iso} {year}')
    rows[key]=value
   self.cache[code]=rows
  return self.cache[code]
 def fetch_observations(self,candidate):
  code=candidate.source_indicator_code
  return [SourceObservation(iso,canonical_country_name(iso,iso),year,value,candidate.source_url,f'WDI:{code}:{iso}:{year}','official',{'indicator_code':code}) for (iso,year),value in sorted(self._series(code).items())]
 def category_id(self,candidate):return f'worldbankinfra:{candidate.rule.key}'

def main():
 p=argparse.ArgumentParser();p.add_argument('--input');p.add_argument('--dry-run',action='store_true');p.add_argument('--only',action='append',default=[]);a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run(only_keys=set(a.only) or None))
if __name__=='__main__':main()
