#!/usr/bin/env python3
"""NOAA/NCEI Global Historical Tsunami Database importer (v16.2.6)."""
from __future__ import annotations
import argparse,hashlib,csv,io,os,re
from collections import defaultdict
from pathlib import Path
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name,country_name_to_iso3
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition,IndicatorRule,SourceObservation
from data_pipeline.supabase import SupabaseWarehouse
SOURCE_ORG='NOAA National Centers for Environmental Information';SOURCE_DATASET='Global Historical Tsunami Database';SOURCE_PAGE='https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/tsunamis';METHOD='https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-data'
def norm(s):return re.sub(r'[^a-z0-9]+',' ',str(s or '').lower()).strip()
def load(path_or_url):
 raw=Path(path_or_url).read_bytes() if Path(path_or_url).exists() else HttpClient(timeout=240,retries=5,user_agent='GeoStats/16.2.6 NOAA').get_bytes(path_or_url)
 text=raw.decode('utf-8-sig','replace');delim='\t' if text[:10000].count('\t')>text[:10000].count(',') else ',';counts=defaultdict(int)
 for row in csv.DictReader(io.StringIO(text),delimiter=delim):
  m={norm(k):v for k,v in row.items()};country=m.get('country') or m.get('country name');valid=m.get('event validity') or m.get('validity') or m.get('eventvalidity')
  try: validity=float(str(valid))
  except: continue
  if validity<=0: continue
  iso=country_name_to_iso3(country)
  if iso: counts[iso]+=1
 return dict(counts)
def input_sha256(value):
 p=Path(value)
 return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else ''

class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='noaatsunami'
 def __init__(self,warehouse,input_path,dry_run=False):super().__init__(warehouse,dry_run=dry_run);self.counts=load(input_path)
 def discover(self):
  desc='Number of valid tsunami source events in NOAA/NCEI’s Global Historical Tsunami Database associated with the country. This is a historical-record count, not a measure of present-day risk.'
  r=IndicatorRule(key='most-recorded-tsunami-events',title='Most recorded tsunami events',description=desc,plain_language_description=desc,technical_definition='Count of NOAA Global Historical Tsunami Database source events with event validity greater than zero, grouped by database country.',unit_explanation='Recorded valid tsunami source events',family='Natural hazards',icon='🌊',unit='recorded events',value_type='total',ranking_direction='high',include=('valid source events',),min_coverage=40,evidence_tier='A',source_priority=7,specificity_score=98,recognizability_score=94,understandability_score=96,fun_score=97)
  return [CandidateDefinition(r,'NOAA-GHTD:valid-source-events','Valid tsunami source events by country',SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'methodology_url':METHOD,'source_query':{'event_validity':'>0','group_by':'country'},'measurementType':'total','broadDomain':'physical-geography','knowledgeCluster':'natural-hazards','strategyFamily':'tsunami-history','v16_2_6_content_reviewed':True,'source_file_sha256':self.source_sha256})]
 def fetch_observations(self,c):return [SourceObservation(iso,canonical_country_name(iso,iso),2026,float(n),SOURCE_PAGE,f'tsunami:{iso}','official') for iso,n in self.counts.items()]
 def category_id(self,c):return 'noaatsunami:recorded-events'
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--input',required=True,help='Official NOAA/NCEI tsunami event TSV/CSV export');ap.add_argument('--dry-run',action='store_true');a=ap.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run())
if __name__=='__main__':main()
