#!/usr/bin/env python3
"""Fill existing MDD rankings for the explicitly selected familiar mammals."""
import collections
import csv
import gzip
import hashlib
import io
import json
from pathlib import Path

P = Path(__file__).resolve().parents[1] / 'data/animalstats'
selection = json.loads((P / 'research/familiar-mammal-selection-20261014.json').read_text())
names = {a['scientificName'] for a in selection['animals']}
raw = gzip.decompress((P / 'source/mdd/MDD_v2.5_6904species.csv.gz').read_bytes())
assert hashlib.sha256(raw).hexdigest() == '0d07a7e9409712fa86c1e3afadcf4c67bf4f9e16d5693a878e11ec1bf6860493'
rows = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
index = {r['sciName'].replace('_', ' '): (i, r) for i, r in enumerate(rows, 2)}
families = collections.Counter(r['family'] for r in rows if r['extinct'] == '0')
base = json.loads((P / 'pilot.json').read_text())
traits = {t['id']: t for t in base['traits']}
data = json.loads((P / 'existing-coverage.json').read_text())
existing = {(v['animalId'], v['traitId']) for v in data['values']}
continents = {'Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'}
admitted, held = [], []
for animal in data['animals']:
    name = animal['scientificName']
    if name not in names:
        continue
    match = index.get(name)
    if not match:
        held.append(dict(scientificName=name, reason='No exact unmodified species name in MDD v2.5.'))
        continue
    number, row = match
    if row['extinct'] != '0' or row['flagged'] != '0':
        held.append(dict(scientificName=name, reason='Extinct or flagged MDD target; no taxonomy transfer.', taxonomyNotes=row.get('taxonomyNotes', '')))
        continue
    places = sorted({s.strip() for s in row['countryDistribution'].split('|') if s.strip() and '?' not in s and s.strip() not in {'NA', 'Domesticated'}})
    uncertain = [s for s in row['countryDistribution'].split('|') if '?' in s]
    regions = sorted({s.strip() for s in row['continentDistribution'].split('|') if s.strip() in continents})
    measurements = {'mdd_family_species_count': families[row['family']]}
    if row['domestic'] == '0' and places:
        measurements['mdd_country_count'] = len(places)
    if row['domestic'] == '0' and regions:
        measurements['mdd_continent_count'] = len(regions)
    for tid, numeric in measurements.items():
        detail = (f'Family: {row["family"]}; exact number of recognized living species in this source classification, including recognized domestic species and flagged contributing taxa. Target itself is not flagged.' if tid == 'mdd_family_species_count' else
            'Exact confirmed entries: ' + '; '.join(places) + '. Uncertain entries excluded: ' + ('; '.join(uncertain) or 'none') + '. Published continent list: ' + '; '.join(regions) + '. Native range and pre-1500 introductions included; recent introductions excluded as in the source.')
        note = f'Original CSV row {number}; MDD taxon #{row["id"]}; exact name {row["sciName"]}. {detail} Taxon page: https://www.mammaldiversity.org/taxon/{row["id"]}.'
        for suffix in ['', '__low']:
            trait = traits[tid + suffix]
            key = (animal['id'], trait['id'])
            if key in existing:
                continue
            data['values'].append(dict(animalId=animal['id'], traitId=trait['id'], valueNumeric=numeric,
                unit=trait['unit'], sex='not applicable', lifeStage='species-level source inventory',
                measurementBasis=trait['measurementBasis'], sourceId=trait['canonicalSourceId'],
                observationType='compiled', confidence='approved', uncertaintyStatus='not-reported',
                sourceQuality='versioned expert taxonomy/range inventory; exact list counts', notes=note))
            existing.add(key)
        admitted.append(dict(animalId=animal['id'], scientificName=name, traitId=tid, value=numeric, originalRow=number))
(P / 'existing-coverage.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
report = dict(source='ASM Mammal Diversity Database v2.5', sourceSha256=hashlib.sha256(raw).hexdigest(),
    method='Existing category definitions retained. Exact source-name joins only. No inferred continents, uncertain countries, or taxonomy transfers.',
    sourceMeasurements=len(admitted), directionalValues=len(admitted) * 2, admitted=admitted, held=held)
(P / 'research/familiar-mammal-range-admission-20261014.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(dict(sourceMeasurements=len(admitted), directionalValues=len(admitted) * 2, held=held)))
