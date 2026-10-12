#!/usr/bin/env python3
"""Admit cited shell lengths, existing AnAge facts and unpooled kitten observations."""
import argparse,pathlib,json,csv,zipfile,io,collections,re,math,hashlib
R=pathlib.Path(__file__).resolve().parents[1];P=R/'data/animalstats';S=P/'source/underrepresented-20261010b';S.mkdir(exist_ok=True)
p=argparse.ArgumentParser();p.add_argument('--sealifebase-root',type=pathlib.Path);args=p.parse_args()
parts=[json.loads((P/(n+'.json')).read_text()) for n in ['pilot','existing-coverage','fish-records','marine','aquatic-eggs']]
animals={a['id']:a for d in parts for a in d['animals']};names={a['scientificName']:a for a in animals.values() if a.get('entityType')!='breed'};traits={t['id']:t for d in parts for t in d['traits']};present={(v['animalId'],v['traitId']) for d in parts for v in d['values']}
d={k:[] for k in ['animals','traits','values','sources','photos']};audit={'accepted':[],'held':[],'marineAnimalIds':[]}
def source(id,name,url,year,license,kind='curated-trait-database'):
 d['sources'].append(dict(id=id,name=name,url=url,versionYear=year,license=license,sourceClass=kind,retrievedAt='2026-10-10'))
def pair(id,hi,lo,unit,key,basis,src,groups,kind='intuitive',separation='positive_ratio_5_percent'):
 for suf,label,direction,counter in [('',hi,'higher_wins','__low'),('__low',lo,'lower_wins','')]:
  t=dict(id=id+suf,displayName=label,unit=unit,metricKey=key,gameplayFamily=key,measurementBasis=basis,definition=basis,canonicalSourceId=src,eligibilityGroups=groups,categoryKind=kind,prototypeCategory=True,direction=direction,counterTraitId=id+counter,separationMethod=separation);d['traits'].append(t);traits[t['id']]=t

def value(a,id,n,sex,stage,notes,**extra):
 for suf in ['', '__low']:
  tid=id+suf
  if tid not in traits or (a['id'],tid) in present:continue
  t=traits[tid];d['values'].append(dict(animalId=a['id'],traitId=tid,valueNumeric=n,unit=t['unit'],measurementBasis=t['measurementBasis'],sourceId=t['canonicalSourceId'],sex=sex,lifeStage=stage,notes=notes,confidence='approved',observationType='compiled',uncertaintyStatus='not-reported',**extra));present.add((a['id'],tid))
source('sealifebase-shell-2606','SeaLifeBase · cited bivalve shell lengths','https://www.sealifebase.ca/','26.06','CC BY-NC 4.0; cite SeaLifeBase and original references')
pair('bivalve_shell_length','Longest shell','Shortest shell','cm','shell-length','Largest cited shell-length record in SeaLifeBase 26.06, restricted to explicitly SHL-coded bivalves. This is shell length, not shell height, animal total length, width or a length reconstructed from weight. Values describe source records rather than typical adult size.','sealifebase-shell-2606',['bivalve'])
if args.sealifebase_root:
 import pyarrow.parquet as pq
 speciesrows=pq.read_table(args.sealifebase_root/'species.parquet').to_pylist();referencerows=pq.read_table(args.sealifebase_root/'refrens.parquet').to_pylist()
else:
 frozen=json.loads((S/'sealifebase-reviewed-rows.json').read_text());speciesrows=frozen['species'];referencerows=frozen['references']
