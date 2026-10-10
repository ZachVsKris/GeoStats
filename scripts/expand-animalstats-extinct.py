#!/usr/bin/env python3
"""Build a conservative extinct-only dinosaur catalog from two full primary tables."""
import pathlib,json,xlrd,re,hashlib,collections
ROOT=pathlib.Path(__file__).resolve().parents[1];P=ROOT/'data/animalstats/source/extinct-20261010';D=ROOT/'data/animalstats/pilot.json'
w=xlrd.open_workbook(P/'benson-original.xls');s=w.sheet_by_name('Full data');pb=json.loads((P/'pbdb-dinosaur-species.json').read_text());lookup=collections.defaultdict(list)
for row in pb['records']:lookup[row['nam']].append(row)
genera='Tyrannosaurus Triceratops Stegosaurus Velociraptor Diplodocus Brachiosaurus Apatosaurus Allosaurus Ankylosaurus Iguanodon Parasaurolophus Carnotaurus Deinonychus Giganotosaurus Ceratosaurus Coelophysis Compsognathus Gallimimus Protoceratops Pachycephalosaurus Plateosaurus Dilophosaurus Herrerasaurus Eoraptor Kentrosaurus Edmontosaurus Corythosaurus Maiasaura Camarasaurus Amargasaurus Mamenchisaurus Microraptor Sinosauropteryx Albertosaurus Baryonyx Suchomimus Daspletosaurus Tarbosaurus Utahraptor Ouranosaurus Acrocanthosaurus Euoplocephalus Nodosaurus Saurolophus Centrosaurus Chasmosaurus Torosaurus Struthiomimus Ornithomimus'.split()
core=set('Tyrannosaurus Triceratops Stegosaurus Velociraptor Diplodocus Brachiosaurus Apatosaurus Allosaurus Ankylosaurus Iguanodon Parasaurolophus Carnotaurus Deinonychus'.split())
# Referred/contested specimens, reassigned species and all estimated measurements stay out.
held={'Compsognathus_corallestris','Dilophosaurus_sinensis','Troodon_formosus','Argentinosaurus_huinculensis'}
grouped=collections.defaultdict(list);rejections=[]
for i in range(1,s.nrows):
 r=s.row_values(i);name=r[1];genus=name.split('_')[0]
 if genus not in genera:continue
 reason=None
 if name in held:reason='contested taxon or specimen referral'
 elif r[23]!=0 or r[24]!=0:reason='juvenile or bonebed'
 elif not isinstance(r[9],(float,int)) or r[9]<=0:reason='no femur length'
 elif re.search(r'estimat|multiple individuals|reconstruct|scal(?:ed|ing)',str(r[22]),re.I):reason='notes indicate estimation or mixed specimens'
 elif len(lookup[name.replace('_',' ')])!=1:reason='ambiguous or absent exact taxonomy join'
 elif not str(r[21]).strip():reason='missing original reference'
 if reason:rejections.append({'name':name,'row':i+1,'reason':reason});continue
 b=lookup[name.replace('_',' ')][0]
 if b.get('ext')!='0' or b.get('flg') or not b.get('noc') or not b.get('fea') or not re.search(r'\d{4}',b.get('att','')):continue
 grouped[genus].append((r,b,i+1))
d=json.loads(D.read_text());d['animals']=[a for a in d['animals'] if not a['id'].startswith('extinct_')];d['traits']=[t for t in d['traits'] if not t['id'].startswith('extinct_')];d['values']=[v for v in d['values'] if not v['traitId'].startswith('extinct_')];d['sources']=[s for s in d['sources'] if not s['id'].startswith('extinct-')];d['photos']=[p for p in d['photos'] if not p['animalId'].startswith('extinct_')]
sources=[('extinct-pbdb-20261010','Paleobiology Database · exact dinosaur species','https://paleobiodb.org/','2026 snapshot','CC BY 4.0'),('extinct-benson-2014','Benson et al. · original fossil specimen measurements','https://doi.org/10.1371/journal.pbio.1001853','2014','CC0')]
for id,name,url,year,license in sources:d['sources'].append(dict(id=id,name=name,url=url,versionYear=year,retrievedAt='2026-10-10',license=license,sourceClass='primary-research' if 'benson' in id else 'curated-trait-database'))
metrics=[('fossil_age','Oldest recorded fossils','Youngest recorded fossils','million years ago','fossil-time','intuitive','extinct-pbdb-20261010','Upper age bound of the oldest fossil occurrence assigned to this exact species in the PBDB snapshot. The full age interval is preserved; overlapping intervals are excluded from rounds. This is fossil evidence, not an estimate of when the animal evolved.'),('description','Named longest ago','Named most recently','years since description (2026)','extinct-scientific-history','intuitive','extinct-pbdb-20261010','Years from the original scientific description year in the PBDB taxonomic authority to the fixed reference year 2026. This is naming history, not the year the first fossil was found.'),('occurrences','Most recorded fossil finds','Fewest recorded fossil finds','PBDB occurrence records','fossil-discovery','intuitive','extinct-pbdb-20261010','Number of occurrence records assigned to this exact species in the 2026-10-10 Paleobiology Database snapshot. Records represent documented fossil finds, not individual skeletons, historical population or completeness of the fossil record.'),('femur','Longest thigh bone','Shortest thigh bone','mm','fossil-anatomy','specialist','extinct-benson-2014','Largest eligible adult femur length reported for this exact species in Benson et al. (2014). Excludes flagged juveniles, bonebeds, mixed-individual notes and estimated lengths. It describes the measured source specimens, not the maximum possible size of the species.')]
for metric,high,low,unit,family,kind,source,definition in metrics:
 basis=definition
 for direction,label,suffix,counter in [('higher_wins',high,'','__low'),('lower_wins',low,'__low','')]:
  id='extinct_'+metric+suffix;d['traits'].append(dict(id=id,displayName=label,prototypeCategory=True,counterTraitId='extinct_'+metric+counter,metricKey=family,gameplayFamily=family,categoryKind=kind,definition=definition,direction=direction,unit=unit,eligibilityGroups=['dinosaur'],canonicalSourceId=source,separationMethod='distinct_ordinal' if metric=='description' else 'positive_ratio_5_percent',measurementBasis=basis))
