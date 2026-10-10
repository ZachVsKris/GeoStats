#!/usr/bin/env python3
"""Admit exact-species, cited FishBase egg records. Never use derived fecundity curves."""
import argparse,collections,hashlib,json,math,pathlib,re
import pyarrow.parquet as pq
root=pathlib.Path(__file__).resolve().parents[1];parser=argparse.ArgumentParser();parser.add_argument('--source-root',type=pathlib.Path,required=True);args=parser.parse_args()
parts=[json.loads((root/f'data/animalstats/{n}.json').read_text()) for n in ['pilot','existing-coverage','fish-records','marine']];animals={a['scientificName']:a for p in parts for a in p['animals']};species={r['SpecCode']:r for r in pq.read_table(args.source_root/'species.parquet').to_pylist()};refs={r['RefNo']:r for r in pq.read_table(args.source_root/'refrens.parquet').to_pylist()}
source='fishbase-eggs-spawning-2606';d={k:[] for k in ['animals','traits','values','sources','photos','boards']};d['sources']=[{'id':source,'name':'FishBase · cited egg and fecundity records','sourceClass':'curated-trait-database','url':'https://fishbase.se/manual/fishbasethe_spawning_table.htm','versionYear':'26.06 frozen snapshot','retrievedAt':'2026-10-10','license':'CC BY-NC 4.0; cite FishBase, Froese and Pauly, and original record references'}]
metrics=[('fish_ripe_egg_count','Most eggs in a female','Fewest eggs in a female','eggs','offspring','Largest cited absolute fecundity record for the species in FishBase SPAWNING 26.06: the number of eggs in a ripe female. This is a documented specimen/population record, not annual or lifetime offspring, breeding success, or a value predicted from body length. Body sizes and localities vary; original record context is retained.','spawning','FecundityMax','FecundityRef'),('fish_egg_diameter','Largest eggs','Smallest eggs','mm','egg-size','Largest cited egg-diameter record in FishBase EGGS 26.06 for bony fish. Values describe the egg, not a shark/skate egg case; spherical and ovoid eggs retain their reported diameter. This is linear diameter, not egg volume or weight. Original records, species, localities and references are retained.','eggs','Eggdiammax','EggdiammaxRef')]
accepted=[];held=[];manifest=[]
flags=re.compile(r'calculat|predict|modelled|modeled|length.fecundity|fecundity.length|unpublished|doubtful|personal comm|assum|no further information|estimated|estimation',re.I)
for tid,hi,lo,unit,key,basis,table,field,refcol in metrics:
 for suffix,label,direction,counter in [('',hi,'higher_wins','__low'),('__low',lo,'lower_wins','')]:d['traits'].append({'id':tid+suffix,'displayName':label,'definition':basis,'measurementBasis':basis,'direction':direction,'unit':unit,'eligibilityGroups':['fish'],'canonicalSourceId':source,'separationMethod':'positive_ratio_5_percent','prototypeCategory':True,'categoryKind':'intuitive' if key=='offspring' else 'specialist','metricKey':key,'gameplayFamily':key,'counterTraitId':tid+counter})
 path=args.source_root/(table+'.parquet');manifest.append({'table':table,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()});eligible=collections.defaultdict(list)
 for r in pq.read_table(path).to_pylist():
  code=r.get('SpecCode',r.get('Speccode'));sp=species.get(code);v=r.get(field)
  if not sp or not isinstance(v,(int,float)) or not math.isfinite(v) or v<=0:continue
  name=sp['Genus']+' '+sp['Species'];animal=animals.get(name)
  if not animal or animal['taxonomicGroup']!='fish':continue
  refno=r.get(refcol) or r.get('EggsRefNo') or r.get('SpawningRefNo');ref=refs.get(refno);comment=(r.get('FecComment') or '')+' '+(r.get('AddInfos') or '')+' '+(r.get('AddChars') or '');reason=None
  if sp.get('TaxIssue'):reason='unresolved taxonomy'
  elif not ref or not ref.get('Title'):reason='no original citation'
  elif flags.search(comment+' '+ref['Title']):reason='derived, estimated, doubtful or unverifiable record'
  elif table=='spawning' and re.search(r'annual|seasonal|batch|per day|per month|per year|lifetime|mean fecundity|relative fecundity',comment,re.I):reason='incompatible fecundity basis'
  elif table=='eggs' and r.get('Shapeofegg') not in [None,'spherical','ovoid']:reason='incompatible egg geometry'
  if reason:held.append({'species':name,'field':field,'reason':reason,'reference':refno});continue
  eligible[code].append((v,r,refno,ref))
 for code,rows in eligible.items():
  v,r,refno,ref=max(rows,key=lambda item:item[0]);sp=species[code];animal=animals[sp['Genus']+' '+sp['Species']];citation=f"{ref.get('Author')}. {ref.get('Year')}. {ref['Title']} {ref.get('Source') or ''}";citation=re.sub('<[^>]+>','',citation)
  # Source is a float32 table: preserve five significant digits, not spurious
  # binary-storage decimal tails. Egg counts are stored as integers.
  numeric=int(v) if table=='spawning' else float(f'{v:.5g}')
  notes=f"FishBase species {code}; {table} row {r.get('autoctr',r.get('Stockcode'))}; field {field}; original reference {refno}. {citation}. Locality: {r.get('Spawningarea')}; corresponding specimen weight: {r.get('WeightMax')}; egg shape: {r.get('Shapeofegg')}. {r.get('FecComment') or ''}. https://www.fishbase.se/summary/{sp['Genus']}-{sp['Species']}.html"
  for suffix in ['', '__low']:d['values'].append({'animalId':animal['id'],'traitId':tid+suffix,'valueNumeric':numeric,'unit':unit,'sex':'female' if table=='spawning' else 'not applicable','lifeStage':'ripe adult female' if table=='spawning' else 'egg','measurementBasis':basis,'sourceId':source,'observationType':'compiled','confidence':'approved','notes':notes,'uncertaintyStatus':'not-reported'})
  accepted.append({'animalId':animal['id'],'field':field,'value':numeric,'reference':refno,'citation':citation})
(root/'data/animalstats/aquatic-eggs.json').write_text(json.dumps(d,ensure_ascii=False)+'\n');(root/'data/animalstats/research/aquatic-eggs-admission.json').write_text(json.dumps({'sourceFiles':manifest,'accepted':accepted,'held':held,'coverage':dict(collections.Counter(r['field'] for r in accepted)),'rules':['Only exact existing bony-fish species','Cited records only; no derived curves or estimated values','Reject annual, batch, lifetime and mean fecundity summaries','Do not import SeaLifeBase egg records until oocyte versus encapsulated egg size is checked','Maximum eligible record per species; not typical size or universal world record']},indent=2)+'\n');print(collections.Counter(r['field'] for r in accepted))