slb={r['Genus']+' '+r['Species']:r for r in speciesrows};refs={r['RefNo']:r for r in referencerows}
z=zipfile.ZipFile(P/'source/anage-build-15.zip');anage=list(csv.DictReader(io.StringIO(z.read('anage_data.txt').decode()),delimiter='\t'))
# Extend the existing catalog, never overwrite reviewed values or infer from relatives.
for r in anage:
 if r['Class']!='Bivalvia' or r['Data quality'] not in ['acceptable','high'] or not r['References']:continue
 name=r['Genus']+' '+r['Species'];s=slb.get(name)
 if not s or s.get('TaxIssue'):audit['held'].append({'name':name,'reason':'missing exact SeaLifeBase taxon or unresolved taxonomy'});continue
 a=names.get(name)
 if not a:
  a=dict(id=name.lower().replace(' ','_'),scientificName=name,commonName=r['Common name'],entityType='species',taxonomicGroup='bivalve',familiarityTier='core' if re.search(r'oyster|mussel|scallop|geoduck|quahog',r['Common name'],re.I) else 'familiar',active=True);d['animals'].append(a);names[name]=a;animals[a['id']]=a
 if s.get('Saltwater')==1:audit['marineAnimalIds'].append(a['id'])
 try:years=float(r['Maximum longevity (yrs)'])
 except ValueError:years=0
 if years>0 and r['Specimen origin']=='wild':
  notes=f"AnAge Build 15; exact taxon {name}; HAGRID {r['HAGRID']}; original reference IDs {r['References']}; quality {r['Data quality']}; specimen origin wild. Existing longevity definition retained."
  value(a,'wild_recorded_lifespan',years,'species-level','species-level',notes,recordOrigin='wild',sourceQuality=r['Data quality'],sampleSizeCategory=r['Sample size'])
  audit['accepted'].append({'name':name,'field':'AnAge maximum longevity','value':years,'references':r['References']})
 ref=refs.get(s.get('MaxLengthRef'));length=s.get('Length')
 if s.get('LTypeMaxM')=='SHL' and isinstance(length,(int,float)) and length>0 and ref and ref.get('Title') and not re.search(r'estimat|calculat|doubtful|unpublished|predict', (s.get('Comments') or '')+' '+ref['Title'],re.I):
  citation=f"{ref.get('Author')}. {ref.get('Year')}. {ref['Title']} {ref.get('Source') or ''}"
  value(a,'bivalve_shell_length',float(f'{length:.6g}'),'not specified','record specimen',f"SeaLifeBase species {s['SpecCode']}; field Length; length type SHL; original reference {s['MaxLengthRef']}. {citation}. https://www.sealifebase.ca/summary/{s['Genus']}-{s['Species']}.html",recordOrigin='not-specified')
  audit['accepted'].append({'name':name,'field':'shell length','value':length,'reference':s['MaxLengthRef'],'citation':citation})
 for tid,field,refField in [('marine_habitat_depth','DepthRangeDeep','DepthRangeRef')]:
  n=s.get(field);ref=refs.get(s.get(refField))
  if isinstance(n,(int,float)) and n>0 and ref and ref.get('Title') and not re.search(r'estimat|calculat|doubtful|unpublished|predict',(s.get('Comments') or '')+' '+ref['Title'],re.I):
   citation=f"{ref.get('Author')}. {ref.get('Year')}. {ref['Title']} {ref.get('Source') or ''}"
   value(a,tid,n,'not specified','species habitat',f"SeaLifeBase species {s['SpecCode']}; field {field}; original reference {s[refField]}. {citation}. https://www.sealifebase.ca/summary/{s['Genus']}-{s['Species']}.html",recordOrigin='not-specified')
 year=re.search(r'\b(1[6-9]\d{2}|20[0-2]\d)\b',s.get('Author') or '')
 if year:value(a,'marine_description_year',2026-int(year[0]),'not applicable','species description',f"SeaLifeBase species {s['SpecCode']}; original taxonomic authorship {s['Author']}. https://www.sealifebase.ca/summary/{s['Genus']}-{s['Species']}.html")
# Add shell length for other current bivalves, retaining exactly the same SHL basis.
for name,a in list(names.items()):
 if a['taxonomicGroup']!='bivalve':continue
 s=slb.get(name,{});ref=refs.get(s.get('MaxLengthRef'));n=s.get('Length')
 if s.get('LTypeMaxM')=='SHL' and isinstance(n,(int,float)) and n>0 and ref and ref.get('Title') and not s.get('TaxIssue') and not re.search(r'estimat|calculat|doubtful|unpublished|predict', (s.get('Comments') or '')+' '+ref['Title'],re.I):
  value(a,'bivalve_shell_length',float(f'{n:.6g}'),'not specified','record specimen',f"SeaLifeBase species {s['SpecCode']}; Length; SHL; original reference {s['MaxLengthRef']}. {ref.get('Author')}. {ref.get('Year')}. {ref['Title']}. https://www.sealifebase.ca/summary/{s['Genus']}-{s['Species']}.html",recordOrigin='not-specified')
