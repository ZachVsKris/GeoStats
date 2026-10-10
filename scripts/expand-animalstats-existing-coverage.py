#!/usr/bin/env python3
"""Extend existing AnAge facts under the existing exact-taxon admission rules."""
import csv,io,json,pathlib,zipfile,hashlib,math,collections
R=pathlib.Path(__file__).resolve().parents[1];P=R/'data/animalstats';b=json.loads((P/'pilot.json').read_text());path=P/'source/anage-build-15.zip'
with zipfile.ZipFile(path) as z:rows={r['Genus']+' '+r['Species']:r for r in csv.DictReader(io.StringIO(z.read('anage_data.txt').decode()),delimiter='\t')}
selection={
'Bubalus bubalis':'Water buffalo','Syncerus caffer':'African buffalo','Cervus canadensis':'Elk','Odocoileus virginianus':'White-tailed deer','Cervus nippon':'Sika deer','Capreolus capreolus':'Roe deer','Oryx gazella':'Gemsbok','Gazella gazella':'Mountain gazelle','Alcelaphus buselaphus':'Hartebeest','Connochaetes taurinus':'Blue wildebeest','Aepyceros melampus':'Impala','Lama glama':'Llama','Vicugna pacos':'Alpaca','Orycteropus afer':'Aardvark','Manis pentadactyla':'Chinese pangolin','Choloepus didactylus':'Two-toed sloth','Bradypus variegatus':'Three-toed sloth','Hydrochoerus hydrochaeris':'Capybara','Castor canadensis':'North American beaver','Sciurus carolinensis':'Eastern gray squirrel','Marmota monax':'Groundhog','Erethizon dorsatum':'North American porcupine','Lynx canadensis':'Canada lynx','Lynx rufus':'Bobcat','Lutra lutra':'Eurasian otter','Lontra canadensis':'North American river otter','Ailurus fulgens':'Red panda','Potos flavus':'Kinkajou','Mephitis mephitis':'Striped skunk','Taxidea taxus':'American badger','Vulpes zerda':'Fennec fox','Lycaon pictus':'African wild dog','Hyaena hyaena':'Striped hyena','Crocuta crocuta':'Spotted hyena','Vulpes lagopus':'Arctic fox','Acinonyx jubatus':'Cheetah','Tapirus terrestris':'Brazilian tapir','Okapia johnstoni':'Okapi','Diceros bicornis':'Black rhinoceros','Mirounga angustirostris':'Northern elephant seal','Trichechus manatus':'West Indian manatee','Dugong dugon':'Dugong','Monodon monoceros':'Narwhal','Delphinapterus leucas':'Beluga whale','Balaenoptera musculus':'Blue whale','Megaptera novaeangliae':'Humpback whale','Physeter macrocephalus':'Sperm whale','Macropus rufus':'Red kangaroo','Lemur catta':'Ring-tailed lemur','Gorilla gorilla':'Western gorilla','Pongo pygmaeus':'Bornean orangutan','Papio hamadryas':'Hamadryas baboon','Mandrillus sphinx':'Mandrill','Macaca mulatta':'Rhesus macaque'}
fields={'adult_body_mass':'Adult weight (g)','maximum_documented_lifespan':'Maximum longevity (yrs)','wild_recorded_lifespan':'Maximum longevity (yrs)','gestation':'Gestation/Incubation (days)','litter_size':'Litter/Clutch size','female_maturity':'Female maturity (days)','male_maturity':'Male maturity (days)','weaning_age':'Weaning (days)','birth_weight':'Birth weight (g)','weaning_mass':'Weaning weight (g)','litters_per_year':'Litters/Clutches per year','interbirth_interval':'Inter-litter/Interbirth interval'}
d={'animals':[],'traits':[],'sources':[],'photos':[],'values':[]};audit={'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'newAnimals':[],'held':[],'coverage':{}};animals=list(b['animals']);known={a['scientificName'] for a in animals};existing={(v['animalId'],v['traitId']) for v in b['values']};traits={t['id']:t for t in b['traits']}
for name,common in selection.items():
 if name in known:continue
 row=rows.get(name)
 if not row or row['Data quality'] not in ['high','acceptable']:
  audit['held'].append({'species':name,'reason':'no exact source taxon' if not row else 'source quality '+row['Data quality']});continue
 group={'Rodentia':'rodent','Primates':'primate','Carnivora':'carnivore','Cetacea':'marine-mammal','Sirenia':'marine-mammal','Diprotodontia':'marsupial'}.get(row['Order'],'large-mammal')
 animal={'id':name.lower().replace(' ','_'),'scientificName':name,'commonName':common,'taxonomicGroup':group,'entityType':'species','familiarityTier':'core','active':True};d['animals'].append(animal);animals.append(animal);audit['newAnimals'].append(name)
# Common animals with weak AnAge records remain eligible for independently
# sourced range/ecology facts. They receive no AnAge observations below.
spatialPath=P/'source/underrepresented-20261010/TetrapodTraits_v2.0.1.csv'
spatialNames={r['Scientific.Name'] for r in csv.DictReader(spatialPath.open())} if spatialPath.exists() else set()
audit['rangeOnlyAnimals']=[]
for name,common,group in [('Alces alces','Moose','large-mammal'),('Odobenus rosmarus','Walrus','marine-mammal'),('Manis pentadactyla','Chinese pangolin','large-mammal'),('Mirounga angustirostris','Northern elephant seal','marine-mammal'),('Bradypus variegatus','Three-toed sloth','large-mammal'),('Erethizon dorsatum','North American porcupine','rodent')]:
 if name in {a['scientificName'] for a in animals} or name not in spatialNames:continue
 animal={'id':name.lower().replace(' ','_'),'scientificName':name,'commonName':common,'taxonomicGroup':group,'entityType':'species','familiarityTier':'core','active':True};d['animals'].append(animal);animals.append(animal);audit['rangeOnlyAnimals'].append({'species':name,'source':'TetrapodTraits 2.0.1 range/ecology; no weak AnAge records admitted'})
for animal in animals:
 row=rows.get(animal['scientificName'])
 if not row or animal.get('entityType')=='breed' or row['Data quality'] not in ['high','acceptable'] or not row['References']:continue
 for tid,field in fields.items():
  if tid not in traits:continue
  if tid not in ['adult_body_mass','maximum_documented_lifespan','wild_recorded_lifespan'] and row['Class']!='Mammalia':continue
  if tid=='gestation' and row['Order']=='Monotremata':continue
  if tid=='maximum_documented_lifespan' and row['Specimen origin']!='captivity':continue
  if tid=='wild_recorded_lifespan' and row['Specimen origin']!='wild':continue
  try:value=float(row[field])
  except ValueError:continue
  if not math.isfinite(value) or value<=0:continue
  t=traits[tid];targets=[t]+([traits[t['counterTraitId']]] if t.get('counterTraitId') in traits else [])
  for trait in targets:
   if (animal['id'],trait['id']) in existing:continue
   if trait['canonicalSourceId']!='anage-15':continue
   v={'animalId':animal['id'],'traitId':trait['id'],'valueNumeric':value,'unit':trait['unit'],'sex':'female' if tid=='female_maturity' else 'male' if tid=='male_maturity' else 'species-level','lifeStage':'newborn' if tid=='birth_weight' else 'adult' if tid=='adult_body_mass' else 'species-level','measurementBasis':trait['measurementBasis'],'sourceId':'anage-15','observationType':'compiled','confidence':'approved','notes':f"AnAge Build 15; exact taxon {animal['scientificName']}; HAGRID {row['HAGRID']}; original column {field}; original reference IDs {row['References']}; quality {row['Data quality']}; longevity origin {row['Specimen origin']}. Existing comparison definition retained; no values inferred from relatives or breeds.",'recordOrigin':row['Specimen origin'] if 'lifespan' in tid else 'not-specified','uncertaintyStatus':'not-reported','sourceQuality':row['Data quality'],'sampleSizeCategory':row['Sample size'] if 'lifespan' in tid else 'not-reported'};d['values'].append(v);existing.add((animal['id'],trait['id']))
prior=P/'existing-coverage.json'
if prior.exists():
 old=json.loads(prior.read_text());d['photos']=old.get('photos',[])
for tid in fields:
 audit['coverage'][tid]={'before':sum(v['traitId']==tid for v in b['values']),'added':sum(v['traitId']==tid for v in d['values']),'after':sum(v['traitId']==tid for v in b['values']+d['values'])}
(P/'existing-coverage.json').write_text(json.dumps(d)+'\n');(P/'research/existing-coverage-admission.json').write_text(json.dumps(audit,indent=2)+'\n');print(json.dumps({'newAnimals':len(d['animals']),'newSourceCells':len(d['values']),'coverage':audit['coverage']}))
