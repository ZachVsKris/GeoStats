#!/usr/bin/env python3
"""UNESCO Intangible Cultural Heritage country-count importer (v16.2.6)."""
from __future__ import annotations
import argparse,csv,io,json,os,re
from collections import defaultdict
from pathlib import Path
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name,country_alpha2_to_iso3,country_name_to_iso3
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition,IndicatorRule,SourceObservation
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='UNESCO'; SOURCE_DATASET='Intangible Cultural Heritage DataHub'; SOURCE_PAGE='https://data.unesco.org/explore/dataset/ich001/'; API='https://data.unesco.org/api/explore/v2.1/catalog/datasets/ich001/records?limit=100&offset={offset}'; METHOD='https://ich.unesco.org/en/lists'

def _country_codes(value):
 out=[]
 if isinstance(value,list):
  for x in value:
   if isinstance(x,dict): out += _country_codes(x.get('code_iso') or x.get('iso2') or x.get('code') or x.get('name_en') or x.get('name'))
   else: out += _country_codes(x)
 elif isinstance(value,dict): out += _country_codes(value.get('code_iso') or value.get('iso2') or value.get('code') or value.get('name_en') or value.get('name'))
 elif value:
  text=str(value).strip();
  for part in re.split(r'[;,|]+',text):
   part=part.strip(); iso=country_alpha2_to_iso3(part) if len(part)==2 else (part.upper() if len(part)==3 else country_name_to_iso3(part))
   if iso: out.append(iso)
 return out

def load_input(path):
 raw=Path(path).read_bytes();
 if path.lower().endswith('.json'):
  p=json.loads(raw.decode('utf-8-sig')); return p.get('results',p) if isinstance(p,dict) else p
 text=raw.decode('utf-8-sig','replace'); return list(csv.DictReader(io.StringIO(text)))

def counts_from_records(records):
 by=defaultdict(set)
 for i,row in enumerate(records):
  if not isinstance(row,dict): continue
  fields=row.get('record',{}).get('fields',{}) if isinstance(row.get('record'),dict) else row
  rid=str(fields.get('id') or fields.get('id_') or fields.get('element_id') or fields.get('name_en') or i)
  countries=fields.get('countries') or fields.get('country') or fields.get('states') or fields.get('countries_en')
  for iso in set(_country_codes(countries)): by[iso].add(rid)
 return {iso:len(ids) for iso,ids in by.items()}

class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='unescoich'
 def __init__(self,warehouse,input_path=None,dry_run=False):
  super().__init__(warehouse,dry_run=dry_run)
  if input_path: records=load_input(input_path)
  else:
   http=HttpClient(timeout=120,retries=5,user_agent='GeoStats/16.2.6 UNESCO ICH');records=[];offset=0
   while True:
    p=http.get_json(API.format(offset=offset)); batch=p.get('results',[]) if isinstance(p,dict) else []
    records+=batch
    if not batch or len(batch)<100: break
    offset += len(batch)
    if offset>10000: raise RuntimeError('UNESCO ICH pagination exceeded safety ceiling.')
  self.counts=counts_from_records(records)
 def discover(self):
  desc='Number of elements associated with the country on UNESCO’s current Intangible Cultural Heritage lists. Multinational elements count for every participating country.'
  r=IndicatorRule(key='most-ich-elements',title='Most UNESCO Intangible Cultural Heritage elements',description=desc,plain_language_description=desc,technical_definition=desc,unit_explanation='Current UNESCO-listed elements associated with the country',family='Culture',icon='🎭',unit='elements',value_type='total',ranking_direction='high',include=('ich001',),min_coverage=80,evidence_tier='A',source_priority=6,specificity_score=98,recognizability_score=94,understandability_score=96,fun_score=97)
  return [CandidateDefinition(r,'ICH001:current-elements','UNESCO ICH current listed elements',SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'api_url':API.format(offset=0),'methodology_url':METHOD,'dataset_release':'current UNESCO ICH DataHub snapshot','source_query':{'dataset':'ich001','count':'unique element id by participating country'},'measurementType':'total','broadDomain':'culture','knowledgeCluster':'heritage','strategyFamily':'cultural-heritage','v16_2_6_content_reviewed':True,'license_name':'UNESCO Open Access'} )]
 def fetch_observations(self,c): return [SourceObservation(iso,canonical_country_name(iso,iso),2026,float(n),SOURCE_PAGE,f'ich:{iso}:2026','official') for iso,n in self.counts.items()]
 def category_id(self,c): return 'unescoich:most-elements'
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--input');ap.add_argument('--dry-run',action='store_true');a=ap.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run())
if __name__=='__main__':main()
