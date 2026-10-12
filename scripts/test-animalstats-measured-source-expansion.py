#!/usr/bin/env python3
"""Audit game values directly against original empirical tables."""
import csv,io,json,pathlib,statistics,zipfile
P=pathlib.Path(__file__).resolve().parents[1]/'data/animalstats'
parts=[json.loads((P/(n+'.json')).read_text()) for n in ['pilot','existing-coverage','fish-records','tetrapod-spatial','marine','aquatic-eggs','underrepresented','insect-ladybirds']]
names={a['id']:a['scientificName'] for d in parts for a in d['animals']}
speeds=list(csv.DictReader(io.StringIO(zipfile.ZipFile(P/'source/movement-2023/travel-speed-data.zip').read('Travel speed data and model/data/processed/df_spp.csv').decode('latin1'))))
checked=0
for d in parts:
 for v in d['values']:
  if v['sourceId']!='travel-speed-2023':continue
  mode={'field_travel_speed':'running','field_swim_speed':'swimming','field_flight_speed':'flying'}[v['traitId'].removesuffix('__low')]
  raw=[float(r['move_avgspeed_ms'])*3.6 for r in speeds if r['scientific_name']==names[v['animalId']] and r['move_movement_mode']==mode and r['move_study_condition']=='field' and r['move_speed_method'] in ['direct_obs','telemetry'] and r['move_avgspeed_value']=='mean']
  assert raw and abs(v['valueNumeric']-statistics.median(raw))<1e-10,(v['animalId'],v['valueNumeric'],raw)
  if min(raw)!=max(raw):assert v['valueMin']==min(raw) and v['valueMax']==max(raw)
  assert v['recordOrigin']=='wild' and v['observationType']=='compiled'
  checked+=1
anage={r['Genus']+' '+r['Species']:r for r in csv.DictReader(io.StringIO(zipfile.ZipFile(P/'source/anage-build-15.zip').read('anage_data.txt').decode()),delimiter='\t')}
count=0
for v in parts[1]['values']:
 if v['sourceId']!='anage-15' or 'original column ' not in v['notes']:continue
 r=anage[names[v['animalId']]];field=v['notes'].split('original column ')[1].split(';')[0]
 assert r['References'] and r['Data quality'] in ['high','acceptable'] and float(r[field])==v['valueNumeric']
 if 'lifespan' in v['traitId']:assert r['Specimen origin']==v['recordOrigin']
 if field=='Adult weight (g)':assert 'adult' in v['traitId'] or v['traitId']=='lightest_adult'
 count+=1
assert checked>=214 and count>=1400
holds={r['animalId'] for r in json.loads((P/'research/longevity-review-decisions.json').read_text())['decisions'] if r['decision']=='hold'}
assert not any(v['sourceId']=='anage-15' and v['animalId'] in holds and ('lifespan' in v['traitId'] or 'longevity' in v['traitId']) and v['confidence']=='approved' for d in parts for v in d['values'])
assert not any(v['confidence']=='approved' and v['animalId']=='proteus_anguinus' and 'lifespan' in v['traitId'] for d in parts for v in d['values'])
print(json.dumps({'empiricalMovementValuesChecked':checked,'AnAgeRawSourceValuesChecked':count,'modeledSpeedsAndAssayWeightsExcluded':True}))