records=[]
for genus,rows in grouped.items():
 # One exact species per familiar genus, selected by specimen coverage, never by presumed taxonomy inheritance.
 counts=collections.Counter(r[0][1] for r in rows);name=max(counts,key=lambda n:(counts[n],max(r[0][9] for r in rows if r[0][1]==n)));rows=[r for r in rows if r[0][1]==name];r,b,line=max(rows,key=lambda x:x[0][9]);id='extinct_'+name.lower();year=int(re.search(r'\d{4}',b['att'])[0]);lower=min(x[0][9] for x in rows);upper=r[9]
 d['animals'].append(dict(id=id,commonName='T. rex' if genus=='Tyrannosaurus' else genus,scientificName=name.replace('_',' '),taxonomicGroup='dinosaur',extinctionStatus='extinct',familiarityTier='core' if genus in core else 'familiar',active=True))
 asset='/animalstats/extinct/'+genus.lower()+'.svg';d['photos'].append(dict(animalId=id,assetUrl=asset,originalUrl=asset,creator='AnimalStats',license='CC BY 4.0',attribution='AnimalStats anatomical cartoon reconstruction; colors are illustrative',approved=True))
 nums={'fossil_age':b['fea'],'description':2026-year,'occurrences':b['noc'],'femur':upper}
 for metric,_,_,unit,_,_,source,definition in metrics:
  notes=(f'PBDB taxon {b["oid"]}; authority {b["att"]}; occurrence reference {b.get("rid")}; snapshot 2026-10-10.' if metric!='femur' else f'Original table row {line}; institution {r[25]}; specimen {r[26]}; source: {r[21]}; notes: {r[22]}.')
  for suffix in ['','__low']:
   v=dict(animalId=id,traitId='extinct_'+metric+suffix,valueNumeric=nums[metric],unit=unit,sex='not specified',lifeStage='adult fossil specimen' if metric=='femur' else 'taxon record',measurementBasis=definition,sourceId=source,observationType='compiled',confidence='approved',notes=notes)
   if metric=='fossil_age':v.update(valueMin=b.get('fla',b['fea']),valueMax=b['fea'],uncertaintyKind='source-range',uncertaintyStatus='reported')
   if metric=='femur' and lower!=upper:v.update(valueMin=lower,valueMax=upper,uncertaintyKind='source-range',uncertaintyStatus='reported')
   d['values'].append(v)
 records.append({'id':id,'genus':genus,'clade':r[3],'subclade':r[4],'specimen_rows':[x[2] for x in rows],'pbdb':b,'specimen_source':r[21]})
E={k:[v for v in d[k] if (v.get('extinctionStatus')=='extinct' if k=='animals' else v.get('id','').startswith('extinct-') if k=='sources' else v.get('id','').startswith('extinct_') if k=='traits' else v.get('traitId','').startswith('extinct_') if k=='values' else v.get('animalId','').startswith('extinct_'))] for k in ['animals','traits','values','sources','photos']};E['boards']=[];(ROOT/'data/animalstats/extinct.json').write_text(json.dumps(E)+'\n');R=ROOT/'data/animalstats/research/extinct-intake-audit.json';R.write_text(json.dumps({'accepted_species':len(records),'metrics':4,'labels':8,'records':records,'rejected_rows':rejections,'policy':'Extinct-only boards; no modeled mass/speed/lifespan; exact species joins; bounds retained; three intuitive metrics and one specialist metric.'},indent=2)+'\n');print('Accepted',len(records),'species; 8 candidate labels; no boards yet')
