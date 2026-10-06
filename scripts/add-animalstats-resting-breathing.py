#!/usr/bin/env python3
"""Import a reviewed single-study subset, without taxon aliases or predictions."""
import csv
import hashlib
import json
import math
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'data/animalstats'
source_file=P/'source/discovery-heart-frdata-filter.csv'
assert hashlib.sha1(b'blob '+str(len(source_file.read_bytes())).encode()+b'\0'+source_file.read_bytes()).hexdigest()=='5dba3c5a2664b7dea11b481d2a5b6f00a61482de'
data=json.loads((P/'pilot.json').read_text())
animals={a['scientificName']:a for a in data['animals'] if a.get('entityType') != 'breed'}
accepted={'Ceratotherium simum','Hippopotamus amphibius','Giraffa camelopardalis','Ursus maritimus','Castor canadensis'}
basis=('Reported breathing frequency in awake, resting adult mammals from Mortola & Lanthier 2005, '
       'as transcribed in the author mammal-allometry archive pinned to 91c6e5df80459a9c69c445a32e30653e5c351f10. '
       'Only exact named wild-species matches with at least three sampled animals and explicit adult/resting/unsedated flags. '
       'Study cohort rates, not universal species constants; temperature, feeding and sex are not standardized. '
       'No allometric predictions, domestic-dog-to-wolf substitution or missing-value imputation.')
sid='mortola-lanthier-2005-breathing'
source=dict(id=sid,name='Mortola & Lanthier: measured resting breathing frequency',
            sourceClass='primary-research',url='https://doi.org/10.1016/j.resp.2004.10.006',
            versionYear='2005; pinned numerical archive 91c6e5d',retrievedAt='2026-10-03',
            license='Selected attributed numerical facts; no blanket archive redistribution license claimed')
data['sources']=[s for s in data['sources'] if s['id']!=sid]+[source]
tid='resting_breathing_frequency'
trait=dict(id=tid,displayName='Fastest breathing at rest',unit='breaths/min',definition=basis,
           measurementBasis=basis,canonicalSourceId=sid,eligibilityGroups=[],direction='higher_wins',
           separationMethod='positive_ratio_5_percent',gameplayFamily='breathing',
           playerHint='Breaths per minute while awake and resting. Measured study averages.')
data['traits']=[t for t in data['traits'] if t['id'] not in {tid,tid+'__low'}]+[trait]
data['values']=[v for v in data['values'] if v['traitId'] not in {tid,tid+'__low'}]
audit=[]
for index,row in enumerate(csv.DictReader(source_file.open()),2):
    name=row.get('genus','')+' '+row.get('species','')
    if name not in accepted:continue
    assert row['Primary Source']=='Mortola and Lanthier, 2005'
    assert all(row[k]==v for k,v in [('adult','y'),('resting','y'),('sedated','n')])
    assert re.fullmatch(r'\d+\+?',row['Number of Animals'])
    assert int(row['Number of Animals'].rstrip('+'))>=3
    number=float(row['fr']);assert math.isfinite(number) and number>0
    observation=dict(animalId=animals[name]['id'],traitId=tid,valueNumeric=number,unit='breaths/min',
                     sex='not standardized',lifeStage='adult',measurementBasis=basis,sourceId=sid,
                     observationType='compiled',confidence='approved',uncertaintyStatus='not-reported',
                     notes=f"Mortola & Lanthier 2005; archive CSV row {index}; N={row['Number of Animals']}; adult y, resting y, sedated n. "
                           f"Fasted={row['fasted']}, thermoneutral={row['tnz']}, nonreproductive={row['nonrep']}; m means missing, not yes. "
                           "No published uncertainty bounds in this archive. Original study protocol verified from primary publication. "
                           "Numerical transcription preserved; no rounding or averaging across studies.")
    data['values'].append(observation)
    audit.append(dict(scientificName=name,value=number,sampleSizeRaw=row['Number of Animals'],
                      sourceRow=index,primaryStudy=source['url'],
                      numericArchive='https://github.com/stacyderuiter/mammal-allometry/blob/91c6e5df80459a9c69c445a32e30653e5c351f10/data/frdata-filter.csv',
                      decision='approved-study-cohort-comparison',missingUncertainty=True))
assert len(audit)==5
(P/'pilot.json').write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
(P/'research/resting-breathing-audit.json').write_text(json.dumps(dict(
    reviewedAt='2026-10-03',traitId=tid,measurementBasis=basis,records=audit,
    exclusions=['Domestic dog never mapped to gray wolf','Mixed source studies excluded','Fewer than three animals excluded',
                'Unspecified adult/resting/sedation state excluded','Unknown flags not promoted to positive protocol flags'],
    sourceSha256=hashlib.sha256(source_file.read_bytes()).hexdigest(),
    approvalScope='Selected study-cohort facts only; board eligibility and rank separation independently tested'),indent=2)+'\n')
print(json.dumps({'approved_observations':len(audit),'new_metric_families':1,'proposed_directions':2}))
