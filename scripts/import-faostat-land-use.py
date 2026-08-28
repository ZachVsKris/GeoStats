#!/usr/bin/env python3
from __future__ import annotations
import argparse,os
from collections import defaultdict
from pathlib import Path
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name,country_name_to_iso3
from data_pipeline.models import CandidateDefinition,IndicatorRule,SourceObservation
from data_pipeline.official_tabular import first_value,norm,number,read_official_rows,source_file_sha256
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='FAOSTAT Land Use';SOURCE_DATASET='FAOSTAT Land Use';SOURCE_PAGE='https://www.fao.org/faostat/en/#data/RL';METHOD='https://www.fao.org/faostat/en/#definitions'
# key,title,item aliases,EXACT source-published share element aliases,denominator label
SPECS=(
 ('agricultural-land-share','Largest agricultural-land share',('Agricultural land',),('Share in Land area','Share in land area'),'land area'),
 ('pasture-meadow-share','Largest pasture and meadow share',('Permanent meadows and pastures',),('Share in Agricultural land','Share in agricultural land'),'agricultural land'),
 ('other-land-share','Largest other-land share',('Other land',),('Share in Land area','Share in land area'),'land area'),
 ('irrigation-equipped-share','Largest irrigated-land share',('Land area equipped for irrigation','Area equipped for irrigation'),('Share in Agricultural land','Share in agricultural land'),'agricultural land'),
 ('agriculture-irrigated-share','Highest irrigated agricultural-land share',('Agricultural land actually irrigated','Area actually irrigated'),('Share in Agricultural land','Share in agricultural land'),'agricultural land'),
 ('organic-agriculture-share','Highest organic-agriculture share',('Agricultural area under organic agriculture','Area under organic agriculture'),('Share in Agricultural land','Share in agricultural land'),'agricultural land'),
 ('organic-cropland-share','Highest organic-cropland share',('Cropland area under organic agriculture','Cropland under organic agriculture'),('Share in Cropland','Share in cropland'),'cropland'),
 ('natural-forest-share','Highest naturally regenerating forest share',('Naturally regenerating forest',),('Share in Forest land','Share in forest land'),'forest land'),
 ('planted-forest-share','Highest planted-forest share',('Planted forest',),('Share in Forest land','Share in forest land'),'forest land'),
 ('primary-forest-share','Highest primary-forest share',('Primary forest',),('Share in Forest land','Share in forest land'),'forest land'),
)
def exact(v,aliases):return any(norm(v)==norm(a) for a in aliases)
class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='faostatlanduse'
 def __init__(self,warehouse,input_path=None,dry_run=False):super().__init__(warehouse,dry_run=dry_run);self.input_path=input_path;self._data=None
 def _parse(self):
  if self._data is not None:return self._data
  if not self.input_path:raise RuntimeError('FAOSTAT Land Use requires the exact official bulk input via --input.')
  out=defaultdict(dict);sha=source_file_sha256(self.input_path)
  for row in read_official_rows(self.input_path):
   country=str(first_value(row,'Area','Country') or '');iso=country_name_to_iso3(country)
   if not iso:continue
   try:year=int(float(first_value(row,'Year')))
   except (TypeError,ValueError):continue
   item=first_value(row,'Item');element=first_value(row,'Element');value=number(first_value(row,'Value'))
   if value is None:continue
   for key,title,items,elements,denom in SPECS:
    if not exact(item,items) or not exact(element,elements):continue
    if value < -1e-9 or value > 100+1e-9:raise RuntimeError(f'{key}: percentage outside 0-100 for {iso} {year}: {value}')
    k=(iso,year);prior=out[key].get(k)
    if prior and abs(prior[1]-value)>1e-9:raise RuntimeError(f'{key}: contradictory duplicate for {iso} {year}')
    out[key][k]=(canonical_country_name(iso,country),float(value),str(element),sha)
  self._data=out;return out
 def discover(self):
  out=[]
  for key,title,items,elements,denom in SPECS:
   desc=f'{title} using FAOSTAT’s published percentage with denominator {denom}; GeoStats does not recompute this from unrelated totals.'
   rule=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=f'Exact FAOSTAT item {items[0]!r} and exact published element {elements[0]!r}.',unit_explanation=f'% of {denom}',family='Land use',icon='🌍',unit='% of stated land denominator',value_type='percentage',ranking_direction='high',include=(items[0],elements[0]),min_coverage=80,evidence_tier='A',source_priority=6,specificity_score=99,recognizability_score=92,understandability_score=92,fun_score=86)
   out.append(CandidateDefinition(rule,f'FAOSTAT-RL:{key}',title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'methodology_url':METHOD,'source_query':{'item_aliases':items,'required_element_aliases':elements},'denominator_basis':denom,'source_published_share_required':True,'manual_review_required':True,'official_bulk_input_required':True,'v16_2_6_content_reviewed':True}))
  return out
 def fetch_observations(self,c):
  return [SourceObservation(iso,name,year,val,SOURCE_PAGE,f'FAOSTAT-RL:{c.rule.key}:{iso}:{year}','official',{'source_element':element,'source_file_sha256':sha,'denominator_locked':True}) for (iso,year),(name,val,element,sha) in sorted(self._parse().get(c.rule.key,{}).items())]
 def category_id(self,c):return f'faostat-land-use:{c.rule.key}'
def main():
 p=argparse.ArgumentParser();p.add_argument('--input');p.add_argument('--dry-run',action='store_true');p.add_argument('--only',action='append',default=[]);a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run(only_keys=set(a.only) or None))
if __name__=='__main__':main()
