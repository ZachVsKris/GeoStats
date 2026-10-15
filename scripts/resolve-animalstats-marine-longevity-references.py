#!/usr/bin/env python3
"""Resolve selected marine longevity citations from a frozen bibliography.

This is an offline research step, never a biological-data importer. Requires
research-only pyarrow. Does not change any playable values or boards.
"""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/animalstats'
EXPECTED = 'b92b4dcc1625e1c116331f3224ad3ee9e3e5c8b79bc25fe6db7a05d37fa6bfcb'
COLUMNS = ['RefNo', 'Author', 'Year', 'Title', 'Source', 'DOI', 'PaperURL']


def resolve(source):
    import pyarrow.parquet as pq
    assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED, 'Bibliography snapshot changed'
    path = DATA / 'research/marine-catalog-longevity-review-20261015.json'
    report = json.loads(path.read_text())
    needed = {int(c['sourceCells']['LongevityWildRef']) for c in report['candidates'] if c['sourceCells']['LongevityWildRef']}
    selected = [{key: row.get(key) for key in COLUMNS} for row in pq.read_table(source).to_pylist() if row['RefNo'] in needed]
    assert len({r['RefNo'] for r in selected}) == len(selected), 'Duplicate bibliography identifiers'
    snapshot = dict(sourceVersion='SeaLifeBase 26.06 frozen references',
        sourceUrl='https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/cboettig/fishbase/slb/v26.06/parquet/refrens.parquet',
        sourceSha256=EXPECTED, license='CC BY-NC 4.0; cite SeaLifeBase and each original publication',
        purpose='Bibliographic resolution only; no biological values admitted. Selected references for the 37-species catalog longevity queue; not the complete database.', references=selected)
    target = DATA / 'source/marine-catalog-longevity-references-2606.json'
    target.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    index = {str(r['RefNo']): r for r in selected}
    for candidate in report['candidates']:
        candidate.pop('originalReference', None)
        reference = index.get(candidate['sourceCells']['LongevityWildRef'])
        if reference:
            candidate['originalReference'] = reference
        if candidate['sourceCells']['LongevityWildRef'] == '85497':
            candidate['status'] = 'excluded-model-derived-age'
            candidate['primaryMethodReview'] = dict(
                doi='10.1590/S0073-47212008000200011',
                url='https://www.scielo.br/j/isz/a/FXxL7CXBk5X8W7SpTWBbS3w/?lang=pt',
                finding='The original abstract and methods estimate age using the inverse von Bertalanffy growth function fitted to size-frequency modal progression. These are not observed individual lifespans.',
                decision='Exclude both Callinectes species from measured-lifespan imports; reputable publication, incompatible observation method.')
    report['resolvedReferenceSpecies'] = sum('originalReference' in c for c in report['candidates'])
    report['distinctResolvedPublications'] = len(index)
    report['referenceSnapshot'] = str(target.relative_to(ROOT))
    report['excludedModelDerivedSpecies'] = sum(c['status'] == 'excluded-model-derived-age' for c in report['candidates'])
    assert report['newAdmittedValues'] == report['newPlayableLabels'] == 0
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ['resolvedReferenceSpecies', 'distinctResolvedPublications', 'excludedModelDerivedSpecies', 'newAdmittedValues']}))


if __name__ == '__main__':
    resolve(Path(sys.argv[1]))
