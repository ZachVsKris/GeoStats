#!/usr/bin/env python3
"""Append pinned, directly compiled AnAge/AmphiBIO observations; never impute."""
import csv,io,json,zipfile,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/animalstats'
# Reviewed familiar names; taxonomy remains the source release's taxonomy.
SPECIES={
 'Helarctos malayanus':('Sun bear','bear'),'Melursus ursinus':('Sloth bear','bear'),'Tremarctos ornatus':('Spectacled bear','bear'),'Ursus thibetanus':('Asian black bear','bear'),
 'Alligator mississippiensis':('American alligator','crocodilian'), 'Crocodylus niloticus':('Nile crocodile','crocodilian'), 'Crocodylus acutus':('American crocodile','crocodilian'), 'Gavialis gangeticus':('Gharial','crocodilian'), 'Osteolaemus tetraspis':('Dwarf crocodile','crocodilian'),
 'Boa constrictor':('Boa constrictor','snake'), 'Eunectes murinus':('Green anaconda','snake'), 'Python regius':('Ball python','snake'), 'Python molurus':('Indian python','snake'), 'Elaphe guttata':('Corn snake','snake'), 'Crotalus atrox':('Western diamondback rattlesnake','snake'), 'Agkistrodon contortrix':('Copperhead','snake'),
 'Eublepharis macularius':('Leopard gecko','lizard'), 'Sphenodon punctatus':('Tuatara','reptile'), 'Chlamydosaurus kingii':('Frilled lizard','lizard'),
 'Chelonia mydas':('Green sea turtle','turtle'), 'Caretta caretta':('Loggerhead turtle','turtle'), 'Dermochelys coriacea':('Leatherback turtle','turtle'), 'Macrochelys temminckii':('Alligator snapping turtle','turtle'), 'Trachemys scripta':('Pond slider','turtle'), 'Gopherus agassizii':('Desert tortoise','turtle'), 'Chelonoidis nigra':('Galápagos tortoise','turtle'),
 'Anaxyrus americanus':('American toad','frog'), 'Rhinella marina':('Cane toad','frog'), 'Lithobates catesbeianus':('American bullfrog','frog'), 'Xenopus laevis':('African clawed frog','frog'), 'Hyla versicolor':('Gray tree frog','frog'), 'Litoria caerulea':('Australian green tree frog','frog'), 'Dendrobates auratus':('Green-and-black poison dart frog','frog'), 'Dendrobates leucomelas':('Yellow-banded poison dart frog','frog'), 'Pyxicephalus adspersus':('African bullfrog','frog'), 'Conraua goliath':('Goliath frog','frog'),
 'Ambystoma mexicanum':('Axolotl','salamander'), 'Ambystoma tigrinum':('Tiger salamander','salamander'), 'Ambystoma maculatum':('Spotted salamander','salamander'), 'Salamandra salamandra':('Fire salamander','salamander'), 'Proteus anguinus':('Olm','salamander'), 'Cryptobranchus alleganiensis':('Hellbender','salamander'), 'Andrias japonicus':('Japanese giant salamander','salamander'),
 'Carcharodon carcharias':('Great white shark','shark'), 'Rhincodon typus':('Whale shark','shark'), 'Galeocerdo cuvier':('Tiger shark','shark'), 'Carcharhinus leucas':('Bull shark','shark'), 'Prionace glauca':('Blue shark','shark'), 'Sphyrna lewini':('Scalloped hammerhead','shark'), 'Isurus oxyrinchus':('Shortfin mako','shark'), 'Triakis semifasciata':('Leopard shark','shark'), 'Carcharias taurus':('Sand tiger shark','shark'), 'Negaprion brevirostris':('Lemon shark','shark'), 'Cetorhinus maximus':('Basking shark','shark'),
 'Manta birostris':('Giant manta ray','ray'), 'Myliobatis californica':('Bat ray','ray'), 'Dasyatis americana':('Southern stingray','ray'),
 'Cyprinus carpio':('Common carp','fish'), 'Carassius auratus':('Goldfish','fish'), 'Salmo salar':('Atlantic salmon','fish'), 'Gadus morhua':('Atlantic cod','fish'), 'Thunnus alalunga':('Albacore tuna','fish'), 'Pylodictis olivaris':('Flathead catfish','fish'),
 'Homarus americanus':('American lobster','crustacean'), 'Arctica islandica':('Ocean quahog clam','bivalve'), 'Panopea generosa':('Pacific geoduck','bivalve'), 'Mercenaria mercenaria':('Hard clam','bivalve'), 'Mytilus edulis':('Blue mussel','bivalve'), 'Crassostrea gigas':('Pacific oyster','bivalve'), 'Crassostrea virginica':('Eastern oyster','bivalve'), 'Strongylocentrotus franciscanus':('Red sea urchin','echinoderm'), 'Apis mellifera':('Honey bee','insect'), 'Drosophila melanogaster':('Fruit fly','insect'),
}
def main():
 import urllib.request
 archive=OUT/'source/amphibio-v1.zip'
 if not archive.exists():
  archive.parent.mkdir(parents=True,exist_ok=True)
  urllib.request.urlretrieve('https://ndownloader.figshare.com/files/8828578',archive)
 if hashlib.sha256(archive.read_bytes()).hexdigest() != '15185ffec078423ff7b99d1f16d4daa351a5a8861dd27e5574d05f9a58bc4626':raise SystemExit('AmphiBIO archive changed; review before importing')
 if not (OUT/'source/amphibio/AmphiBIO_v1.csv').exists():
  with zipfile.ZipFile(archive) as z:z.extractall(OUT/'source/amphibio')
 d=json.loads((OUT/'pilot.json').read_text())
 with zipfile.ZipFile(OUT/'source/anage-build-15.zip') as z:rows=list(csv.DictReader(io.TextIOWrapper(z.open('anage_data.txt')),delimiter='\t'))
 lookup={f"{r['Genus']} {r['Species']}":r for r in rows}
 species={a['scientificName']:a for a in d['animals'] if a.get('entityType') != 'breed'}
 for name,(common,group) in SPECIES.items():
  if name not in lookup:print('No AnAge entry',name);continue
  if name not in species:
   a=dict(id=name.lower().replace(' ','_'),commonName=common,scientificName=name,taxonomicGroup=group,familiarityTier='familiar',active=True);d['animals'].append(a);species[name]=a
 traits={t['id']:t for t in d['traits']}; values={(v['animalId'],v['traitId']):v for v in d['values']}
 def trait(tid,name,unit,basis,source,groups=[]):
  if tid not in traits:
   t=dict(id=tid,displayName=name,definition=basis,direction='higher_wins',unit=unit,eligibilityGroups=groups,canonicalSourceId=source,separationMethod='positive_ratio_5_percent',measurementBasis=basis);d['traits'].append(t);traits[tid]=t
 trait('shark_litter_size','Pups per litter','pups','Typical number of live-born pups per litter compiled by AnAge','anage-15',['shark','ray'])
 trait('weaning_mass','Body mass at weaning','g','Typical body weight at weaning compiled by AnAge','anage-15',['carnivore','bear','large-mammal','primate','marsupial','rodent','marine-mammal'])
 trait('wild_recorded_lifespan','Longest recorded life in the wild','years','Maximum recorded lifespan of wild specimens in AnAge; a documented record, not typical life expectancy','anage-15')
 trait('egg_clutch_size','Eggs per clutch','eggs','Typical number of eggs in one clutch compiled by AnAge','anage-15',['bird','turtle','lizard','frog','salamander'])
 for name,a in species.items():
  r=lookup.get(name)
  if not r:continue
  group=a['taxonomicGroup']; quality=r['Data quality']
  for tid,col in [('gestation','Gestation/Incubation (days)'),('litter_size','Litter/Clutch size'),('weaning_age','Weaning (days)'),('birth_weight','Birth weight (g)'),('litters_per_year','Litters/Clutches per year'),('interbirth_interval','Inter-litter/Interbirth interval'),('shark_litter_size','Litter/Clutch size'),('weaning_mass','Weaning weight (g)'),('adult_body_mass','Adult weight (g)'),('female_maturity','Female maturity (days)'),('male_maturity','Male maturity (days)'),('maximum_documented_lifespan','Maximum longevity (yrs)'),('wild_recorded_lifespan','Maximum longevity (yrs)'),('egg_clutch_size','Litter/Clutch size')]:
   if tid in ['gestation','litter_size','weaning_age','birth_weight','litters_per_year','interbirth_interval'] and group not in ['carnivore','bear','large-mammal','primate','marsupial','rodent','marine-mammal']:continue
   if tid=='maximum_documented_lifespan' and r['Specimen origin']!='captivity':continue
   if tid=='wild_recorded_lifespan' and r['Specimen origin']!='wild':continue
   if traits[tid]['eligibilityGroups'] and group not in traits[tid]['eligibilityGroups']:continue
   try:num=float(r[col])
   except ValueError:continue
   if num<=0 or quality not in ['acceptable','high']:continue
   t=traits[tid];key=(a['id'],tid)
   if key not in values:
    v=dict(animalId=a['id'],traitId=tid,valueNumeric=num,unit=t['unit'],sex='female' if tid=='female_maturity' else 'male' if tid=='male_maturity' else 'species-level',lifeStage='newborn' if tid=='birth_weight' else 'adult' if tid=='adult_body_mass' else 'species-level',measurementBasis=t['measurementBasis'],sourceId='anage-15',observationType='compiled',confidence='approved',notes=f"HAGRID {r['HAGRID']}; AnAge references {r['References']}; quality {quality}; longevity origin {r['Specimen origin']}; longevity sample size {r['Sample size']}; no uncertainty interval supplied")
    d['values'].append(v);values[key]=v
   values[key].update(lifeStage='newborn' if tid=='birth_weight' else 'adult' if tid=='adult_body_mass' else 'species-level', recordOrigin=r['Specimen origin'] if 'lifespan' in tid else 'not-specified',uncertaintyStatus='not-reported',sourceQuality=quality,sampleSizeCategory=r['Sample size'] if 'lifespan' in tid else 'not-reported')
 # Source sample-size/data-quality flags describe longevity, not all life-history traits.
 for v in d['values']:
  v.setdefault('uncertaintyStatus','not-reported');v.setdefault('recordOrigin','not-specified')
 if not any(s['id']=='amphibio-5' for s in d['sources']):
  d['sources'].append(dict(id='amphibio-5',name='AmphiBIO amphibian ecological traits',sourceClass='curated-trait-database',url='https://doi.org/10.6084/m9.figshare.4644424.v5',versionYear='v1, Figshare version 5 (2017)',retrievedAt='2026-09-29',license='CC BY 4.0; Oliveira et al. 2017'))
 amphib=list(csv.DictReader(open(OUT/'source/amphibio/AmphiBIO_v1.csv',encoding='cp1252')))
 references={r['Species']:r['Reference'] for r in csv.DictReader(open(OUT/'source/amphibio/AmphiBIO_v1_references.csv',encoding='cp1252'))}
 metrics=[('frog_max_svl','Maximum frog body length','Body_size_mm','mm','Maximum adult snout-to-vent length compiled in AmphiBIO',['frog']),('amphibian_max_mass','Maximum amphibian body mass','Body_mass_g','g','Maximum adult mass compiled in AmphiBIO',['frog','salamander']),('amphibian_max_clutch','Maximum eggs per clutch','Litter_size_max_n','eggs','Maximum number of eggs per clutch compiled in AmphiBIO for egg-laying amphibians',['frog','salamander']),('amphibian_min_maturity','Earliest reported maturity','Age_at_maturity_min_y','years','Minimum reported age at sexual maturity compiled in AmphiBIO',['frog','salamander']),('amphibian_max_events','Maximum breeding events per year','Reproductive_output_y','events/year','Maximum number of reproduction events per year compiled in AmphiBIO',['frog','salamander'])]
 for tid,label,_,unit,basis,groups in metrics:trait(tid,label,unit,basis,'amphibio-5',groups)
 for r in amphib:
  a=species.get(r['Species'])
  if not a or a['taxonomicGroup'] not in ['frog','salamander']:continue
  for tid,_,col,unit,basis,groups in metrics:
   if a['taxonomicGroup'] not in groups or (tid=='amphibian_max_clutch' and r['Viv']=='1'):continue
   try:num=float(r[col])
   except ValueError:continue
   if num<=0:continue
   key=(a['id'],tid)
   if key in values:continue
   v=dict(animalId=a['id'],traitId=tid,valueNumeric=num,unit=unit,sex='species-level',lifeStage='adult',measurementBasis=basis,sourceId='amphibio-5',observationType='compiled',confidence='approved',uncertaintyStatus='not-reported',recordOrigin='not-specified',notes=f"AmphiBIO {r['id']}; compiled extrema, not a mean or confidence interval; references {references.get(r['Species'],'see release')}; OBS {r['OBS']}")
   d['values'].append(v);values[key]=v
 for t in d['traits']:
  if t['id']=='amphibian_min_maturity':t['direction']='lower_wins'
 # Direction variants reuse the exact sourced measurement, never estimate a new value.
 variants=[('shortest_gestation','gestation','Shortest gestation'),('earliest_female_maturity','female_maturity','Earliest female maturity'),('earliest_weaning','weaning_age','Earliest weaning'),('lightest_newborn','birth_weight','Lightest newborn'),('smallest_adult_mass','adult_body_mass','Smallest adult body mass'),('shortest_wild_lifespan','wild_recorded_lifespan','Shortest recorded life in the wild'),('fewest_shark_pups','shark_litter_size','Fewest pups per litter')]
 for tid,base,label in variants:
  if tid not in traits:
   t=dict(traits[base],id=tid,displayName=label,direction='lower_wins');d['traits'].append(t);traits[tid]=t
  for v in list(d['values']):
   if v['traitId']==base and (v['animalId'],tid) not in values:
    copy=dict(v,traitId=tid);d['values'].append(copy);values[(v['animalId'],tid)]=copy
 # A vetted photo manifest is separate from data provenance.
 d['photos']=json.loads((OUT/'photos.json').read_text())
 (OUT/'pilot.json').write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
 print(len(d['animals']),'animals',len(d['traits']),'traits',len(d['values']),'values')
if __name__=='__main__':main()
