#!/usr/bin/env python3
"""GeoStats v16.2.6 curated UN World Population Prospects 2024 importer.

Uses the final 2023 estimate year only (never projections). The importer accepts the
UN compact CSV/XLSX download and derives a small set of highly understandable
country comparisons. Every derived statistic uses the same WPP release and year.
"""
from __future__ import annotations
import argparse, csv, io, os, re, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name, country_name_to_iso3
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_ORG='United Nations Population Division'
SOURCE_DATASET='World Population Prospects 2024'
SOURCE_PAGE='https://population.un.org/wpp/'
METHOD='https://population.un.org/wpp/Publications/Files/WPP2024_Methodology-Report_Final.pdf'
DOWNLOAD='https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/EXCEL_FILES/1_General/WPP2024_GEN_F01_DEMOGRAPHIC_INDICATORS_COMPACT.xlsx'
YEAR=2023

def norm(s): return re.sub(r'[^a-z0-9]+','',str(s or '').lower())

def _xlsx_rows(raw: bytes):
    z=zipfile.ZipFile(io.BytesIO(raw))
    shared=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        root=ET.fromstring(z.read('xl/sharedStrings.xml'))
        ns={'a':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        for si in root.findall('a:si',ns): shared.append(''.join(t.text or '' for t in si.findall('.//a:t',ns)))
    # Compact workbook's first worksheet contains the general indicators; scan worksheets until a header is found.
    ns={'a':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    for name in sorted(n for n in z.namelist() if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')):
        root=ET.fromstring(z.read(name)); rows=[]
        for row in root.findall('.//a:sheetData/a:row',ns):
            vals=[]
            for c in row.findall('a:c',ns):
                t=c.get('t'); v=c.find('a:v',ns); inline=c.find('a:is/a:t',ns)
                value=''
                if inline is not None: value=inline.text or ''
                elif v is not None:
                    value=v.text or ''
                    if t=='s' and value.isdigit() and int(value)<len(shared): value=shared[int(value)]
                vals.append(value)
            if vals: rows.append(vals)
        for i,row in enumerate(rows):
            nr={norm(x) for x in row}
            if ('iso3code' in nr or 'iso3' in nr) and 'year' in nr:
                headers=row
                for data in rows[i+1:]:
                    if len(data)<len(headers): data=data+['']*(len(headers)-len(data))
                    yield dict(zip(headers,data))
                return
    raise RuntimeError('Could not find the WPP compact demographic-indicator sheet/header.')

def load(path_or_url: str):
    from data_pipeline.http import HttpClient
    raw=Path(path_or_url).read_bytes() if Path(path_or_url).exists() else HttpClient(timeout=240,retries=5,user_agent='GeoStats/16.2.6 WPP').get_bytes(path_or_url)
    if raw[:2]==b'PK': rows=list(_xlsx_rows(raw))
    else: rows=list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig','replace'))))
    out=[]
    for row in rows:
        m={norm(k):v for k,v in row.items()}
        year_raw=m.get('year')
        try: year=int(float(str(year_raw)))
        except: continue
        if year!=YEAR: continue
        iso3=str(m.get('iso3code') or m.get('iso3') or '').upper().strip()
        if len(iso3)!=3: iso3=country_name_to_iso3(m.get('location') or m.get('country')) or ''
        if not iso3: continue
        def val(*names):
            for n in names:
                x=m.get(norm(n))
                if x not in (None,''):
                    try:return float(str(x).replace(',',''))
                    except:pass
            return None
        total=val('TPopulation1July','TotalPopulation1July','TPopulation1JulyThousands')
        male=val('PopMale1July','MalePopulation1July')
        female=val('PopFemale1July','FemalePopulation1July')
        metrics={
          'male-share': (100*male/total if male is not None and total and total>0 else None),
          'female-share': (100*female/total if female is not None and total and total>0 else None),
          'sex-ratio': val('SexRatio'),
          'median-age': val('MedianAgePop','MedianAge'),
          'population-density': val('PopDensity','PopulationDensity'),
          'population-growth': val('PopGrowthRate','PopulationGrowthRate'),
          'fertility': val('TFR','TotalFertilityRate'),
          'life-expectancy': val('LEx','LifeExpectancy'),
          'female-life-expectancy': val('LExFemale','FemaleLifeExpectancy'),
          'male-life-expectancy': val('LExMale','MaleLifeExpectancy'),
          'infant-mortality': val('IMR','InfantMortalityRate'),
          'natural-change-rate': val('NatChangeRT','RateNaturalChange','RateofNaturalChange','CrudeRateNaturalChange'),
          'birth-rate': val('CBR','CrudeBirthRate'),
          'death-rate': val('CDR','CrudeDeathRate'),
          'net-migration-rate': val('CNMR','NetMigrationRate','CrudeNetMigrationRate'),
          'sex-ratio-at-birth': val('SRB','SexRatioatBirth','SexRatioAtBirthMalesPer100FemaleBirths'),
          'mean-age-childbearing': val('MACB','MeanAgeChildbearing','MeanAgeofChildbearing'),
        }
        if metrics['female-life-expectancy'] is not None and metrics['male-life-expectancy'] is not None:
            metrics['female-life-expectancy-advantage']=metrics['female-life-expectancy']-metrics['male-life-expectancy']
        out.append((iso3,metrics))
    return out

SPECS={
 'highest-male-share':('Highest male share of population','Share of the population that is male.','%','percentage','high','Population'),
 'highest-female-share':('Highest female share of population','Share of the population that is female.','%','percentage','high','Population'),
 'highest-sex-ratio':('Most men per 100 women','Male population per 100 female population.','men per 100 women','rate','high','Population'),
 'lowest-sex-ratio':('Most women relative to men','Lowest number of men per 100 women.','men per 100 women','rate','low','Population'),
 'highest-median-age':('Highest median age','Median age of the population.','years','other','high','Population'),
 'lowest-median-age':('Lowest median age','Median age of the population.','years','other','low','Population'),
 'lowest-pop-density':('Lowest population density','Population per square kilometer.','people/km²','rate','low','Population'),
 'fastest-pop-decline':('Fastest population decline','Annual population growth rate; the most negative rate ranks first.','% per year','rate','low','Population'),
 'lowest-fertility':('Lowest fertility rate','Average number of births per woman under current age-specific fertility rates.','births per woman','rate','low','Population'),
 'highest-life-expectancy':('Highest life expectancy','Life expectancy at birth for both sexes.','years','other','high','Health'),
 'female-life-expectancy-advantage':('Largest female life-expectancy advantage','Female life expectancy minus male life expectancy at birth.','years','other','high','Population'),
 'highest-natural-change-rate':('Fastest natural population increase','Crude rate of natural population increase: births minus deaths, per 1,000 people.','per 1,000 people','rate','high','Population'),
 'highest-birth-rate':('Highest birth rate','Crude birth rate per 1,000 people.','births per 1,000 people','rate','high','Population'),
 'lowest-death-rate':('Lowest death rate','Crude death rate per 1,000 people.','deaths per 1,000 people','rate','low','Population'),
 'highest-net-migration-rate':('Highest net migration rate','Net migration rate per 1,000 people.','per 1,000 people','rate','high','Population'),
 'highest-sex-ratio-at-birth':('Most boys born per 100 girls','Male births per 100 female births.','boys per 100 girls','rate','high','Population'),
 'highest-mean-age-childbearing':('Oldest average age of mothers at childbirth','Mean age of childbearing.','years','other','high','Population'),
 'highest-male-life-expectancy':('Highest male life expectancy','Male life expectancy at birth.','years','other','high','Health'),
 'highest-female-life-expectancy':('Highest female life expectancy','Female life expectancy at birth.','years','other','high','Health'),
}
KEY_METRIC={
 'highest-male-share':'male-share','highest-female-share':'female-share','highest-sex-ratio':'sex-ratio','lowest-sex-ratio':'sex-ratio',
 'highest-median-age':'median-age','lowest-median-age':'median-age','highest-pop-density':'population-density','lowest-pop-density':'population-density',
 'fastest-pop-decline':'population-growth','lowest-fertility':'fertility','highest-life-expectancy':'life-expectancy',
 'lowest-infant-mortality':'infant-mortality','female-life-expectancy-advantage':'female-life-expectancy-advantage',
 'highest-natural-change-rate':'natural-change-rate','highest-birth-rate':'birth-rate','lowest-death-rate':'death-rate',
 'highest-net-migration-rate':'net-migration-rate','highest-sex-ratio-at-birth':'sex-ratio-at-birth',
 'highest-mean-age-childbearing':'mean-age-childbearing','highest-male-life-expectancy':'male-life-expectancy',
 'highest-female-life-expectancy':'female-life-expectancy'
}
class Importer(WarehouseImporter):
 source_organization=SOURCE_ORG; source_dataset=SOURCE_DATASET; source_slug='unwpp'
 def __init__(self,warehouse,input_path=DOWNLOAD,dry_run=False): super().__init__(warehouse,dry_run=dry_run); self.rows=load(input_path)
 def discover(self):
  out=[]
  for key,(title,desc,unit,vtype,direction,family) in SPECS.items():
   rule=IndicatorRule(key=key,title=title,description=desc,plain_language_description=desc,technical_definition=f'{desc} WPP 2024 estimate for {YEAR}.',unit_explanation=unit,family=family,icon='👥',unit=unit,value_type=vtype,ranking_direction=direction,include=(key,),min_coverage=180,evidence_tier='A',source_priority=4,specificity_score=98,recognizability_score=97,understandability_score=98,fun_score=95)
   out.append(CandidateDefinition(rule,f'WPP2024:{KEY_METRIC[key]}:{YEAR}',title,SOURCE_PAGE,{'source_page_url':SOURCE_PAGE,'download_url':DOWNLOAD,'methodology_url':METHOD,'dataset_release':'World Population Prospects 2024','source_query':{'year':YEAR,'metric':KEY_METRIC[key],'variant':'estimate'},'minimum_year':YEAR,'measurementType':vtype,'broadDomain':'population','knowledgeCluster':'demographics','strategyFamily':key,'v16_2_6_content_reviewed':True,'license_name':'CC BY 3.0 IGO'}))
  return out
 def fetch_observations(self,c):
  metric=KEY_METRIC[c.rule.key]; out=[]
  for iso3,vals in self.rows:
   v=vals.get(metric)
   if v is not None: out.append(SourceObservation(iso3,canonical_country_name(iso3,iso3),YEAR,float(v),SOURCE_PAGE,f'{metric}:{iso3}:{YEAR}','estimated'))
  return out
 def category_id(self,c): return f'unwpp:{c.rule.key}'

def main():
 ap=argparse.ArgumentParser(); ap.add_argument('--input',default=DOWNLOAD); ap.add_argument('--dry-run',action='store_true'); a=ap.parse_args(); u=os.getenv('SUPABASE_URL'); k=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
 if not a.dry_run and(not u or not k): raise SystemExit('Set Supabase secrets.')
 print(Importer(None if a.dry_run else SupabaseWarehouse(u,k),a.input,a.dry_run).run())
if __name__=='__main__': main()
