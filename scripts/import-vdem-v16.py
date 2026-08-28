#!/usr/bin/env python3
from __future__ import annotations
import argparse,os
from data_pipeline.base import WarehouseImporter
from data_pipeline.models import CandidateDefinition,IndicatorRule
from data_pipeline.strict_bulk import StrictBulkSpec,parse_wide_metric_file
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='V-Dem Institute';SOURCE_DATASET='V-Dem Country-Year Core v16';SOURCE_PAGE='https://www.v-dem.net/data/the-v-dem-dataset/';CODEBOOK='https://v-dem.net/documents/55/v-dem_codebook_v16.pdf'
SPECS=(
 StrictBulkSpec('electoral-democracy','Highest Electoral Democracy Index',('v2x_polyarchy',),'V-Dem index','index','high',0,1,min_coverage=160),
 StrictBulkSpec('liberal-democracy','Highest Liberal Democracy Index',('v2x_libdem',),'V-Dem index','index','high',0,1,min_coverage=160),
 StrictBulkSpec('participatory-democracy','Highest Participatory Democracy Index',('v2x_partipdem',),'V-Dem index','index','high',0,1,min_coverage=160),
 StrictBulkSpec('deliberative-democracy','Highest Deliberative Democracy Index',('v2x_delibdem',),'V-Dem index','index','high',0,1,min_coverage=160),
 StrictBulkSpec('egalitarian-democracy','Highest Egalitarian Democracy Index',('v2x_egaldem',),'V-Dem index','index','high',0,1,min_coverage=160),
 StrictBulkSpec('freedom-expression','Highest freedom of expression and alternative information',('v2x_freexp_altinf',),'V-Dem index','index','high',0,1,min_coverage=160),
 StrictBulkSpec('clean-elections','Highest Clean Elections Index',('v2xel_frefair',),'V-Dem index','index','high',0,1,min_coverage=160),
 StrictBulkSpec('freedom-association','Highest Freedom of Association Index',('v2x_frassoc_thick',),'V-Dem index','index','high',0,1,min_coverage=160),
 StrictBulkSpec('rule-law','Strongest rule of law',('v2x_rule',),'V-Dem index','index','high',0,1,min_coverage=160),
 StrictBulkSpec('judicial-constraints','Strongest judicial constraints on the executive',('v2x_jucon',),'V-Dem index','index','high',0,1,min_coverage=160),
 StrictBulkSpec('legislative-constraints','Strongest legislative constraints on the executive',('v2xlg_legcon',),'V-Dem index','index','high',0,1,min_coverage=160),
 StrictBulkSpec('women-political-empowerment',"Highest Women's Political Empowerment Index",('v2x_gender',),'V-Dem index','index','high',0,1,min_coverage=160),
 StrictBulkSpec('political-corruption','Highest political corruption',('v2x_corr',),'V-Dem index','index','high',0,1,min_coverage=160),
 StrictBulkSpec('civil-society-participation','Highest Civil Society Participation Index',('v2x_cspart',),'V-Dem index','index','high',0,1,min_coverage=160),
 StrictBulkSpec('core-civil-society','Strongest core civil society',('v2xcs_ccsi',),'V-Dem index','index','high',0,1,min_coverage=160),
)
class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='vdemv16'
 def __init__(self,warehouse,input_path=None,dry_run=False):super().__init__(warehouse,dry_run=dry_run);self.input_path=input_path;self._parsed=None
 def _data(self):
  if self._parsed is None:
   if not self.input_path:raise RuntimeError('V-Dem v16 importer requires the exact official country-year CSV/XLSX via --input.')
   self._parsed=parse_wide_metric_file(self.input_path,SPECS,fixed_year=2025)
  return self._parsed
 def discover(self):
  out=[]
  for s in SPECS:
   direction_note='Higher values mean more political corruption.' if s.key=='political-corruption' else 'Higher values mean more of the named democratic/institutional trait.'
   desc=f'{s.title} in V-Dem v16 for the fixed 2025 country-year.'
   rule=IndicatorRule(key=s.key,title=s.title,description=desc,plain_language_description=desc,technical_definition=f'Exact V-Dem v16 variable {s.aliases[0]} for year 2025. {direction_note}',unit_explanation='V-Dem interval index (0–1)',family='Government & democracy',icon='🗳️',unit='V-Dem index',value_type='index',ranking_direction='high',include=s.aliases,min_coverage=s.min_coverage,evidence_tier='A',source_priority=8,specificity_score=100,recognizability_score=95,understandability_score=90,fun_score=92,objective_status='composite')
   out.append(CandidateDefinition(rule,f'VDEM16:{s.aliases[0]}',s.title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'codebook_url':CODEBOOK,'dataset_release':'v16','reference_year':2025,'source_query':{'variable_code':s.aliases[0]},'official_bulk_input_required':True,'manual_review_required':True,'composite_or_model_based_index':True,'license':'CC BY-SA 4.0','v16_2_6_content_reviewed':True}))
  return out
 def fetch_observations(self,c):return self._data().get(c.rule.key,[])
 def category_id(self,c):return f'vdem-v16:{c.rule.key}'
def main():
 p=argparse.ArgumentParser();p.add_argument('--input');p.add_argument('--dry-run',action='store_true');p.add_argument('--only',action='append',default=[]);a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run(only_keys=set(a.only) or None))
if __name__=='__main__':main()
