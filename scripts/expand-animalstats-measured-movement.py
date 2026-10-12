#!/usr/bin/env python3
"""Extend existing facts from the empirical table, never the fitted speed model."""
import collections,csv,gzip,hashlib,io,json,math,pathlib,statistics,zipfile
import openpyxl
R=pathlib.Path(__file__).resolve().parents[1];P=R/'data/animalstats'
parts=[json.loads((P/(n+'.json')).read_text()) for n in ['pilot','existing-coverage','fish-records','tetrapod-spatial','marine','aquatic-eggs','underrepresented','insect-ladybirds']]
d=parts[1];names={a['scientificName'].lower():a for part in parts for a in part['animals'] if a.get('entityType')!='breed'}
traits={t['id']:t for part in parts for t in part['traits']};present={(v['animalId'],v['traitId']) for part in parts for v in part['values']}
archive=P/'source/movement-2023/travel-speed-data.zip'
assert hashlib.sha256(archive.read_bytes()).hexdigest()=='8224f0998dcf01c744b002121cf145134266f662f682184c881e048a443df4b2'
z=zipfile.ZipFile(archive);rows=list(csv.DictReader(io.StringIO(z.read('Travel speed data and model/data/processed/df_spp.csv').decode('latin1'))))
book=openpyxl.load_workbook(io.BytesIO(z.read('Travel speed data and model/data/processed/df_spp_refs.xlsx')),read_only=True,data_only=True)
sheet=book['df_spp_refs'];cells=list(sheet.values);refs={int(row[0]):dict(zip(cells[0],row)) for row in cells[1:] if row[0] is not None}
mdd={r['sciName'].replace('_',' ').lower():r for r in csv.DictReader(gzip.open(P/'source/mdd/MDD_v2.5_6904species.csv.gz','rt')) if r['extinct']=='0' and r['flagged']=='0'}
flight=dict(traits['field_swim_speed'],id='field_flight_speed',displayName='Fastest measured flight',counterTraitId='field_flight_speed__low',eligibilityGroups=['bird','insect','bat'],definition='Median of empirical field-study mean flying travel speeds in Dyer et al. 2023. Direct observation or telemetry only; laboratory trials, reported medians and fitted predictions are excluded. Flight can include gliding and is not a maximum dive or sprint. Study sex and life stage are not standardized; the full included study-mean envelope is checked.',playerHint='Measured travel through the air, including gliding—not a diving record.')
flight['measurementBasis']=flight['definition']
for suffix,label,direction,counter in [('',flight['displayName'],'higher_wins','__low'),('__low','Slowest measured flight','lower_wins','')]:
 t=dict(flight,id='field_flight_speed'+suffix,displayName=label,direction=direction,counterTraitId='field_flight_speed'+counter)
 if t['id'] not in traits:d['traits'].append(t);traits[t['id']]=t
accepted=[];held=[];new=[]
for mode,tid in [('running','field_travel_speed'),('swimming','field_swim_speed'),('flying','field_flight_speed')]:
 by=collections.defaultdict(list)
 for row in rows:
  if row['move_movement_mode']!=mode or row['move_study_condition']!='field' or row['move_avgspeed_value']!='mean' or row['move_speed_method'] not in ['direct_obs','telemetry']:continue
  name=row['scientific_name'];a=names.get(name.lower())
  if not a and row['taxon_group']=='mammal' and name.lower() in mdd and name!='Homo sapiens':
   tax=mdd[name.lower()];a=dict(id=name.lower().replace(' ','_'),scientificName=name,commonName=tax['mainCommonName'],entityType='species',taxonomicGroup='marine-mammal' if tax['family'] in ['Phocidae','Otariidae','Odobenidae','Balaenopteridae','Phocoenidae','Delphinidae','Ziphiidae','Monodontidae','Balaenidae','Physeteridae','Kogiidae'] else 'bat' if tax['order']=='Chiroptera' else 'carnivore' if tax['order']=='Carnivora' else 'rodent' if tax['order']=='Rodentia' else 'mammal',familiarityTier='familiar',active=True)
   d['animals'].append(a);names[name.lower()]=a;new.append(a['id'])
  if not a:held.append(dict(name=name,mode=mode,reason='No exact reviewed catalog taxon; no synonym or genus transfer'));continue
  n=float(row['move_avgspeed_ms']);ref=refs.get(int(row['move_speed_ref']))
  if not math.isfinite(n) or n<=0 or not ref or not ref.get('ref_citation'):continue
  by[a['id']].append(row)
 for aid,rr in by.items():
  nums=[float(r['move_avgspeed_ms'])*3.6 for r in rr]
  note='; '.join(f"Empirical source row: {r['scientific_name']}, {r['move_avgspeed_ms']} m/s; field {r['move_speed_method']}; reference {r['move_speed_ref']}: {refs[int(r['move_speed_ref'])]['ref_citation']}; DOI {refs[int(r['move_speed_ref'])].get('ref_DOI') or 'not supplied'}" for r in rr)+'. Study means summarized by their median. No fitted speed or body-mass prediction is used.'
  for suffix in ['','__low']:
   t=traits[tid+suffix]
   if (aid,t['id']) in present:continue
   v=dict(animalId=aid,traitId=t['id'],valueNumeric=statistics.median(nums),unit='km/h',sex='source cohorts',lifeStage='source stages not standardized',measurementBasis=t['measurementBasis'],sourceId='travel-speed-2023',observationType='compiled',confidence='approved',notes=note,recordOrigin='wild',uncertaintyStatus='reported' if min(nums)!=max(nums) else 'not-reported',uncertaintyKind='source-range' if min(nums)!=max(nums) else 'not-reported')
   if min(nums)!=max(nums):v.update(valueMin=min(nums),valueMax=max(nums))
   d['values'].append(v);present.add((aid,t['id']));accepted.append(v)
(P/'existing-coverage.json').write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
report=dict(source='Dyer et al. 2023 empirical table, Zenodo 7554842',archiveSha256=hashlib.sha256(archive.read_bytes()).hexdigest(),addedAnimals=new,addedValues=len(accepted),addedDistinctMeasurements=len(accepted)//2,traitCoverage={tid:len({v['animalId'] for part in parts for v in part['values'] if v['traitId']==tid}) for tid in ['field_travel_speed','field_swim_speed','field_flight_speed']},held=held,policy=['Exact species joins only','Field study means only; no laboratory, median or fitted records','Original citations and descriptive disagreement envelopes retained','Body masses from this source are never imported'])
(P/'research/measured-movement-admission-20261012.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='held'}))
