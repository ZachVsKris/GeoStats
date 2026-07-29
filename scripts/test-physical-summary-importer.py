#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
import tempfile
from pathlib import Path
from data_pipeline.canonical_countries import CANONICAL_COUNTRY_NAMES


def load_module():
    path = Path(__file__).with_name('import-physical-summaries.py')
    spec = importlib.util.spec_from_file_location('physical_importer', path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["physical_importer"] = module
    spec.loader.exec_module(module)
    return module


def main() -> int:
    module = load_module()
    headers = ['source','metric','country_iso3','data_year','value','unit','dataset_release','source_url','methodology_url','derivation_method','boundary_dataset','derivation_version','exact_query_url','download_url','api_url','license_name','license_url']
    rows = [','.join(headers)]
    for index, (iso3, _) in enumerate(list(CANONICAL_COUNTRY_NAMES.items())[:60]):
        rows.append(','.join(['worldcover','grassland-share',iso3,'2021',str(10 + index / 10),'% of land','WorldCover 2021','https://example.org/data','https://example.org/method','zonal area summary','Natural Earth 1:10m','v1','','','','CC BY 4.0','https://example.org/license']))
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'summary.csv'
        path.write_text('\n'.join(rows), encoding='utf-8')
        importer = module.PhysicalSummaryImporter(None, source='worldcover', input_value=str(path), dry_run=True)
        candidates = importer.discover()
        assert len(candidates) == 1
        observations = importer.fetch_observations(candidates[0])
        assert len(observations) == 60
        assert candidates[0].metadata['knowledgeCluster'] == 'land-cover'
    print('Physical-summary importer fixtures passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
