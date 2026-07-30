#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,io,os,re
from pathlib import Path
from urllib.request import Request,urlopen
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name,country_name_to_iso3
from data_pipeline.models import CandidateDefinition,IndicatorRule,SourceObservation
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='USGS Minerals';SOURCE_DATASET='Mineral Commodity Summaries world production';SOURCE_PAGE='https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries'
MINERALS={'gold','silver','copper','lithium','cobalt','nickel','zinc','lead','iron ore','potash','phosphate rock','rare earths'}
def norm(v):return re.sub(r'[^a-z0-9]+',' ',str(v or '').lower()).strip()
def mineral_key(v):
 n=norm(v)
 for m in MINERALS:
  if m in n:return m.replace(' ','-')
 return None
def load(inp):
 raw=Path(inp).read_bytes() if Path(inp).exists() else urlopen(Request(inp,headers={'User-Agent':'GeoStats/15.8'}),timeout=240).read()
 rows=[]
 for r in csv.DictReader(io.StringIO(raw.decode('utf-8-sig','replace'))):
  d={norm(k):v for k,v in r.items()}; country=next((v for k,v in d.items() if k in {'country','country name'}),None); mineral=next((v for k,v in d.items() if k in {'commodity','mineral','commodity name'}),None);year=next((v for k,v in d.items() if k=='year'),None);value=next((v for k,v in d.items() if k in {'production','value','mine production'}),None);unit=next((v for k,v in d.items() if k=='unit'),'metric tonnes')
  iso3=country_name_to_iso3(str(country or ''));key=mineral_key(mineral)
  try:num=float(str(value).replace(',',''))
  except:continue
  if iso3 and key and year and not re.search(r'reserve|capacity|grade',norm(mineral)):rows.append((key,iso3,int(float(year)),num,str(unit)))
 return rows
class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='usgsminerals'
 def __init__(self,w,input_path,dry_run=False):super().__init__(w,dry_run=dry_run);self.rows=load(input_path)
 def discover(self):
  keys=sorted({r[0] for r in self.rows});out=[]
  for key in keys:
   label=key.replace('-',' ');title=f'Most {label} produced';desc=f'Total mine production of {label}.';unit=next((r[4] for r in self.rows if r[0]==key),'metric tonnes')
   rule=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=desc,unit_explanation=unit,family='Minerals',icon='⛏️',unit=unit,value_type='total',ranking_direction='high',include=(key,),min_coverage=40,evidence_tier='A',source_priority=13,specificity_score=98,recognizability_score=96,understandability_score=98,fun_score=96)
   out.append(CandidateDefinition(rule,f'USGS-MCS:{key}',title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'methodology_url':SOURCE_PAGE,'broadDomain':'resources','knowledgeCluster':'mineral-production','strategyFamily':f'mineral-production:{key}','boardDescription':desc}))
  return out
 def fetch_observations(self,c):
  by={}
  for key,i,y,v,u in self.rows:
   if key==c.rule.key and(i not in by or y>by[i][0]):by[i]=(y,v)
  return [SourceObservation(i,canonical_country_name(i,i),y,v,SOURCE_PAGE,f'{c.rule.key}:{i}:{y}','official') for i,(y,v) in by.items()]
 def category_id(self,c):return f'usgsminerals:{c.rule.key}'
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--input',required=True);ap.add_argument('--dry-run',action='store_true');a=ap.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run())
if __name__=='__main__':main()
