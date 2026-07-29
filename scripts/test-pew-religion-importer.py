#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path

from openpyxl import Workbook
from data_pipeline.canonical_countries import CANONICAL_COUNTRY_NAMES


def load_module():
    path = Path(__file__).with_name('import-pew-religion.py')
    spec = importlib.util.spec_from_file_location('pew_importer', path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    module = load_module()
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(['Country', 'Year', 'Christian share 2020', 'Muslim share 2020', 'Hindu share 2020', 'Buddhist share 2020', 'Unaffiliated share 2020', 'Religious diversity index 2020'])
    for index, (_, name) in enumerate(list(CANONICAL_COUNTRY_NAMES.items())[:120]):
        sheet.append([name, 2020, 50 + index % 20, 30 - index % 20, 5, 3, 12, 4.5 + (index % 10) / 10])
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'pew.xlsx'
        workbook.save(path)
        rows = module._load_rows(path)
        assert len(rows) == 120
        importer = module.PewReligionImporter(None, input_path=str(path), dry_run=True)
        candidates = importer.discover()
        assert {candidate.rule.key for candidate in candidates} == {
            'christian-share', 'muslim-share', 'hindu-share', 'buddhist-share', 'unaffiliated-share', 'religious-diversity'
        }
        christian = next(candidate for candidate in candidates if candidate.rule.key == 'christian-share')
        observations = importer.fetch_observations(christian)
        assert len(observations) == 120
        assert all(observation.data_year == 2020 for observation in observations)
        assert christian.metadata['knowledgeCluster'] == 'religious-composition'
    print('Pew religion importer fixtures passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
