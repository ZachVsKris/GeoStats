#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

MODULE = Path(__file__).with_name("import-comtrade.py")
spec = importlib.util.spec_from_file_location("import_comtrade", MODULE)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


def test_rows_and_numbers() -> None:
    assert module._rows({"data": [{"x": 1}]}) == [{"x": 1}]
    assert module._rows({"results": [{"x": 2}]}) == [{"x": 2}]
    assert module._number("1,234.5") == 1234.5
    assert module._number("not available") is None
    assert module._api_error({"error": "bad request"}) == "bad request"


def test_url_modes() -> None:
    importer = module.ComtradeImporter(None, dry_run=True)
    importer.subscription_key = ""
    try:
        importer._url("0901", 2024)
    except RuntimeError as error:
        assert "COMTRADE_API_KEY" in str(error)
    else:
        raise AssertionError("Global Comtrade import must require a subscription key")

    importer.subscription_key = "secret"
    url = importer._url("0901", 2024)
    query = parse_qs(urlparse(url).query, keep_blank_values=True)
    assert "/data/v1/get/" in url
    assert query["reporterCode"] == [""]
    assert query["maxRecords"] == ["250000"]
    assert query["subscription-key"] == ["secret"]
    assert query["breakdownMode"] == ["classic"]
    assert "partner2Code" not in query and "customsCode" not in query and "motCode" not in query


def test_catalog_is_curated() -> None:
    importer = module.ComtradeImporter(None, dry_run=True)
    importer.subscription_key = "secret"
    candidates = importer.discover()
    keys = {candidate.rule.key for candidate in candidates}
    assert "most-coffee-exported" in keys
    assert "most-cars-exported" in keys
    clothing = next(candidate for candidate in candidates if candidate.rule.key == "most-clothing-exported")
    assert clothing.metadata["commodity_codes"] == ["61", "62"]
    assert len(candidates) >= 12


if __name__ == "__main__":
    test_rows_and_numbers()
    test_url_modes()
    test_catalog_is_curated()
    print("UN Comtrade importer tests passed.")
