#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


def load_module():
    path = Path(__file__).with_name('review-catalog-similarity-v15-5.py')
    spec = importlib.util.spec_from_file_location('similarity_review', path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["similarity_review"] = module
    spec.loader.exec_module(module)
    return module


def category(module, identifier, title, cluster, family, *, clarity=90, wonkiness=10, coverage=180):
    return module.Category(identifier, title, 'Source', 'daily', 'domain', cluster, family, clarity, wonkiness, coverage, 100, 0.02, 95, 2024)


def main() -> int:
    module = load_module()
    refugees = category(module, 'a', 'Most refugees living abroad', 'forced-displacement', 'origin-displacement')
    asylum = category(module, 'b', 'Most asylum applications by origin', 'forced-displacement', 'origin-displacement', clarity=80)
    decision, _ = module.recommendation(refugees, asylum, 0.95, 0.8, 0.75, 0.7)
    assert decision == 'retire_b'
    forest_area = category(module, 'c', 'Most forest', 'forest-cover', 'forest-cover')
    forest_share = category(module, 'd', 'Most forested', 'forest-cover', 'forest-cover', clarity=88)
    decision, _ = module.recommendation(forest_area, forest_share, 0.94, 0.7, 0.7, 0.65)
    assert decision == 'random_b'
    gdp = category(module, 'e', 'Largest economy', 'economic-output', 'economic-output')
    emissions = category(module, 'f', 'Most CO2 emissions', 'emissions', 'emissions')
    decision, _ = module.recommendation(gdp, emissions, 0.96, 0.8, 0.8, 0.2)
    assert decision == 'keep_both'
    print('Catalog similarity fixtures passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
