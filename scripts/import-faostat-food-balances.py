#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name, country_name_to_iso3
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

CATALOG_URL="https://bulks-faostat.fao.org/production/datasets_E.json"
FALLBACK_URL="https://bulks-faostat.fao.org/production/FoodBalanceSheets_E_All_Data_(Normalized).zip"
SOURCE_PAGE="https://www.fao.org/faostat/en/#data/FBS"
METHODOLOGY_URL="https://www.fao.org/faostat/en/#definitions"


def norm(value: Any)->str:
    return re.sub(r"[^a-z0-9]+"," ",str(value or "").lower()).strip()

# key, title, icon, item aliases, element type, optional component aliases
SPECS = [
 ("beer","Most beer available per person","🍺",("beer",),"kg",None),
 ("wine","Most wine available per person","🍷",("wine",),"kg",None),
 ("milk","Most milk available per person","🥛",("milk excluding butter",),"kg",None),
 ("cheese","Most cheese available per person","🧀",("cheese",),"kg",None),
 ("eggs","Most eggs available per person","🥚",("eggs",),"kg",None),
 ("beef","Most beef available per person","🥩",("bovine meat",),"kg",None),
 ("pork","Most pork available per person","🥓",("pigmeat",),"kg",None),
 ("poultry","Most poultry available per person","🍗",("poultry meat",),"kg",None),
 ("fish","Most fish available per person","🐟",("fish seafood",),"kg",None),
 ("rice","Most rice available per person","🍚",("rice and products",),"kg",None),
 ("potatoes","Most potatoes available per person","🥔",("potatoes and products",),"kg",None),
 ("sugar","Most sugar available per person","🍬",("sugar sweeteners",),"kg",None),
 ("vegetable-oil","Most vegetable oil available per person","🫒",("vegetable oils",),"kg",None),
 ("coffee","Most coffee available per person","☕",("coffee and products",),"kg",None),
 ("tea","Most tea available per person","🍵",("tea including mate",),"kg",None),
 ("wheat-products","Most wheat products available per person","🍞",("wheat and products",),"kg",None),
 ("maize","Most maize available per person","🌽",("maize and products",),"kg",None),
 ("bananas","Most bananas available per person","🍌",("bananas",),"kg",None),
 ("tomatoes","Most tomatoes available per person","🍅",("tomatoes and products",),"kg",None),
 ("onions","Most onions available per person","🧅",("onions",),"kg",None),
 ("fruit","Most fruit available per person","🍎",("fruits excluding wine",),"kg",None),
 ("vegetables","Most vegetables available per person","🥕",("vegetables",),"kg",None),
 ("meat","Most meat available per person","🍖",("meat",),"kg",None),
 ("dairy-products","Most dairy products available per person","🧀",(),"kg",(("milk excluding butter",),("butter ghee",))),
 ("pulses","Most pulses available per person","🫘",("pulses",),"kg",None),
 ("calories","Most calories available per person","⚡",("grand total",),"kcal",None),
 ("protein","Most protein available per person","💪",("grand total",),"protein",None),
]

ELEMENT_MATCH={
 "kg":("food supply quantity kg capita yr","food supply quantity kg cap yr"),
 "kcal":("food supply kcal capita day",),
 "protein":("protein supply quantity g capita day",),
}


def make_rule(key,title,icon,kind):
    if kind=="kg": unit="kg per person per year"; value_type="per_capita"; description=f"FAOSTAT food supply available for consumption, measured in kilograms per person per year."
    elif kind=="kcal": unit="kcal per person per day"; value_type="per_capita"; description="FAOSTAT dietary energy supply available for consumption per person per day."
    else: unit="grams per person per day"; value_type="per_capita"; description="FAOSTAT protein supply available for consumption per person per day."
    return IndicatorRule(key=key,title=title,description=description,plain_language_description=description,
      technical_definition="Food Balance Sheet apparent consumption: national food supply available for human consumption, not direct dietary-survey intake.",
      unit_explanation=unit,family="Food consumption",icon=icon,unit=unit,value_type=value_type,ranking_direction="high",
      include=(key,),min_coverage=100,evidence_tier="B",source_priority=17,specificity_score=96,recognizability_score=98,
      understandability_score=97,fun_score=96,objective_status="objective",modeled_hint=.4)

RULE_BY_KEY={key:make_rule(key,title,icon,kind) for key,title,icon,_aliases,kind,_components in SPECS}


def _catalog_download(http:HttpClient)->tuple[str,str]:
    try:
        payload=http.get_json(CATALOG_URL)
        records=payload if isinstance(payload,list) else payload.get("Datasets") or payload.get("data") or []
        for row in records:
            if str(row.get("Dataset Code") or row.get("DatasetCode") or row.get("Code") or row.get("code") or "").upper()=="FBS":
                url=row.get("File Location") or row.get("FileLocation") or row.get("Download URL") or row.get("url")
                if url: return str(url),str(row.get("Release Date") or row.get("DateUpdate") or "FAOSTAT FBS current release")
    except Exception as error:
        print(f"FAOSTAT catalog warning: {error}; using stable official FBS URL.",flush=True)
    return FALLBACK_URL,"FAOSTAT Food Balances current bulk release"


def _input_bytes(path_or_url:str|None,http:HttpClient)->tuple[bytes,str,str]:
    if path_or_url and Path(path_or_url).exists(): return Path(path_or_url).read_bytes(),str(path_or_url),"fixture"
    url,release=_catalog_download(http)
    return http.get_bytes(path_or_url or url,accept="application/zip,text/csv,*/*"),path_or_url or url,release


