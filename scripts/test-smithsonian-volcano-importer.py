#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
from pathlib import Path
from data_pipeline.canonical_countries import CANONICAL_COUNTRY_NAMES


def load_module():
    path = Path(__file__).with_name('import-smithsonian-volcanoes.py')
    spec = importlib.util.spec_from_file_location('gvp_importer', path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    module = load_module()
    importer = module.SmithsonianVolcanoImporter(None, dry_run=True)
    features = []
    for index, (_, name) in enumerate(list(CANONICAL_COUNTRY_NAMES.items())[:60]):
        features.append({'id': f'v{index}', 'properties': {'Country': name, 'Elevation': 1000 + index, 'Volcano Name': f'Volcano {index}'}})
        if index % 3 == 0:
            features.append({'id': f'v{index}b', 'properties': {'Country': name, 'Elevation': 800 + index, 'Volcano Name': f'Volcano {index} B'}})
    importer._features = features
    metrics = importer._country_metrics()
    assert len(metrics) == 60
    candidates = importer.discover()
    count_candidate = next(item for item in candidates if item.rule.key == 'most-holocene-volcanoes')
    height_candidate = next(item for item in candidates if item.rule.key == 'highest-volcano')
    assert len(importer.fetch_observations(count_candidate)) == 60
    heights = importer.fetch_observations(height_candidate)
    assert len(heights) == 60
    assert max(item.value for item in heights) == 1059
    print('Smithsonian volcano importer fixtures passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
