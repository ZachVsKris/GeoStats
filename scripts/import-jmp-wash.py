#!/usr/bin/env python3
from __future__ import annotations
import argparse,os
from collections import defaultdict
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import CANONICAL_COUNTRY_NAMES,canonical_country_name,country_name_to_iso3
from data_pipeline.countries import normalize_iso3
from data_pipeline.models import CandidateDefinition,IndicatorRule,SourceObservation
from data_pipeline.official_tabular import first_value,norm,number,read_official_rows,source_file_sha256
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='WHO/UNICEF Joint Monitoring Programme';SOURCE_DATASET='JMP household WASH estimates';SOURCE_PAGE='https://washdata.org/data/household#!/';METHOD='https://washdata.org/how-we-work/about-jmp'
# key,title,service type,EXACT accepted service-level labels
SPECS=(
 ('water-safely-managed','Highest safely managed drinking-water coverage','drinking water',('Safely managed',)),
 ('water-basic','Highest basic drinking-water coverage','drinking water',('At least basic',)),
 ('water-limited','Highest limited drinking-water-service share','drinking water',('Limited service','Limited',)),
 ('water-unimproved','Highest unimproved drinking-water-service share','drinking water',('Unimproved',)),
 ('water-surface','Highest surface-water reliance','drinking water',('Surface water',)),
 ('sanitation-safely-managed','Highest safely managed sanitation coverage','sanitation',('Safely managed',)),
 ('sanitation-basic','Highest basic sanitation coverage','sanitation',('At least basic',)),
 ('sanitation-limited','Highest limited sanitation-service share','sanitation',('Limited service','Limited',)),
 ('sanitation-unimproved','Highest unimproved sanitation-service share','sanitation',('Unimproved',)),
 ('open-defecation','Highest open-defecation rate','sanitation',('Open defecation',)),
 ('hygiene-basic','Highest basic hygiene-service coverage','hygiene',('Basic service','Basic',)),
 ('hygiene-limited','Highest limited hygiene-service share','hygiene',('Limited service','Limited',)),
 ('hygiene-none','Highest share without a handwashing facility','hygiene',('No facility',)),
)
BY_KEY={x[0]:x for x in SPECS}
def exact(v,aliases):return any(norm(v)==norm(a) for a in aliases)
def _iso(row):
 code=normalize_iso3(first_value(row,'ISO3','Country Code','ISO3 code','SpatialDim'))
 if code:return code
 return country_name_to_iso3(str(first_value(row,'Country','Country or Area','Location') or ''))
class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='jmpwash'
 def __init__(self,warehouse,input_path=None,dry_run=False):super().__init__(warehouse,dry_run=dry_run);self.input_path=input_path;self._parsed=None
 def _parse(self):
  if self._parsed is not None:return self._parsed
  if not self.input_path:raise RuntimeError('JMP importer requires the exact official household WASH export via --input.')
  store=defaultdict(dict);sha=source_file_sha256(self.input_path)
  for row in read_official_rows(self.input_path):
   iso=_iso(row)
   if not iso or iso not in CANONICAL_COUNTRY_NAMES:continue
   residence=first_value(row,'Residence','Residence type','Dim1')
   if residence not in (None,'') and norm(residence) not in {'total','national','all','all residences'}:continue
   try:year=int(float(first_value(row,'Year','Time period','TIME_PERIOD')))
   except (TypeError,ValueError):continue
   service=str(first_value(row,'Service type','Service','Indicator type','WASH service') or '')
   level=str(first_value(row,'Service level','Service ladder','Level','Indicator') or '')
   value=number(first_value(row,'Value','Coverage','OBS_VALUE','Percent'))
   if value is None:continue
   if value < -1e-9 or value > 100+1e-9:raise RuntimeError(f'JMP percentage outside 0-100 for {iso} {year}: {value}')
   for key,title,stype,levels in SPECS:
    if norm(service)!=norm(stype) or not exact(level,levels):continue
    k=(iso,year);prior=store[key].get(k)
    if prior and abs(prior[1]-value)>1e-9:raise RuntimeError(f'{key}: contradictory duplicate for {iso} {year}')
    store[key][k]=(canonical_country_name(iso,iso),float(value),sha)
  # Ladder identity guards when the full published ladder is present.
  ladders=(('water-basic','water-limited','water-unimproved','water-surface'),('sanitation-basic','sanitation-limited','sanitation-unimproved','open-defecation'),('hygiene-basic','hygiene-limited','hygiene-none'))
  all_keys={(iso,year) for key in store for (iso,year) in store[key]}
  for iso,year in all_keys:
   for ladder in ladders:
    vals=[store[k].get((iso,year)) for k in ladder]
    if all(v is not None for v in vals):
     total=sum(v[1] for v in vals if v)
     if abs(total-100.0)>1.5:raise RuntimeError(f'JMP ladder identity failed for {iso} {year} {ladder}: {total}')
  self._parsed=store;return store
 def discover(self):
  out=[]
  for key,title,stype,levels in SPECS:
   desc=f'{title} from the WHO/UNICEF JMP national household service ladder; urban/rural rows and aggregates are excluded.'
   rule=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=f'National/total residence only; service={stype!r}; exact service-level aliases={levels}.',unit_explanation='% of population',family='Water & sanitation',icon='🚰',unit='% of population',value_type='percentage',ranking_direction='high',include=(stype,*levels),min_coverage=80,evidence_tier='A',source_priority=6,specificity_score=99,recognizability_score=94,understandability_score=94,fun_score=88)
   out.append(CandidateDefinition(rule,f'JMP:{key}',title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'methodology_url':METHOD,'source_query':{'service_type':stype,'service_levels':levels,'residence':'national/total'},'manual_review_required':True,'official_bulk_input_required':True,'canonical_country_universe_only':True,'ladder_identity_checked':True,'v16_2_6_content_reviewed':True}))
  return out
 def fetch_observations(self,c):return [SourceObservation(iso,name,year,val,SOURCE_PAGE,f'JMP:{c.rule.key}:{iso}:{year}','official',{'source_file_sha256':sha,'residence':'national'}) for (iso,year),(name,val,sha) in sorted(self._parse().get(c.rule.key,{}).items())]
 def category_id(self,c):return f'jmp-wash:{c.rule.key}'
def main():
 p=argparse.ArgumentParser();p.add_argument('--input');p.add_argument('--dry-run',action='store_true');p.add_argument('--only',action='append',default=[]);a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run(only_keys=set(a.only) or None))
if __name__=='__main__':main()
