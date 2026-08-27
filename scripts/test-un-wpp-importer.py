import csv
import importlib.util
import tempfile
import sys
from pathlib import Path

p=Path(__file__).with_name('import-un-wpp.py')
spec=importlib.util.spec_from_file_location('unwpp',p)
m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)

with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'wpp.csv'
 fields=['ISO3_code','Location','Year','TPopulation1July','PopMale1July','PopFemale1July','PopDensity','SexRatio','MedianAgePop','PopGrowthRate','TFR','LEx','LExMale','LExFemale','IMR','NatChangeRT','CBR','CDR','CNMR','SRB','MACB']
 with f.open('w',newline='') as h:
  w=csv.DictWriter(h,fieldnames=fields);w.writeheader()
  w.writerow(dict(ISO3_code='FRA',Location='France',Year=2023,TPopulation1July=68000,PopMale1July=33000,PopFemale1July=35000,PopDensity=120,SexRatio=94.3,MedianAgePop=42,PopGrowthRate=.2,TFR=1.7,LEx=82,LExMale=79,LExFemale=85,IMR=3.4,NatChangeRT=1.1,CBR=10.6,CDR=9.5,CNMR=1.2,SRB=105.1,MACB=31.2))
  w.writerow(dict(ISO3_code='DEU',Location='Germany',Year=2024,TPopulation1July=84000))
 imp=m.Importer(None,str(f),True)
 assert len(imp.rows)==1
 assert len(imp.discover())==19
 cs={c.rule.key:c for c in imp.discover()}
 assert 'highest-pop-density' not in cs and 'lowest-infant-mortality' not in cs
 assert cs['highest-median-age'].rule.title=='Highest median age'
 assert cs['lowest-median-age'].rule.title=='Lowest median age'
 assert cs['highest-natural-change-rate'].rule.value_type=='rate'
 assert cs['highest-male-life-expectancy'].rule.value_type=='other'
 assert len(imp.fetch_observations(cs['highest-male-share']))==1
 assert round(imp.fetch_observations(cs['female-life-expectancy-advantage'])[0].value,1)==6
 assert imp.fetch_observations(cs['highest-birth-rate'])[0].value==10.6
 assert imp.fetch_observations(cs['lowest-death-rate'])[0].value==9.5
 assert imp.fetch_observations(cs['highest-sex-ratio-at-birth'])[0].value==105.1
 assert imp.fetch_observations(cs['highest-mean-age-childbearing'])[0].value==31.2
 assert imp.fetch_observations(cs['highest-male-life-expectancy'])[0].value==79
 assert imp.fetch_observations(cs['highest-female-life-expectancy'])[0].value==85
print('UN WPP importer fixtures passed.')
