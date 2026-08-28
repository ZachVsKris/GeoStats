import csv
import importlib.util
import tempfile
import sys
from io import BytesIO
from pathlib import Path
from openpyxl import Workbook

p=Path(__file__).with_name('import-un-wpp.py')
spec=importlib.util.spec_from_file_location('unwpp',p)
m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)

# UN WPP moved the official compact workbook under /wpp/assets/Excel Files/.
# Keep this pinned so CI catches a regression back to the retired 404 /Download/Files path.
assert '/wpp/assets/Excel%20Files/' in m.DOWNLOAD
assert '/wpp/Download/Files/' not in m.DOWNLOAD
assert m.DOWNLOAD.endswith('WPP2024_GEN_F01_DEMOGRAPHIC_INDICATORS_COMPACT.xlsx')

# Mirror the structure of UN's published compact workbook: an Estimates sheet,
# metadata rows before the header, and human-readable WPP column labels.
wb=Workbook()
ws=wb.active
ws.title='Estimates'
for i in range(1,17):
 ws.cell(i,5,f'WPP metadata row {i}')
real_headers=[
 'Index','Variant','Region, subregion, country or area *','Notes','Location code','ISO3 Alpha-code','Year',
 'Total Population, as of 1 July (thousands)','Male Population, as of 1 July (thousands)',
 'Female Population, as of 1 July (thousands)','Population Density, as of 1 July (persons per square km)',
 'Population Sex Ratio, as of 1 July (males per 100 females)','Median Age, as of 1 July (years)',
 'Population Growth Rate (percentage)','Total Fertility Rate (live births per woman)',
 'Life Expectancy at Birth, both sexes (years)','Male Life Expectancy at Birth (years)',
 'Female Life Expectancy at Birth (years)','Infant Mortality Rate (infant deaths per 1,000 live births)',
 'Rate of Natural Change (per 1,000 population)','Crude Birth Rate (births per 1,000 population)',
 'Crude Death Rate (deaths per 1,000 population)','Net Migration Rate (per 1,000 population)',
 'Sex Ratio at Birth (males per 100 female births)','Mean Age Childbearing (years)'
]
ws.append(real_headers)
ws.append([1,'Estimates','France','',250,'FRA',2023,68000,33000,35000,120,94.3,42,.2,1.7,82,79,85,3.4,1.1,10.6,9.5,1.2,105.1,31.2])
# Region aggregates have no ISO3. This row deliberately uses the display name
# 'Micronesia' to prove it cannot be mis-mapped to FSM and duplicate the country row.
ws.append([2,'Estimates','Micronesia','',954,'',2023,5000,2500,2500,50,100,25,1.0,2.5,75,72,78,15,10,20,10,0,105,27])
ws.append([3,'Estimates','Micronesia (Fed. States of)','',583,'FSM',2023,115,58,57,160,101.8,25,.7,2.7,71,68,74,20,13,24,11,-2,105,27])
ws.append([4,'Estimates','Germany','',276,'DEU',2024,84000])
xlsx=BytesIO(); wb.save(xlsx); wb.close()
real_rows=m.load.__globals__['_xlsx_rows'](xlsx.getvalue())
real_rows=list(real_rows)
assert len(real_rows)==4
assert real_rows[0]['ISO3 Alpha-code']=='FRA'
with tempfile.TemporaryDirectory() as d:
 xf=Path(d)/'wpp.xlsx'; xf.write_bytes(xlsx.getvalue())
 parsed=m.load(str(xf))
 assert [iso for iso,_ in parsed]==['FRA','FSM']
 assert len({iso for iso,_ in parsed})==2
 metrics=parsed[0][1]
 assert round(metrics['male-share'],1)==48.5
 assert metrics['median-age']==42
 assert metrics['population-density']==120
 assert metrics['fertility']==1.7
 assert metrics['life-expectancy']==82
 assert metrics['natural-change-rate']==1.1
 assert metrics['birth-rate']==10.6
 assert metrics['death-rate']==9.5
 assert metrics['net-migration-rate']==1.2
 assert metrics['sex-ratio-at-birth']==105.1
 assert metrics['mean-age-childbearing']==31.2

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
 assert all(c.metadata['measurementType'] in {'total','share','per_capita','other'} for c in cs.values())
 assert cs['highest-male-share'].metadata['measurementType']=='share'
 assert cs['highest-natural-change-rate'].metadata['measurementType']=='other'
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
