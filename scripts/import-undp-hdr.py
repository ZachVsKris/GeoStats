#!/usr/bin/env python3
from __future__ import annotations
import argparse,os
from data_pipeline.base import WarehouseImporter
from data_pipeline.models import CandidateDefinition,IndicatorRule
from data_pipeline.strict_bulk import StrictBulkSpec,parse_long_indicator_file,parse_wide_metric_file
from data_pipeline.official_tabular import read_official_rows,norm
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='UNDP';SOURCE_DATASET='Human Development Reports Data Center';SOURCE_PAGE='https://hdr.undp.org/data-center';DOWNLOAD_PAGE='https://hdr.undp.org/data-center/documentation-and-downloads'
SPECS=(
 StrictBulkSpec('hdi','Highest Human Development Index',('hdi','HDI','Human Development Index'),'HDI','index','high',0,1,min_coverage=180),
 StrictBulkSpec('ihdi','Highest inequality-adjusted Human Development Index',('ihdi','IHDI','Inequality-adjusted Human Development Index'),'IHDI','index','high',0,1,min_coverage=150),
 StrictBulkSpec('hdi-inequality-loss','Largest human-development loss to inequality',('loss','Loss due to inequality in HDI (%)','HDI inequality loss'),'%', 'percentage','high',0,100,min_coverage=150),
 StrictBulkSpec('human-inequality-coefficient','Highest coefficient of human inequality',('coef_ineq','Coefficient of human inequality','Coefficient of Human Inequality'),'%', 'percentage','high',0,100,min_coverage=150),
 StrictBulkSpec('life-expectancy-inequality','Highest inequality in life expectancy',('ineq_le','Inequality in life expectancy (%)','Inequality in life expectancy'),'%', 'percentage','high',0,100,min_coverage=150),
 StrictBulkSpec('education-inequality','Highest inequality in education',('ineq_edu','Inequality in education (%)','Inequality in education'),'%', 'percentage','high',0,100,min_coverage=150),
 StrictBulkSpec('income-inequality','Highest inequality in income',('ineq_inc','Inequality in income (%)','Inequality in income'),'%', 'percentage','high',0,100,min_coverage=150),
 StrictBulkSpec('gdi','Highest Gender Development Index',('gdi','GDI','Gender Development Index'),'GDI','index','high',0,1.5,min_coverage=160),
 StrictBulkSpec('gii','Highest Gender Inequality Index',('gii','GII','Gender Inequality Index'),'GII','index','high',0,1,min_coverage=160),
 StrictBulkSpec('phdi','Highest planetary pressures-adjusted HDI',('phdi','PHDI','Planetary pressures-adjusted HDI'),'PHDI','index','high',0,1,min_coverage=150),
 StrictBulkSpec('mpi','Highest Multidimensional Poverty Index',('mpi','MPI','Multidimensional Poverty Index'),'MPI','index','high',0,1,min_coverage=90,eligible_universe_type='source_subset'),
 StrictBulkSpec('mpi-headcount','Highest multidimensional-poverty headcount',('pop_mpi','Headcount ratio: Population in multidimensional poverty (%)','MPI headcount ratio'),'%', 'percentage','high',0,100,min_coverage=90,eligible_universe_type='source_subset'),
 StrictBulkSpec('mpi-intensity','Highest multidimensional-poverty intensity',('intensity','Intensity of deprivation among the multidimensionally poor (%)','MPI intensity'),'%', 'percentage','high',0,100,min_coverage=90,eligible_universe_type='source_subset'),
 StrictBulkSpec('female-hdi','Highest female Human Development Index',('hdi_f','Female HDI','Human Development Index, female'),'HDI','index','high',0,1,min_coverage=150),
 StrictBulkSpec('male-hdi','Highest male Human Development Index',('hdi_m','Male HDI','Human Development Index, male'),'HDI','index','high',0,1,min_coverage=150),
)
class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='undphdr'
 def __init__(self,warehouse,input_path=None,dry_run=False):super().__init__(warehouse,dry_run=dry_run);self.input_path=input_path;self._parsed=None
 def _data(self):
  if self._parsed is None:
   if not self.input_path:raise RuntimeError('UNDP HDR importer requires the exact official composite-index export via --input.')
   rows=read_official_rows(self.input_path);headers={norm(k) for r in rows[:3] for k in r};is_long=bool(headers & {norm('Indicator'),norm('Indicator Name'),norm('Variable'),norm('Variable Code')}) and bool(headers & {norm('Value'),norm('OBS_VALUE')})
   self._parsed=parse_long_indicator_file(self.input_path,SPECS) if is_long else parse_wide_metric_file(self.input_path,SPECS)
  return self._parsed
 def discover(self):
  out=[]
  for s in SPECS:
   subset=s.eligible_universe_type=='source_subset'
   desc=f'{s.title} using the official UNDP Human Development Reports country dataset.'
   rule=IndicatorRule(key=s.key,title=s.title,description=desc,plain_language_description=desc,technical_definition=f'Exact official UNDP variable/label only: {s.aliases}. Common-year selection is performed after import; no interpolation or manual fills.',unit_explanation=s.unit,family='Human development',icon='🌍',unit=s.unit,value_type=s.value_type,ranking_direction='high',include=s.aliases,min_coverage=s.min_coverage,evidence_tier='A',source_priority=8,specificity_score=99,recognizability_score=95,understandability_score=92,fun_score=88)
   out.append(CandidateDefinition(rule,f'UNDPHDR:{s.key}',s.title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'download_page':DOWNLOAD_PAGE,'source_query':{'accepted_exact_variables':s.aliases},'official_bulk_input_required':True,'manual_review_required':True,'common_year_required':not subset,'eligible_universe_type':s.eligible_universe_type,'eligible_universe_note':'MPI measures cover a source-defined developing-country subset and may use survey reference periods; activation requires subset/reference-period review.' if subset else 'UNDP composite-index common-year coverage required.','v16_2_6_content_reviewed':True}))
  return out
 def fetch_observations(self,c):return self._data().get(c.rule.key,[])
 def category_id(self,c):return f'undp-hdr:{c.rule.key}'
def main():
 p=argparse.ArgumentParser();p.add_argument('--input');p.add_argument('--dry-run',action='store_true');p.add_argument('--only',action='append',default=[]);a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run(only_keys=set(a.only) or None))
if __name__=='__main__':main()