source('mugnier-2022-kitten-records','Mugnier et al. · kitten birth records','https://doi.org/10.1016/j.theriogenology.2022.07.008','2022','CC BY 4.0','primary-research')
d['sources'][-1]['entityScope']='breed'
pair('pet_cat_birth_mass','Heaviest newborn kittens','Lightest newborn kittens','g','birth-mass','Descriptive mean birth weight in Mugnier et al. (2022) Table 1, French breeder records collected 2016–2020. Only individually reported breeds are included; pooled sister breeds are excluded. These are observed descriptive averages, not regression predictions. Source SD describes individual variation, not uncertainty in the mean.','mugnier-2022-kitten-records',[])
pair('pet_cat_litter_2022','Largest litter','Smallest litter','kittens','offspring','Descriptive mean litter size in Mugnier et al. (2022) Table 1, French breeder records from 2016–2020, including stillborn kittens. Only unpooled breeds are included. This cohort is kept separate from the earlier Fournier litter study; no values are mixed between studies.','mugnier-2022-kitten-records',[])
catrows=[('Bengal','cat_bengal',102,28,88.6,13.3,4.5,1.6),('Birman','cat_birman',276,87,96.2,14.7,3.6,1.2),('Chartreux','cat_chartreux',106,27,117.6,17.6,4.1,1.1),('Egyptian Mau','cat_egyptian_mau',114,28,92.3,21.5,4.6,1.3),('Maine Coon','cat_maine_coon',582,143,118.7,19.3,4.6,2.1),('Norwegian Forest','cat_norwegian_forest',506,120,107.4,16.5,4.5,1.7),('Ragdoll','cat_ragdoll',258,61,100.1,14.1,4.6,1.5),('Siberian','cat_siberian',427,106,100.7,16.5,4.5,1.7),('Sphynx','cat_sphynx',80,25,90.8,16.2,3.7,1.7)]
for name,id,n,litters,mass,sd,litter,lsd in catrows:
 a=animals.get(id)
 if not a:
  a=dict(id=id,commonName=name,scientificName='Felis catus',entityType='breed',breedName=name,parentTaxon='Felis catus',taxonomicGroup='cat-breed',familiarityTier='core',active=True);d['animals'].append(a);animals[id]=a
 value(a,'pet_cat_birth_mass',mass,'both sexes','newborn',f"Mugnier et al. 2022, Table 1; breed {name}; n={n} kittens in {litters} litters; descriptive mean {mass} g, SD {sd} g; not a confidence interval or regression result.",sampleSizeCategory=f'{n} kittens')
 value(a,'pet_cat_litter_2022',litter,'female','reproduction',f"Mugnier et al. 2022, Table 1; breed {name}; {litters} litters; descriptive mean {litter} kittens, SD {lsd}; includes stillborn kittens.",sampleSizeCategory=f'{litters} litters')
 audit['accepted'].append({'name':name,'field':'kitten birth mass','value':mass,'sample':n,'litters':litters})
# Insect cells are an exact-name intersection of independently cited raw tables.
source('nw-arthropod-body-2025','Northwestern European arthropods · cited adult measurements','https://doi.org/10.5281/zenodo.13379714','2025','CC BY-NC 4.0')
source('church-insect-eggs-2019','Church et al. · published insect egg measurements','https://doi.org/10.1038/s41597-019-0049-y','2019','CC0 dataset; original publications cited per record','primary-research')
source('nw-arthropod-taxonomy-2025','Northwestern European arthropods · taxonomic authorship','https://ipt.biodiversity.be/resource?r=arthropod-trait-dataset','2025','CC BY-NC 4.0')
pair('insect_record_body_length','Longest body','Shortest body','mm','insect-body-length','Reported upper adult body-length endpoint in the referenced Northwestern European arthropod raw tables. Butterflies and moths are excluded because some size entries are wing measurements. Expert estimates, inferred lengths and personal communications are excluded. This is a regional sourced comparison, not a claim to cover all insects.','nw-arthropod-body-2025',['insect'])
pair('insect_record_egg_length','Longest eggs','Shortest eggs','mm','insect-egg-length','Single egg-length measurement explicitly reported in the text of a publication and transcribed by Church et al. (2019), field pl, in millimetres. If multiple eligible descriptions exist, the largest reported pl is used. This is the egg length axis, not volume or image-derived size. Exact species and original publication are retained.','church-insect-eggs-2019',['insect'])
pair('insect_egg_elongation','Most elongated eggs','Roundest eggs','ratio','insect-egg-shape','Ratio of the larger to smaller of the two explicitly published egg dimensions (Church et al. fields pl and pw), from the same selected record as egg length. A ratio near 1 means equal length and width, not necessarily a perfectly spherical egg. This is direct arithmetic on reported measurements, not a predicted biological value.','church-insect-eggs-2019',['insect'],kind='specialist')
pair('insect_description_age','Named longest ago','Named most recently','years','insect-description-age','Years from the first formal scientific-description year in the referenced taxonomic authorship to 2026. This is naming history, not the age of the species or an evolutionary divergence estimate.','nw-arthropod-taxonomy-2025',['insect'],kind='specialist')
for cell in json.loads((S/'insect-source-cells.json').read_text()):
 name=cell['name'];a=names.get(name)
 if not a:
  a=dict(id=name.lower().replace(' ','_'),scientificName=name,commonName=cell['commonName'],entityType='species',taxonomicGroup='insect',familiarityTier='core' if cell['taxonomy']['order'] in ['Odonata','Orthoptera'] or name in ['Aromia moschata','Helophilus pendulus','Pentatoma rufipes','Palomena prasina','Otiorhynchus sulcatus'] else 'familiar',active=True)
  d['animals'].append(a);names[name]=a;animals[a['id']]=a
 b=cell['body'];e=cell['eggs'];tax=cell['taxonomy']
 assert b['file'].startswith(('Coleoptera','Hemiptera','Diptera','Odonata','Orthoptera'))
 value(a,'insect_record_body_length',b['value'],'not specified','adult',f"Raw {b['file']}, row {b['row']}, Size_max (adult body length, mm); original cited source {b['source']}; exact species {name}. Expert and wing measurements excluded.")
 citation=f"{e['bib_author']} ({e['bib_year']}). {e['bib_title']}. {e['bib_journal']} {e['bib_pages']}."
 length,width=float(e['pl']),float(e['pw'])
 value(a,'insect_record_egg_length',length,'not applicable','egg',f"Church et al. 2019, original egg record {e['ID']}; pl={length} mm, pw={width} mm, both text measurements. Original source: {citation}")
 value(a,'insect_egg_elongation',max(length,width)/min(length,width),'not applicable','egg',f"Original egg record {e['ID']}; max({length}, {width}) / min({length}, {width}). No volume, imputation or image estimate. Original source: {citation}")
 year=re.search(r'\b(1[6-9]\d{2}|20[0-2]\d)\b',tax['scientificName'])
 if year:value(a,'insect_description_age',2026-int(year[0]),'not applicable','species description',f"Published taxonomic authorship: {tax['scientificName']}; exact dataset taxonID {tax['taxonID']}.")
 audit['accepted'].append({'name':name,'field':'cited adult body and egg measurements','originalBodySource':b['source'],'eggRecord':e['ID']})
