"""Admit exact-species fossil histories; no reconstructed body mass or inferred biology."""
import argparse, collections, json, pathlib, re
R=pathlib.Path(__file__).resolve().parents[1]; P=R/'data/animalstats'
p=argparse.ArgumentParser();p.add_argument('--source-root',type=pathlib.Path);args=p.parse_args();S=args.source_root;frozen=json.loads((P/'source/extinct-mammals-20261012/reviewed-pbdb-records.json').read_text()) if S is None else None
d=json.loads((P/'extinct.json').read_text());sid='pbdb-extinct-mammals-20261012'
roster={
'Mammuthus primigenius':'Woolly mammoth','Mammuthus columbi':'Columbian mammoth','Mammuthus trogontherii':'Steppe mammoth','Mammuthus meridionalis':'Southern mammoth','Mammuthus exilis':'Pygmy mammoth','Mammuthus creticus':'Cretan dwarf mammoth',
'Mammut americanum':'American mastodon','Mammut borsoni':"Borson’s mastodon",'Mammut pacificus':'Pacific mastodon',
'Smilodon fatalis':'Saber-toothed cat','Smilodon populator':'South American saber-toothed cat','Smilodon gracilis':'Slender saber-toothed cat','Homotherium latidens':'Scimitar-toothed cat','Homotherium serum':'American scimitar-toothed cat',
'Coelodonta antiquitatis':'Woolly rhinoceros','Coelodonta thibetana':'Tibetan woolly rhinoceros','Megaloceros giganteus':'Irish elk',
'Megatherium americanum':'Giant ground sloth','Eremotherium laurillardi':'Pan-American giant ground sloth','Eremotherium eomigrans':'Early giant ground sloth','Paramylodon harlani':"Harlan’s ground sloth",'Mylodon darwini':"Darwin’s ground sloth",
'Thylacoleo carnifex':'Marsupial lion','Diprotodon optatum':'Giant wombat relative','Glyptodon clavipes':'Glyptodon','Glyptodon reticulatus':'Reticulated glyptodon','Doedicurus clavicaudatus':'Club-tailed glyptodont','Castoroides ohioensis':'Giant beaver','Castoroides dilophidus':'Florida giant beaver','Arctodus simus':'Giant short-faced bear','Arctodus pristinus':'Lesser short-faced bear'}
taxa=collections.defaultdict(list)
for t in (json.loads((S/'pbdb-mammal-taxa.json').read_text())['records'] if S else frozen['taxa']):
 if t.get('rnk')=='species' and not t.get('flg') and t.get('ext')=='0':taxa[t['nam']].append(t)
by=collections.defaultdict(list)
for o in (json.loads((S/'pbdb-mammal-occs.json').read_text())['records'] if S else frozen['occurrences']):
 if o.get('rnk')==3 and o.get('tna') in roster:by[o['tna']].append(o)
# Scientific-description dates and discovery locations are records, not body-size guesses.
metrics=[('mammal_sites','Most fossil sites','Fewest fossil sites','recorded sites','fossil-sites','intuitive','Number of distinct PBDB collection sites with occurrences accepted as this exact extinct mammal species. Snapshot 12 October 2026. This is documented fossil discovery coverage, not historical population.'),('mammal_latitude','Most northerly fossil finds','Most southerly fossil finds','degrees from South Pole','fossil-discovery-geography','intuitive','Mean present-day latitude of distinct exact-species fossil collection sites with coordinates, plus 90 degrees. Each site counts once. These are modern discovery locations, not reconstructed ancient habitat or travel.'),('mammal_spread','Widest fossil discovery spread','Narrowest fossil discovery spread','degrees latitude','fossil-discovery-geography','specialist','Difference between northernmost and southernmost present-day latitude of distinct exact-species fossil sites. At least two coordinates. This measures discovery spread, not the animal’s historical range.'),('mammal_description','Longest known to science','Most recently named','years since description (2026)','extinct-scientific-history','intuitive','2026 minus the year in the exact accepted species authorship in PBDB. This is when the species was scientifically named, not when it evolved or became extinct.'),('mammal_references','Most fossil references','Fewest fossil references','recorded references','fossil-research-records','specialist','Number of distinct PBDB reference identifiers linked to exact-species fossil occurrence records. These identify catalogued reference works, not citations received, research quality or a complete list of publications about the species.')]
newids={'extinct_'+x[0]+s for x in metrics for s in ['', '__low']} | {'extinct_mammal_fossil_layer','extinct_mammal_fossil_layer__low'}
d['animals']=[a for a in d['animals'] if a['taxonomicGroup']!='extinct-mammal'];d['traits']=[t for t in d['traits']if t['id']not in newids];d['values']=[v for v in d['values']if v['sourceId']!=sid];d['sources']=[s for s in d['sources']if s['id']!=sid];d['photos']=[p for p in d['photos']if not p.get('animalId','').startswith('fossil_mammal_')]
d['sources'].append(dict(id=sid,name='Paleobiology Database · extinct mammal fossil histories',url='https://paleobiodb.org/',versionYear='2026-10-12 snapshot',retrievedAt='2026-10-12',license='CC BY 4.0',sourceClass='curated-trait-database'))
for m,hi,lo,unit,key,kind,basis in metrics:
 for s,label,di,other in [('',hi,'higher_wins','__low'),('__low',lo,'lower_wins','')]:
  d['traits'].append(dict(id='extinct_'+m+s,displayName=label,unit=unit,metricKey=key,gameplayFamily='range-geography'if 'geography'in key else key,measurementBasis=basis,definition=basis,canonicalSourceId=sid,eligibilityGroups=['extinct-mammal'],categoryKind=kind,prototypeCategory=True,direction=di,counterTraitId='extinct_'+m+other,separationMethod='positive_ratio_5_percent'))
