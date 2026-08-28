#!/usr/bin/env python3
"""UN DESA International Migrant Stock 2024 new-source repair importer."""
from __future__ import annotations
import argparse, os
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name, country_name_to_iso3
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.official_tabular import first_value, norm, normalized, number, read_official_rows, source_file_sha256
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_ORG='United Nations Population Division'; SOURCE_DATASET='International Migrant Stock 2024'; YEAR=2024
SOURCE_PAGE='https://www.un.org/development/desa/pd/content/international-migrant-stock'

def load(path: str):
    out=[]
    for row in read_official_rows(path):
        iso3=str(first_value(row,'iso3','iso3 code','country code') or '').upper().strip(); country=str(first_value(row,'country','country name','country or area','location') or '')
        if len(iso3)!=3: iso3=country_name_to_iso3(country) or ''
        year_raw=first_value(row,'year')
        try: year=int(float(str(year_raw))) if year_raw not in (None,'') else YEAR
        except: continue
        if year!=YEAR or not iso3: continue
        total=number(first_value(row,'international migrant stock','migrant stock','migrants','total migrants','international migrants'))
        share=number(first_value(row,'international migrant stock percentage of population','migrant share','migrants percent population','percentage of population','share of population'))
        # Long-format official exports are also accepted, but only for explicitly identified stock/share measures.
        indicator=norm(first_value(row,'indicator','indicator name','measure'))
        if total is None and 'migrant' in indicator and 'stock' in indicator and not any(x in indicator for x in ['percent','share']): total=number(first_value(row,'value','numeric value'))
        if share is None and 'migrant' in indicator and any(x in indicator for x in ['percent','share']): share=number(first_value(row,'value','numeric value'))
        out.append((iso3,country,total,share))
    return out

SPECS={
 'migrant-stock':('Largest international migrant population','Number of international migrants living in the country.','people','total','International migrant stock'),
 'migrant-share':('Largest immigrant share','International migrants as a percentage of the destination country population.','% of population','share','International migrant stock as percentage of population'),
}
class Importer(WarehouseImporter):
    source_organization=SOURCE_ORG;source_dataset=SOURCE_DATASET;source_slug='undesamigrant'
    def __init__(self,w,input_path,dry_run=False):super().__init__(w,dry_run=dry_run);self.rows=load(input_path); self.source_sha256=source_file_sha256(input_path)
    def discover(self):
        out=[]
        for key,(title,desc,unit,mtype,technical) in SPECS.items():
            rule=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=f'{technical}, UN DESA International Migrant Stock 2024.',unit_explanation=unit,family='Migration',icon='🧭',unit=unit,value_type='percentage' if mtype=='share' else 'total',ranking_direction='high',include=(key,),min_coverage=175,evidence_tier='A',source_priority=5,specificity_score=99,recognizability_score=98,understandability_score=98,fun_score=95)
            out.append(CandidateDefinition(rule,f'IMS2024:{key}',technical,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'methodology_url':SOURCE_PAGE,'dataset_release':'International Migrant Stock 2024','source_query':{'year':YEAR,'metric':key,'destination_stock':True},'minimum_year':YEAR,'measurementType':mtype,'broadDomain':'demographics','knowledgeCluster':'migration-stock','strategyFamily':key,'v16_2_6_content_reviewed':True,'source_file_sha256':self.source_sha256}))
        return out
    def fetch_observations(self,c):
        idx=2 if c.rule.key=='migrant-stock' else 3
        return [SourceObservation(i,canonical_country_name(i,n or i),YEAR,float(row[idx]),SOURCE_PAGE,f'{c.rule.key}:{i}:{YEAR}','estimated') for row in self.rows for i,n in [(row[0],row[1])] if row[idx] is not None]
    def category_id(self,c):return f'undesamigrant:{c.rule.key}'

def main():
    p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--dry-run',action='store_true');a=p.parse_args();u=os.getenv('SUPABASE_URL');k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    if not a.dry_run and(not u or not k):raise SystemExit('Set Supabase secrets.')
    print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run())
if __name__=='__main__':main()
