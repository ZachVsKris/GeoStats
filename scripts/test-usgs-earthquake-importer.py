#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
from pathlib import Path
from shapely.geometry import Polygon
from shapely.strtree import STRtree


def load_module():
    path = Path(__file__).with_name('import-usgs-earthquakes.py')
    spec = importlib.util.spec_from_file_location('usgs_importer', path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    module = load_module()
    locator = object.__new__(module.CountryLocator)
    locator.geometries = [Polygon([(0, 0), (2, 0), (2, 2), (0, 2)]), Polygon([(3, 0), (5, 0), (5, 2), (3, 2)])]
    locator.iso_by_index = ['AAA', 'BBB']
    locator.tree = STRtree(locator.geometries)
    assert locator.country_for(1, 1) == 'AAA'
    assert locator.country_for(4, 1) == 'BBB'
    assert locator.country_for(10, 10) is None
    importer = module.UsgsEarthquakeImporter(None, dry_run=True)
    importer._metrics = {
        'AAA': {'count': 4, 'max_magnitude': 7.2, 'event_id': 'a'},
        'BBB': {'count': 2, 'max_magnitude': 6.8, 'event_id': 'b'},
    }
    candidates = importer.discover()
    count_candidate = next(item for item in candidates if item.rule.key == 'most-major-earthquakes')
    magnitude_candidate = next(item for item in candidates if item.rule.key == 'strongest-earthquake')
    assert [item.value for item in importer.fetch_observations(count_candidate)] == [4.0, 2.0]
    assert [item.value for item in importer.fetch_observations(magnitude_candidate)] == [7.2, 6.8]
    print('USGS earthquake importer fixtures passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
