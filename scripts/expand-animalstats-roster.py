"""Add recognizable mammal taxa using the pinned AnAge source, never imputation.

Run senses/diet, history/conservation and the board curator after this importer.
Source quality is an admission gate, not a claim that a species has one fixed size.
"""
import csv, hashlib, io, json, math, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'data/animalstats'
NEW = {
    'Capra hircus': ('Domestic goat', 'large-mammal'),
    'Sus scrofa': ('Wild boar', 'large-mammal'),
    'Procyon lotor': ('Raccoon', 'carnivore'),
    'Meles meles': ('European badger', 'carnivore'),
    'Panthera onca': ('Jaguar', 'carnivore'),
    'Puma concolor': ('Cougar', 'carnivore'),
    'Phoca vitulina': ('Harbor seal', 'marine-mammal'),
    'Zalophus californianus': ('California sea lion', 'marine-mammal'),
    'Vombatus ursinus': ('Common wombat', 'marsupial'),
    'Tachyglossus aculeatus': ('Short-beaked echidna', 'monotreme'),
    'Rangifer tarandus': ('Reindeer', 'large-mammal'),
    'Cervus elaphus': ('Red deer', 'large-mammal'),
    'Suricata suricatta': ('Meerkat', 'carnivore'),
    'Rattus norvegicus': ('Brown rat', 'rodent'),
    'Mesocricetus auratus': ('Golden hamster', 'rodent'),
    'Myotis lucifugus': ('Little brown bat', 'bat'),
    'Pteropus vampyrus': ('Large flying fox', 'bat'),
    'Myrmecophaga tridactyla': ('Giant anteater', 'large-mammal'),
    'Dasypus novemcinctus': ('Nine-banded armadillo', 'large-mammal'),
}
FIELDS = {'adult_body_mass':'Adult weight (g)', 'maximum_documented_lifespan':'Maximum longevity (yrs)', 'gestation':'Gestation/Incubation (days)', 'litter_size':'Litter/Clutch size', 'female_maturity':'Female maturity (days)', 'male_maturity':'Male maturity (days)', 'weaning_age':'Weaning (days)', 'birth_weight':'Birth weight (g)', 'weaning_mass':'Weaning weight (g)', 'litters_per_year':'Litters/Clutches per year', 'interbirth_interval':'Inter-litter/Interbirth interval'}
data = json.loads((P/'pilot.json').read_text())
traits = {t['id']:t for t in data['traits']}
path = P/'source/anage-build-15.zip'
with zipfile.ZipFile(path) as z:
    rows = {r['Genus']+' '+r['Species']:r for r in csv.DictReader(io.StringIO(z.read('anage_data.txt').decode()),delimiter='\t')}
audit = {'reviewedAt':'2026-10-04','sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'newAnimals':NEW,'observations':[],'held':[
    {'species':'Bos taurus','reason':'Pinned AnAge data quality is questionable.'},
    {'species':'Felis catus','reason':'Pinned AnAge data quality is questionable.'},
    {'species':'Odobenus rosmarus','reason':'Pinned AnAge data quality is low.'},
    {'species':'Alces alces','reason':'Pinned AnAge data quality is low.'},
    {'species':'Ovis aries','reason':'Source taxon combines domestic sheep and mouflon; cohort identity requires further review.'},
    {'species':'Canis familiaris','reason':'Generic domestic-dog body mass is not a breed-specific comparison; hold until cohort/breed provenance is resolved.'},
]}
for scientific,(common,group) in NEW.items():
    r = rows[scientific]
    assert r['Data quality'] in {'high','acceptable'}, scientific
    aid = scientific.lower().replace(' ','_')
    if not any(a['id']==aid for a in data['animals']):
        data['animals'].append(dict(id=aid,commonName=common,scientificName=scientific,taxonomicGroup=group,familiarityTier='familiar',active=True))
    for tid,column in FIELDS.items():
        if not r[column] or tid=='maximum_documented_lifespan' and r['Specimen origin']!='captivity':continue
        n = float(r[column]); assert math.isfinite(n) and n>0
        t = traits[tid]
        row = dict(animalId=aid,traitId=tid,valueNumeric=n,unit=t['unit'],sex='female' if tid=='female_maturity' else 'male' if tid=='male_maturity' else 'species-level',lifeStage='newborn' if tid=='birth_weight' else 'adult' if tid=='adult_body_mass' else 'species-level',measurementBasis=t['measurementBasis'],sourceId=t['canonicalSourceId'],observationType='compiled',confidence='approved',notes=f"AnAge Build 15, exact source taxon {scientific}, HAGRID {r['HAGRID']}, original column {column}, references {r['References']}. Quality {r['Data quality']}. Published typical values, not guaranteed individual sizes; source sex/population may vary. Longevity origin {r['Specimen origin']}; no wild/captive substitution. Domestic goat remains distinguished from wild goats, and wild boar from domestic pigs.",recordOrigin=r['Specimen origin'] if tid=='maximum_documented_lifespan' else 'not-specified',uncertaintyStatus='not-reported',sourceQuality=r['Data quality'],sampleSizeCategory=r['Sample size'] if tid=='maximum_documented_lifespan' else 'not-reported')
        data['values']=[v for v in data['values'] if (v['animalId'],v['traitId'])!=(aid,tid)]+[row]
        audit['observations'].append(dict(species=scientific,traitId=tid,value=n,hagrid=r['HAGRID'],sourceColumn=column))
(P/'pilot.json').write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
(P/'research/roster-expansion-audit.json').write_text(json.dumps(audit,indent=2,ensure_ascii=False)+'\n')
print({'newSpecies':len(NEW),'newSourceObservations':len(audit['observations'])})
