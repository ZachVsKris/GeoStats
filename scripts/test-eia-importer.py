#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

MODULE = Path(__file__).with_name("import-eia.py")
spec = importlib.util.spec_from_file_location("import_eia", MODULE)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


def test_facet_parsing() -> None:
    payload = {"response": {"facets": [{"id": "57", "name": "Crude oil including lease condensate"}]}}
    assert module._facet_entries(payload) == [{"id": "57", "name": "Crude oil including lease condensate"}]
    data, total = module._data_rows({"response": {"total": "1", "data": [{"period": "2024"}]}})
    assert total == 1 and data[0]["period"] == "2024"
    assert module._api_error({"error": "invalid key"}) == "invalid key"


def test_resolution_prefers_specific_product() -> None:
    entries = [
        {"id": "1", "name": "Crude oil price"},
        {"id": "2", "name": "Crude oil including lease condensate"},
    ]
    chosen = module._best(entries, (r"crude oil",), (r"including lease condensate",), (r"price",))
    assert chosen and chosen["id"] == "2"


def test_api_key_requirement_and_url() -> None:
    importer = module.EiaImporter(None, dry_run=True)
    importer.api_key = ""
    try:
        importer._require_key()
    except RuntimeError as error:
        assert "EIA_API_KEY" in str(error)
    else:
        raise AssertionError("Missing EIA key should fail clearly")

    importer.api_key = "abc"
    candidate = module.CandidateDefinition(
        rule=module.SPECS[0].rule,
        source_indicator_code="57:1",
        source_indicator_name="Oil production",
        source_url=module.EIA_BROWSER,
        metadata={"product_id": "57", "activity_id": "1", "accepted_unit_patterns": ["barrels"]},
    )
    url = importer._data_url(candidate, offset=0, length=5000)
    assert "api_key=abc" in url
    assert "facets%5BproductId%5D%5B%5D=57" in url
    assert "data%5B%5D=value" in url


def test_empty_facet_falls_back_to_recent_data_catalog() -> None:
    importer = module.EiaImporter(None, dry_run=True)
    importer.api_key = "abc"

    class FakeHttp:
        def get_json(self, url):
            if "/facet/" in url:
                return {"response": {"totalFacets": "0", "facets": []}}
            return {
                "response": {
                    "total": "2",
                    "data": [
                        {
                            "productId": "57",
                            "productName": "Crude oil including lease condensate",
                            "activityId": "1",
                            "activityName": "Production",
                        },
                        {
                            "productId": "4413",
                            "productName": "Renewable electricity",
                            "activityId": "2",
                            "activityName": "Consumption",
                        },
                    ],
                }
            }

    importer.http = FakeHttp()
    products = importer._facet("productId")
    activities = importer._facet("activityId")
    assert {row["id"] for row in products} == {"57", "4413"}
    assert {row["id"] for row in activities} == {"1", "2"}


def test_one_unit_is_selected_for_entire_category() -> None:
    importer = module.EiaImporter(None, dry_run=True)
    importer.api_key = "abc"
    countries = [
        "AFG", "ALB", "DZA", "AND", "AGO", "ATG", "ARG", "ARM", "AUS", "AUT",
        "AZE", "BHS", "BHR", "BGD", "BRB", "BLR", "BEL", "BLZ", "BEN", "BTN",
    ]
    rows = []
    for index, country in enumerate(countries, start=1):
        rows.append({
            "countryRegionId": country,
            "countryRegionName": country,
            "period": "2024",
            "value": index,
            "unit": "thousand barrels per day",
        })
        rows.append({
            "countryRegionId": country,
            "countryRegionName": country,
            "period": "2024",
            "value": index * 10,
            "unit": "quadrillion Btu",
        })

    class FakeHttp:
        def get_json(self, _url):
            return {"response": {"total": len(rows), "data": rows}}

    importer.http = FakeHttp()
    candidate = module.CandidateDefinition(
        rule=module.SPECS[0].rule,
        source_indicator_code="57:1",
        source_indicator_name="Oil production",
        source_url=module.EIA_BROWSER,
        metadata={
            "product_id": "57",
            "activity_id": "1",
            "accepted_unit_patterns": [r"thousand barrels per day", r"quadrillion btu"],
        },
    )
    observations = importer.fetch_observations(candidate)
    assert len(observations) == len(countries)
    assert candidate.metadata["selected_unit"] == "thousand barrels per day"
    assert all(row.metadata["unit"] == "thousand barrels per day" for row in observations)


def test_rule_catalog() -> None:
    keys = {spec.rule.key for spec in module.SPECS}
    assert "most-crude-oil-produced" in keys
    assert "most-renewable-electricity-generated" in keys
    assert "most-electricity-exported" in keys
    assert len(keys) >= 12


if __name__ == "__main__":
    test_facet_parsing()
    test_resolution_prefers_specific_product()
    test_api_key_requirement_and_url()
    test_empty_facet_falls_back_to_recent_data_catalog()
    test_one_unit_is_selected_for_entire_category()
    test_rule_catalog()
    print("EIA importer tests passed.")
