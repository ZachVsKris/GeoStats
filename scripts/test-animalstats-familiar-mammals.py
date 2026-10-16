#!/usr/bin/env python3
"""Check new familiar-mammal observations against the frozen original cells."""
import csv
import collections
import gzip
import hashlib
import io
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'data/animalstats'
source = ROOT / 'source/anage-build-15.zip'
assert hashlib.sha256(source.read_bytes()).hexdigest() == 'e3ddb66e32e973a79932859ba53013e8f60d957c6ec01c6eb573e3ea3018d630'
with zipfile.ZipFile(source) as archive:
    rows = {r['Genus'] + ' ' + r['Species']: r for r in csv.DictReader(io.StringIO(archive.read('anage_data.txt').decode()), delimiter='\t')}
selection = json.loads((ROOT / 'research/familiar-mammal-selection-20261014.json').read_text())
data = json.loads((ROOT / 'existing-coverage.json').read_text())
animals = {a['scientificName']: a for a in data['animals']}
values = {(v['animalId'], v['traitId']): v for v in data['values']}
fields = {
    'adult_body_mass': ('Adult weight (g)', 'g'),
    'maximum_documented_lifespan': ('Maximum longevity (yrs)', 'years'),
    'wild_recorded_lifespan': ('Maximum longevity (yrs)', 'years'),
    'gestation': ('Gestation/Incubation (days)', 'days'),
    'litter_size': ('Litter/Clutch size', 'offspring'),
    'female_maturity': ('Female maturity (days)', 'days'),
    'male_maturity': ('Male maturity (days)', 'days'),
    'weaning_age': ('Weaning (days)', 'days'),
    'birth_weight': ('Birth weight (g)', 'g'),
    'weaning_mass': ('Weaning weight (g)', 'g'),
    'litters_per_year': ('Litters/Clutches per year', 'litters/year'),
    'interbirth_interval': ('Inter-litter/Interbirth interval', 'days'),
}
checked = []
for selected in selection['animals']:
    name = selected['scientificName']
    row, animal = rows[name], animals[name]
    assert row['Class'] == 'Mammalia' and row['Data quality'] in ['high', 'acceptable']
    assert row['References'] and animal['entityType'] == 'species'
    for trait, (field, unit) in fields.items():
        entry = values.get((animal['id'], trait))
        if entry is None:
            continue
        assert entry['valueNumeric'] == float(row[field]) > 0, (name, trait)
        assert entry['unit'] == unit and entry['sourceId'] == 'anage-15'
        expected_review = name == 'Gulo gulo' and trait == 'gestation'
        assert entry['confidence'] == ('review' if expected_review else 'approved')
        assert entry['observationType'] == 'compiled'
        assert entry['uncertaintyStatus'] == 'not-reported'
        assert row['HAGRID'] in entry['notes'] and row['References'] in entry['notes']
        if trait == 'maximum_documented_lifespan':
            assert entry['recordOrigin'] == row['Specimen origin'] == 'captivity'
        if trait == 'wild_recorded_lifespan':
            assert entry['recordOrigin'] == row['Specimen origin'] == 'wild'
        if trait in ['female_maturity', 'male_maturity']:
            assert entry['sex'] == trait.split('_')[0]
        opposite = values[(animal['id'], trait + '__low')]
        assert opposite['valueNumeric'] == entry['valueNumeric']
        assert opposite['sourceId'] == entry['sourceId']
        assert opposite['confidence'] == entry['confidence']
        checked.append((name, trait))
assert len(checked) == 269
# Independently reconcile added inventory and ecology measurements as well.
mdd_raw = gzip.decompress((ROOT / 'source/mdd/MDD_v2.5_6904species.csv.gz').read_bytes())
assert hashlib.sha256(mdd_raw).hexdigest() == '0d07a7e9409712fa86c1e3afadcf4c67bf4f9e16d5693a878e11ec1bf6860493'
mdd_rows = list(csv.DictReader(io.StringIO(mdd_raw.decode('utf-8-sig'))))
mdd = {r['sciName'].replace('_', ' '): r for r in mdd_rows}
families = collections.Counter(r['family'] for r in mdd_rows if r['extinct'] == '0')
inventory = 0
for selected in selection['animals']:
    animal = animals[selected['scientificName']]
    for tid in ['mdd_country_count', 'mdd_continent_count', 'mdd_family_species_count']:
        entry = values.get((animal['id'], tid))
        if entry is None:
            continue
        row = mdd[selected['scientificName']]
        assert row['flagged'] == '0' and row['extinct'] == '0'
        if tid == 'mdd_family_species_count':
            expected = families[row['family']]
        elif tid == 'mdd_country_count':
            expected = len({x.strip() for x in row['countryDistribution'].split('|') if x.strip() and '?' not in x and x.strip() not in {'NA', 'Domesticated'}})
        else:
            expected = len({x.strip() for x in row['continentDistribution'].split('|') if x.strip() in {'Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'}})
        assert entry['valueNumeric'] == expected
        assert values[(animal['id'], tid + '__low')]['valueNumeric'] == expected
        inventory += 1
assert inventory == 72
excerpt_raw = (ROOT / 'source/familiar-mammal-tetrapod-201-cells.json').read_bytes()
assert hashlib.sha256(excerpt_raw).hexdigest() == '59a450bc7dfa9f56f5c62c1f7c6f03aa64471edbe2ce192525aa07435feff15c'
excerpt = json.loads(excerpt_raw)
ecological_rows = {r['fields']['Scientific.Name']: r['fields'] for r in excerpt['rows']}
source_fields = dict(tt_range_area='RangeSize_km2', tt_range_temperature='AnnuMeanTemp', tt_range_rainfall='AnnuPrecip', tt_range_elevation='Elevation', tt_diet_breadth='DietBreadth', tt_habitat_breadth='MajorHabitatSum', tt_assessed_risk='AssessedStatus')
ecological = 0
for selected in selection['animals']:
    animal = animals[selected['scientificName']]
    for tid, field in source_fields.items():
        entry = values.get((animal['id'], tid))
        if entry is None:
            continue
        row = ecological_rows[selected['scientificName']]
        if field == 'AssessedStatus':
            expected = dict(LC=1, NT=2, VU=3, EN=4, CR=5)[row[field]]
        else:
            expected = float(row[field])
            if field == 'AnnuMeanTemp':
                expected = expected / 10 + 273.15
        assert entry['valueNumeric'] == round(expected, 6)
        assert values[(animal['id'], tid + '__low')]['valueNumeric'] == entry['valueNumeric']
        if field == 'MajorHabitatSum':
            assert row['ImputedMajorHabitat'] == '0'
        if field in ['AnnuMeanTemp', 'AnnuPrecip', 'Elevation']:
            assert animal['taxonomicGroup'] != 'marine-mammal'
        ecological += 1
assert ecological == 180
print(json.dumps(dict(animals=len(selection['animals']), AnAgeSourceCells=len(checked),
    mddSourceCells=inventory, ecologySourceCells=ecological,
    totalSourceCells=len(checked) + inventory + ecological,
    directionalValues=2 * (len(checked) + inventory + ecological), exactSourceMatches=True,
    newPlayableLabels=0,
    limitation='Verifies faithful source transcription and admissible fields, not independent confirmation of every underlying biological study.')))