# Freeze exact bulk rows and references used, so review does not depend on a temporary cache.
selected=[slb[n] for n,a in names.items() if a['taxonomicGroup']=='bivalve' and n in slb]
refids={r.get(k) for r in selected for k in ['MaxLengthRef','DepthRangeRef']}
(S/'sealifebase-reviewed-rows.json').write_text(json.dumps({'version':'26.06','species':selected,'references':[refs[i] for i in refids if i in refs]},ensure_ascii=False,indent=2,default=str)+'\n')
# ReptTraits fields with their individual references. Modelled adult masses are held.
source('repttraits-observed-2024','ReptTraits · individually cited measurements','https://doi.org/10.6084/m9.figshare.24572683.v4','2024','CC BY 4.0')
reptgroups=['lizard','snake','turtle','crocodilian','reptile']
reptfields=[('rept_reported_total_length','Longest body','Shortest body','mm','reptile-total-length','Maximum total length ("TL", mm)','Published maximum total body length, explicitly TL, in ReptTraits v1-2. Snout–vent length and straight carapace length are excluded. Values retain individual original citations and exclude estimates or reconstructions.'),('rept_reported_hatchling_mass','Heaviest hatchling','Lightest hatchling','g','birth-mass','Hatchling/neonate mass (g)','Published hatchling or newborn mass in ReptTraits v1-2, with the per-cell original reference. This is the source-reported measurement, not a weight predicted from length, an adult value, or a median newly calculated across studies.'),('rept_reported_clutch_max','Most eggs in one clutch','Fewest eggs in one clutch','eggs','offspring','Largest clutch size','Largest published egg clutch in ReptTraits v1-2, restricted to egg-laying species. Live births are excluded. This is a documented upper clutch-size record, not the typical or mean clutch.'),('rept_reported_egg_length','Longest egg','Shortest egg','mm','egg-size','Egg length (mm)','Published egg length in ReptTraits v1-2, restricted to egg-laying species and retained with its individual reference. This is a linear egg dimension, not volume, hatchling size or a reconstructed value.')]
for id,hi,lo,unit,key,field,basis in reptfields:pair(id,hi,lo,unit,key,basis,'repttraits-observed-2024',reptgroups)
pair('rept_scientific_description_age','Named longest ago','Named most recently','years','scientific-history','Years since the original scientific description, from the species-specific description-year field in ReptTraits v1-2 to 2026. This is naming history, not evolutionary age.','repttraits-observed-2024',reptgroups,kind='specialist')
rept=json.loads((S/'repttraits-reviewed-rows.json').read_text())
for cell in rept['species']:
 if cell['name']=='Ophiophagus hannah':
  audit['held'].append({'name':cell['name'],'reason':'Source predates king cobra species-complex split; record locations need review before inheriting old measurements.'});continue
 name=cell['name'];r=cell['data'];rs=cell['sources'];a=names.get(name)
 if not a:
  group='turtle' if r['Order']=='Testudines' else 'crocodilian' if r['Order']=='Crocodylia' else 'snake' if r['Suborder']=='Serpentes' else 'lizard'
  core=name in ['Eretmochelys imbricata','Caiman crocodilus','Crocodylus porosus','Iguana iguana','Pogona vitticeps','Eublepharis macularius','Gekko gecko','Heloderma suspectum','Malayopython reticulatus','Naja naja','Ophiophagus hannah','Varanus komodoensis','Chelydra serpentina','Chrysemys picta','Macrochelys temminckii','Aldabrachelys gigantea','Centrochelys sulcata']
  a=dict(id=name.lower().replace(' ','_'),scientificName=name,commonName=cell['commonName'],entityType='species',taxonomicGroup=group,familiarityTier='core' if core else 'familiar',active=True);d['animals'].append(a);names[name]=a;animals[a['id']]=a
 for id,hi,lo,unit,key,field,basis in reptfields:
  n=r.get(field);ref=str(rs.get(field) or '')
  if not isinstance(n,(int,float)) or not n>0 or not ref or ref.strip()=='NA' or re.search(r'estimat|median|calculat|reconstruct|Slavenko',ref,re.I):continue
  if id in ['rept_reported_clutch_max','rept_reported_egg_length'] and str(r.get('Reproductive mode')).lower()!='oviparous':continue
  value(a,id,n,'not specified','hatchling or newborn' if 'hatchling' in id else 'egg' if 'egg_length' in id else 'reproduction' if 'clutch' in id else 'adult',f"ReptTraits v1-2, exact species {name}; field {field}; original source {ref}; reproductive mode {r.get('Reproductive mode')}. Per-cell sources and full bibliography frozen in repttraits-reviewed-rows.json.")
 year=r.get('Description year')
 if isinstance(year,(int,float)) and 1500<year<2026:value(a,'rept_scientific_description_age',2026-year,'not applicable','species description',f"ReptTraits exact taxon {name}; original authors {r.get('Description author/s')}; description year {year}.")
