#!/usr/bin/env python3
"""Extend existing ecology rankings from frozen exact-species source cells."""
import json
import math
from pathlib import Path

P = Path(__file__).resolve().parents[1] / 'data/animalstats'
source = json.loads((P / 'source/familiar-mammal-tetrapod-201-cells.json').read_text())
assert source['originalSha256'] == '1f9aab1093477dce3bccb12ef008c25a37c868b38aa36e6d5cd378e9019e5f0e'
rows = {r['fields']['Scientific.Name']: r for r in source['rows']}
names = {r['scientificName'] for r in json.loads((P / 'research/familiar-mammal-selection-20261014.json').read_text())['animals']}
data = json.loads((P / 'existing-coverage.json').read_text())
traits = {t['id']: t for t in json.loads((P / 'tetrapod-spatial.json').read_text())['traits']}
existing = {(v['animalId'], v['traitId']) for v in data['values']}
fields = dict(tt_range_area='RangeSize_km2', tt_range_temperature='AnnuMeanTemp',
    tt_range_rainfall='AnnuPrecip', tt_range_elevation='Elevation',
    tt_diet_breadth='DietBreadth', tt_habitat_breadth='MajorHabitatSum', tt_assessed_risk='AssessedStatus')
risk = dict(LC=1, NT=2, VU=3, EN=4, CR=5)
admitted, held = [], []
for animal in data['animals']:
    name = animal['scientificName']
    if name not in names:
        continue
    target = rows.get(name)
    if not target:
        held.append(dict(scientificName=name, reason='No exact original source name; no synonym transfer.'))
        continue
    row = target['fields']
    for tid, field in fields.items():
        reason = None
        if '_' in row['Scientific.Name'] or row['AssessedStatus'] in ['EX', 'EW']:
            reason = 'Domestic/extinct source record excluded.'
        if field == 'MajorHabitatSum' and row['ImputedMajorHabitat'] != '0':
            reason = 'Imputed habitat excluded.'
        if animal['taxonomicGroup'] == 'marine-mammal' and field in ['AnnuMeanTemp', 'AnnuPrecip', 'Elevation']:
            reason = 'Terrestrial climate/topography layers require separate aquatic habitat interpretation; not ocean temperature or diving depth.'
        original = row.get(dict(DietBreadth='SourceDiet', MajorHabitatSum='SourceMajorHabitat', AssessedStatus='SourceStatus').get(field, '')) or {
            'RangeSize_km2': 'Map of Life range maps; equal-area projection',
            'AnnuMeanTemp': 'CHELSA v1.2', 'AnnuPrecip': 'CHELSA v1.2', 'Elevation': 'EarthEnv topographic layers'}.get(field, '')
        if not original or 'imput' in original.lower() or 'assumed' in original.lower():
            reason = 'Missing or inferred original source excluded.'
        try:
            numeric = risk[row[field]] if field == 'AssessedStatus' else float(row[field])
            if field == 'AnnuMeanTemp':
                numeric = numeric / 10 + 273.15
            if not math.isfinite(numeric) or numeric <= 0:
                reason = 'Missing or nonpositive source value.'
        except (ValueError, KeyError):
            reason = 'Missing or ineligible source value.'
        if reason:
            held.append(dict(scientificName=name, traitId=tid, reason=reason))
            continue
        for suffix in ['', '__low']:
            trait = traits[tid + suffix]
            key = (animal['id'], trait['id'])
            if key in existing:
                continue
            data['values'].append(dict(animalId=animal['id'], traitId=trait['id'], valueNumeric=round(numeric, 6),
                unit=trait['unit'], sex='not applicable', lifeStage='species distribution or ecology',
                measurementBasis=trait['measurementBasis'], sourceId=trait['canonicalSourceId'], observationType='compiled',
                confidence='approved', uncertaintyStatus='not-reported',
                notes=f'TetrapodTraits 2.0.1; exact species {name}; original CSV row {target["sourceRow"]}; original field {field}={row[field]}; source: {original}. Original CSV SHA256 {source["originalSha256"]}. Cite Moura et al. 2024 doi:10.1371/journal.pbio.3002658 and Pyron et al. 2025 doi:10.21203/rs.3.rs-7556378/v1.'))
            existing.add(key)
        admitted.append(dict(animalId=animal['id'], scientificName=name, traitId=tid, sourceField=field, sourceValue=row[field], value=round(numeric, 6)))
(P / 'existing-coverage.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
report = dict(sourceVersion=source['version'], sourceSha256=source['originalSha256'],
    sourceMeasurements=len(admitted), directionalValues=len(admitted) * 2,
    method='Existing category definitions and unit conversions retained. Exact species only. No imputed animal attributes.',
    admitted=admitted, held=held)
(P / 'research/familiar-mammal-ecology-admission-20261014.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(dict(sourceMeasurements=len(admitted), directionalValues=len(admitted) * 2, held=len(held))))
