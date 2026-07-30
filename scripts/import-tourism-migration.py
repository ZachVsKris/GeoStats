#!/usr/bin/env python3
from __future__ import annotations
import argparse, os
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name
from data_pipeline.countries import normalize_iso3
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_PAGE="https://data.worldbank.org/indicator"
METHODOLOGY="https://databank.worldbank.org/metadataglossary/world-development-indicators"
START_YEAR=2015
END_YEAR=datetime.now(timezone.utc).year

SPECS=[
 ("tourist-arrivals","Most international tourist arrivals","International tourist arrivals","ST.INT.ARVL","arrivals","total","✈️","tourism-arrivals"),
 ("tourist-arrivals-per-resident","Most tourist arrivals per resident","International tourist arrivals divided by population","ST.INT.ARVL/SP.POP.TOTL","arrivals per resident","rate","🧳","tourism-arrivals"),
 ("tourism-receipts","Most international tourism revenue","International tourism receipts","ST.INT.RCPT.CD","current US dollars","total","💵","tourism-revenue"),
 ("tourism-receipts-share","Highest tourism revenue share of exports","International tourism receipts as a share of total exports","ST.INT.RCPT.XP.ZS","% of exports","percentage","🌍","tourism-revenue"),
 ("migrant-population","Largest international migrant population","International migrant stock, total","SM.POP.TOTL","people","total","🧭","migration-stock"),
 ("migrant-share","Highest international migrant share","International migrant stock as a percentage of population","SM.POP.TOTL.ZS","% of population","percentage","🧭","migration-stock"),
]

def make_rule(key,title,official,code,unit,value_type,icon,strategy):
 description={
  'tourist-arrivals':'Number of international tourist arrivals in the latest broadly covered year.',
  'tourist-arrivals-per-resident':'International tourist arrivals divided by the country’s population.',
  'tourism-receipts':'International tourism receipts in current US dollars.',
  'tourism-receipts-share':'International tourism receipts as a percentage of total exports.',
  'migrant-population':'Number of international migrants living in the country.',
  'migrant-share':'International migrants as a percentage of the country’s population.',
 }[key]
 return IndicatorRule(key=key,title=title,description=description,plain_language_description=description,
  technical_definition=official,unit_explanation=unit,family='Tourism' if key.startswith('tour') else 'Migration',icon=icon,unit=unit,
  value_type=value_type,ranking_direction='high',include=(key,),min_coverage=100,evidence_tier='B',source_priority=18,
  specificity_score=96,recognizability_score=98,understandability_score=97,fun_score=96,objective_status='objective')
RULES={row[0]:make_rule(*row) for row in SPECS}

class TourismMigrationImporter(WarehouseImporter):
 source_organization='World Bank'
 source_dataset='World Development Indicators: tourism and international migration'
 source_slug='worldbankexpansion'
 def __init__(self,warehouse,*,dry_run=False,payloads:dict[str,list[dict[str,Any]]]|None=None):
  super().__init__(warehouse,dry_run=dry_run);self.http=HttpClient(timeout=180,retries=5,user_agent='GeoStats/15.9 tourism migration importer');self.payloads=payloads or {};self._series={}
 def _load(self,code):
  if code in self._series:return self._series[code]
  rows=self.payloads.get(code)
  if rows is None:
   url=f"https://api.worldbank.org/v2/country/all/indicator/{quote(code,safe='')}?format=json&per_page=20000&date={START_YEAR}:{END_YEAR}"
   payload=self.http.get_json(url);rows=payload[1] if isinstance(payload,list) and len(payload)>1 and isinstance(payload[1],list) else []
  out={}
  for row in rows:
   iso3=normalize_iso3(str(row.get('countryiso3code') or row.get('country_code') or ''))
   value=row.get('value');year=row.get('date') or row.get('year')
   if not iso3 or value is None:continue
   try:y=int(year);v=float(value)
   except (TypeError,ValueError):continue
   country=row.get('country');name=country.get('value') if isinstance(country,dict) else row.get('country_name') or iso3
   out[(iso3,y)]={'value':v,'country':canonical_country_name(iso3,str(name))}
  self._series[code]=out;return out
 def _values(self,key):
  if key=='tourist-arrivals-per-resident':
   arrivals=self._load('ST.INT.ARVL');pop=self._load('SP.POP.TOTL');out={}
   for pair,a in arrivals.items():
    p=pop.get(pair)
    if p and p['value']>0:out[pair]={'value':a['value']/p['value'],'country':a['country']}
   return out
  code=next(row[3] for row in SPECS if row[0]==key)
  return self._load(code)
 def discover(self):
  out=[]
  for key,title,official,code,unit,value_type,icon,strategy in SPECS:
   if not self._values(key):continue
   primary=code.split('/')[0]
   out.append(CandidateDefinition(RULES[key],code,official,f"{SOURCE_PAGE}/{primary}",{
    'source_page_url':f"{SOURCE_PAGE}/{primary}",'api_url':f"https://api.worldbank.org/v2/country/all/indicator/{primary}",
    'minimum_year':START_YEAR,'methodology_url':f"{METHODOLOGY}/series/{primary}",
    'source_query':{'indicator':code,'date':f'{START_YEAR}:{END_YEAR}','derived':key=='tourist-arrivals-per-resident'},
    'broadDomain':'culture' if key.startswith('tour') else 'demographics',
    'knowledgeCluster':'tourism' if key.startswith('tour') else 'migration-stock','strategyFamily':strategy,
    'manual_review_required':True,'expansion_intake_version':'v15.9'
   }))
  return out
 def category_id(self,candidate):return f"worldbank-expansion:{candidate.rule.key}"
 def fetch_observations(self,candidate):
  return [SourceObservation(iso3,payload['country'],year,payload['value'],candidate.source_url,
    f"{candidate.source_indicator_code}:{iso3}:{year}",'official',{'indicator':candidate.source_indicator_code})
    for (iso3,year),payload in sorted(self._values(candidate.rule.key).items())]

def main():
 p=argparse.ArgumentParser();p.add_argument('--dry-run',action='store_true');p.add_argument('--only',action='append',default=[]);a=p.parse_args()
 url=os.environ.get('SUPABASE_URL');key=os.environ.get('SUPABASE_SECRET_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and (not url or not key):raise SystemExit('Set SUPABASE_URL and SUPABASE service-role secret.')
 warehouse=None if a.dry_run else SupabaseWarehouse(url or '',key or '')
 print(TourismMigrationImporter(warehouse,dry_run=a.dry_run).run(only_keys=set(a.only) or None));return 0
if __name__=='__main__':raise SystemExit(main())
