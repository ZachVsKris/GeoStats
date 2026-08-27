#!/usr/bin/env python3
"""WTO commercial-services new-source repair importer (official bulk input only)."""
from __future__ import annotations
import argparse, os
from collections import defaultdict
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name, country_name_to_iso3
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.official_tabular import first_value, norm, number, read_official_rows, source_file_sha256
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_ORG='World Trade Organization'; SOURCE_DATASET='Trade in commercial services annual dataset'
SOURCE_PAGE='https://data.wto.org/en/dataset/comservices'; METHOD='https://www.wto.org/english/res_e/statis_e/tradeserv_stat_e.htm'

def usd_value(value, unit):
    v=number(value); u=norm(unit)
    if v is None or not any(x in u for x in ['usd','us dollar','u s dollar']): return None
    mult=1e9 if 'billion' in u else 1e6 if 'million' in u else 1e3 if 'thousand' in u else 1
    return v*mult

def load(path: str):
    flows=defaultdict(dict); names={}
    for row in read_official_rows(path):
        iso3=str(first_value(row,'reporter iso3','reporteriso3a','iso3','economy code','reporter code') or '').upper().strip(); country=str(first_value(row,'reporter','economy','country','country name') or '')
        if len(iso3)!=3: iso3=country_name_to_iso3(country) or ''
        try:year=int(float(str(first_value(row,'year') or '')))
        except:continue
        if not iso3:continue
        sector=norm(first_value(row,'sector','service sector','product sector','indicator'))
        if sector and not any(x in sector for x in ['total commercial services','commercial services total','commercial services','s200','total services']):continue
        # Wide format first.
        exp=usd_value(first_value(row,'exports usd','exports','export value'),first_value(row,'exports unit','unit','units') or 'US dollars')
        imp=usd_value(first_value(row,'imports usd','imports','import value'),first_value(row,'imports unit','unit','units') or 'US dollars')
        if exp is not None: flows[(iso3,year)]['exports']=exp
        if imp is not None: flows[(iso3,year)]['imports']=imp
        # Long format.
        flow=norm(first_value(row,'flow','trade flow','indicator type'))
        val=usd_value(first_value(row,'value','trade value'),first_value(row,'unit','units'))
        if val is not None and flow in {'export','exports','import','imports'}: flows[(iso3,year)]['exports' if flow.startswith('export') else 'imports']=val
        names[iso3]=country
    return [(iso3,names.get(iso3,''),year,v['exports']+v['imports']) for (iso3,year),v in flows.items() if 'exports' in v and 'imports' in v]

class Importer(WarehouseImporter):
    source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='wtoservices'
    def __init__(self,w,input_path,dry_run=False):super().__init__(w,dry_run=dry_run);self.rows=load(input_path); self.source_sha256=source_file_sha256(input_path)
    def discover(self):
        desc='Exports plus imports of total commercial services in the same year, converted from the source unit to current US dollars.'
        rule=IndicatorRule(key='total-services-trade',title='Largest services trade',description=desc,plain_language_description=desc,technical_definition='WTO annual total commercial-services exports plus imports.',unit_explanation='current US dollars',family='Trade',icon='🌐',unit='current US dollars',value_type='total',ranking_direction='high',include=('total-services-trade',),min_coverage=150,evidence_tier='A',source_priority=5,specificity_score=99,recognizability_score=98,understandability_score=97,fun_score=94)
        return [CandidateDefinition(rule,'WTO:COMMERCIAL-SERVICES:EXPORTS+IMPORTS','Total commercial services trade',SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'methodology_url':METHOD,'source_query':{'sector':'total commercial services','flows':['exports','imports'],'same_year':True},'measurementType':'total','broadDomain':'trade','knowledgeCluster':'services-trade','strategyFamily':'services-trade','v16_2_6_content_reviewed':True,'source_file_sha256':self.source_sha256})]
    def fetch_observations(self,c):return [SourceObservation(i,canonical_country_name(i,n or i),y,v,SOURCE_PAGE,f'total-services:{i}:{y}','official') for i,n,y,v in self.rows]
    def category_id(self,c):return 'wtoservices:total-services-trade'

def main():
    p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--dry-run',action='store_true');a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
    print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run())
if __name__=='__main__':main()
