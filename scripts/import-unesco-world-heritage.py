#!/usr/bin/env python3
from __future__ import annotations
import argparse, os, tempfile
from collections import defaultdict
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name, country_name_to_iso3
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_ORG='UNESCO World Heritage Centre'
SOURCE_DATASET='World Heritage List'
SOURCE_URL='https://whc.unesco.org/en/list/xml'
SOURCE_PAGE='https://whc.unesco.org/en/list/'
METHODOLOGY='https://whc.unesco.org/en/criteria/'
YEAR=2026

def make_rule(key,title,description,icon='🏛️'):
 return IndicatorRule(key=key,title=title,description=description,plain_language_description=description,
  technical_definition='Count of inscribed UNESCO World Heritage properties associated with each State Party. Transnational properties count for every listed State Party.',
  unit_explanation='inscribed properties',family='Culture',icon=icon,unit='sites',value_type='count',ranking_direction='high',
  include=(key,),min_coverage=80,evidence_tier='A',source_priority=12,specificity_score=98,recognizability_score=98,understandability_score=98,fun_score=96)
RULES=[
 make_rule('all-sites','Most World Heritage sites','Number of UNESCO World Heritage sites associated with the country.'),
 make_rule('cultural-sites','Most cultural World Heritage sites','Number of UNESCO cultural World Heritage sites.'),
 make_rule('natural-sites','Most natural World Heritage sites','Number of UNESCO natural World Heritage sites.','🌿'),
 make_rule('mixed-sites','Most mixed World Heritage sites','Number of sites recognized for both cultural and natural importance.','🏞️'),
 make_rule('danger-sites','Most World Heritage sites in danger','Number of the country’s World Heritage sites on the In Danger list.','⚠️'),
]

def local_name(tag): return tag.rsplit('}',1)[-1].lower()
def text_map(node): return {local_name(child.tag):(child.text or '').strip() for child in list(node)}
def split_states(value):
 import re
 return [v.strip() for v in re.split(r';|\|| / |, (?=[A-Z])',value or '') if v.strip()]

def parse_xml(path:Path):
 root=ET.parse(path).getroot(); counts=defaultdict(lambda:defaultdict(int))
 for node in root.iter():
  fields=text_map(node)
  if not fields or not ({'states','state_party','state'} & set(fields)): continue
  states=fields.get('states') or fields.get('state_party') or fields.get('state') or ''
  category=(fields.get('category') or fields.get('type') or '').lower()
  danger=(fields.get('danger') or fields.get('danger_list') or fields.get('in_danger') or '').lower()
  for state in split_states(states):
   iso3=country_name_to_iso3(state)
   if not iso3: continue
   counts[iso3]['all-sites']+=1
   if 'cultural' in category: counts[iso3]['cultural-sites']+=1
   elif 'natural' in category: counts[iso3]['natural-sites']+=1
   elif 'mixed' in category: counts[iso3]['mixed-sites']+=1
   if danger in {'1','yes','true','y'} or 'danger' in danger: counts[iso3]['danger-sites']+=1
 return counts

class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG; source_dataset=SOURCE_DATASET; source_slug='unescoheritage'
 def __init__(self,warehouse,input_path=None,dry_run=False):
  super().__init__(warehouse,dry_run=dry_run); self.input_path=input_path; self._counts=None
 def _path(self):
  if self.input_path: return Path(self.input_path)
  data=urlopen(Request(SOURCE_URL,headers={'User-Agent':'GeoStats/15.8'}),timeout=180).read()
  p=Path(tempfile.mkdtemp())/'heritage.xml'; p.write_bytes(data); return p
 def counts(self):
  if self._counts is None:self._counts=parse_xml(self._path())
  return self._counts
 def discover(self):
  return [CandidateDefinition(rule=r,source_indicator_code=f'WHC:{r.key}',source_indicator_name=r.title,source_url=SOURCE_PAGE,
   metadata={'source_page_url':SOURCE_PAGE,'methodology_url':METHODOLOGY,'dataset_release':'UNESCO World Heritage List 2026','minimum_year':1978,
   'broadDomain':'culture','knowledgeCluster':'world-heritage','strategyFamily':f'world-heritage:{r.key}','boardDescription':r.description}) for r in RULES]
 def fetch_observations(self,c):
  return [SourceObservation(iso3,canonical_country_name(iso3,iso3),YEAR,float(values.get(c.rule.key,0)),SOURCE_PAGE,f'{iso3}:{c.rule.key}:{YEAR}','official') for iso3,values in self.counts().items()]
 def category_id(self,c): return f'unescoheritage:{c.rule.key}'

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--input');ap.add_argument('--dry-run',action='store_true');ap.add_argument('--only',action='append',default=[]);a=ap.parse_args()
 url=os.getenv('SUPABASE_URL');key=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and (not url or not key):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(url,key),a.input,a.dry_run).run(only_keys=set(a.only) or None))
if __name__=='__main__':main()
