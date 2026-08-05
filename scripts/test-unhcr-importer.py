#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

MODULE = Path(__file__).with_name("import-unhcr.py")
spec = importlib.util.spec_from_file_location("import_unhcr", MODULE)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


def test_page_parser() -> None:
    rows, pages, current = module._page({"items": [{"year": 2024}], "maxPages": 3, "page": 1})
    assert rows == [{"year": 2024}]
    assert pages == 3 and current == 1
    rows, pages, current = module._page({"data": [{"year": 2023}]})
    assert rows[0]["year"] == 2023 and pages is None


def test_country_and_number_parsing() -> None:
    iso3, name = module._country({"coa_iso": "UGA", "coa_name": "Uganda"}, "coa")
    assert iso3 == "UGA" and name == "Uganda"
    iso3, name = module._country({"coo": "SYR", "coo_name": "Syrian Arab Republic"}, "coo")
    assert iso3 == "SYR"
    assert module._number("1,234") == 1234
    assert module._number("*") is None


def test_rule_catalog() -> None:
    importer = module.UnhcrImporter(None, dry_run=True)
    candidates = importer.discover()
    keys = {candidate.rule.key for candidate in candidates}
    assert "most-refugees-hosted" in keys
    assert "most-internally-displaced-people" in keys
    assert "most-asylum-applications-received" in keys
    hosted = next(candidate for candidate in candidates if candidate.rule.key == "most-refugees-hosted")
    assert hosted.metadata["dimension"] == "coa"
    assert len(candidates) >= 10


if __name__ == "__main__":
    test_page_parser()
    test_country_and_number_parsing()
    test_rule_catalog()
    print("UNHCR importer tests passed.")