# Amphibian coverage uses the same published AmphiBIO definitions, with exact accepted taxonomy.
source('gbif-amphibian-authorship-20261010','GBIF · exact amphibian taxonomic authorship','https://api.gbif.org/v1/species/match','2026-10-10 snapshot','CC BY 4.0','institutional-database')
pair('amph_record_clutch','Most eggs in one clutch','Fewest eggs in one clutch','eggs','offspring','Maximum number of eggs per clutch compiled in AmphiBIO v1, restricted to explicitly egg-laying species (Viv=0). Species-level literature references are preserved. This compares reported upper clutch sizes, not typical clutch sizes or live-born litters.','amphibio-5',['frog','salamander'])
pair('amph_first_maturity','Last to grow up','First to grow up','years','maturity','Earliest reported age at reproductive maturity in AmphiBIO v1. The source does not consistently separate sexes, so this is the documented species-level lower endpoint, not a male-only or female-only age. Species literature references are retained.','amphibio-5',['frog','salamander'],kind='specialist')
pair('amph_breeding_events','Most breeding events per year','Fewest breeding events per year','events/year','breeding','Maximum annual number of reproduction events reported in AmphiBIO v1, with original species-level literature references. This is the reported upper annual frequency, not a number inferred from gestation length or a prediction.','amphibio-5',['frog','salamander'])
pair('amph_description_age','Named longest ago','Named most recently','years','scientific-history','Years from the original taxonomic-authority year in the exact accepted GBIF species-match record to 2026. Ambiguous matches, synonyms, genus matches and inherited dates are excluded. This measures naming history, not evolutionary age.','gbif-amphibian-authorship-20261010',['frog','salamander'],kind='specialist')
for cell in json.loads((S/'amphibio-reviewed-rows.json').read_text()):
 name=cell['name'];r=cell['data'];a=names.get(name)
 if not a:
  core=name in ['Agalychnis callidryas','Dendrobates tinctorius','Phyllobates terribilis','Ceratophrys_ornata','Bufo bufo','Rana temporaria','Pseudacris crucifer','Notophthalmus viridescens','Necturus maculosus','Pleurodeles waltl','Bombina orientalis']
  a=dict(id=name.lower().replace(' ','_'),scientificName=name,commonName=cell['commonName'],entityType='species',taxonomicGroup='frog' if r['Order']=='Anura' else 'salamander',familiarityTier='core' if core else 'familiar',active=True);d['animals'].append(a);names[name]=a;animals[a['id']]=a
 note=f"AmphiBIO v1 exact species {name}; original species literature references: {cell['speciesReferences']}; raw id {r['id']}; original OBS {r['OBS']}. Species-level references are not represented as individually mapped trait citations."
 for id,field,stage in [('amphibian_max_mass','Body_mass_g','adult'),('frog_max_svl','Body_size_mm','adult'),('amph_record_clutch','Litter_size_max_n','reproduction'),('amph_first_maturity','Age_at_maturity_min_y','reproductive maturity'),('amph_breeding_events','Reproductive_output_y','reproduction')]:
  if id=='frog_max_svl' and r['Order']!='Anura':continue
  if id=='amph_record_clutch' and r['Viv']!='0':continue
  try:n=float(r[field])
  except ValueError:continue
  if n>0:value(a,id,n,'species-level',stage,note+f'; field {field}.')
 tax=cell['taxonomy'];year=re.search(r'\b(1[6-9]\d{2}|20[0-2]\d)\b',tax['scientificName'])
 if year:value(a,'amph_description_age',2026-int(year[0]),'not applicable','species description',f"Exact accepted GBIF species {name}, usageKey {tax['usageKey']}; original taxonomic authorship {tax['scientificName']}; retrieved 2026-10-10. https://www.gbif.org/species/{tax['usageKey']}")
