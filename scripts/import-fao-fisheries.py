#!/usr/bin/env python3
from __future__ import annotations
import argparse,hashlib,csv,io,os,re
from pathlib import Path
from urllib.request import Request,urlopen
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name,country_name_to_iso3
from data_pipeline.models import CandidateDefinition,IndicatorRule,SourceObservation
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='FAO Fisheries';SOURCE_DATASET='FAO FishStat capture and aquaculture production';SOURCE_PAGE='https://www.fao.org/statistics/data-collection/fishery-and-aquaculture/en'
SPECS={'capture-tonnes':('Most wild fish caught','Total capture fisheries production.','🎣'),'aquaculture-tonnes':('Most aquaculture production','Total farmed aquatic-animal production.','🐟'),'combined-tonnes':('Most fish and aquaculture produced','Combined capture and aquaculture production.','🐠')}
def norm(v):return re.sub(r'[^a-z0-9]+',' ',str(v or '').lower()).strip()
def load(inp):
 raw=Path(inp).read_bytes() if Path(inp).exists() else urlopen(Request(inp,headers={'User-Agent':'GeoStats/15.8'}),timeout=240).read();rows=[]
 for r in csv.DictReader(io.StringIO(raw.decode('utf-8-sig','replace'))):
  d={norm(k):v for k,v in r.items()};country=d.get('country name') or d.get('country') or d.get('country iso3');iso3=str(d.get('country iso3') or '').upper() or country_name_to_iso3(str(country or ''));year=d.get('year')
  try:capture=float(str(d.get('capture tonnes') or d.get('capture') or 0).replace(',',''));aqua=float(str(d.get('aquaculture tonnes') or d.get('aquaculture') or 0).replace(',',''));y=int(float(str(year)))
  except:continue
  if iso3:rows.append((iso3,y,capture,aqua))
 return rows
def input_sha256(value):
 p=Path(value)
 return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else ''

class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='faofisheries'
 def __init__(self,w,input_path,dry_run=False):super().__init__(w,dry_run=dry_run);self.rows=load(input_path);self.source_sha256=input_sha256(input_path)
 def discover(self):
  out=[]
  for key,(title,desc,icon) in SPECS.items():
   rule=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=desc,unit_explanation='metric tonnes',family='Fisheries',icon=icon,unit='metric tonnes',value_type='total',ranking_direction='high',include=(key,),min_coverage=80,evidence_tier='A',source_priority=13,specificity_score=98,recognizability_score=96,understandability_score=98,fun_score=94)
   out.append(CandidateDefinition(rule,f'FISHSTAT:{key}',title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'methodology_url':SOURCE_PAGE,'broadDomain':'agriculture','knowledgeCluster':'fisheries-production','strategyFamily':key,'boardDescription':desc,'source_file_sha256':self.source_sha256}))
  return out
 def fetch_observations(self,c):
  out=[]
  for i,y,cap,aqua in self.rows:
   value=cap if c.rule.key=='capture-tonnes' else aqua if c.rule.key=='aquaculture-tonnes' else cap+aqua
   out.append(SourceObservation(i,canonical_country_name(i,i),y,value,SOURCE_PAGE,f'{c.rule.key}:{i}:{y}','official'))
  return out
 def category_id(self,c):return f'faofisheries:{c.rule.key}'
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--input',required=True);ap.add_argument('--dry-run',action='store_true');a=ap.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run())
if __name__=='__main__':main()
