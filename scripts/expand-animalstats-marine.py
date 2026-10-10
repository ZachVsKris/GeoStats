#!/usr/bin/env python3
"""Import cited habitat depths and directly weighed IGFA records from frozen bulk tables.

Never import modelled Key Facts, length-weight conversions, or the incompatible
shell/mantle/disc lengths in SeaLifeBase. Exact species joins only.
"""
import argparse, collections, hashlib, json, pathlib, re
import pyarrow.parquet as pq
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--source-root',type=pathlib.Path,required=True);args=p.parse_args()
parts=[json.loads((ROOT/f'data/animalstats/{n}.json').read_text()) for n in ['pilot','existing-coverage','fish-records']]
existing={a['scientificName']:a for d in parts for a in d['animals']}
# Deliberate familiar-type roster; names are exact species, never genus averages.
inverts={
'Octopus vulgaris':('Common octopus','cephalopod'), 'Enteroctopus dofleini':('Giant Pacific octopus','cephalopod'),
'Architeuthis dux':('Giant squid','cephalopod'),'Dosidicus gigas':('Humboldt squid','cephalopod'),
'Mesonychoteuthis hamiltoni':('Colossal squid','cephalopod'),'Sepia officinalis':('Common cuttlefish','cephalopod'),
'Sepia apama':('Giant Australian cuttlefish','cephalopod'),'Loligo vulgaris':('European squid','cephalopod'),
'Doryteuthis opalescens':('California market squid','cephalopod'),'Doryteuthis pealeii':('Longfin squid','cephalopod'),
'Nautilus pompilius':('Chambered nautilus','cephalopod'),'Argonauta argo':('Paper nautilus','cephalopod'),
'Homarus americanus':('American lobster','crustacean'),'Homarus gammarus':('European lobster','crustacean'),
'Panulirus argus':('Caribbean spiny lobster','crustacean'),'Panulirus cygnus':('Western rock lobster','crustacean'),
'Panulirus ornatus':('Ornate spiny lobster','crustacean'),'Callinectes sapidus':('Blue crab','crustacean'),
'Carcinus maenas':('European green crab','crustacean'),'Cancer pagurus':('Brown crab','crustacean'),
'Metacarcinus magister':('Dungeness crab','crustacean'),'Cancer borealis':('Jonah crab','crustacean'),
'Paralithodes camtschaticus':('Red king crab','crustacean'),'Chionoecetes opilio':('Snow crab','crustacean'),
'Macrocheira kaempferi':('Japanese spider crab','crustacean'),'Penaeus monodon':('Giant tiger prawn','crustacean'),
'Penaeus vannamei':('Whiteleg shrimp','crustacean'),'Penaeus aztecus':('Brown shrimp','crustacean'),
'Penaeus duorarum':('Pink shrimp','crustacean'),'Euphausia superba':('Antarctic krill','crustacean'),
'Limulus polyphemus':('Atlantic horseshoe crab','chelicerate'),
'Tridacna gigas':('Giant clam','bivalve'),'Tridacna maxima':('Small giant clam','bivalve'),
'Tridacna derasa':('Smooth giant clam','bivalve'),'Arctica islandica':('Ocean quahog clam','bivalve'),
'Mercenaria mercenaria':('Hard clam','bivalve'),'Panopea generosa':('Pacific geoduck','bivalve'),
'Mytilus edulis':('Blue mussel','bivalve'),'Mytilus californianus':('California mussel','bivalve'),
'Mytilus galloprovincialis':('Mediterranean mussel','bivalve'),'Crassostrea virginica':('Eastern oyster','bivalve'),
'Crassostrea gigas':('Pacific oyster','bivalve'),'Ostrea edulis':('European flat oyster','bivalve'),
'Pecten maximus':('Great scallop','bivalve'),'Placopecten magellanicus':('Atlantic sea scallop','bivalve'),
'Haliotis rufescens':('Red abalone','gastropod'),'Haliotis asinina':('Donkey-ear abalone','gastropod'),
'Conus geographus':('Geography cone snail','gastropod'),'Littorina littorea':('Common periwinkle','gastropod'),
'Asterias rubens':('Common starfish','echinoderm'),'Asterias amurensis':('Northern Pacific sea star','echinoderm'),
'Acanthaster planci':('Crown-of-thorns starfish','echinoderm'),'Pycnopodia helianthoides':('Sunflower sea star','echinoderm'),
'Strongylocentrotus purpuratus':('Purple sea urchin','echinoderm'),'Strongylocentrotus droebachiensis':('Green sea urchin','echinoderm'),
'Paracentrotus lividus':('European sea urchin','echinoderm'),'Holothuria scabra':('Sandfish sea cucumber','echinoderm'),
'Aurelia aurita':('Moon jellyfish','cnidarian'),'Cyanea capillata':("Lion’s mane jellyfish",'cnidarian'),
'Chrysaora quinquecirrha':('Atlantic sea nettle','cnidarian'),'Chironex fleckeri':('Box jellyfish','cnidarian'),
'Physalia physalis':('Portuguese man-of-war','cnidarian'),'Actinia equina':('Beadlet sea anemone','cnidarian')}
fishnames=set(json.loads((ROOT/'data/animalstats/research/familiar-fish-roster.json').read_text()))
fishnames.update(['Squalus acanthias','Mustelus mustelus','Carcharhinus melanopterus','Carcharhinus amblyrhynchos','Triaenodon obesus','Sphyrna mokarran','Dasyatis pastinaca','Raja clavata','Myliobatis californica','Balistes capriscus','Pomatomus saltatrix','Scomberomorus cavalla','Scomberomorus maculatus','Seriola dumerili','Seriola lalandi','Trachinotus carolinus','Rachycentron canadum','Megalops atlanticus','Albula vulpes','Centropomus undecimalis','Sciaenops ocellatus','Acanthocybium solandri','Euthynnus alletteratus','Sarda sarda'])
d={k:[] for k in ['animals','traits','values','sources','photos','boards']};accepted=[];held=[];manifest=[];marine=set();src='fish-sealifebase-habitat-2606';weightSrc='fishbase-igfa-summary-2606'
d['sources']=[{'id':src,'name':'FishBase and SeaLifeBase · cited habitat depth','sourceClass':'curated-trait-database','url':'https://www.sealifebase.org/','versionYear':'26.06 frozen bulk snapshot','retrievedAt':'2026-10-10','license':'CC BY-NC 4.0; cite Froese & Pauly (FishBase), Palomares & Pauly (SeaLifeBase), and original references'}, {'id':weightSrc,'name':'FishBase · IGFA weighed catch records','sourceClass':'curated-trait-database','url':'https://www.fishbase.se/','versionYear':'26.06 frozen bulk snapshot','retrievedAt':'2026-10-10','license':'CC BY-NC 4.0; cite Froese & Pauly, FishBase and original IGFA records'}]
metrics=[('marine_habitat_depth','Deepest water habitat','Shallowest water habitat','m','habitat-depth',src,'Deepest endpoint of the cited species habitat-depth range in FishBase or SeaLifeBase 26.06. This is where the species has been reported, not a measured dive, typical swimming depth, depth tolerance or model prediction.',[]),('fish_igfa_record_mass','Heaviest recorded fish','Lightest recorded fish','g','mass',weightSrc,'Largest body-weight record summarized by FishBase 26.06 whose original reference is an IGFA angling-record publication. This is a directly weighed catch record, not typical adult weight or a weight estimated from length. Records are not guaranteed to be current world records.',['fish','shark','ray'])]
for tid,hi,lo,unit,key,source,basis,groups in metrics:
 for suf,label,direction,counter in [('',hi,'higher_wins','__low'),('__low',lo,'lower_wins','')]:
  d['traits'].append({'id':tid+suf,'displayName':label,'definition':basis,'measurementBasis':basis,'direction':direction,'unit':unit,'eligibilityGroups':groups or list(sorted(set(x[1] for x in inverts.values())|{'fish','shark','ray','marine-mammal','turtle'})),'canonicalSourceId':source,'separationMethod':'positive_ratio_5_percent','prototypeCategory':True,'categoryKind':'intuitive','metricKey':key,'gameplayFamily':'habitat' if key=='habitat-depth' else key,'counterTraitId':tid+counter})
