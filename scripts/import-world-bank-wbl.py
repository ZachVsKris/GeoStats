#!/usr/bin/env python3
from __future__ import annotations
import argparse,os
from data_pipeline.base import WarehouseImporter
from data_pipeline.models import CandidateDefinition,IndicatorRule
from data_pipeline.strict_bulk import StrictBulkSpec,parse_wide_metric_file
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='World Bank Women, Business and the Law 2026';SOURCE_DATASET='Women, Business and the Law 2026';SOURCE_PAGE='https://wbl.worldbank.org/';DOWNLOAD_PAGE='https://wbl.worldbank.org/en/reports'
# Exact accepted workbook-column labels. No substring/fuzzy fallback is used.
SPECS=(
 StrictBulkSpec('legal-overall',"Strongest legal framework for women's economic opportunity",('Legal Frameworks score','Legal Framework score','Legal frameworks'),'WBL score (0-100)','index','high',0,100,min_coverage=180),
 StrictBulkSpec('supportive-overall',"Strongest supportive framework for women's economic opportunity",('Supportive Frameworks score','Supportive Framework score','Supportive frameworks'),'WBL score (0-100)','index','high',0,100,min_coverage=180),
 StrictBulkSpec('enforcement-overall',"Strongest enforcement of women's economic rights",('Enforcement Perceptions score','Enforcement score','Enforcement perceptions'),'WBL score (0-100)','index','high',0,100,min_coverage=50),
 StrictBulkSpec('safety',"Strongest legal protections for women's safety",('Safety score','Safety'),'WBL score (0-100)','index','high',0,100),
 StrictBulkSpec('mobility',"Strongest legal equality in women's mobility",('Mobility score','Mobility'),'WBL score (0-100)','index','high',0,100),
 StrictBulkSpec('work','Strongest legal equality for women at work',('Work score','Workplace score','Work'),'WBL score (0-100)','index','high',0,100),
 StrictBulkSpec('pay',"Strongest legal equality in women's pay",('Pay score','Pay'),'WBL score (0-100)','index','high',0,100),
 StrictBulkSpec('marriage',"Strongest legal equality for women in marriage",('Marriage score','Marriage'),'WBL score (0-100)','index','high',0,100),
 StrictBulkSpec('parenthood',"Strongest legal support for women's parenthood",('Parenthood score','Parenthood'),'WBL score (0-100)','index','high',0,100),
 StrictBulkSpec('childcare','Strongest legal support for childcare',('Childcare score','Childcare'),'WBL score (0-100)','index','high',0,100),
 StrictBulkSpec('entrepreneurship',"Strongest legal equality for women entrepreneurs",('Entrepreneurship score','Entrepreneurship'),'WBL score (0-100)','index','high',0,100),
 StrictBulkSpec('assets',"Strongest legal equality in women's asset rights",('Assets score','Assets'),'WBL score (0-100)','index','high',0,100),
 StrictBulkSpec('pension',"Strongest legal equality in women's pensions",('Pension score','Pension'),'WBL score (0-100)','index','high',0,100),
)
class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='worldbankwbl'
 def __init__(self,warehouse,input_path=None,dry_run=False):super().__init__(warehouse,dry_run=dry_run);self.input_path=input_path;self._parsed=None
 def _data(self):
  if self._parsed is None:
   if not self.input_path:raise RuntimeError('WBL 2026 requires the exact official workbook/export via --input.')
   self._parsed=parse_wide_metric_file(self.input_path,SPECS,default_year=2026)
  return self._parsed
 def discover(self):
  out=[]
  for spec in SPECS:
   desc=f'{spec.title} from the official World Bank Women, Business and the Law 2026 economy-level score.'
   rule=IndicatorRule(key=spec.key,title=spec.title,description=desc,plain_language_description=desc,technical_definition=f'Exact WBL 2026 workbook column, accepted labels: {spec.aliases}.',unit_explanation=spec.unit,family='Gender & law',icon='⚖️',unit=spec.unit,value_type='index',ranking_direction='high',include=spec.aliases,min_coverage=spec.min_coverage,evidence_tier='A',source_priority=8,specificity_score=98,recognizability_score=91,understandability_score=89,fun_score=83,objective_status='composite')
   out.append(CandidateDefinition(rule,f'WBL2026:{spec.key}',spec.title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'download_page':DOWNLOAD_PAGE,'dataset_release':'WBL 2026','source_query':{'accepted_exact_columns':spec.aliases},'manual_review_required':True,'official_bulk_input_required':True,'composite_score':True,'eligible_universe_note':'Enforcement perceptions has a smaller source-defined reporting universe; no imputation is permitted.'}))
  return out
 def fetch_observations(self,c):return self._data().get(c.rule.key,[])
 def category_id(self,c):return f'worldbank-wbl:{c.rule.key}'
def main():
 p=argparse.ArgumentParser();p.add_argument('--input');p.add_argument('--dry-run',action='store_true');p.add_argument('--only',action='append',default=[]);a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run(only_keys=set(a.only) or None))
if __name__=='__main__':main()
