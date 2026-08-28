#!/usr/bin/env python3
from __future__ import annotations
import argparse,os,re
from collections import defaultdict
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name,country_name_to_iso3
from data_pipeline.countries import normalize_iso3
from data_pipeline.models import CandidateDefinition,IndicatorRule,SourceObservation
from data_pipeline.official_tabular import first_value,norm,number,read_official_rows,source_file_sha256
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='FAO';SOURCE_DATASET='FAOSTAT Suite of Food Security Indicators / Cost and Affordability of a Healthy Diet';SOURCE_PAGE='https://data.fao.org/catalog/dataset/955d6564-40a9-48b4-b51b-f19d65bb3539'
# key,title,exact accepted item labels,unit,allowed exact unit labels,min,max
SPECS=(
 ('undernourishment-prevalence','Highest undernourishment rate',('Prevalence of undernourishment (percent) (3-year average)','Prevalence of undernourishment (percent)'),'% of population',('%','percent'),0,100),
 ('undernourished-number','Largest undernourished population',('Number of people undernourished (million) (3-year average)','Number of people undernourished (million)'),'million people',('million','million people'),0,None),
 ('severe-food-insecurity-prevalence','Highest severe food-insecurity rate',('Prevalence of severe food insecurity in the total population (percent) (3-year average)','Prevalence of severe food insecurity in the total population (percent)'),'% of population',('%','percent'),0,100),
 ('severe-food-insecurity-number','Largest severely food-insecure population',('Number of severely food insecure people (million) (3-year average)','Number of severely food insecure people (million)'),'million people',('million','million people'),0,None),
 ('moderate-severe-food-insecurity-prevalence','Highest moderate-or-severe food-insecurity rate',('Prevalence of moderate or severe food insecurity in the total population (percent) (3-year average)','Prevalence of moderate or severe food insecurity in the total population (percent)'),'% of population',('%','percent'),0,100),
 ('moderate-severe-food-insecurity-number','Largest moderate-or-severe food-insecure population',('Number of moderately or severely food insecure people (million) (3-year average)','Number of moderately or severely food insecure people (million)'),'million people',('million','million people'),0,None),
 ('dietary-energy-adequacy','Highest dietary-energy supply adequacy',('Average dietary energy supply adequacy (percent) (3-year average)','Average dietary energy supply adequacy (percent)'),'% of dietary energy requirement',('%','percent'),0,300),
 ('dietary-energy-cereals-share','Highest cereal-and-root share of dietary energy',('Share of dietary energy supply derived from cereals, roots and tubers (percent) (3-year average)','Share of dietary energy supply derived from cereals, roots and tubers (percent)'),' % of dietary energy supply'.strip(),('%','percent'),0,100),
 ('food-deficit-depth','Largest dietary-energy deficit',('Depth of the food deficit (kilocalories per person per day) (3-year average)','Depth of the food deficit (kilocalories per person per day)'),'kilocalories per person per day',('kcal/cap/d','kcal/cap/day','kilocalories per person per day'),0,None),
 ('food-production-variability','Highest food-production variability',('Per capita food production variability (constant 2014-2016 thousand int$ per capita)','Per capita food production variability'),'index',('constant 2014-2016 thousand int$ per capita','index'),0,None),
 ('food-supply-variability','Highest food-supply variability',('Per capita food supply variability (kcal/cap/day)','Per capita food supply variability'),'kilocalories per person per day',('kcal/cap/d','kcal/cap/day'),0,None),
 ('cereal-import-dependency','Highest cereal import dependency',('Cereal import dependency ratio (percent) (3-year average)','Cereal import dependency ratio (percent)'),'%',('%','percent'),-200,200),
 ('healthy-diet-cost','Highest cost of a healthy diet',('Cost of a healthy diet (CoHD)','Cost of a healthy diet'),'PPP dollars per person per day',('PPP dollar per person per day','PPP dollars per person per day','PPP dollar/capita/day'),0,None),
 ('healthy-diet-unaffordable-share','Highest share unable to afford a healthy diet',('Percentage of the population unable to afford a healthy diet (PUA)','Percentage of the population unable to afford a healthy diet'),'% of population',('%','percent'),0,100),
 ('healthy-diet-unaffordable-number','Largest population unable to afford a healthy diet',('Number of people unable to afford a healthy diet (NUA)','Number of people unable to afford a healthy diet'),'million people',('million','million people'),0,None),
)
BY_KEY={x[0]:x for x in SPECS}
def _iso(row):
 code=normalize_iso3(first_value(row,'ISO3','Country Code','ISO Code'))
 return code or country_name_to_iso3(str(first_value(row,'Area','Country','Country or Area') or ''))
