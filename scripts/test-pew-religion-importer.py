#!/usr/bin/env python3
from __future__ import annotations
import importlib.util, tempfile
from pathlib import Path
from openpyxl import Workbook
from data_pipeline.canonical_countries import CANONICAL_COUNTRY_NAMES

def load_module():
    path=Path(__file__).with_name("import-pew-religion.py")
    spec=importlib.util.spec_from_file_location("pew_importer",path)
    assert spec and spec.loader
    module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module

def make_book(path:Path, *, include_diversity:bool):
    wb=Workbook(); ws=wb.active
    headers=["Country","Year"]
    labels=["Christian","Muslim","Hindu","Buddhist","Jewish","Other religions","Unaffiliated"]
    for label in labels: headers += [f"{label} population 2020",f"{label} share 2020"]
    if include_diversity: headers += ["Religious diversity index 2020"]
    ws.append(headers)
    for i,(_,name) in enumerate(list(CANONICAL_COUNTRY_NAMES.items())[:120]):
        shares=[40,25,12,8,5,4,6]
        row=[name,2020]
        for j,_ in enumerate(labels): row += [1_000_000+i*1000+j,shares[j]]
        if include_diversity: row += [6.7]
        ws.append(row)
    wb.save(path)

def make_split_book(path:Path):
    wb=Workbook(); pop=wb.active; pop.title="Population totals"; share=wb.create_sheet("Population shares")
    labels=["Christian","Muslim","Hindu","Buddhist","Jewish","Other religions","Unaffiliated"]
    pop.append(["Country","Year"]+[f"{label} population 2020" for label in labels])
    share.append(["Country","Year"]+[f"{label} share 2020" for label in labels])
    for i,(_,name) in enumerate(list(CANONICAL_COUNTRY_NAMES.items())[:120]):
        pop.append([name,2020]+[1_000_000+i*1000+j for j,_ in enumerate(labels)])
        share.append([name,2020,40,25,12,8,5,4,6])
    wb.save(path)

def check(m,path:Path, *, expected_diversity:float):
    importer=m.PewReligionImporter(None,input_path=str(path),dry_run=True)
    candidates=importer.discover(); assert len(candidates)==15, len(candidates)
    keys={c.rule.key for c in candidates}
    assert {"jewish-share","jewish-population","other-religions-share","christian-population","religious-diversity"} <= keys
    for c in candidates: assert len(importer.fetch_observations(c))==120
    christian=next(c for c in candidates if c.rule.key=="christian-share")
    total=next(c for c in candidates if c.rule.key=="christian-population")
    assert christian.metadata["strategyFamily"]==total.metadata["strategyFamily"]=="religion-christian"
    diversity=next(c for c in candidates if c.rule.key=="religious-diversity")
    observed=importer.fetch_observations(diversity)[0].value
    assert abs(observed-expected_diversity)<0.01,(observed,expected_diversity)

def main():
    m=load_module()
    with tempfile.TemporaryDirectory() as d:
        current=Path(d)/"pew-current.xlsx"; make_book(current,include_diversity=True); check(m,current,expected_diversity=6.7)
        legacy=Path(d)/"pew-legacy.xlsx"; make_book(legacy,include_diversity=False)
        expected=(1-sum((v/100)**2 for v in [40,25,12,8,5,4,6]))*11.6
        check(m,legacy,expected_diversity=expected)
        split=Path(d)/"pew-split.xlsx"; make_split_book(split); check(m,split,expected_diversity=expected)
    print("Pew religion 15-category importer fixtures passed, including RDI derivation fallback."); return 0
if __name__=="__main__": raise SystemExit(main())
