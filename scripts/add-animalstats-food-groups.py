#!/usr/bin/env python3
"""Promote observed food-group classifications, never modeled diet or mass."""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/animalstats'
path = OUT / 'source/mammal-food-types-Supplemental_data_1_diet_dataset.csv'
assert hashlib.sha256(path.read_bytes()).hexdigest() == '59e4c08607113f7210408b8b058287f66b639c7ea1441d265b0930df84167951'
data = json.loads((OUT / 'pilot.json').read_text())
animals = {a['scientificName']: a for a in data['animals']}
sid = 'reuter-2023-observed-food-groups'
tid = 'diet_food_group_count'
basis = ('Number of four broad food groups classified as substantial in the published Reuter, Hopkins & Price 2023 terrestrial-mammal diet dataset: vertebrate prey, invertebrate prey, fibrous plants and nonfibrous plants. '
         'The original diet evidence is stomach or cheek-pouch contents, food stores, direct feeding observations or fecal analysis; a group qualifies at at least 5% by volume, weight or feeding time. '
         'A count of food groups, not the number of prey species, an individual menu, or a precise proportion eaten. No phylogenetic or morphological diet predictions. '
         'Sex, life stage and observation effort are not standardized; unrecorded minor or seasonal foods may be absent. Aquatic mammals are excluded from this playing subset.')
source = dict(id=sid, name='Reuter, Hopkins & Price: observed mammal food groups', sourceClass='curated-trait-database',
              url='https://doi.org/10.5061/dryad.83bk3j9vk', versionYear='2023', retrievedAt='2026-10-03', license='CC0 1.0 (Dryad dataset)',
              primaryPublicationUrl='https://doi.org/10.1098/rspb.2022.1062')
trait = dict(id=tid, displayName='Most food groups', unit='food groups', definition=basis, measurementBasis=basis,
             canonicalSourceId=sid, eligibilityGroups=[], direction='higher_wins', separationMethod='positive_ratio_5_percent',
             gameplayFamily='diet', playerHint='How many of four broad food groups are a substantial part of the diet?')
data['sources'] = [s for s in data['sources'] if s['id'] != sid] + [source]
data['traits'] = [t for t in data['traits'] if t['id'] not in {tid, tid+'__low'}] + [trait]
data['values'] = [v for v in data['values'] if v['traitId'] not in {tid, tid+'__low'}]
fields = ['vertebrate', 'invertebrate', 'fibrousplant', 'nonfibrousplant']
audit, excluded, seen = [], [], set()
for number, row in enumerate(csv.DictReader(path.open()), 2):
    name = row['Binomial']
    if name not in animals:
        continue
    assert name not in seen, 'Duplicate species classification requires review'
    seen.add(name)
    animal = animals[name]
    if animal['taxonomicGroup'] in {'marine-mammal', 'monotreme'}:
        excluded.append(dict(scientificName=name, reason='Aquatic feeding context excluded; no cross-food-web comparison'))
        continue
    assert all(row[f] in {'0', '1'} for f in fields), 'No blank-to-zero conversion'
    bits = {f: int(row[f]) for f in fields}
    count = sum(bits.values())
    assert 1 <= count <= 4
    notes = (f'Original dataset CSV row {number}; '+', '.join(f'{f}={bits[f]}' for f in fields)+
             '. Exact sum of explicit published classifications; zero is an explicit category code, not a missing value. '
             'Only the four diet indicators are used; body mass and phylogenetic-model outputs are excluded. '
             'Published direct-evidence eligibility and 5% threshold checked in author dataset methods. '
             'Equal counts share rank; no hidden tie-breaker. This is documented coarse diet breadth, not total food-species diversity.')
    data['values'].append(dict(animalId=animal['id'], traitId=tid, valueNumeric=count, unit='food groups',
                              sex='species-level compilation', lifeStage='source stages not standardized', measurementBasis=basis,
                              sourceId=sid, observationType='compiled', confidence='approved', uncertaintyStatus='not-reported', notes=notes))
    audit.append(dict(scientificName=name, foodGroups=count, classifications=bits, sourceRow=number,
                      decision='approved-published-food-group-count'))
assert len(audit) >= 29
(OUT / 'pilot.json').write_text(json.dumps(data, indent=2, ensure_ascii=False)+'\n')
(OUT / 'research/food-groups-gameplay-audit.json').write_text(json.dumps(dict(
    reviewedAt='2026-10-03', sourceSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
    source=source, traitId=tid, records=audit, exclusions=excluded,
    approvalScope='Published four-group classifications only; not species richness or inferred diet'), indent=2)+'\n')
print(json.dumps(dict(approvedObservations=len(audit), newMetricFamilies=1, proposedDirections=2)))