def _period(row):
 raw=str(first_value(row,'Year','Year Code','Time period','TIME_PERIOD') or '').strip(); years=[int(x) for x in re.findall(r'(?<!\d)(?:19|20)\d{2}(?!\d)',raw)]
 if years:return max(years),raw
 try:return int(float(raw)),raw
 except ValueError:return None,raw
class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='faostatfoodsecurity'
 def __init__(self,warehouse,input_path=None,dry_run=False):super().__init__(warehouse,dry_run=dry_run);self.input_path=input_path;self._parsed=None
 def _parse(self):
  if self._parsed is not None:return self._parsed
  if not self.input_path:raise RuntimeError('FAOSTAT Food Security importer requires the exact official bulk CSV/ZIP via --input.')
  out=defaultdict(dict);sha=source_file_sha256(self.input_path)
  for row in read_official_rows(self.input_path):
   iso=_iso(row)
   if not iso:continue
   year,period=_period(row)
   if year is None:continue
   item=str(first_value(row,'Item','Indicator','Item Name') or ''); unit=str(first_value(row,'Unit') or '')
   val=number(first_value(row,'Value','OBS_VALUE'))
   if val is None:continue # censored symbols such as <2.5 are intentionally not approximated
   for key,title,aliases,outunit,unit_aliases,lo,hi in SPECS:
    if not any(norm(item)==norm(a) for a in aliases):continue
    if unit and not any(norm(unit)==norm(u) for u in unit_aliases):raise RuntimeError(f'{key}: unexpected FAOSTAT unit {unit!r}; expected {unit_aliases}')
    if lo is not None and val < lo-1e-9:raise RuntimeError(f'{key}: value {val} below {lo}')
    if hi is not None and val > hi+1e-9:raise RuntimeError(f'{key}: value {val} above {hi}')
    k=(iso,year);prior=out[key].get(k)
    if prior and abs(prior[1]-val)>1e-9:raise RuntimeError(f'{key}: contradictory duplicate for {iso} endpoint {year}')
    out[key][k]=(canonical_country_name(iso,iso),float(val),sha,item,period,unit)
  self._parsed=out;return out
 def discover(self):
  out=[]
  for key,title,aliases,unit,unit_aliases,lo,hi in SPECS:
   desc=f'{title} using the official FAOSTAT food-security/healthy-diet indicator.'
   rule=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=f'Exact FAOSTAT item label match {aliases}; exact source unit {unit_aliases}. For rolling periods the terminal year is stored as data_year and the complete reference period is preserved in metadata.',unit_explanation=unit,family='Food security',icon='🍽️',unit=unit,value_type='percentage' if '%' in unit else ('total' if 'million' in unit else 'other'),ranking_direction='high',include=aliases,min_coverage=40,evidence_tier='A',source_priority=8,specificity_score=99,recognizability_score=91,understandability_score=93,fun_score=88)
   out.append(CandidateDefinition(rule,f'FAOSTATFS:{key}',title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'source_query':{'accepted_exact_items':aliases,'accepted_exact_units':unit_aliases},'official_bulk_input_required':True,'manual_review_required':True,'rolling_period_policy':'store terminal year only for warehouse indexing; preserve full source reference period; activation requires comparable period review','censored_values_not_approximated':True,'v16_2_6_content_reviewed':True}))
  return out
 def fetch_observations(self,c):return [SourceObservation(iso,name,year,val,SOURCE_PAGE,f'FAOSTATFS:{c.rule.key}:{iso}:{year}','official',{'source_file_sha256':sha,'item':item,'reference_period':period,'source_unit':unit}) for (iso,year),(name,val,sha,item,period,unit) in sorted(self._parse().get(c.rule.key,{}).items())]
 def category_id(self,c):return f'faostat-food-security:{c.rule.key}'
def main():
 p=argparse.ArgumentParser();p.add_argument('--input');p.add_argument('--dry-run',action='store_true');p.add_argument('--only',action='append',default=[]);a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run(only_keys=set(a.only) or None))
if __name__=='__main__':main()
