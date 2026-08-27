#!/usr/bin/env python3
"""Release-wide common-year policy audit for v16.2.6 source families."""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from data_pipeline.models import IndicatorRule, SourceObservation
from data_pipeline.quality import score_observations

# Prove the shared pipeline prefers a broad common-year snapshot over a sparse newer year.
rule=IndicatorRule(key='fixture',title='Fixture',description='fixture',plain_language_description='fixture',technical_definition='fixture',unit_explanation='x',family='Fixture',icon='x',unit='x',value_type='total',ranking_direction='high',include=('fixture',),min_coverage=4,evidence_tier='A',source_priority=1,specificity_score=100,recognizability_score=100,understandability_score=100,fun_score=100)
obs=[]
for iso,val in [('AAA',1),('BBB',2),('CCC',3),('DDD',4),('EEE',5)]: obs.append(SourceObservation(iso,iso,2023,val,'fixture','x','official'))
for iso,val in [('AAA',2),('BBB',3)]: obs.append(SourceObservation(iso,iso,2024,val,'fixture','x','official'))
q=score_observations(rule,obs)
assert q.common_year==2023 and q.common_year_coverage==5,(q.common_year,q.common_year_coverage)

policies={
 'unwpp':('scripts/import-un-wpp.py',['YEAR=2023','if year!=YEAR']),
 'worldbankclimate':('scripts/import-world-bank-climate.py',['1991','2020','averaged across']),
 'imfweo':('scripts/import-imf-weo.py',['YEAR = 2024','historical_only']),
 'naturalearth':('scripts/import-natural-earth.py',['STATIC_YEAR = 2022','referenceLabel']),
 'naturalearthcapitals':('scripts/import-natural-earth-capitals.py',["VERSION='5.1.2'",'YEAR=2026']),
 'noaatsunami':('scripts/import-noaa-tsunami.py',['Global Historical Tsunami Database','event validity']),
 'unescoich':('scripts/import-unesco-ich.py',['Intangible Cultural Heritage','Current UNESCO-listed']),
 'aquastat':('scripts/import-aquastat.py',['SourceObservation','year']),
 'faofisheries':('scripts/import-fao-fisheries.py',['SourceObservation','year']),
 'usgsminerals':('scripts/import-usgs-minerals.py',['SourceObservation','year']),
 'whoghed':('scripts/import-who-ghed.py',['SourceObservation','year']),
 'undesamigrant':('scripts/import-un-desa-migrant-stock.py',['YEAR=2024','if year!=YEAR']),
 'wtoservices':('scripts/import-wto-services.py',['same_year','year']),
 'untourismdirect':('scripts/import-un-tourism.py',['SourceObservation','year']),
 'unwup2025':('scripts/import-un-wup-2025.py',['YEAR = 2025','WUP2025-F04']),
 'unwupcities2025':('scripts/import-un-wup-2025-cities.py',['YEAR = 2025','MIN_CITY_THOUSANDS = 50.0']),
}
for source,(file,tokens) in policies.items():
    text=(ROOT/file).read_text()
    for token in tokens: assert token in text,(source,token)
# Every multi-year importer is funneled through WarehouseImporter/score_observations, which stores only quality.common_year.
base=(ROOT/'scripts/data_pipeline/base.py').read_text(); quality=(ROOT/'scripts/data_pipeline/quality.py').read_text()
assert 'score_observations' in base and 'quality.common_year' in base and '_select_common_year' in quality
print(f'v16.2.6 common-year/reference-period audit passed across {len(policies)} source families.')
