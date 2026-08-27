#!/usr/bin/env python3
from __future__ import annotations
import argparse,os
from collections import defaultdict
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name,country_name_to_iso3
from data_pipeline.models import CandidateDefinition,IndicatorRule,SourceObservation
from data_pipeline.official_tabular import first_value,norm,number,read_official_rows,source_file_sha256
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='FAOSTAT / ESA WorldCover 2021';SOURCE_DATASET='FAOSTAT land-cover statistics derived from ESA WorldCover 2021';SOURCE_PAGE='https://www.fao.org/faostat/en/#data/LC';ESA_PAGE='https://esa-worldcover.org/en/data-access'
CLASS_ALIASES={
 'tree-cover-share':('Tree cover','Tree-covered area','Tree-covered areas'),
 'shrub-share':('Shrubland','Shrub-covered area','Shrub-covered areas'),
 'cropland-cover-share':('Cropland',),
 'built-up-share':('Built-up','Built-up area','Artificial surfaces'),
 'bare-land-share':('Bare / sparse vegetation','Bare or sparse vegetation','Bare land'),
 'snow-ice-share':('Snow and ice','Permanent snow and ice'),
 'permanent-water-share':('Permanent water bodies','Permanent water'),
 'herbaceous-wetland-share':('Herbaceous wetland','Herbaceous wetlands'),
 'mangrove-share':('Mangroves','Mangrove'),
 'grassland-denominator-only':('Grassland','Grassland including moss and lichen','Grassland, moss and lichen'),
}
TITLES={
 'tree-cover-share':'Largest tree-covered share','shrub-share':'Largest shrub-covered share','cropland-cover-share':'Largest cropland land-cover share','built-up-share':'Largest built-up land share','bare-land-share':'Largest bare-land share','snow-ice-share':'Largest snow-and-ice land-cover share','permanent-water-share':'Largest permanent-water share','herbaceous-wetland-share':'Largest herbaceous-wetland share','mangrove-share':'Largest mangrove land-cover share',
}
BLOCKED_TRACKER_CONCEPTS={'moss-lichen-share':{'title':'Largest moss-and-lichen share','reason':'FAOSTAT does not publish a standalone national moss/lichen WorldCover class on this path; it is folded into the source grassland grouping.'}}
def exact(v,aliases):return any(norm(v)==norm(a) for a in aliases)
class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='faostatworldcover'
 def __init__(self,warehouse,input_path=None,dry_run=False):super().__init__(warehouse,dry_run=dry_run);self.input_path=input_path;self._parsed=None
 def _parse(self):
  if self._parsed is not None:return self._parsed
  if not self.input_path:raise RuntimeError('WorldCover recovery requires the exact official FAOSTAT bulk input via --input.')
  groups=defaultdict(dict);sha=source_file_sha256(self.input_path)
  for row in read_official_rows(self.input_path):
   country=str(first_value(row,'Area','Country') or '');iso=country_name_to_iso3(country)
   if not iso:continue
   try:year=int(float(first_value(row,'Year')))
   except (TypeError,ValueError):continue
   item=first_value(row,'Item','Land cover class');element=first_value(row,'Element');value=number(first_value(row,'Value'))
   if value is None or value < 0:continue
   # Do not accept source-published shares here: denominator must be reconstructed only from the same mapped WorldCover class areas.
   if element not in (None,'') and norm(element) not in {'area','area 1000 ha','area ha'}:continue
   matched=next((key for key,aliases in CLASS_ALIASES.items() if exact(item,aliases)),None)
   if not matched:continue
   k=(iso,year);prior=groups[k].get(matched)
   if prior is not None and abs(prior-value)>1e-9:raise RuntimeError(f'WorldCover contradictory duplicate {iso} {year} {matched}')
   groups[k][matched]=float(value);groups[k]['__name__']=canonical_country_name(iso,country);groups[k]['__sha__']=sha
  out=defaultdict(dict);required=set(CLASS_ALIASES)
  for (iso,year),vals in groups.items():
   if not required.issubset(vals):continue
   denominator=sum(float(vals[k]) for k in required)
   if denominator<=0:continue
   for key in TITLES:
    out[key][(iso,year)]=(vals['__name__'],100.0*float(vals[key])/denominator,denominator,vals['__sha__'])
  self._parsed=out;return out
 def discover(self):
  out=[]
  for key,title in TITLES.items():
   desc=f'{title} using the FAOSTAT/ESA WorldCover class area divided only by the same source’s complete mapped WorldCover class-area denominator.'
   rule=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=f'100 × source class area / sum of complete FAOSTAT WorldCover class areas; class aliases {CLASS_ALIASES[key]}.',unit_explanation='% of mapped land',family='Land cover',icon='🛰️',unit='% of mapped land',value_type='percentage',ranking_direction='high',include=CLASS_ALIASES[key],min_coverage=100,evidence_tier='A',source_priority=7,specificity_score=99,recognizability_score=93,understandability_score=93,fun_score=91)
   out.append(CandidateDefinition(rule,f'FAOSTAT-WORLDCOVER:{key}',title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'underlying_source_url':ESA_PAGE,'source_query':{'class_aliases':CLASS_ALIASES[key]},'denominator_basis':'sum of complete source-native mapped WorldCover class areas','external_land_area_denominator_forbidden':True,'manual_review_required':True,'official_bulk_input_required':True,'v16_2_6_content_reviewed':True}))
  return out
 def fetch_observations(self,c):
  return [SourceObservation(iso,name,year,val,SOURCE_PAGE,f'FAOSTAT-WORLDCOVER:{c.rule.key}:{iso}:{year}','official',{'source_mapped_area_denominator':denom,'source_file_sha256':sha}) for (iso,year),(name,val,denom,sha) in sorted(self._parse().get(c.rule.key,{}).items())]
 def category_id(self,c):return f'faostat-worldcover:{c.rule.key}'
def main():
 p=argparse.ArgumentParser();p.add_argument('--input');p.add_argument('--dry-run',action='store_true');p.add_argument('--only',action='append',default=[]);a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run(only_keys=set(a.only) or None))
if __name__=='__main__':main()