pair('anage_rept_female_maturity','Last to start parenting','First to start parenting','days','maturity','Reported female age at reproductive maturity in AnAge Build 15, with original reference IDs. These are compiled species-level female records, not ages inferred from body weight or copied from males.','anage-15',reptgroups,kind='intuitive')
pair('anage_rept_incubation','Longest wait to hatch','Shortest wait to hatch','days','incubation','Reported incubation duration in AnAge Build 15, restricted to explicitly egg-laying reptile species in the exact ReptTraits reproductive-mode record. Gestation in live-bearing species is excluded. These source-compiled incubation durations are not a standardized-temperature experiment; original incubation temperature is not consistently supplied.','anage-15',reptgroups)
reptmode={c['name']:c['data']['Reproductive mode'] for c in rept['species']}
# Expand established AnAge metrics using the same sex/stage/origin definitions.
for r in anage:
 name=r['Genus']+' '+r['Species'];a=names.get(name)
 if not a or r['Class'] not in ['Reptilia','Amphibia'] or r['Data quality'] not in ['high','acceptable'] or not r['References']:continue
 note=f"AnAge Build 15; exact taxon {name}; HAGRID {r['HAGRID']}; original reference IDs {r['References']}; quality {r['Data quality']}; specimen origin {r['Specimen origin']}. No value inherited from a related species."
 try:longevity=float(r['Maximum longevity (yrs)'])
 except ValueError:longevity=0
 if longevity>0 and r['Specimen origin']=='captivity' and name!='Proteus anguinus':value(a,'maximum_documented_lifespan',longevity,'species-level','species-level',note,recordOrigin='captivity',sourceQuality=r['Data quality'],sampleSizeCategory=r['Sample size'])
 try:mass=float(r['Adult weight (g)'])
 except ValueError:mass=0
 if mass>0:value(a,'adult_body_mass',mass,'species-level','adult',note+'; original field Adult weight (g).',recordOrigin='not-specified',sourceQuality=r['Data quality'])
# Additional reproductive records have explicit group and field semantics.
for r in anage:
 name=r['Genus']+' '+r['Species'];a=names.get(name)
 if not a or a['taxonomicGroup'] not in reptgroups or r['Data quality'] not in ['high','acceptable'] or not r['References'] or name=='Ophiophagus hannah':continue
 for tid,field,stage in [('anage_rept_female_maturity','Female maturity (days)','reproductive maturity'),('anage_rept_incubation','Gestation/Incubation (days)','egg incubation')]:
  if tid=='anage_rept_incubation' and reptmode.get(name)!='oviparous':continue
  try:n=float(r[field])
  except ValueError:continue
  if n>0:value(a,tid,n,'female' if 'female' in tid else 'species-level',stage,f"AnAge Build 15; HAGRID {r['HAGRID']}; exact species {name}; original field {field}; original references {r['References']}; quality {r['Data quality']}; incubation temperature not standardized or supplied where applicable.",sourceQuality=r['Data quality'])