def _rows_from_bytes(raw:bytes):
    """Yield normalized rows without materializing the entire bulk CSV."""
    if raw[:2]==b"PK":
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            names=[n for n in archive.namelist() if n.lower().endswith('.csv') and 'normalized' in n.lower()]
            if not names: names=[n for n in archive.namelist() if n.lower().endswith('.csv')]
            if not names: raise RuntimeError('FAOSTAT FBS archive contains no CSV.')
            selected=max(names,key=lambda n:archive.getinfo(n).file_size)
            with archive.open(selected) as binary, io.TextIOWrapper(binary,encoding='utf-8-sig',errors='replace',newline='') as text:
                yield from csv.DictReader(text)
        return
    with io.StringIO(raw.decode('utf-8-sig',errors='replace')) as text:
        yield from csv.DictReader(text)


def _field(row:dict[str,str],*names:str)->str:
    normalized={norm(k):v for k,v in row.items()}
    for name in names:
        if norm(name) in normalized: return str(normalized[norm(name)] or '').strip()
    return ''


def _matches(value:str,aliases:tuple[str,...])->bool:
    n=norm(value)
    return any(n==norm(a) for a in aliases)


class FoodBalanceImporter(WarehouseImporter):
    source_organization="FAOSTAT Food Balances"
    source_dataset="Food Balances (2010-)"
    source_slug="faostatfbs"
    def __init__(self,warehouse,*,input_path=None,dry_run=False):
        super().__init__(warehouse,dry_run=dry_run); self.input_path=input_path; self.http=HttpClient(timeout=300,retries=5,user_agent='GeoStats/16.0 FBS importer'); self._parsed=None; self.download_url=None; self.release=None
    def parsed(self):
        if self._parsed is not None:return self._parsed
        raw,url,release=_input_bytes(self.input_path,self.http); self.download_url=url; self.release=release
        values=defaultdict(dict)
        for row in _rows_from_bytes(raw):
            item=_field(row,'Item'); element=_field(row,'Element'); kind=None
            ne=norm(element)
            for candidate,aliases in ELEMENT_MATCH.items():
                if any(norm(alias)==ne for alias in aliases): kind=candidate; break
            if not kind: continue
            country=_field(row,'Area','Country'); iso3=country_name_to_iso3(country)
            if not iso3: continue
            try: year=int(float(_field(row,'Year'))); value=float(_field(row,'Value').replace(',',''))
            except (ValueError,AttributeError): continue
            item_norm=norm(item); values[(iso3,year,kind,item_norm)]={"value":value,"country":canonical_country_name(iso3,country),"unit":_field(row,'Unit'),"flag":_field(row,'Flag')}
        self._parsed=values; return values
    def _series(self,key):
        spec=next(s for s in SPECS if s[0]==key); _k,_t,_i,aliases,kind,components=spec; values=self.parsed(); out={}
        for (iso3,year,row_kind,item),payload in values.items():
            if row_kind!=kind: continue
            if components is None:
                if not _matches(item,aliases): continue
                out[(iso3,year)]=payload
            else:
                for component in components:
                    if _matches(item,component):
                        prior=out.setdefault((iso3,year),{"value":0.0,"country":payload['country'],"unit":payload['unit'],"flag":"derived"})
                        prior['value']+=payload['value']
        return out
    def discover(self):
        result=[]
        for key,title,icon,aliases,kind,components in SPECS:
            if not self._series(key): continue
            item_label=' + '.join('/'.join(c) for c in components) if components else '/'.join(aliases)
            result.append(CandidateDefinition(RULE_BY_KEY[key],f"FBS:{key}",title,SOURCE_PAGE,{
              "source_page_url":SOURCE_PAGE,"download_url":self.download_url or FALLBACK_URL,"dataset_release":self.release,
              "minimum_year":2010,"methodology_url":METHODOLOGY_URL,"official_unit":RULE_BY_KEY[key].unit,
              "source_query":{"dataset":"FBS","item":item_label,"element":kind},"broadDomain":"culture",
              "knowledgeCluster":"food-consumption","strategyFamily":"food-consumption","manual_review_required":True,
              "apparentConsumption":True,
            }))
        return result
    def category_id(self,candidate):return f"faostat-fbs:{candidate.rule.key}"
    def fetch_observations(self,candidate):
        out=[]
        for (iso3,year),payload in self._series(candidate.rule.key).items():
            out.append(SourceObservation(iso3,payload['country'],year,float(payload['value']),self.download_url or FALLBACK_URL,
              f"FBS:{candidate.rule.key}:{iso3}:{year}","estimated" if str(payload.get('flag')).lower() not in {'','a'} else 'official',
              {"dataset":"FBS","apparent_consumption":True,"source_unit":payload.get('unit')}))
        return sorted(out,key=lambda x:(x.data_year,x.country_iso3))


def main():
    p=argparse.ArgumentParser(); p.add_argument('--input');p.add_argument('--dry-run',action='store_true');p.add_argument('--only',action='append',default=[]);a=p.parse_args()
    url=os.environ.get('SUPABASE_URL');key=os.environ.get('SUPABASE_SECRET_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not a.dry_run and (not url or not key):raise SystemExit('Set SUPABASE_URL and SUPABASE service-role secret.')
    warehouse=None if a.dry_run else SupabaseWarehouse(url or '',key or '')
    print(FoodBalanceImporter(warehouse,input_path=a.input,dry_run=a.dry_run).run(only_keys=set(a.only) or None));return 0
if __name__=='__main__':raise SystemExit(main())
