#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,io,os,re,tempfile
from pathlib import Path
from urllib.request import Request,urlopen
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name,country_name_to_iso3
from data_pipeline.models import CandidateDefinition,IndicatorRule,SourceObservation
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='FAO AQUASTAT';SOURCE_DATASET='AQUASTAT Main Database';SOURCE_PAGE='https://www.fao.org/aquastat/en/databases/maindatabase/';METHODOLOGY='https://www.fao.org/aquastat/en/overview/methodology/'
SPECS={
 'renewable-water-per-person':('Renewable water per person','Renewable internal freshwater resources available per person.','m³/person','per_capita','Water resources'),
 'water-stress':('Highest water stress','Freshwater withdrawals as a share of available renewable freshwater resources.','%','percentage','Water use'),
 'total-water-withdrawal':('Most freshwater withdrawn','Total annual freshwater withdrawals.','km³/year','total','Water use'),
 'agricultural-water-share':('Highest agricultural share of water use','Agriculture’s share of total freshwater withdrawals.','%','percentage','Water use'),
 'irrigated-cropland-share':('Highest irrigated cropland share','Share of cultivated land equipped for irrigation.','%','percentage','Irrigation'),
 'dam-capacity':('Largest dam capacity','Total capacity of large dams.','km³','total','Water infrastructure'),
}
ALIASES={
 'renewable-water-per-person':['total renewable water resources per capita','renewable water resources per capita'],
 'water-stress':['sdg 6.4.2. water stress','level of water stress','freshwater withdrawal as percentage of total renewable water resources'],
 'total-water-withdrawal':['total water withdrawal','total freshwater withdrawal'],
 'agricultural-water-share':['agricultural water withdrawal as percentage of total water withdrawal'],
 'irrigated-cropland-share':['area equipped for irrigation as percentage of cultivated area','percentage of cultivated area equipped for irrigation'],
 'dam-capacity':['total dam capacity','total capacity of dams'],
}
def norm(v):return re.sub(r'[^a-z0-9]+',' ',str(v or '').lower()).strip()
def resolve(name):
 n=norm(name)
 for key,aliases in ALIASES.items():
  if any(norm(a) in n or n in norm(a) for a in aliases):return key
 return None
def load(path_or_url):
 if path_or_url and Path(path_or_url).exists():raw=Path(path_or_url).read_bytes()
 elif path_or_url:raw=urlopen(Request(path_or_url,headers={'User-Agent':'GeoStats/15.8'}),timeout=240).read()
 else:raise RuntimeError('Provide --input with an official AQUASTAT bulk CSV or URL.')
 text=raw.decode('utf-8-sig','replace');reader=csv.DictReader(io.StringIO(text));out=[]
 for row in reader:
  lower={norm(k):v for k,v in row.items()}
  country=next((v for k,v in lower.items() if k in {'area','country','country name'}),None)
  variable=next((v for k,v in lower.items() if k in {'variable name','variable','indicator','indicator name'}),None)
  year=next((v for k,v in lower.items() if k=='year'),None);value=next((v for k,v in lower.items() if k=='value'),None)
  key=resolve(variable);iso3=country_name_to_iso3(str(country or ''))
  try:num=float(str(value).replace(',',''))
  except:continue
  if key and iso3 and year:out.append((key,iso3,int(float(year)),num))
 return out
class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='aquastat'
 def __init__(self,warehouse,input_path,dry_run=False):super().__init__(warehouse,dry_run=dry_run);self.rows=load(input_path)
 def discover(self):
  out=[]
  for key,(title,desc,unit,value_type,family) in SPECS.items():
   r=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=desc,unit_explanation=unit,family=family,icon='💧',unit=unit,value_type=value_type,ranking_direction='high',include=(key,),min_coverage=80,evidence_tier='A',source_priority=14,specificity_score=96,recognizability_score=94,understandability_score=94,fun_score=90)
   out.append(CandidateDefinition(r,f'AQUASTAT:{key}',title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'methodology_url':METHODOLOGY,'broadDomain':'water','knowledgeCluster':family.lower().replace(' ','-'),'strategyFamily':key,'boardDescription':desc}))
  return out
 def fetch_observations(self,c):
  by={}
  for key,iso3,year,value in self.rows:
   if key==c.rule.key and (iso3 not in by or year>by[iso3][0]):by[iso3]=(year,value)
  return [SourceObservation(i,canonical_country_name(i,i),y,v,SOURCE_PAGE,f'{c.rule.key}:{i}:{y}','official') for i,(y,v) in by.items()]
 def category_id(self,c):return f'aquastat:{c.rule.key}'
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--input',required=True);ap.add_argument('--dry-run',action='store_true');a=ap.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run())
if __name__=='__main__':main()