# Cat behavior: exact breed survey rows, no pooled-breed inheritance or model predictions.
source('febarq-fetch-2024','Delgado et al. · published cat owner survey','https://doi.org/10.1371/journal.pone.0309068','2024','CC BY 4.0','primary-research');d['sources'][-1]['entityScope']='breed'
catfields=[('fetch','Most likely to play fetch','Least likely to play fetch','%', 'PlaysFetch','Share of owners reporting their cat sometimes, usually or always plays fetch (score at least 2), using the published Fe-BARQ responses in Delgado et al. 2024, collected 2015–2023. Scores 0 and 1 count as non-fetchers, following the paper. At least 20 valid responses per exact breed.'),('carry','Most likely to carry toys','Least likely to carry toys','%','Act03','Share of owners reporting their cat sometimes, usually or always carries small objects or toys (Fe-BARQ item 3, score at least 2). This is carrying, not necessarily retrieving a thrown object. At least 20 valid responses per exact breed.'),('initiate_play','Most likely to invite play','Least likely to invite play','%','Act13','Share of owners reporting their cat sometimes, usually or always initiates interactive play with people by bringing toys, strings or objects (Fe-BARQ item 13, score at least 2). At least 20 valid responses per exact breed.'),('playfulness','Most playful in owner survey','Least playful in owner survey','score / 4','Activity','Descriptive breed mean of the published Fe-BARQ Activity/Playfulness subscale in Delgado et al. 2024. Individual subscale scores average the original 0–4 owner responses. At least 20 valid responses; compares this surveyed cohort, not an objective species-wide measurement.'),('sociability','Most sociable with people','Least sociable with people','score / 4','SociabilityPeople','Descriptive breed mean of the published Fe-BARQ Sociability with People subscale, in the 2015–2023 owner survey. At least 20 valid responses per exact breed. This describes owner reports, not an objective temperament guarantee.'),('trainability','Easiest to train in owner survey','Hardest to train in owner survey','score / 4','Trainability','Descriptive breed mean of the published Fe-BARQ Trainability subscale in Delgado et al. 2024, 0–4. At least 20 valid owner responses per exact breed; no regression predictions. This is owner-reported trainability, not intelligence.'),('prey_interest','Most interested in prey','Least interested in prey','score / 4','PreyInterest','Descriptive breed mean of the published Fe-BARQ Prey Interest subscale in Delgado et al. 2024, 0–4. At least 20 valid owner responses per exact breed; this is interest rather than actual hunting success.')]
for id,hi,lo,unit,field,basis in catfields:pair('pet_cat_survey_'+id,hi,lo,unit,'cat-owner-'+id,basis,'febarq-fetch-2024',[])
catraw=list(csv.DictReader((S/'febqFINAL.csv').open(encoding='utf-8-sig')))
for a in animals.values():
 if a['taxonomicGroup']!='cat-breed':continue
 rows=[r for r in catraw if r['breedid']==a['commonName']]
 for id,hi,lo,unit,field,basis in catfields:
  nums=[]
  for row in rows:
   try:n=float(row[field])
   except ValueError:continue
   if 0<=n<=4:nums.append(n)
  if len(nums)<20:continue
  n=100*sum(x>=2 for x in nums)/len(nums) if unit=='%' else sum(nums)/len(nums)
  if n>0:value(a,'pet_cat_survey_'+id,n,'both sexes','survey cohort',f"Delgado et al. 2024; febqFINAL.csv; exact breed {a['commonName']}; field {field}; n={len(nums)} valid responses; descriptive {'proportion scoring at least 2' if unit=='%' else 'arithmetic mean of published individual subscale scores'}; not a regression or pooled-breed prediction.",sampleSizeCategory=f'{len(nums)} cats',recordOrigin='owner survey')
