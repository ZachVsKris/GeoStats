#!/usr/bin/env python3
from __future__ import annotations
import argparse,os
from data_pipeline.base import WarehouseImporter
from data_pipeline.models import CandidateDefinition,IndicatorRule
from data_pipeline.strict_bulk import StrictBulkSpec,parse_long_indicator_file,parse_wide_metric_file
from data_pipeline.official_tabular import read_official_rows,norm
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='FAO';SOURCE_DATASET='Global Forest Resources Assessment 2025';SOURCE_PAGE='https://fra-data.fao.org/';METHOD='https://www.fao.org/forest-resources-assessment/en/'
SPECS=(
 StrictBulkSpec('forest-share','Highest % of land covered by forest',('Forest area (% of land area)','Forest area as a proportion of total land area','Forest share of land'),'% of land area','percentage','high',0,100,min_coverage=150),
 StrictBulkSpec('primary-forest-area','Largest primary forest area',('Primary forest','Primary forest area'),'1,000 hectares','total','high',0,None,min_coverage=110),
 StrictBulkSpec('planted-forest-area','Largest planted forest area',('Planted forest','Planted forest area'),'1,000 hectares','total','high',0,None,min_coverage=120),
 StrictBulkSpec('natural-forest-area','Largest naturally regenerating forest area',('Naturally regenerating forest','Naturally regenerating forest area'),'1,000 hectares','total','high',0,None,min_coverage=120),
 StrictBulkSpec('protected-forest-area','Largest protected forest area',('Forest area within protected areas','Forest in protected areas','Protected forest area'),'1,000 hectares','total','high',0,None,min_coverage=100),
 StrictBulkSpec('protected-forest-share','Highest % of forest in protected areas',('Forest area within protected areas (% of forest area)','Protected forest share','Forest in protected areas (% of forest area)'),' % of forest area'.strip(),'percentage','high',0,100,min_coverage=95),
 StrictBulkSpec('mangrove-area','Largest mangrove area',('Mangroves','Mangrove area'),'1,000 hectares','total','high',0,None,min_coverage=70),
 StrictBulkSpec('growing-stock','Largest forest growing stock',('Growing stock','Total growing stock'),'million cubic metres','total','high',0,None,min_coverage=110),
 StrictBulkSpec('biomass-carbon-stock','Largest forest biomass carbon stock',('Carbon stock in living biomass','Forest biomass carbon stock'),'million tonnes','total','high',0,None,min_coverage=100),
 StrictBulkSpec('carbon-stock-per-hectare','Highest forest carbon stock per hectare',('Carbon stock per hectare','Forest carbon stock per hectare'),'tonnes per hectare','rate','high',0,None,min_coverage=90),
 StrictBulkSpec('total-carbon-stock','Largest total forest carbon stock',('Total forest carbon stock','Carbon stock in forest'),'million tonnes','total','high',0,None,min_coverage=100),
 StrictBulkSpec('public-ownership-share','Highest % of forest publicly owned',('Public ownership (% of forest area)','Publicly owned forest share'),' % of forest area'.strip(),'percentage','high',0,100,min_coverage=75),
 StrictBulkSpec('private-ownership-share','Highest % of forest privately owned',('Private ownership (% of forest area)','Privately owned forest share'),' % of forest area'.strip(),'percentage','high',0,100,min_coverage=75),
 StrictBulkSpec('biodiversity-designation','Largest forest area managed for biodiversity conservation',('Forest area designated for conservation of biodiversity','Biodiversity conservation forest area'),'1,000 hectares','total','high',0,None,min_coverage=80),
 StrictBulkSpec('soil-water-protection','Largest forest area managed for soil and water protection',('Forest area designated for protection of soil and water','Soil and water protection forest area'),'1,000 hectares','total','high',0,None,min_coverage=80),
 StrictBulkSpec('production-designation','Largest forest area managed for production',('Forest area designated for production','Production forest area'),'1,000 hectares','total','high',0,None,min_coverage=80),
)
DESCRIPTIONS={
 'forest-share':'Percentage of the country’s land that meets FAO’s forest definition: at least 0.5 hectares with trees over 5 metres and canopy cover over 10%, excluding land mainly used for farming or cities.',
 'primary-forest-area':'Forest of native tree species that has regenerated naturally and shows no clearly visible sign of human activity or major ecological disruption.',
 'planted-forest-area':'Forest mainly made up of trees established through planting or deliberate seeding.',
 'natural-forest-area':'Forest mainly made up of trees established through natural regeneration rather than planting.',
 'protected-forest-area':'Forest located inside a legally designated protected area.',
 'protected-forest-share':'Percentage of the country’s forest located inside legally designated protected areas.',
 'mangrove-area':'Area of salt-tolerant forest growing along tropical and subtropical coasts and tidal waterways.',
 'growing-stock':'Total trunk volume of living trees in forest, measured over bark from stump height toward the top of each tree.',
 'biomass-carbon-stock':'Carbon stored in the living above-ground and below-ground parts of forest trees.',
 'carbon-stock-per-hectare':'Average tonnes of carbon stored in all forest carbon pools for each hectare of forest.',
 'total-carbon-stock':'Carbon stored across living biomass, dead wood, litter and forest soil.',
 'public-ownership-share':'Percentage of forest owned by national, state or local government, or by government-controlled institutions.',
 'private-ownership-share':'Percentage of forest owned by individuals, families, communities, cooperatives, companies or other private organizations.',
 'biodiversity-designation':'Forest area whose main management purpose is conserving biological diversity.',
 'soil-water-protection':'Forest area whose main management purpose is protecting soil and water.',
 'production-designation':'Forest area whose main management purpose is producing wood, fibre, bioenergy or other forest products.',
}
class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='faofra2025'
 def __init__(self,warehouse,input_path=None,dry_run=False):super().__init__(warehouse,dry_run=dry_run);self.input_path=input_path;self._parsed=None
 def _data(self):
  if self._parsed is None:
   if not self.input_path:raise RuntimeError('FAO FRA 2025 importer requires the exact official country table/export via --input.')
   rows=read_official_rows(self.input_path);headers={norm(k) for r in rows[:3] for k in r};is_long=bool(headers & {norm('Indicator'),norm('Variable'),norm('Item')}) and bool(headers & {norm('Value'),norm('OBS_VALUE')})
   self._parsed=parse_long_indicator_file(self.input_path,SPECS,indicator_fields=('Indicator','Variable','Item','Indicator Name'),default_year=2025,fixed_year=2025) if is_long else parse_wide_metric_file(self.input_path,SPECS,default_year=2025,fixed_year=2025)
  return self._parsed
 def discover(self):
  out=[]
  for s in SPECS:
   desc=DESCRIPTIONS[s.key]
   rule=IndicatorRule(key=s.key,title=s.title,description=desc,plain_language_description=desc,technical_definition=f'Exact FRA 2025 field/indicator only; accepted labels: {s.aliases}. No alternate denominator or cross-dataset derivation.',unit_explanation=s.unit,family='Forests',icon='🌲',unit=s.unit,value_type=s.value_type,ranking_direction='high',include=s.aliases,min_coverage=s.min_coverage,evidence_tier='A',source_priority=8,specificity_score=99,recognizability_score=93,understandability_score=94,fun_score=91)
   out.append(CandidateDefinition(rule,f'FRA2025:{s.key}',s.title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'methodology_url':METHOD,'reference_year':2025,'source_query':{'accepted_exact_labels':s.aliases},'official_bulk_input_required':True,'manual_review_required':True,'no_cross_dataset_derivation':True,'measurementType':'share' if s.value_type=='percentage' else 'rate' if s.value_type=='rate' else 'total','broadDomain':'environment','knowledgeCluster':'forest-resources','strategyFamily':f'forest-resources:{s.key}','definitionStandard':'FAO FRA 2025 terms and definitions','v16_2_6_content_reviewed':True}))
  return out
 def fetch_observations(self,c):return self._data().get(c.rule.key,[])
 def category_id(self,c):return f'fao-fra-2025:{c.rule.key}'
def main():
 p=argparse.ArgumentParser();p.add_argument('--input');p.add_argument('--dry-run',action='store_true');p.add_argument('--only',action='append',default=[]);a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run(only_keys=set(a.only) or None))
if __name__=='__main__':main()
