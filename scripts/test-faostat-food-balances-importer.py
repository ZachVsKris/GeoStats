#!/usr/bin/env python3
import csv, importlib.util, tempfile
from pathlib import Path
from data_pipeline.canonical_countries import CANONICAL_COUNTRY_NAMES

def load():
 p=Path(__file__).with_name('import-faostat-food-balances.py');s=importlib.util.spec_from_file_location('fbs',p);assert s and s.loader;m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

def main():
 m=load(); headers=['Area','Item','Element','Year','Unit','Value','Flag']; items=[]
 for key,title,icon,aliases,kind,components in m.SPECS:
  if components:
   for component in components: items.append((component[0],kind))
  else: items.append((aliases[0],kind))
 with tempfile.TemporaryDirectory() as d:
  p=Path(d)/'fbs.csv'
  with p.open('w',newline='',encoding='utf-8') as f:
   w=csv.writer(f);w.writerow(headers)
   for i,(_,country) in enumerate(list(CANONICAL_COUNTRY_NAMES.items())[:120]):
    for j,(item,kind) in enumerate(items):
     element={'kg':'Food supply quantity (kg/capita/yr)','kcal':'Food supply (kcal/capita/day)','protein':'Protein supply quantity (g/capita/day)'}[kind]
     w.writerow([country,item,element,2023,'kg/capita/yr',10+i+j,'A'])
  imp=m.FoodBalanceImporter(None,input_path=str(p),dry_run=True);c=imp.discover();assert len(c)==27,len(c)
  assert {x.rule.key for x in c}=={x[0] for x in m.SPECS}
  assert all(len(imp.fetch_observations(x))==120 for x in c)
  assert all(x.metadata['strategyFamily']=='food-consumption' for x in c)
 print('FAOSTAT Food Balances 27-category fixtures passed.');return 0
if __name__=='__main__':raise SystemExit(main())