# Aquatic size records retain explicit length types; food breadth uses linked species, never modeled trophic levels.
source('aquatic-cited-size-2606','FishBase / SeaLifeBase · explicitly typed size records','https://www.fishbase.se/manual/FishBaseThe_SPECIES_Table.htm','26.06 snapshot','CC BY-NC 4.0; cite FishBase, SeaLifeBase and original references')
pair('aquatic_cited_total_length','Longest body','Shortest body','cm','body-length','Largest cited total-length field in FishBase / SeaLifeBase 26.06, explicitly coded TL and restricted to fish and crustaceans. This is the male or unsexed maximum-length field; female-specific maxima are not merged into it. Shell length, shell height, mantle length, carapace length, disc width, estimated sizes and larval records are excluded. Original citations are retained.','aquatic-cited-size-2606',['fish','shark','ray','crustacean'])
pair('crab_cited_shell_width','Widest shell','Narrowest shell','cm','shell-width','Largest cited carapace-width field in SeaLifeBase 26.06, explicitly coded CW, for crustaceans. This is the shell across the body, not leg span, claw reach or a width predicted from weight. Original citations are retained.','aquatic-cited-size-2606',['crustacean'])
for cell in json.loads((S/'marine-size-reviewed-rows.json').read_text()):
 name=cell['name'];a=names.get(name)
 if not a:
  core=name in ['Homarus gammarus','Panulirus argus','Panulirus interruptus','Palinurus elephas','Astacus astacus','Procambarus clarkii','Pacifastacus leniusculus','Macrobrachium rosenbergii','Penaeus monodon','Litopenaeus vannamei','Pandalus borealis','Pandalus platyceros','Metacarcinus magister','Cancer borealis','Chionoecetes opilio','Paralithodes camtschaticus','Callinectes sapidus','Carcinus aestuarii']
  a=dict(id=name.lower().replace(' ','_'),scientificName=name,commonName=cell['commonName'],entityType='species',taxonomicGroup=cell['group'],familiarityTier='core' if core else 'familiar',active=True);d['animals'].append(a);names[name]=a;animals[a['id']]=a
 if cell['saltwater']:audit['marineAnimalIds'].append(a['id'])
 for field,record in cell['cells'].items():
  ref=record['citation'];citation=f"{ref.get('Author')}. {ref.get('Year')}. {ref.get('Title')}. {ref.get('Source')}."
  note=f"{cell['database']} 26.06; exact species {name}; SpecCode {cell['specCode']}; original field {field}; length type {cell['lengthType']}; reference {record['referenceId']}: {citation}"
  if field=='Length' and cell['lengthType'] in ['TL','CW']:
   value(a,'aquatic_cited_total_length' if cell['lengthType']=='TL' else 'crab_cited_shell_width',record['value'],'male / unsexed maximum field','reported species maximum',note,recordOrigin='not-specified')
  if field=='DepthRangeDeep':value(a,'marine_habitat_depth',record['value'],'not specified','species habitat',note,recordOrigin='wild')
 year=re.search(r'\b(1[6-9]\d{2}|20[0-2]\d)\b',cell['authorship'] or '')
 if year:value(a,'marine_description_year',2026-int(year[0]),'not applicable','species description',f"{cell['database']} species {cell['specCode']}; exact taxon {name}; original authorship {cell['authorship']}.")
source('aquatic-adult-diet-2606','FishBase / SeaLifeBase · cited adult food-species records','https://www.fishbase.org/manual/English/FishbaseThe_FOOD_ITEMS_table.htm','26.06 snapshot','CC BY-NC 4.0; original references retained')
dietrows=json.loads((S/'marine-diet-reviewed-rows.json').read_text());dietgroups=sorted({names[r['predator']]['taxonomicGroup'] for r in dietrows if r['predator'] in names})
pair('aquatic_documented_food_species','Most food species recorded','Fewest food species recorded','recorded species','documented-food-diversity','Number of distinct food species explicitly linked in cited adult diet records in FishBase / SeaLifeBase 26.06. Only records labelled adults are used; juvenile, larval and default unspecified-stage entries are excluded. Fish and other food species are resolved by their database species IDs. This is documented diet breadth, affected by sampling effort, not a claim to know the complete diet. Inferred functional food classifications and modeled trophic levels are not used.','aquatic-adult-diet-2606',dietgroups)
bydiet=collections.defaultdict(list)
for row in dietrows:bydiet[row['predator']].append(row)
for name,rows in bydiet.items():
 a=names.get(name)
 if not a:continue
 foods={n for r in rows for n in r['prey']}
 if foods:value(a,'aquatic_documented_food_species',len(foods),'not specified','adult diet records',f"Exact species {name}; {len(rows)} cited adult records; resolved food species: {', '.join(sorted(foods))}; original database references: {', '.join(sorted({r['database']+':'+str(r['referenceId'])for r in rows}))}. Full row contexts, IDs and citations retained in marine-diet-reviewed-rows.json.",sampleSizeCategory=f'{len(rows)} source records',recordOrigin='published adult diet records')
# Preserve approved portraits across reproducible imports.
old=P/'underrepresented.json'
if old.exists():d['photos']=[photo for photo in json.loads(old.read_text()).get('photos',[]) if photo['animalId'] in animals]
(S/'cat-birthweight-reviewed-cells.json').write_text(json.dumps(catrows,indent=2)+'\n')
(P/'underrepresented.json').write_text(json.dumps(d,ensure_ascii=False)+'\n');audit['coverage']=dict(collections.Counter(v['traitId'] for v in d['values']));(P/'research/underrepresented-admission-20261010b.json').write_text(json.dumps(audit,indent=2)+'\n');print({'newAnimals':len(d['animals']),'values':len(d['values']),'coverage':audit['coverage']})
