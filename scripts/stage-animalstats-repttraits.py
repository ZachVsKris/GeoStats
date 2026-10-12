import pathlib,json,openpyxl,re,collections,argparse
args=argparse.ArgumentParser();args.add_argument('--workbook',type=pathlib.Path,required=True);opts=args.parse_args();R=pathlib.Path(__file__).resolve().parents[1];S=R/'data/animalstats/source/underrepresented-20261010b';w=openpyxl.load_workbook(opts.workbook,read_only=True,data_only=True);it=iter(w['Data'].values);h=next(it);rows={r[0]:dict(zip(h,r))for r in it};it=iter(w['Sources of individual trait val'].values);hh=next(it);refs={r[0]:dict(zip(hh,r))for r in it};bibliography=[r[0]for r in list(w['References'].values)[1:]if r[0]]
# Familiar species and recognisable groups, not every species of a large genus.
names='''Alligator mississippiensis|American alligator
Alligator sinensis|Chinese alligator
Basiliscus basiliscus|Common basilisk
Basiliscus plumifrons|Green basilisk
Boa constrictor|Boa constrictor
Boa imperator|Common boa
Caretta caretta|Loggerhead sea turtle
Chamaeleo calyptratus|Veiled chameleon
Chamaeleo chamaeleon|Common chameleon
Chamaeleo dilepis|Flap-necked chameleon
Chamaeleo senegalensis|Senegal chameleon
Chelonia mydas|Green sea turtle
Chelydra serpentina|Common snapping turtle
Crocodylus acutus|American crocodile
Crocodylus johnstoni|Freshwater crocodile
Crocodylus niloticus|Nile crocodile
Crocodylus porosus|Saltwater crocodile
Crocodylus siamensis|Siamese crocodile
Crocodylus palustris|Mugger crocodile
Crotalus adamanteus|Eastern diamondback rattlesnake
Crotalus atrox|Western diamondback rattlesnake
Crotalus cerastes|Sidewinder
Crotalus horridus|Timber rattlesnake
Crotalus scutulatus|Mojave rattlesnake
Crotalus viridis|Prairie rattlesnake
Dermochelys coriacea|Leatherback sea turtle
Eublepharis macularius|Leopard gecko
Eunectes murinus|Green anaconda
Eunectes notaeus|Yellow anaconda
Furcifer pardalis|Panther chameleon
Furcifer oustaleti|Oustalet's chameleon
Furcifer labordi|Labord's chameleon
Furcifer lateralis|Carpet chameleon
Gekko gecko|Tokay gecko
Gekko japonicus|Japanese gecko
Gekko vittatus|White-lined gecko
Heloderma horridum|Mexican beaded lizard
Heloderma suspectum|Gila monster
Iguana iguana|Green iguana
Iguana delicatissima|Lesser Antillean iguana
Malayopython reticulatus|Reticulated python
Naja naja|Indian cobra
Naja haje|Egyptian cobra
Naja atra|Chinese cobra
Naja kaouthia|Monocled cobra
Naja mossambica|Mozambique spitting cobra
Naja nigricollis|Black-necked spitting cobra
Naja pallida|Red spitting cobra
Naja philippinensis|Philippine cobra
Ophiophagus hannah|King cobra
Pogona barbata|Eastern bearded dragon
Pogona vitticeps|Central bearded dragon
Pogona henrylawsoni|Pygmy bearded dragon
Python bivittatus|Burmese python
Python molurus|Indian python
Python regius|Ball python
Python sebae|African rock python
Python brongersmai|Blood python
Testudo graeca|Greek tortoise
Testudo hermanni|Hermann's tortoise
Testudo horsfieldii|Russian tortoise
Testudo marginata|Marginated tortoise
Testudo kleinmanni|Egyptian tortoise
Trachemys scripta|Pond slider
Uromastyx aegyptia|Egyptian spiny-tailed lizard
Uromastyx geyri|Saharan spiny-tailed lizard
Varanus komodoensis|Komodo dragon
Varanus niloticus|Nile monitor
Varanus salvator|Asian water monitor
Varanus exanthematicus|Savannah monitor
Varanus giganteus|Perentie
Varanus prasinus|Emerald tree monitor
Varanus albigularis|Rock monitor
Varanus acanthurus|Spiny-tailed monitor
Varanus salvadorii|Crocodile monitor
Varanus varius|Lace monitor'''
names+='''
Eretmochelys imbricata|Hawksbill sea turtle
Caiman crocodilus|Spectacled caiman
Caiman latirostris|Broad-snouted caiman
Caiman yacare|Yacare caiman
Crocodylus rhombifer|Cuban crocodile
Crocodylus mindorensis|Philippine crocodile
Crocodylus moreletii|Morelet's crocodile
Antaresia childreni|Children's python
Antaresia maculosa|Spotted python
Aspidites melanocephalus|Black-headed python
Aspidites ramsayi|Woma python
Aldabrachelys gigantea|Aldabra giant tortoise
Centrochelys sulcata|African spurred tortoise
Chelonoidis carbonarius|Red-footed tortoise
Chelonoidis denticulatus|Yellow-footed tortoise
Geochelone elegans|Indian star tortoise
Gopherus agassizii|Desert tortoise
Gopherus polyphemus|Gopher tortoise
Chrysemys picta|Painted turtle
Emys orbicularis|European pond turtle
Emydoidea blandingii|Blanding's turtle
Terrapene carolina|Eastern box turtle
Terrapene ornata|Ornate box turtle
Sternotherus odoratus|Common musk turtle
Kinosternon subrubrum|Eastern mud turtle
Kinosternon flavescens|Yellow mud turtle
Macrochelys temminckii|Alligator snapping turtle
Apalone spinifera|Spiny softshell turtle
Apalone ferox|Florida softshell turtle
Apalone mutica|Smooth softshell turtle
Pelodiscus sinensis|Chinese softshell turtle
Chelus fimbriata|Mata mata
Chelodina longicollis|Eastern long-necked turtle
Mauremys reevesii|Reeves's turtle
Mauremys leprosa|Mediterranean pond turtle
Lepidochelys kempii|Kemp's ridley sea turtle
Lepidochelys olivacea|Olive ridley sea turtle
Natator depressus|Flatback sea turtle
Podocnemis expansa|Giant South American river turtle
Podocnemis unifilis|Yellow-spotted river turtle''';common=dict(line.split('|')for line in names.splitlines());out={'version':'ReptTraits v1-2','doi':'10.6084/m9.figshare.24572683.v4','downloadUrl':'https://ndownloader.figshare.com/files/45408133','species':[{'name':n,'commonName':c,'data':rows[n],'sources':refs[n]}for n,c in common.items()if n in rows],'bibliography':bibliography,'definitionRows':list(w['Trait definitions'].values)};(S/'repttraits-reviewed-rows.json').write_text(json.dumps(out,indent=2,default=str)+'\n');print('Reviewed name roster',len(out['species']))
fields=['Maximum Longevity (years)','Maximum body mass (g)','Maximum total length ("TL", mm)','Hatchling/neonate mass (g)','Largest clutch size','Egg length (mm)'];print({f:sum(isinstance(x['data'][f],(int,float)) and x['data'][f]>0 and bool(x['sources'].get(f)) and not re.search(r'estimat|median|Slavenko|calculat|^NA$',str(x['sources'].get(f)),re.I)for x in out['species'])for f in fields})
