"""Regression checks for source-field contamination and breed/sample eligibility."""
import csv, io, json, math, pathlib, re, zipfile
P = pathlib.Path(__file__).resolve().parents[1] / 'data/animalstats'
S = P / 'source/underrepresented-20261010b'
d = json.loads((P / 'underrepresented.json').read_text())
parts = [json.loads((P / (x + '.json')).read_text()) for x in ['pilot', 'existing-coverage', 'fish-records', 'marine', 'aquatic-eggs', 'underrepresented']]
animals = {a['id']: a for part in parts for a in part['animals']}
values = {(v['animalId'], v['traitId']): v for v in d['values']}
with zipfile.ZipFile(P / 'source/anage-build-15.zip') as z:
    rows = csv.DictReader(io.StringIO(z.read('anage_data.txt').decode()), delimiter='\t')
    anage = {r['Genus'] + ' ' + r['Species']: r for r in rows}
weights = [v for v in d['values'] if v['traitId'] == 'adult_body_mass' and v['sourceId'] == 'anage-15']
assert len(weights) >= 50
for v in weights:
    r = anage[animals[v['animalId']]['scientificName']]
    assert v['valueNumeric'] == float(r['Adult weight (g)'])
    assert 'original field Adult weight (g)' in v['notes']
for c in json.loads((S / 'insect-source-cells.json').read_text()):
    assert 'Lepidoptera' not in c['body']['file']
    assert not re.search(r'SCALETOOL|expert|pers|Verheyde|Pollet', c['body']['source'], re.I)
    aid = c['name'].lower().replace(' ', '_')
    assert values[aid, 'insect_record_body_length']['valueNumeric'] == c['body']['value']
    length, width = float(c['eggs']['pl']), float(c['eggs']['pw'])
    assert values[aid, 'insect_record_egg_length']['valueNumeric'] == length
    assert math.isclose(values[aid, 'insect_egg_elongation']['valueNumeric'], max(length, width) / min(length, width))
births = json.loads((S / 'cat-birthweight-reviewed-cells.json').read_text())
assert len(births) == 9
assert {v['animalId'] for v in d['values'] if v['traitId'] == 'pet_cat_birth_mass'} == {r[1] for r in births}
for breed, aid, kittens, litters, mass, sd, litter, litter_sd in births:
    assert values[aid, 'pet_cat_birth_mass']['valueNumeric'] == mass
    assert values[aid, 'pet_cat_birth_mass']['sampleSizeCategory'] == f'{kittens} kittens'
raw = list(csv.DictReader((S / 'febqFINAL.csv').open(encoding='utf-8-sig')))
fetches = [v for v in d['values'] if v['traitId'] == 'pet_cat_survey_fetch']
assert len(fetches) >= 8
for v in fetches:
    breed = animals[v['animalId']]['commonName']
    nums = []
    for row in raw:
        if row['breedid'] != breed: continue
        try: n = float(row['PlaysFetch'])
        except ValueError: continue
        if 0 <= n <= 4: nums.append(n)
    assert len(nums) >= 20
    assert math.isclose(v['valueNumeric'], 100 * sum(n >= 2 for n in nums) / len(nums))
assert not any(v['animalId'] == 'ophiophagus_hannah' for v in d['values'])
assert not any(v['animalId'] == 'proteus_anguinus' and v['traitId'].startswith('maximum_documented_lifespan') for v in d['values'])
for photo in d['photos']:
    assert photo['approved'] and photo['animalId'] in animals
    assert (P.parents[1] / 'public' / photo['assetUrl'].lstrip('/')).exists()
print(json.dumps({'adultWeightSourceChecks': len(weights), 'unpooledCatBirthBreeds': len(births), 'fetchThresholdChecks': len(fetches), 'sourceContaminationChecks': True}))
