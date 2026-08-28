import importlib.util
import tempfile
import sys
from pathlib import Path

p=Path(__file__).with_name('import-imf-weo.py')
spec=importlib.util.spec_from_file_location('imfweo',p)
m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)

with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'weo.xls'
 rows=[
  ('Gross domestic product per capita, current prices','U.S. dollars','45000'),
  ('Gross domestic product per capita, current prices','Purchasing power parity; international dollars','61000'),
  ('Gross domestic product, constant prices','Percent change','2.1'),
  ('Inflation, average consumer prices','Percent change','1.9'),
  ('Inflation, end of period consumer prices','Percent change','2.0'),
  ('General government gross debt','Percent of GDP','110'),
  ('General government net lending/borrowing','Percent of GDP','-4.2'),
  ('General government revenue','Percent of GDP','52'),
  ('General government total expenditure','Percent of GDP','56'),
  ('Current account balance','Percent of GDP','1.1'),
  ('Gross national savings','Percent of GDP','24'),
  ('Total investment','Percent of GDP','23'),
  ('Volume of exports of goods and services','Percent change','3.4'),
  ('Volume of imports of goods and services','Percent change','2.8'),
  # Same subject but wrong units must not leak into government-debt.
  ('General government gross debt','National currency','999'),
 ]
 with f.open('w') as h:
  h.write('WEO Country Code\tISO\tCountry\tSubject Descriptor\tUnits\t2024\t2025\n')
  for subject,units,value in rows:
   h.write(f'1\tFRA\tFrance\t{subject}\t{units}\t{value}\t0\n')
 imp=m.Importer(None,str(f),True)
 assert len(imp.discover())==14
 assert len(imp.rows)==14
 cs={c.rule.key:c for c in imp.discover()}
 assert all(c.metadata['source_query']['year']==2024 for c in imp.discover())
 assert cs['gdp-per-person'].metadata['measurementType']=='per_capita'
 assert cs['real-gdp-growth'].metadata['measurementType']=='rate'
 assert cs['government-debt'].rule.value_type=='percentage'
 assert imp.fetch_observations(cs['ppp-gdp-per-person'])[0].value==61000
 assert imp.fetch_observations(cs['government-balance'])[0].value==-4.2
 assert len(imp.fetch_observations(cs['government-debt']))==1
print('IMF WEO importer fixtures passed.')