accepted=[];held=[];frozen=[]
for name,common in roster.items():
 matches=taxa[name];occ=by[name]
 if len(matches)!=1 or not occ:held.append({'name':name,'reason':'No unique unflagged extinct accepted species with exact-species occurrences'});continue
 t=matches[0];aid='fossil_mammal_'+name.lower().replace(' ','_');sites={o['cid']:o for o in occ if o.get('cid')};coords={}
 for cid,o in sites.items():
  try:lat=float(o['lat'])
  except (KeyError,ValueError,TypeError):continue
  if -90<=lat<=90:coords[cid]=lat
 year=re.search(r'\b(1[6-9]\d{2}|20[0-2]\d)\b',t.get('att',''));nums={'mammal_sites':len(sites),'mammal_latitude':sum(coords.values())/len(coords)+90 if coords else 0,'mammal_spread':max(coords.values())-min(coords.values())if len(coords)>1 else 0,'mammal_description':2026-int(year[0])if year else 0,'mammal_references':len({o['rid']for o in occ if o.get('rid')})}
 d['animals'].append(dict(id=aid,scientificName=name,commonName=common,entityType='species',taxonomicGroup='extinct-mammal',familiarityTier='core',active=True,extinctionStatus='extinct'))
 # Reviewed, explicitly labeled reconstructions; rendered by the companion script.
 d['photos'].append(dict(animalId=aid,assetUrl='/animalstats/extinct/'+name.split()[0].lower()+'.svg',originalUrl='https://paleobiodb.org/classic/basicTaxonInfo?taxon_no='+t['oid'].split(':')[-1],creator='AnimalStats',license='Original illustration',attribution='AnimalStats · cartoon reconstruction',approved=True))
 for m,hi,lo,unit,key,kind,basis in metrics:
  n=nums[m]
  if not isinstance(n,(int,float))or n<=0:continue
  for s in ['', '__low']:
   extra={'fossilIntervalYoungerBoundMa':t.get('fla'),'fossilIntervalOlderBoundMa':t.get('fea')}if m=='mammal_fossil_layer'else{}
   d['values'].append(dict(animalId=aid,traitId='extinct_'+m+s,valueNumeric=n,unit=unit,measurementBasis=basis,sourceId=sid,sex='not applicable',lifeStage='taxon record',confidence='approved',observationType='compiled',uncertaintyStatus='not-reported',notes=f"PBDB exact accepted species {name}; taxon {t['oid']}; authorship {t.get('att')}; taxon reference {t.get('rid')}; {len(occ)} occurrences, {len(sites)} sites and {len(coords)} coordinates. Original occurrence reference IDs: {', '.join(sorted({o['rid']for o in occ if o.get('rid')}))}. No genus-level occurrences or reconstructed mass, lifespan or speed.",**extra))
 accepted.append({'animalId':aid,'name':name,'metrics':nums,'taxon':t});frozen.extend(occ)
assert len(accepted)>=20,(len(accepted),held)
(P/'extinct.json').write_text(json.dumps(d,separators=(',',':'))+'\n');dest=P/'source/extinct-mammals-20261012';dest.mkdir(exist_ok=True)
(dest/'reviewed-pbdb-records.json').write_text(json.dumps({'taxa':[x['taxon']for x in accepted],'occurrences':frozen,'retrievedAt':'2026-10-12'},separators=(',',':'))+'\n');(P/'research/extinct-mammal-admission-20261012.json').write_text(json.dumps({'accepted':accepted,'held':held,'policy':'Exact extinct species and fossil histories; no inferred animal biology'},indent=2)+'\n');print('Admitted',len(accepted),'extinct mammals; held',held)
