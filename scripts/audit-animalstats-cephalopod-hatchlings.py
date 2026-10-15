#!/usr/bin/env python3
"""Extract the publisher's 2016 tables for review, never directly into gameplay.

No correction of misspelled names, coordinate errors, shrinkage estimates or
taxonomic complexes is automatic. Source cells and their references survive.
"""
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/animalstats/source/cephalopod-hatchlings-2016.xml'
EXPECTED = '217f90b41577aeb21d9cfa9617983cedc543578c7a466ef87b2337ba843eefa2'


def text(node):
    return ' '.join(''.join(node.itertext()).split())


def main():
    raw = SOURCE.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != EXPECTED:
        raise ValueError('Publisher snapshot differs from reviewed source')
    root = ET.fromstring(raw)
    refs = {r.attrib['id']: text(r) for r in root.findall('.//ref')}
    table = root.find(".//table-wrap[@id='pone.0165334.t001']")
    rows = []
    group = None
    for row in table.findall('.//tbody/tr'):
        cells = row.findall('td')
        values = [text(c) for c in cells]
        if len(values) != 7:
            raise ValueError('Unexpected source table shape')
        if not values[1]:
            group = values[0]
            continue
        holds = []
        if '*' in values[2]:
            holds.append('Hatchling length is estimated using a pooled shrinkage correction; exclude from measured hatchling rankings.')
        if re.search(r'(?:\btype\b|\b(?:sp|spp|cf)\.)', values[0], re.I):
            holds.append('Species complex or incomplete identification; do not merge into a named species.')
        for minutes in re.findall(r'°(\d+)', values[5]):
            if int(minutes) >= 60:
                holds.append('Invalid coordinate minutes in released table; do not silently repair or admit range.')
        citations = {}
        for column, cell in zip(['species', 'mode', 'hatchling', 'adult', 'relativeSize', 'latitude', 'range'], cells):
            ids = [x.attrib['rid'] for x in cell.findall('.//xref') if x.attrib.get('ref-type') == 'bibr']
            citations[column] = [{'id': key, 'reference': refs[key]} for key in ids]
        rows.append(dict(sourceName=values[0], group=group,
            sourceCells=dict(zip(['species', 'mode', 'hatchlingMm', 'adultMantleMm', 'relativeSizePercent', 'latitude', 'rangeKm'], values)),
            references=citations, holds=holds,
            status='research-only; identity and measurement review pending'))
    assert len(rows) == 110
    result = dict(status='research-only; no game measurements admitted',
        doi='10.1371/journal.pone.0165334',
        sourceUrl='https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0165334&type=manuscript',
        sourceFile=str(SOURCE.relative_to(ROOT)), sha256=digest,
        license='CC BY; Villanueva, Vidal, Fernández-Álvarez and Nabhitabhata (2016)',
        sourceRows=len(rows), correctedHatchlingRows=sum('*' in r['sourceCells']['hatchlingMm'] for r in rows),
        declaredCorrectedSpecies=10,
        correctionCountDiscrepancy='Article methods say ten corrected species, but eleven Table 1 rows carry an asterisk. All eleven are held.',
        coordinateErrorRows=sum(any('coordinate' in h for h in r['holds']) for r in rows),
        newPlayableLabels=0, newAdmittedValues=0,
        methodReview=[
            'Hatchlings were laboratory hatched, including identified wild-collected egg masses. Keep captive hatchling measurements separate from adult records.',
            'Mantle length excludes arms and tentacles; never label as total body length or mix with nautilus shell diameter.',
            'Ten source hatchling lengths use an estimated shrinkage correction and are ineligible as measured values.',
            'Published hatchling means may pool several study means; preserve every original reference and inspect aggregation.',
            'Adult lengths are published maxima, largely from FAO catalogs, not average adult lengths.',
            'Latitude span is not occupied area, abundance, distance migrated or lifetime movement.',
            'The relative hatchling-size index uses a mean hatchling divided by a maximum adult; keep this basis explicit.',
            'Table 2 has only 15 species and differing endpoints (settlement versus first schooling); do not publish a universal development-duration ranking.',
            'Original species spellings and coordinate mistakes are preserved for review; taxonomy corrections require explicit evidence.',
        ], candidates=rows)
    out = ROOT / 'data/animalstats/research/cephalopod-hatchling-readiness-20261014.json'
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ['sourceRows', 'correctedHatchlingRows', 'coordinateErrorRows', 'newPlayableLabels']}))


if __name__ == '__main__':
    main()
