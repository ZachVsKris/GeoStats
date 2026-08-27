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
SOURCE_ORG='UNICEF';SOURCE_DATASET='UNICEF Data Warehouse';SOURCE_PAGE='https://data.unicef.org/resources/resource-type/datasets/'
SPECS=(
 ('child-marriage-before18','Highest child-marriage rate',('Women aged 20 to 24 years who were first married or in union before age 18 (%)','Child marriage before age 18'),' % of women age 20–24'.strip(),80),
 ('child-labour','Highest child-labor rate',('Children aged 5 to 17 years engaged in child labour (%)','Child labour (%)'),'% of children age 5–17',80),
 ('violent-discipline','Highest violent-discipline rate among children',('Children aged 1 to 14 years who experienced any physical punishment and/or psychological aggression by caregivers in the past month (%)','Violent discipline (%)'),'% of children age 1–14',70),
 ('fgm-women','Highest female genital mutilation prevalence',('Women and girls aged 15 to 49 years who have undergone FGM (%)','Female genital mutilation prevalence among women aged 15-49 (%)'),'% of women age 15–49',25),
 ('stunting-u5','Highest child stunting rate',('Children under 5 who are stunted (%)','Stunting prevalence among children under 5 (%)'),'% of children under 5',100),
 ('wasting-u5','Highest child wasting rate',('Children under 5 who are wasted (%)','Wasting prevalence among children under 5 (%)'),'% of children under 5',100),
 ('overweight-u5','Highest child overweight rate',('Children under 5 who are overweight (%)','Overweight prevalence among children under 5 (%)'),'% of children under 5',100),
 ('underweight-u5','Highest child underweight rate',('Children under 5 who are underweight (%)','Underweight prevalence among children under 5 (%)'),'% of children under 5',90),
 ('exclusive-breastfeeding','Highest exclusive-breastfeeding rate',('Infants under 6 months exclusively breastfed (%)','Exclusive breastfeeding among infants under 6 months (%)'),'% of infants under 6 months',90),
 ('early-breastfeeding','Highest early-initiation-of-breastfeeding rate',('Newborns put to the breast within one hour of birth (%)','Early initiation of breastfeeding (%)'),'% of newborns',80),
 ('low-birthweight','Highest low-birthweight rate',('Newborns weighing less than 2500 g at birth (%)','Low birthweight prevalence (%)'),'% of newborns',100),
 ('minimum-diet-diversity','Highest minimum dietary-diversity rate among young children',('Children aged 6 to 23 months receiving minimum dietary diversity (%)','Minimum dietary diversity, children 6-23 months (%)'),'% of children age 6–23 months',70),
 ('minimum-acceptable-diet','Highest minimum acceptable-diet rate among young children',('Children aged 6 to 23 months receiving a minimum acceptable diet (%)','Minimum acceptable diet, children 6-23 months (%)'),'% of children age 6–23 months',65),
 ('vitamin-a','Highest vitamin A supplementation coverage',('Children aged 6 to 59 months receiving two doses of vitamin A supplements (%)','Vitamin A supplementation coverage (%)'),'% of children age 6–59 months',80),
 ('ors-diarrhea','Highest oral-rehydration-treatment rate for childhood diarrhea',('Children under 5 with diarrhoea receiving oral rehydration salts (ORS) (%)','Oral rehydration salts treatment for diarrhoea (%)'),'% of children under 5 with diarrhea',70),
 ('care-pneumonia','Highest care-seeking rate for childhood pneumonia symptoms',('Children under 5 with symptoms of acute respiratory infection taken to an appropriate health provider (%)','Care seeking for suspected pneumonia (%)'),'% of children under 5 with symptoms',70),
)
BY_KEY={x[0]:x for x in SPECS}
def _iso(row):
 code=normalize_iso3(first_value(row,'ISO3','ISO Code','Country Code','REF_AREA'))
 return code or country_name_to_iso3(str(first_value(row,'Country','Geographic area','Location','REF_AREA_LABEL') or ''))
def _total_dimension(row,fields,accepted):
 raw=first_value(row,*fields)
 return raw in (None,'') or norm(raw) in {norm(x) for x in accepted}
class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='unicefdata'
 def __init__(self,warehouse,input_path=None,dry_run=False):super().__init__(warehouse,dry_run=dry_run);self.input_path=input_path;self._parsed=None
 def _parse(self):
  if self._parsed is not None:return self._parsed
  if not self.input_path:raise RuntimeError('UNICEF importer requires an exact official Data Warehouse export via --input.')
  out=defaultdict(dict);sha=source_file_sha256(self.input_path)
  for row in read_official_rows(self.input_path):
   iso=_iso(row)
   if not iso or iso not in CANONICAL_COUNTRY_NAMES:continue
   if not _total_dimension(row,('Sex','SEX','Sex label'),('Total','Both sexes','All')):continue
   if not _total_dimension(row,('Residence','Residence type'),('Total','National','All')):continue
   if not _total_dimension(row,('Wealth quintile','Wealth','Economic status'),('Total','All')):continue
   ind=str(first_value(row,'Indicator','Indicator name','INDICATOR_LABEL','Series Name') or '')
   try:year=int(float(first_value(row,'Year','TIME_PERIOD','Time period')))
   except (TypeError,ValueError):continue
   val=number(first_value(row,'Value','OBS_VALUE','Observation Value','Estimate'))
   if val is None:continue
   if val < -1e-9 or val > 100+1e-9:raise RuntimeError(f'UNICEF percentage outside 0-100 for {iso} {year}: {val}')
   for key,title,aliases,unit,cov in SPECS:
    if not any(norm(ind)==norm(a) for a in aliases):continue
    k=(iso,year);prior=out[key].get(k)
    if prior and abs(prior[1]-val)>1e-9:raise RuntimeError(f'{key}: contradictory total-dimension duplicate for {iso} {year}')
    out[key][k]=(canonical_country_name(iso,iso),float(val),sha,ind)
  self._parsed=out;return out
 def discover(self):
  out=[]
  for key,title,aliases,unit,cov in SPECS:
   desc=f'{title} using the UNICEF Data Warehouse internationally harmonized national estimate.'
   rule=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=f'Exact UNICEF indicator label match: {aliases}; total/both-sex, national/total and total-wealth dimensions only.',unit_explanation=unit,family='Children & families',icon='🧒',unit=unit,value_type='percentage',ranking_direction='high',include=aliases,min_coverage=cov,evidence_tier='A',source_priority=7,specificity_score=99,recognizability_score=91,understandability_score=93,fun_score=87)
   out.append(CandidateDefinition(rule,f'UNICEF:{key}',title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'source_query':{'accepted_exact_indicator_labels':aliases,'sex':'total/both','residence':'national/total','wealth':'total'},'official_bulk_input_required':True,'manual_review_required':True,'canonical_country_universe_only':True,'subgroup_rows_excluded':True,'v16_2_6_content_reviewed':True}))
  return out
 def fetch_observations(self,c):return [SourceObservation(iso,name,year,val,SOURCE_PAGE,f'UNICEF:{c.rule.key}:{iso}:{year}','official',{'source_file_sha256':sha,'indicator':ind,'national_total_only':True}) for (iso,year),(name,val,sha,ind) in sorted(self._parse().get(c.rule.key,{}).items())]
 def category_id(self,c):return f'unicef:{c.rule.key}'
def main():
 p=argparse.ArgumentParser();p.add_argument('--input');p.add_argument('--dry-run',action='store_true');p.add_argument('--only',action='append',default=[]);a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run(only_keys=set(a.only) or None))
if __name__=='__main__':main()
