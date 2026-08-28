#!/usr/bin/env python3
"""Direct UN Tourism v16.2.6 repair importer (official bulk/dashboard export only)."""
from __future__ import annotations
import argparse, os
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name, country_name_to_iso3
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.official_tabular import first_value, norm, number, read_official_rows, source_file_sha256
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_ORG='UN Tourism';SOURCE_DATASET='UN Tourism Data Dashboard country profile';SOURCE_PAGE='https://www.unwto.org/tourism-data/country-profile-inbound-tourism';METHOD='https://www.unwto.org/tourism-data'

def load(path: str):
    out=[]
    for row in read_official_rows(path):
        iso3=str(first_value(row,'iso3','country code','destination code') or '').upper().strip();country=str(first_value(row,'country','country name','destination') or '')
        if len(iso3)!=3:iso3=country_name_to_iso3(country) or ''
        try:year=int(float(str(first_value(row,'year') or '')))
        except:continue
        if not iso3:continue
        arrivals=number(first_value(row,'international tourist arrivals','tourist arrivals','arrivals'))
        receipts=number(first_value(row,'international tourism receipts usd','tourism receipts usd','receipts usd','international tourism receipts'))
        share=number(first_value(row,'international tourism exports share','tourism receipts share of exports','tourism share of exports','receipts percent exports'))
        # Long exports need explicit indicator naming; do not infer from generic values.
        indicator=norm(first_value(row,'indicator','indicator name','measure')); val=number(first_value(row,'value','numeric value'))
        unit=norm(first_value(row,'unit','units'))
        if val is not None:
            if arrivals is None and 'international tourist arrivals' in indicator: arrivals=val
            if receipts is None and 'international tourism receipt' in indicator and not any(x in indicator for x in ['share','percent']) and any(x in unit for x in ['usd','us dollar','u s dollar']): receipts=val*(1e9 if 'billion' in unit else 1e6 if 'million' in unit else 1e3 if 'thousand' in unit else 1)
            if share is None and ('tourism export' in indicator or ('tourism receipt' in indicator and any(x in indicator for x in ['share','percent']))): share=val
        out.append((iso3,country,year,arrivals,receipts,share))
    return out

SPECS={
 'arrivals':('Largest international tourist arrivals','Number of international tourist arrivals at the destination.','arrivals','total',3),
 'receipts':('Largest international tourism revenue','International tourism receipts in current US dollars.','current US dollars','total',4),
 'receipts-share':('Highest tourism revenue share of exports','International tourism receipts/exports as a share of total exports.','% of exports','share',5),
}
class Importer(WarehouseImporter):
    source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='untourismdirect'
    def __init__(self,w,input_path,dry_run=False):super().__init__(w,dry_run=dry_run);self.rows=load(input_path); self.source_sha256=source_file_sha256(input_path)
    def discover(self):
        out=[]
        for key,(title,desc,unit,mtype,idx) in SPECS.items():
            rule=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=desc,unit_explanation=unit,family='Tourism',icon='✈️',unit=unit,value_type='percentage' if mtype=='share' else 'total',ranking_direction='high',include=(key,),min_coverage=140,evidence_tier='A',source_priority=6,specificity_score=99,recognizability_score=99,understandability_score=99,fun_score=97)
            out.append(CandidateDefinition(rule,f'UNTOURISM:{key}',title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'methodology_url':METHOD,'source_query':{'metric':key,'direct_un_tourism':True},'measurementType':mtype,'broadDomain':'culture','knowledgeCluster':'tourism','strategyFamily':f'tourism:{key}','v16_2_6_content_reviewed':True,'source_file_sha256':self.source_sha256}))
        return out
    def fetch_observations(self,c):
        idx=SPECS[c.rule.key][4]
        return [SourceObservation(i,canonical_country_name(i,n or i),y,float(row[idx]),SOURCE_PAGE,f'{c.rule.key}:{i}:{y}','official') for row in self.rows for i,n,y in [(row[0],row[1],row[2])] if row[idx] is not None]
    def category_id(self,c):return f'untourismdirect:{c.rule.key}'

def main():
    p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--dry-run',action='store_true');a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
    print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run())
if __name__=='__main__':main()
