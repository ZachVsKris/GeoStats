import csv,json,statistics,copy
from pathlib import Path
root=Path(__file__).resolve().parents[1];path=root/'data/animalstats/pilot.json';d=json.loads(path.read_text())
base=next(t for t in d['traits'] if t['id']=='raw_fledging_age');base.update(displayName='Longest wait to leave the nest',gameplayFamily='fledging',metricKey='fledging',prototypeCategory=True,categoryKind='intuitive',counterTraitId='raw_fledging_age__low',playerHint='Published hatch-to-fledge age; not the age of complete independence. Fledging does not always mean flying.')
d['traits']=[t for t in d['traits'] if t['id']!='raw_fledging_age__low' and not t['id'].startswith('mammal_head_body_length')];low=copy.deepcopy(base);low.update(id='raw_fledging_age__low',displayName='Shortest wait to leave the nest',direction='lower_wins',counterTraitId=base['id']);d['traits'].append(low)
d['values']=[v for v in d['values'] if v['traitId']!='raw_fledging_age__low' and not v['traitId'].startswith('mammal_head_body_length')];d['values'] += [dict(v,traitId='raw_fledging_age__low') for v in d['values'][:] if v['traitId']=='raw_fledging_age']
groups=sorted({a['taxonomicGroup'] for a in d['animals'] if any(v['animalId']==a['id'] and v['traitId']=='gestation' for v in d['values'])});basis='Median of distinct reported adult head-and-body lengths in exact-species Amniote raw records; mammals only; tail excluded. Reported source disagreements are retained as bounds.'
for suffix,label,direction,counter in [('', 'Longest mammal body','higher_wins','mammal_head_body_length__low'),('__low','Shortest mammal body','lower_wins','mammal_head_body_length')]:
 d['traits'].append(dict(id='mammal_head_body_length'+suffix,displayName=label,definition=basis,direction=direction,unit='cm',eligibilityGroups=groups,canonicalSourceId='amniote-raw-2015',separationMethod='positive_ratio_5_percent',measurementBasis=basis,gameplayFamily='length',metricKey='length',playerHint=basis,prototypeCategory=True,categoryKind='intuitive',counterTraitId=counter))
rows=list(csv.DictReader(open(root/'data/animalstats/source/amniote-selected-raw.csv')));audit=[]
for a in d['animals']:
 if a['taxonomicGroup'] not in groups or a.get('entityType')=='breed':continue
 matched=[(i+2,r) for i,r in enumerate(rows) if r['class']=='Mammalia' and r['genus']+' '+r['species']==a['scientificName'] and r['subspecies'] in ['-999','','NA'] and float(r['adult_svl_cm'])>0]
 vals=sorted({float(r['adult_svl_cm']) for _,r in matched})
 if not vals:continue
 value=statistics.median(vals);audit.append(dict(animalId=a['id'],rowNumbers=[i for i,_ in matched],reportedValues=vals,median=value))
 for suffix in ['', '__low']:
  v=dict(animalId=a['id'],traitId='mammal_head_body_length'+suffix,valueNumeric=value,unit='cm',sex='species-level',lifeStage='adult',measurementBasis=basis,sourceId='amniote-raw-2015',observationType='compiled',confidence='approved',notes='adult_svl_cm; raw row numbers '+str([i for i,_ in matched])+'; underlying citations: '+'; '.join(sorted({r['dataset'] for _,r in matched})),uncertaintyStatus='not-reported',recordOrigin='published compilation',sampleSizeCategory='not-reported')
  if len(vals)>1:v.update(valueMin=min(vals),valueMax=max(vals),uncertaintyStatus='reported-range')
  d['values'].append(v)
path.write_text(json.dumps(d,separators=(',',':'))+'\n');(root/'data/animalstats/research/wild-length-import.json').write_text(json.dumps(audit,indent=2)+'\n');print('Added length pairs for',len(audit),'mammals and fledging pair')
