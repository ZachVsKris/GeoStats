#!/usr/bin/env python3
"""Admit cited, non-doubtful fish records; do not use calculated Key Facts."""
import json,pathlib,re,collections,hashlib,argparse
import pyarrow.parquet as pq
R=pathlib.Path(__file__).resolve().parents[1];parser=argparse.ArgumentParser();parser.add_argument('--fishbase-root',type=pathlib.Path,required=True);a=parser.parse_args();S=a.fishbase_root;base=json.loads((R/'data/animalstats/pilot.json').read_text());names=json.loads((R/'data/animalstats/research/familiar-fish-roster.json').read_text());species={r['SpecCode']:r for r in pq.read_table(S/'species.parquet').to_pylist()};refs={r['RefNo']:r for r in pq.read_table(S/'refrens.parquet').to_pylist()};path=R/'data/animalstats/source/underrepresented-20261010/fishbase-popchar.parquet';
if not path.exists():
 import requests
 path.parent.mkdir(parents=True,exist_ok=True)
 response=requests.get('https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/cboettig/fishbase/fb/v26.06/parquet/popchar.parquet',timeout=90);response.raise_for_status();path.write_bytes(response.content)
raw=pq.read_table(path).to_pylist();old={a['scientificName']:a for a in base['animals']};src='fishbase-popchar-2606';d={'animals':[],'traits':[],'values':[],'photos':[],'sources':[{'id':src,'name':'FishBase · cited size and age records','sourceClass':'curated-trait-database','url':'https://www.fishbase.se/manual/fishbasethe_POPCHAR_table.htm','versionYear':'26.06 snapshot','retrievedAt':'2026-10-10','license':'CC BY-NC 4.0; cite Froese and Pauly (eds), FishBase and original references'}],'boards':[]};allanimals={};rejected=[];accepted=[]
# Editorial species selection, not numeric inference. Same species IDs as existing data.
for code,r in species.items():
 name=r['Genus']+' '+r['Species']
 if name not in names:continue
 existing=old.get(name);aid=existing['id'] if existing else name.lower().replace(' ','_');allanimals[code]=aid
 if not existing:d['animals'].append({'id':aid,'commonName':r['FBname'],'scientificName':name,'taxonomicGroup':'fish','entityType':'species','familiarityTier':'familiar','active':True})
metrics=[('fish_record_mass','Heaviest recorded adult','Lightest recorded adult','g','mass','Largest eligible total body-weight record in the FishBase POPCHAR snapshot. Only cited IGFA weighing records are admitted. This is a documented catch record, not typical weight or a prediction from length.'),('fish_record_length','Longest body','Shortest body','cm','length','Largest cited total-length (TL) record in the FishBase POPCHAR snapshot after excluding doubtful, estimated and converted records. Standard length, fork length and disc width are not mixed or converted.'),('fish_record_wild_age','Longest recorded wild life','Shortest recorded wild life','years','lifespan','Oldest eligible cited wild specimen age in the FishBase POPCHAR snapshot. Doubtful, modeled, captive and unverifiable records are excluded. Ages reported by studies using biological ageing methods are compiled records, not typical life expectancy.')]
for tid,hi,lo,unit,metric,basis in metrics:
 for suffix,label,direction,counter in [('',hi,'higher_wins','__low'),('__low',lo,'lower_wins','')]:d['traits'].append({'id':tid+suffix,'displayName':label,'definition':basis,'measurementBasis':basis,'direction':direction,'unit':unit,'eligibilityGroups':['fish','shark','ray'],'canonicalSourceId':src,'separationMethod':'positive_ratio_5_percent','prototypeCategory':True,'categoryKind':'intuitive','metricKey':metric,'gameplayFamily':metric,'counterTraitId':tid+counter})
flags=re.compile(r'doubtful|unpublished|estimated weight|estimated length|estimated maximum|theoretical|von bertalanffy|calculated|reconstructed|converted|transferred|TL assumed|captive|captivity|aquarium|pond|assumed TL',re.I)
for tid,_,_,unit,metric,basis in metrics:
 eligible=collections.defaultdict(list)
 for r in raw:
  if r['Speccode']not in allanimals:continue
  f={'mass':'Wmax','length':'Lmax','lifespan':'tmax'}[metric];value=r.get(f);reference=refs.get(r['PopCharRefNo']);reason=None
  if not isinstance(value,(int,float))or value<=0:continue
  if not reference or not reference.get('Title'):reason='missing reference'
  elif flags.search(r.get('Comments')or''):reason='estimated, doubtful, captive or converted record'
  elif metric=='mass'and(r.get('TypeWeight')!='total weight'or not re.search(r'IGFA|International Game Fish Association',reference.get('Author')or'',re.I)):reason='not a cited IGFA total-weight record'
  elif metric=='length' and allanimals[r['Speccode']] in ['rhincodon_typus','cetorhinus_maximus']:reason='large shark record requires original measurement verification'
  elif metric=='length'and(r.get('Type')!='TL'or r.get('LmaxQuality')not in [0,None]):reason='wrong length type or doubtful quality'
  elif metric=='lifespan'and(r.get('tmaxQuality')not in [0,None]or re.search(r'estimation|prediction|modelling|modeling|potential longevity',reference['Title'],re.I)):reason='doubtful or modeled age'
  if reason:rejected.append({'row':r['Autoctr'],'metric':metric,'reason':reason});continue
  eligible[r['Speccode']].append((value,r,reference))
 for code,rr in eligible.items():
  value,r,reference=max(rr,key=lambda x:x[0]);aid=allanimals[code];citation=f"{reference.get('Author')}. {reference.get('Year')}. {reference['Title']} {reference.get('Source')or''}";notes=f"FishBase species {code}; POPCHAR record {r['Autoctr']}; reference {r['PopCharRefNo']}. {citation} Locality: {r.get('Locality')}; sex: {r.get('Sex')}. {r.get('Comments')or''}";notes=re.sub('<[^>]+>','',notes)
  for suffix in ['', '__low']:d['values'].append({'animalId':aid,'traitId':tid+suffix,'valueNumeric':round(value,5),'unit':unit,'sex':r.get('Sex')or'not specified','lifeStage':'record specimen','measurementBasis':basis,'sourceId':src,'observationType':'compiled','confidence':'approved','notes':notes,'recordOrigin':'wild catch','uncertaintyStatus':'not-reported'})
  accepted.append({'animalId':aid,'metric':metric,'value':round(value,5),'row':r['Autoctr'],'reference':r['PopCharRefNo'],'citation':citation})
(R/'data/animalstats/fish-records.json').write_text(json.dumps(d)+'\n');(R/'data/animalstats/research/fish-records-admission.json').write_text(json.dumps({'sourceRows':len(raw),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'selectedSpecies':len(allanimals),'newAnimals':len(d['animals']),'acceptedRecords':accepted,'rejectedRecords':rejected,'coverage':dict(collections.Counter(x['metric']for x in accepted)),'rules':['No modeled Key Facts or length-weight calculations','Exact species only','No TL/SL/FL conversions','No doubtful records','Only cited IGFA total-weight records','Preserve original references, sex and locality','New species await portraits before entering rounds']},indent=2)+'\n');print('Record coverage',dict(collections.Counter(x['metric']for x in accepted)))
