#!/usr/bin/env python3
import importlib.util
from pathlib import Path
from data_pipeline.canonical_countries import CANONICAL_COUNTRY_NAMES

def load():
 p=Path(__file__).with_name('import-tourism-migration.py');s=importlib.util.spec_from_file_location('tm',p);assert s and s.loader;m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

def main():
 m=load();payloads={}
 for code in ['ST.INT.ARVL','SP.POP.TOTL','ST.INT.RCPT.CD','ST.INT.RCPT.XP.ZS','SM.POP.TOTL','SM.POP.TOTL.ZS']:
  payloads[code]=[]
  for i,(iso3,name) in enumerate(list(CANONICAL_COUNTRY_NAMES.items())[:120]):
   value=1_000_000+i*100 if code!='SP.POP.TOTL' else 5_000_000+i*1000
   payloads[code].append({'countryiso3code':iso3,'country':{'value':name},'date':'2023','value':value})
 imp=m.TourismMigrationImporter(None,dry_run=True,payloads=payloads);c=imp.discover();assert len(c)==6,len(c)
 assert all(len(imp.fetch_observations(x))==120 for x in c)
 per=next(x for x in c if x.rule.key=='tourist-arrivals-per-resident');assert per.metadata['strategyFamily']=='tourism-arrivals'
 print('Tourism and migration 6-category fixtures passed.');return 0
if __name__=='__main__':raise SystemExit(main())
