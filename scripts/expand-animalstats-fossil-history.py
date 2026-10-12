#!/usr/bin/env python3
"""Add exact-species fossil discovery geography; never infer ancient habitats."""
import pathlib,json,collections,math,hashlib
R=pathlib.Path(__file__).resolve().parents[1];P=R/'data/animalstats';S=P/'source/underrepresented-20261010b';d=json.load(open(P/'extinct.json'));full=pathlib.Path('/tmp/underrepresented-new/pbdb-dinosaur-occurrences.json');raw=json.load(open(full if full.exists() else S/'pbdb-reviewed-occurrences.json'))['records'];fulltax=pathlib.Path('/tmp/underrepresented-new/pbdb-dinosaur-families.json');frozenTax=json.load(open(S/'pbdb-reviewed-families.json')) if not fulltax.exists() else None;tax=json.load(open(fulltax))['records'] if fulltax.exists() else frozenTax['exactTaxa'];by=collections.defaultdict(list)
for r in raw:
 if r.get('tna'):by[r['tna']].append(r)
family=collections.defaultdict(set);lookup=collections.defaultdict(list)
for t in tax:
 if t.get('ext')=='0' and not t.get('flg') and t.get('fml') and t['fml']!='NO_FAMILY_SPECIFIED':family[t['fml']].add(t['nam']);lookup[t['nam']].append(t)
if frozenTax:family.update({k:set(v)for k,v in frozenTax['familySpecies'].items()})
sid='extinct-pbdb-discovery-20261010'
d['sources']=[s for s in d['sources']if s['id']!=sid];d['sources'].append(dict(id=sid,name='Paleobiology Database · exact fossil discovery records',url='https://paleobiodb.org/',versionYear='2026-10-10 snapshot',retrievedAt='2026-10-10',license='CC BY 4.0',sourceClass='curated-trait-database'))
metrics=[('discovery_sites','Most fossil sites','Fewest fossil sites','recorded sites','fossil-sites','intuitive','Number of distinct fossil collection sites in the PBDB snapshot whose accepted occurrence name exactly matches this species. This measures documented discovery coverage, not historical population or individual skeletons.'),('discovery_latitude','Most northerly fossil finds','Most southerly fossil finds','degrees from South Pole','fossil-discovery-geography','intuitive','Mean present-day latitude of distinct fossil collection sites with published coordinates, expressed as latitude plus 90 degrees. This compares where fossils were discovered today, not reconstructed ancient latitude, habitat or migration. Each site counts once.'),('discovery_spread','Widest fossil discovery spread','Narrowest fossil discovery spread','degrees latitude','fossil-discovery-geography','specialist','North–south span of present-day coordinates of exact-species fossil collection sites (maximum latitude minus minimum latitude). At least two different latitude records are needed. This is discovery spread, not an estimate of the living animal’s range.'),('family_recorded_species','Most fossil species in its family','Fewest fossil species in its family','recorded species','fossil-family-diversity','specialist','Number of nonflagged extinct dinosaur species recorded in the exact assigned family in the PBDB snapshot. This is catalogued fossil diversity, not a claim that all historical species have been discovered. Living birds, unassigned families and flagged taxa are excluded.')]
ids={'extinct_'+m+sf for m,*_ in metrics for sf in ['', '__low']};d['traits']=[t for t in d['traits']if t['id']not in ids];d['values']=[v for v in d['values']if v['traitId']not in ids];audit=[];frozen=[]
for m,hi,lo,unit,key,kind,basis in metrics:
 for sf,label,direction,other in [('',hi,'higher_wins','__low'),('__low',lo,'lower_wins','')]:
  d['traits'].append(dict(id='extinct_'+m+sf,displayName=label,definition=basis,measurementBasis=basis,unit=unit,metricKey=key,gameplayFamily='range-geography' if 'discovery-geography'in key else key,categoryKind=kind,prototypeCategory=True,counterTraitId='extinct_'+m+other,direction=direction,canonicalSourceId=sid,eligibilityGroups=['dinosaur'],separationMethod='positive_ratio_5_percent'))
for a in d['animals']:
 occurrences=by[a['scientificName']];sites={r['cid']:r for r in occurrences if r.get('cid')};coords={}
 for id,r in sites.items():
  try:lat=float(r.get('lat',''))
  except (TypeError,ValueError):continue
  if -90<=lat<=90:coords[id]=lat
 ts=lookup[a['scientificName']];fam=ts[0]['fml']if len(ts)==1 else None
 nums={'discovery_sites':len(sites),'discovery_latitude':sum(coords.values())/len(coords)+90 if coords else 0,'discovery_spread':max(coords.values())-min(coords.values())if len(coords)>=2 else 0,'family_recorded_species':len(family[fam])if fam else 0}
 for m,hi,lo,unit,key,kind,basis in metrics:
  n=nums[m]
  if n<=0:continue
  for sf in ['', '__low']:
   d['values'].append(dict(animalId=a['id'],traitId='extinct_'+m+sf,valueNumeric=n,unit=unit,measurementBasis=basis,sourceId=sid,sex='not applicable',lifeStage='taxon record',observationType='compiled',confidence='approved',notes=f"PBDB snapshot 2026-10-10; exact accepted species {a['scientificName']}; {len(occurrences)} occurrences, {len(sites)} distinct sites, {len(coords)} georeferenced sites; assigned family {fam}. Current coordinates only; no reconstructed paleocoordinates or population estimates.",uncertaintyStatus='not-reported'))
 audit.append({'animalId':a['id'],'metrics':nums,'family':fam,'georeferencedSites':len(coords)});frozen.extend(occurrences)
(S/'pbdb-reviewed-occurrences.json').write_text(json.dumps({'retrievedAt':'2026-10-10','url':'https://paleobiodb.org/data1.2/occs/list.json?base_name=Dinosauria&show=coords,loc&limit=all','records':frozen},separators=(',',':'))+'\n')
(S/'pbdb-reviewed-families.json').write_text(json.dumps({'retrievedAt':'2026-10-10','familySpecies':{f:sorted(family[f])for f in {r['family']for r in audit}if f},'exactTaxa':[t for a in d['animals']for t in lookup[a['scientificName']]]},indent=2)+'\n');(P/'research/fossil-discovery-admission.json').write_text(json.dumps(audit,indent=2)+'\n');(P/'extinct.json').write_text(json.dumps(d)+'\n');print('Fossil additions',dict(collections.Counter(v['traitId']for v in d['values']if v['sourceId']==sid)))
