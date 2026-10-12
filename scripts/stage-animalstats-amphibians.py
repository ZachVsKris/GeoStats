import pathlib,json,csv,zipfile,io,requests,re,concurrent.futures,argparse
args=argparse.ArgumentParser();args.add_argument('--archive',type=pathlib.Path,required=True);opts=args.parse_args();R=pathlib.Path(__file__).resolve().parents[1];S=R/'data/animalstats/source/underrepresented-20261010b';z=zipfile.ZipFile(opts.archive);raw={r['Species']:r for r in csv.DictReader(io.StringIO(z.read('AmphiBIO_v1.csv').decode('cp1252')))};refs={r['Species']:r['Reference']for r in csv.DictReader(io.StringIO(z.read('AmphiBIO_v1_references.csv').decode('cp1252')))}
names='''Agalychnis callidryas|Red-eyed tree frog
Alytes obstetricans|Common midwife toad
Alytes cisternasii|Iberian midwife toad
Bombina bombina|European fire-bellied toad
Bombina orientalis|Oriental fire-bellied toad
Bombina variegata|Yellow-bellied toad
Bufo bufo|Common toad
Bufo spinosus|Spiny toad
Duttaphrynus melanostictus|Asian common toad
Bufotes viridis|European green toad
Epidalea calamita|Natterjack toad
Anaxyrus americanus|American toad
Anaxyrus fowleri|Fowler's toad
Anaxyrus boreas|Western toad
Ceratophrys cranwelli|Chacoan horned frog
Ceratophrys ornata|Argentine horned frog
Dendrobates tinctorius|Dyeing poison dart frog
Dendrobates auratus|Green and black poison dart frog
Dendrobates leucomelas|Yellow-banded poison dart frog
Phyllobates terribilis|Golden poison frog
Oophaga pumilio|Strawberry poison frog
Mantella aurantiaca|Golden mantella
Hyla arborea|European tree frog
Hyla cinerea|American green tree frog
Hyla versicolor|Gray tree frog
Litoria caerulea|White's tree frog
Litoria infrafrenata|White-lipped tree frog
Leptodactylus pentadactylus|Smoky jungle frog
Lithobates catesbeianus|American bullfrog
Lithobates clamitans|Green frog
Lithobates pipiens|Northern leopard frog
Lithobates sylvaticus|Wood frog
Pelophylax ridibundus|Marsh frog
Pelophylax lessonae|Pool frog
Pelobates fuscus|Common spadefoot toad
Pelobates cultripes|Western spadefoot toad
Pseudacris crucifer|Spring peeper
Pseudacris triseriata|Western chorus frog
Rana temporaria|Common frog
Rana dalmatina|Agile frog
Rana arvalis|Moor frog
Rhinella marina|Cane toad
Xenopus laevis|African clawed frog
Hymenochirus boettgeri|African dwarf frog
Pyxicephalus adspersus|African bullfrog
Conraua goliath|Goliath frog
Ambystoma mexicanum|Axolotl
Ambystoma tigrinum|Tiger salamander
Ambystoma maculatum|Spotted salamander
Andrias japonicus|Japanese giant salamander
Cryptobranchus alleganiensis|Hellbender
Necturus maculosus|Mudpuppy
Notophthalmus viridescens|Eastern newt
Salamandra salamandra|Fire salamander
Salamandra atra|Alpine salamander
Triturus cristatus|Great crested newt
Lissotriton vulgaris|Smooth newt
Ichthyosaura alpestris|Alpine newt
Pleurodeles waltl|Iberian ribbed newt
Proteus anguinus|Olm'''
common=dict(line.split('|')for line in names.splitlines());cachefile=S/'amphibian-taxonomy.json';cache=json.load(open(cachefile))if cachefile.exists()else{}
def get(n):
 if n in cache:return n,cache[n]
 r=requests.get('https://api.gbif.org/v1/species/match',params={'name':n,'kingdom':'Animalia','strict':'true'},timeout=35);r.raise_for_status();return n,r.json()
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
 for f in concurrent.futures.as_completed([ex.submit(get,n)for n in common if n in raw]):
  try:n,t=f.result();cache[n]=t;cachefile.write_text(json.dumps(cache,indent=2)+'\n')
  except Exception as e:print(str(e)[:100],flush=True)
selected=[]
for n,c in common.items():
 if n not in raw:continue
 t=cache.get(n,{})
 if t.get('rank')!='SPECIES' or t.get('matchType')!='EXACT' or t.get('canonicalName')!=n or t.get('status')!='ACCEPTED':continue
 if re.search('estimat|calculat|predict|imput',raw[n].get('OBS',''),re.I):continue
 selected.append({'name':n,'commonName':c,'data':raw[n],'speciesReferences':refs.get(n,''),'taxonomy':t})
(S/'amphibio-reviewed-rows.json').write_text(json.dumps(selected,indent=2)+'\n');print('Exact accepted amphibians',len(selected),flush=True)