flags=re.compile(r'doubtful|estimated weight|calculated weight|converted weight|length.weight relationship|theoretical|unpublished',re.I)
for db in ['fishbase','sealifebase']:
 root=args.source_root/db
 for table in ['species','refrens']:
  path=root/(table+'.parquet');manifest.append({'database':db,'table':table,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 refs={r['RefNo']:r for r in pq.read_table(root/'refrens.parquet').to_pylist()}
 for r in pq.read_table(root/'species.parquet').to_pylist():
  name=r['Genus']+' '+r['Species']
  if not (name in fishnames if db=='fishbase' else name in inverts or name in existing and existing[name]['taxonomicGroup'] in ['marine-mammal','turtle','bivalve','crustacean','echinoderm']):continue
  a=existing.get(name)
  if not a:
   common,group=inverts[name] if db=='sealifebase' else (r['FBname'], 'shark' if name.split()[0] in ['Squalus','Mustelus','Carcharhinus','Triaenodon','Sphyrna'] else 'ray' if name.split()[0] in ['Dasyatis','Raja','Myliobatis'] else 'fish')
   if not common:held.append({'species':name,'reason':'missing common name'});continue
   a={'id':name.lower().replace(' ','_'),'scientificName':name,'commonName':common,'taxonomicGroup':group,'entityType':'species','familiarityTier':'familiar','active':True};d['animals'].append(a);existing[name]=a
  if r['Saltwater']==1:marine.add(a['id'])
  for tid,_,_,unit,key,source,basis,groups in metrics:
   if key=='mass' and db!='fishbase':continue
   field,refField=('DepthRangeDeep','DepthRangeRef') if key=='habitat-depth' else ('Weight','MaxWeightRef')
   value=r.get(field);ref=refs.get(r.get(refField));reason=None
   if not isinstance(value,(int,float)) or value<=0:continue
   if not ref or not ref.get('Title'):reason='missing original reference'
   elif r.get('TaxIssue'):reason='unresolved taxonomy'
   elif key=='mass' and not re.search(r'IGFA|International Game Fish Association',ref.get('Author') or '',re.I):reason='not an IGFA weighed catch record'
   elif flags.search((r.get('Comments') or '')+' '+(ref.get('Title') or '')):reason='doubtful or derived record text'
   if reason:held.append({'species':name,'field':field,'reason':reason});continue
   citation=f"{ref.get('Author')}. {ref.get('Year')}. {ref['Title']} {ref.get('Source') or ''}"
   notes=f"{db} species {r['SpecCode']}; field {field}; original reference {r[refField]}. {re.sub('<[^>]+>','',citation)}. Source species page: https://www.{db}.org/summary/{r['Genus']}-{r['Species']}.html"
   for suf in ['', '__low']:d['values'].append({'animalId':a['id'],'traitId':tid+suf,'valueNumeric':round(value,5),'unit':unit,'sex':'not specified','lifeStage':'species habitat' if key=='habitat-depth' else 'record specimen','measurementBasis':basis,'sourceId':source,'observationType':'compiled','confidence':'approved','notes':notes,'recordOrigin':'wild','uncertaintyStatus':'not-reported'})
   accepted.append({'animalId':a['id'],'database':db,'field':field,'value':value,'reference':r[refField],'citation':citation})
# Taxonomic authorship year is nomenclatural history, not an evolutionary age.
  year_match=re.search(r'\b(1[6-9]\d{2}|20[0-2]\d)\b', r.get('Author') or '')
  if year_match and not r.get('TaxIssue'):
   year=int(year_match.group(1));historyBasis='Year attached to the original formal species description in the taxonomic authorship recorded by FishBase or SeaLifeBase 26.06. This is naming history, not the age of the species, the first human encounter or the date its lineage evolved. Parentheses indicate a later genus reassignment.'
   for suf in ['', '__low']:
    if not any(v['animalId']==a['id'] and v['traitId']=='marine_description_year'+suf for v in d['values']):
     d['values'].append({'animalId':a['id'],'traitId':'marine_description_year'+suf,'valueNumeric':2026-year,'unit':'years since description (2026)','sex':'not applicable','lifeStage':'species description','measurementBasis':historyBasis,'sourceId':src,'observationType':'compiled','confidence':'approved','notes':f"{db} species {r['SpecCode']}; original taxonomic authorship: {r['Author']}. https://www.{db}.org/summary/{r['Genus']}-{r['Species']}.html",'uncertaintyStatus':'not-reported'})
for suf,label,direction,counter in [('', 'Formally described longest ago','higher_wins','__low'),('__low','Formally described most recently','lower_wins','')]:
 d['traits'].append({'id':'marine_description_year'+suf,'displayName':label,'definition':historyBasis,'measurementBasis':historyBasis,'direction':direction,'unit':'years since description (2026)','eligibilityGroups':[], 'canonicalSourceId':src,'separationMethod':'distinct_ordinal','prototypeCategory':True,'categoryKind':'specialist','metricKey':'scientific-history','gameplayFamily':'history','counterTraitId':'marine_description_year'+counter})
previous=ROOT/'data/animalstats/marine.json'
if previous.exists():d['photos']=json.loads(previous.read_text()).get('photos',[])
previous.write_text(json.dumps(d,ensure_ascii=False)+'\n')
audit={'generatedAt':'2026-10-10','newAnimals':len(d['animals']),'sourceFiles':manifest,'coverage':{**dict(collections.Counter(x['field'] for x in accepted)), 'formalDescriptionYear':sum(v['traitId']=='marine_description_year' for v in d['values'])},'accepted':accepted,'held':held,'marineAnimalIds':sorted(marine),'notImported':['SeaLifeBase heterogeneous length types','SeaLifeBase weights (some reference/species mismatches)','Modelled Key Facts, trophic estimates, length-weight conversions','Zero or missing depths, unresolved taxonomy, no original citation']}
(ROOT/'data/animalstats/research/marine-admission.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'newAnimals':len(d['animals']),'coverage':audit['coverage'],'marineAnimals':len(marine)}))
