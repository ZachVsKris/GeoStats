#!/usr/bin/env python3
"""Screen frozen bulk downloads without admitting observations to gameplay.

Usage: python scripts/audit-animalstats-bulk-intake.py /path/to/downloads
The manifest provides versioned URLs and exact hashes. Downloads stay outside
published game data. This audit deliberately does not infer absent life stages,
units, references, or species identities.
"""
import argparse
import collections
import csv
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / 'data/animalstats/research'
MISSING = {'', 'na', 'n/a', 'nan', 'none', 'null', 'unknown'}


def present(value):
    return str(value).strip().casefold() not in MISSING


def number(value):
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def audit(folder):
    manifest = json.loads((RESEARCH / 'bulk-source-intake-20261014.json').read_text())
    for source in manifest['sources']:
        path = folder / source['file']
        if hashlib.sha256(path.read_bytes()).hexdigest() != source['sha256']:
            raise ValueError('Source differs from frozen manifest: ' + source['file'])
    with (folder / 'zooplankton-level1.csv').open(newline='') as stream:
        rows = list(csv.DictReader(stream))
    groups = collections.defaultdict(list)
    excluded = collections.Counter()
    for row in rows:
        if row['isDerived'] != 'FALSE':
            excluded['derived-or-unspecified'] += 1
            continue
        if row['taxonRank'] != 'Species':
            excluded['not-exact-species-rank'] += 1
            continue
        if row['valueType'] != 'numeric' or number(row['traitValue']) is None:
            excluded['not-finite-numeric'] += 1
            continue
        if not present(row['primaryReferenceDOI']):
            excluded['missing-primary-doi'] += 1
            continue
        # Different length conventions and temperatures are separate comparison
        # cells, not quietly averaged into a species score.
        key = tuple(row[field] for field in ['traitName', 'traitUnit', 'lifeStage', 'sizeType', 'assocTemperature'])
        groups[key].append(row)
    report = []
    for key, records in groups.items():
        species = sorted({r['scientificName'] for r in records})
        report.append(dict(zip(['trait', 'unit', 'lifeStage', 'sizeType', 'temperature'], key),
            records=len(records), distinctSpecies=len(species),
            primaryDOIs=sorted({r['primaryReferenceDOI'] for r in records}),
            status='manual-review-only',
            holds=[reason for condition, reason in [
                (not present(key[1]), 'unit unspecified'),
                (not present(key[2]), 'life stage unspecified'),
                (len(species) < 20, 'below scoped publication floor'),
            ] if condition]))
    report.sort(key=lambda item: (-item['distinctSpecies'], item['trait'], item['lifeStage']))
    result = dict(reviewDate='2026-10-14', sourceRows=len(rows),
        newAdmittedValues=0, newPlayableLabels=0,
        scope='Screen only. DOI presence and isDerived=FALSE do not establish biological comparability or measurement quality.',
        excludedInScreen=dict(excluded),
        comparisonCells=report,
        requiredReview=['Read original measurement methods and definitions.',
            'Confirm accepted species identity and life stage.',
            'Keep temperature-dependent assays and distinct length conventions separate.',
            'Review repeat observations and uncertainty before choosing a species summary.',
            'Review intuitive interest and familiar-animal coverage before admitting a category.'])
    output = RESEARCH / 'zooplankton-comparison-readiness-20261014.json'
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(dict(sourceRows=len(rows), comparisonCells=len(report),
        cellsAtScopedFloor=sum(r['distinctSpecies'] >= 20 for r in report),
        excluded=dict(excluded), newPlayableLabels=0)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=Path)
    audit(parser.parse_args().folder)
