#!/usr/bin/env python3
from __future__ import annotations
import argparse,os
from data_pipeline.base import WarehouseImporter
from data_pipeline.models import CandidateDefinition,IndicatorRule
from data_pipeline.strict_bulk import StrictBulkSpec,parse_long_indicator_file,parse_wide_metric_file
from data_pipeline.official_tabular import read_official_rows,norm
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='World Bank';SOURCE_DATASET='Global Findex Database 2025 (2024 survey round)';SOURCE_PAGE='https://www.worldbank.org/en/publication/globalfindex/download-data'
# Accepted aliases are exact, never substring/fuzzy matched. The official country-level release has
# changed labels across editions, so the importer deliberately accepts only the explicitly listed labels.
SPECS=(
 StrictBulkSpec('account-ownership','Highest account ownership',('Account (% age 15+)','Account ownership (% age 15+)','FX.OWN.TOTL.ZS'),'% of adults','percentage','high',0,100,min_coverage=120),
 StrictBulkSpec('financial-institution-account','Highest financial-institution account ownership',('Financial institution account (% age 15+)','Account at a financial institution (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=110),
 StrictBulkSpec('mobile-money-account','Highest mobile-money account ownership',('Mobile money account (% age 15+)','Mobile money account ownership (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=100),
 StrictBulkSpec('debit-card-ownership','Highest debit-card ownership',('Debit card ownership (% age 15+)','Owns a debit card (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=105),
 StrictBulkSpec('credit-card-ownership','Highest credit-card ownership',('Credit card ownership (% age 15+)','Owns a credit card (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=105),
 StrictBulkSpec('digital-payments','Highest digital-payment use',('Made or received digital payments (% age 15+)','Digital payments (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=110),
 StrictBulkSpec('digital-merchant-payment','Highest digital merchant-payment use',('Made a digital merchant payment (% age 15+)','Digital merchant payment (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=100),
 StrictBulkSpec('formal-saving','Highest formal saving rate',('Saved formally (% age 15+)','Saved at a financial institution or using a mobile money account (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=100),
 StrictBulkSpec('formal-borrowing','Highest formal borrowing rate',('Borrowed formally (% age 15+)','Borrowed from a financial institution or using a mobile money account (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=100),
 StrictBulkSpec('mobile-phone-ownership','Highest mobile-phone ownership',('Owns a mobile phone (% age 15+)','Mobile phone ownership (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=110),
 StrictBulkSpec('smartphone-ownership','Highest smartphone ownership',('Owns a smartphone (% age 15+)','Smartphone ownership (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=100),
 StrictBulkSpec('phone-password','Highest phone password protection',('Has a password on primary mobile phone (% age 15+)','Mobile phone protected by a password (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=90),
 StrictBulkSpec('wages-into-account','Highest share receiving wages into an account',('Received private sector wages into an account (% age 15+)','Received wages into an account (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=90),
 StrictBulkSpec('government-payments-into-account','Highest share receiving government payments into an account',('Received government payments into an account (% age 15+)','Government payments into an account (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=80),
 StrictBulkSpec('utility-bills-digitally','Highest share paying utility bills digitally',('Paid utility bills digitally (% age 15+)','Made digital utility payments (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=85),
 StrictBulkSpec('financial-resilience','Highest financial resilience',('Could come up with emergency money in 30 days (% age 15+)','Financially resilient (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=95),
 StrictBulkSpec('saved-any-money','Highest share who saved money',('Saved any money (% age 15+)','Saved money in the past year (% age 15+)'),'% of adults','percentage','high',0,100,min_coverage=100),
)
class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='globalfindex2025'
 def __init__(self,warehouse,input_path=None,dry_run=False):super().__init__(warehouse,dry_run=dry_run);self.input_path=input_path;self._parsed=None
 def _data(self):
  if self._parsed is None:
   if not self.input_path:raise RuntimeError('Global Findex importer requires the exact official 2025 country-level CSV/XLSX via --input.')
   rows=read_official_rows(self.input_path)
   headers={norm(k) for r in rows[:3] for k in r}
   is_long=bool(headers & {norm('Indicator'),norm('Indicator Name'),norm('Series Name'),norm('Indicator Code')}) and bool(headers & {norm('Value'),norm('Observation Value'),norm('OBS_VALUE')})
   self._parsed=(parse_long_indicator_file(self.input_path,SPECS,fixed_year=2024) if is_long else parse_wide_metric_file(self.input_path,SPECS,default_year=2024,fixed_year=2024))
  return self._parsed
 def discover(self):
  out=[]
  for s in SPECS:
   desc=f'{s.title} in the World Bank Global Findex 2025 edition, using the 2024 nationally representative survey round.'
   rule=IndicatorRule(key=s.key,title=s.title,description=desc,plain_language_description=desc,technical_definition=f'Exact official country-level Findex 2025 series/column; accepted exact labels: {s.aliases}.',unit_explanation=s.unit,family='Financial & digital inclusion',icon='💳',unit=s.unit,value_type='percentage',ranking_direction='high',include=s.aliases,min_coverage=s.min_coverage,evidence_tier='A',source_priority=7,specificity_score=98,recognizability_score=92,understandability_score=94,fun_score=90)
   out.append(CandidateDefinition(rule,f'FINDEX2025:{s.key}',s.title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'dataset_release':'Global Findex 2025','reference_year':2024,'source_query':{'accepted_exact_labels':s.aliases},'official_bulk_input_required':True,'manual_review_required':True,'canonical_country_universe_only':True,'v16_2_6_content_reviewed':True}))
  return out
 def fetch_observations(self,c):return self._data().get(c.rule.key,[])
 def category_id(self,c):return f'global-findex:{c.rule.key}'
def main():
 p=argparse.ArgumentParser();p.add_argument('--input');p.add_argument('--dry-run',action='store_true');p.add_argument('--only',action='append',default=[]);a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run(only_keys=set(a.only) or None))
if __name__=='__main__':main()
