#!/usr/bin/env python3
"""Admit explicit adult ear measurements, with raw specimen evidence and no estimates."""
import csv
import gzip
import hashlib
import io
import json
import re
import statistics
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'data/animalstats'
SOURCE = P / 'source/ranges'
ARCHIVE = SOURCE / 'Ranges_Baseline_Traits_Jan-Feb2024.csv.zip'
EXPECTED_MD5 = '4f971dc85af857fc83d6d359ee443edc'
SOURCE_ID = 'ranges-2026-explicit-adult-ears'
NAMES = {'Vulpes vulpes', 'Procyon lotor', 'Mus musculus', 'Myotis lucifugus',
         'Rattus norvegicus', 'Didelphis marsupialis'}
EAR = re.compile(r'ear from notch\s*=\s*(\d+(?:\.\d+)?)\s*mm\b', re.I)
ADULT = re.compile(r'(?:age class\s*=\s*adult\b|reproductive data\s*=\s*adult\b|reproductive data\s*=.*?\badult (?:male|female)\b)', re.I)
FLAGS = ['ear_length_estimated', 'ear_length_units_inferred', 'ear_length_ambiguous']

def main():
    assert hashlib.md5(ARCHIVE.read_bytes()).hexdigest() == EXPECTED_MD5
    data = json.loads((P / 'pilot.json').read_text())
    animals = {a['scientificName']: a for a in data['animals'] if a.get('entityType') != 'breed'}
    citations = {r['Institution'].split(',')[0]: r['DOI'] for r in csv.DictReader((SOURCE / 'SourceDataset_DOIs.tsv').open(), delimiter='\t')}
    selected, exclusions, repeats = defaultdict(dict), [], defaultdict(set)
    with zipfile.ZipFile(ARCHIVE) as archive, archive.open(archive.namelist()[0]) as source:
        for number, row in enumerate(csv.DictReader(io.TextIOWrapper(source, encoding='utf-8-sig')), 2):
            name = row['genus'] + ' ' + row['specificEpithet']
            if name not in NAMES or not row['ear_length_mm']:
                continue
            reason = None
            raw = row['dynamicProperties']
            measurements = list(EAR.finditer(raw))
            adult = ADULT.search(raw)
            value = float(row['ear_length_mm'])
            key = row['occurrenceID']
            repeats[(name, key)].add(value)
            if row['life_stage'] != 'adult':
                reason = 'Life stage is not explicitly adult.'
            elif any(row[k] for k in FLAGS):
                reason = 'Estimated, ambiguous or inferred-unit flag is present.'
            elif re.match(r'^' + re.escape(name) + r'\s+[a-z]', row['scientificName']):
                reason = 'Subspecies retained outside this exact-binomial comparison; no silent taxon sharing.'
            elif len(measurements) != 1 or float(measurements[0].group(1)) != value:
                reason = 'No single matching raw ear-from-notch measurement with explicit millimetres.'
            elif not adult:
                reason = 'Adult label lacks matching explicit raw age/reproductive evidence.'
            elif value <= 0 or value >= float(row['total_length_mm'] or 'inf'):
                reason = 'Nonpositive ear length or ear not shorter than recorded total body length.'
            if reason:
                exclusions.append({'sourceRow': number, 'scientificName': row['scientificName'], 'occurrenceID': key, 'reason': reason, 'value': value})
                continue
            selected[name][key] = {
                'sourceRow': number, 'occurrenceID': key, 'institutionCode': row['institutionCode'],
                'catalogNumber': row['catalogNumber'], 'scientificName': row['scientificName'],
                'year': row['year'], 'countryCode': row['countryCode'], 'sex': row['sex'],
                'lifeStage': row['life_stage'], 'earLengthMM': value,
                'rawEarEvidence': measurements[0].group(0), 'rawAdultEvidence': adult.group(0),
                'institutionDownloadDOI': citations.get(row['institutionCode'], ''),
            }
    for (name, key), values in repeats.items():
        if len(values) > 1:
            selected[name].pop(key, None)
            exclusions.append({'scientificName': name, 'occurrenceID': key,
                               'reason': 'Conflicting repeated measurements for one specimen; no arbitrary selection.', 'values': sorted(values)})
    basis = ('Median of explicitly adult, unambiguously identified museum specimen measurements in the Ranges baseline. '
             'External ear length from notch to tip in explicit millimetres, verified against raw specimen metadata. '
             'Exact recorded-cohort medians, not species-wide maxima or a representative population estimate. '
             'Sex, geography and collection dates vary; specimen counts and original evidence are disclosed. '
             'No estimated measurements, inferred units, unknown ages or silently substituted taxa.')
    source = {'id': SOURCE_ID, 'name': 'Ranges Network: verified adult ear measurements',
              'sourceClass': 'primary-research', 'url': 'https://zenodo.org/records/18201648',
              'versionYear': '2024 museum baseline; release 2026-01-09', 'retrievedAt': '2026-10-05',
              'license': 'CC BY 4.0; individual institutional download DOIs retained'}
    data['sources'] = [s for s in data['sources'] if s['id'] != SOURCE_ID] + [source]
    ids = ['measured_adult_ear_length', 'measured_adult_ear_length__low']
    data['traits'] = [t for t in data['traits'] if t['id'] not in ids]
    for tid, label, direction, counter in [(ids[0], 'Longest ears', 'higher_wins', ids[1]), (ids[1], 'Shortest ears', 'lower_wins', ids[0])]:
        data['traits'].append({'id': tid, 'displayName': label, 'unit': 'mm', 'definition': basis,
                              'measurementBasis': basis, 'canonicalSourceId': SOURCE_ID,
                              'eligibilityGroups': [], 'direction': direction,
                              'separationMethod': 'positive_ratio_5_percent', 'gameplayFamily': 'anatomy',
                              'metricKey': 'ear-length', 'categoryKind': 'intuitive',
                              'prototypeCategory': True, 'counterTraitId': counter,
                              'playerHint': 'Adult ear length, from notch to tip. Median of recorded museum specimens.'})
    data['values'] = [v for v in data['values'] if v['traitId'] not in ids]
    cohorts, raw_rows = [], []
    for name, specimens in selected.items():
        records = list(specimens.values())
        if len(records) < 5:
            continue
        values = [r['earLengthMM'] for r in records]
        median = statistics.median(values)
        sexes = dict(Counter(r['sex'] or 'not reported' for r in records))
        cohort = {'animalId': animals[name]['id'], 'scientificName': name, 'n': len(records),
                  'medianMM': median, 'individualMinMM': min(values), 'individualMaxMM': max(values),
                  'sexCounts': sexes, 'countries': sorted({r['countryCode'] for r in records}),
                  'institutionDownloadDOIs': sorted({r['institutionDownloadDOI'] for r in records if r['institutionDownloadDOI']})}
        note = (f'N={len(records)} independent adult specimens; exact recorded-cohort median {median:g} mm. '
                f'Individual measurements {min(values):g}–{max(values):g} mm, not a confidence interval for the median. '
                f'Sex counts: {json.dumps(sexes)}. Countries: {", ".join(cohort["countries"])}. '
                'All contributing lengths and adult labels match explicit raw metadata; units inferred, estimated values, '
                'subspecies substitutions, unknown ages and conflicting duplicates excluded. '
                'This cohort need not represent the species population. Institutional downloads: '
                + '; '.join(cohort['institutionDownloadDOIs']))
        for tid in ids:
            data['values'].append({'animalId': animals[name]['id'], 'traitId': tid, 'valueNumeric': median,
                                   'unit': 'mm', 'sex': 'recorded specimen cohort; sex counts disclosed',
                                   'lifeStage': 'explicitly adult specimens', 'measurementBasis': basis,
                                   'sourceId': SOURCE_ID, 'observationType': 'observed', 'confidence': 'approved',
                                   'uncertaintyStatus': 'not-reported', 'uncertaintyKind': 'not-reported',
                                   'sampleSizeCategory': str(len(records)), 'sourceQuality': 'raw museum specimen metadata', 'notes': note})
        cohorts.append(cohort); raw_rows.extend(records)
    assert len(cohorts) == 6 and all(c['n'] >= 5 for c in cohorts)
    output = SOURCE / 'verified-adult-ear-specimens.csv'
    with output.open('w', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=list(raw_rows[0])); writer.writeheader(); writer.writerows(raw_rows)
    (P / 'pilot.json').write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False) + '\n')
    (P / 'research/ear-measurement-audit.json').write_text(json.dumps({
        'sourceUrl': source['url'], 'archiveMD5': EXPECTED_MD5,
        'selectedExtractionSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'specimens': len(raw_rows), 'cohorts': cohorts, 'excludedRecords': len(exclusions),
        'rankingScope': 'exact recorded-cohort medians; no population estimate or maximum-record inference',
        'uncertainty': 'Individual ranges disclosed as descriptive variation, not invented confidence intervals.',
    }, indent=2) + '\n')
    (P / 'research/ear-measurement-exclusions.json.gz').write_bytes(gzip.compress(
        json.dumps(exclusions, separators=(',', ':')).encode(), mtime=0))
    (P / 'research/ear-measurement-exclusions.json').write_text(json.dumps({
        'excludedRecords': len(exclusions), 'byReason': dict(Counter(r['reason'] for r in exclusions)),
        'fullRecords': 'ear-measurement-exclusions.json.gz',
        'reviewExamples': [r for r in exclusions if r['reason'].startswith(('No single', 'Conflicting'))][:30],
    }, indent=2) + '\n')
    print(json.dumps(cohorts, indent=2))

if __name__ == '__main__':
    main()
