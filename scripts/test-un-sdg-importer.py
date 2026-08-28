#!/usr/bin/env python3
import importlib.util
import sys
from pathlib import Path

path = Path(__file__).with_name("import-un-sdg.py")
spec = importlib.util.spec_from_file_location("import_un_sdg", path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

assert len(module.SPECS) >= 28
assert len(module.BY_KEY) == len(module.SPECS)
assert module.m49_to_iso3("840") == "USA"
assert module.m49_to_iso3(4) == "AFG"
assert module.m49_to_iso3("999") is None

literacy = module.BY_KEY["youth-literacy"]
definitions = {"Age": {"15-24", "15-99"}, "Sex": {"MALE", "FEMALE", "BOTHSEX"}, "Reporting Type": {"N", "G"}, "Type of skill": {"LITE"}}
assert module.accepts_dimensions(literacy, {"Age": "15-24", "Sex": "BOTHSEX", "Reporting Type": "G", "Type of skill": "LITE"}, definitions)
assert not module.accepts_dimensions(literacy, {"Age": "15-99", "Sex": "BOTHSEX", "Reporting Type": "G", "Type of skill": "LITE"}, definitions)
assert not module.accepts_dimensions(literacy, {"Age": "15-24", "Sex": "FEMALE", "Reporting Type": "G", "Type of skill": "LITE"}, definitions)
assert not module.accepts_dimensions(literacy, {"Age": "15-24", "Sex": "BOTHSEX", "Reporting Type": "N", "Type of skill": "LITE"}, definitions)

school = module.BY_KEY["primary-school-electricity"]
assert module.accepts_dimensions(school, {"Education level": "PRIMAR", "Reporting Type": "G"}, {"Education level": {"PRIMAR", "SECOND"}, "Reporting Type": {"N", "G"}})
assert not module.accepts_dimensions(school, {"Education level": "SECOND", "Reporting Type": "G"}, {"Education level": {"PRIMAR", "SECOND"}, "Reporting Type": {"N", "G"}})

unemployment = module.BY_KEY["highest-unemployment"]
labor_definitions = {"Age": {"15+", "15-24", "25+"}, "Sex": {"MALE", "FEMALE", "BOTHSEX"}, "Reporting Type": {"N", "G"}}
assert module.accepts_dimensions(unemployment, {"Age": "15+", "Sex": "BOTHSEX", "Reporting Type": "G"}, labor_definitions)
assert not module.accepts_dimensions(unemployment, {"Age": "25+", "Sex": "BOTHSEX", "Reporting Type": "G"}, labor_definitions)

manufacturing = module.BY_KEY["manufacturing-employment"]
manufacturing_definitions = {"Activity": {"ISIC3_D", "ISIC4_C"}, "Sex": {"MALE", "FEMALE", "BOTHSEX"}, "Reporting Type": {"N", "G"}}
assert module.accepts_dimensions(manufacturing, {"Activity": "ISIC4_C", "Sex": "BOTHSEX", "Reporting Type": "G"}, manufacturing_definitions)
assert not module.accepts_dimensions(manufacturing, {"Activity": "ISIC3_D", "Sex": "BOTHSEX", "Reporting Type": "G"}, manufacturing_definitions)

pm25 = module.BY_KEY["pm25-exposure"]
location_definitions = {"Location": {"ALLAREA", "CITY", "RURAL", "URBAN"}, "Reporting Type": {"N", "G"}}
assert pm25.unit_code == "mgr/m^3"
assert module.accepts_dimensions(pm25, {"Location": "ALLAREA", "Reporting Type": "G"}, location_definitions)
assert not module.accepts_dimensions(pm25, {"Location": "CITY", "Reporting Type": "G"}, location_definitions)


class PagedHttpFixture:
    def __init__(self):
        self.urls = []

    def get_json(self, url):
        self.urls.append(url)
        if "page=1&" in url:
            return {"data": [{"row": 1}, {"row": 2}], "totalElements": 3, "totalPages": 2, "pageNumber": 1}
        if "page=2&" in url:
            return {"data": [{"row": 3}], "totalElements": 3, "totalPages": 2, "pageNumber": 2}
        raise AssertionError(url)


importer = module.Importer(None, dry_run=True)
importer.http = PagedHttpFixture()
paged = importer._payload("TEST")
assert paged["data"] == [{"row": 1}, {"row": 2}, {"row": 3}]
assert len(importer.http.urls) == 2

print("UN SDG bulk importer fixtures passed.")
