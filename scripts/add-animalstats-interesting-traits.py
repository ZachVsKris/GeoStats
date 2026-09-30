#!/usr/bin/env python3
"""Import measured flight, sleep and field-space traits; never approves a daily board."""
import csv,hashlib,io,json,math,re,statistics,subprocess,urllib.request,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/animalstats';SRC=OUT/'source'
d=json.loads((OUT/'pilot.json').read_text());animals={a['scientificName'].lower():a for a in d['animals']}
NEW={
 'Apus apus':('Common swift','bird'),'Anser anser':('Greylag goose','bird'),'Ardea cinerea':('Grey heron','bird'),'Phalacrocorax carbo':('Great cormorant','bird'),'Larus argentatus':('Herring gull','bird'),'Corvus corone':('Carrion crow','bird'),'Erithacus rubecula':('European robin','bird'),'Sturnus vulgaris':('Common starling','bird'),
 'Ornithorhynchus anatinus':('Platypus','monotreme'),'Erinaceus europaeus':('European hedgehog','insectivore'),'Didelphis marsupialis':('Common opossum','marsupial'),'Tupaia glis':('Common treeshrew','treeshrew'),'Cavia porcellus':('Guinea pig','rodent'),
 'Columba palumbus':('Wood pigeon','bird'),'Corvus frugilegus':('Rook','bird'),'Alauda arvensis':('Eurasian skylark','bird'),'Somateria mollissima':('Common eider','bird'),'Vanellus vanellus':('Northern lapwing','bird'),'Haematopus ostralegus':('Eurasian oystercatcher','bird'),'Sterna hirundo':('Common tern','bird'),'Larus ridibundus':('Black-headed gull','bird'),
}
for scientific,(name,group) in NEW.items():
 if scientific.lower() not in animals:
  a=dict(id=scientific.lower().replace(' ','_'),scientificName=scientific,commonName=name,taxonomicGroup=group,familiarityTier='familiar',active=True);d['animals'].append(a);animals[scientific.lower()]=a

def source(id,name,url,version,license,kind='primary-research'):
 if id not in {s['id'] for s in d['sources']}:d['sources'].append(dict(id=id,name=name,url=url,versionYear=version,retrievedAt='2026-09-29',license=license,sourceClass=kind))
def trait(id,name,unit,basis,sid,family,prompt,groups=[],direction='higher_wins'):
 t=dict(id=id,displayName=name,unit=unit,definition=basis,measurementBasis=basis,canonicalSourceId=sid,eligibilityGroups=groups,direction=direction,separationMethod='positive_ratio_5_percent',gameplayFamily=family,playerHint=prompt)
 d['traits']=[x for x in d['traits'] if x['id']!=id]+[t];return t
selected=[]
def value(a,t,n,notes,low=None,high=None,origin=None,sex='species-level',stage='adult'):
 row=dict(animalId=a['id'],traitId=t['id'],valueNumeric=n,unit=t['unit'],sex=sex,lifeStage=stage,measurementBasis=t['measurementBasis'],sourceId=t['canonicalSourceId'],observationType='compiled',confidence='approved',notes=notes,uncertaintyStatus='reported' if low is not None else 'not-reported',uncertaintyKind='source-range' if low is not None else 'not-reported')
 if low is not None and low!=high:row.update(valueMin=low,valueMax=high)
 else:row.update(uncertaintyStatus='not-reported',uncertaintyKind='not-reported')
 if origin:row['recordOrigin']=origin
 d['values']=[x for x in d['values'] if (x['animalId'],x['traitId'])!=(a['id'],t['id'])]+[row];selected.append(row)
# Reproducible primary source archives; only new measurement subsets are retained as CSV/JSON.
files=[('flight-speed-2007.pdf','https://ndownloader.figshare.com/files/467039','a2067b481c96ea972ced3c8ea6441aaa'),('diving-2020.csv','https://zenodo.org/api/records/4995679/files/Diving_dataset.csv/content','509751d8acab389b31e3de08e445e1d0'),('homerange-2025.zip','https://raw.githubusercontent.com/SHoeks/HomeRange/main/HomeRangeData_2025_04_11_1.zip','f6e30c3ce2ad57c035df8e1a66e27a5d'),('sleep-bu-records.csv','https://www.bu.edu/phpbin/sleep/csv/','febaa3b29da53adab1078da613b14591')]
for name,url,md5 in files:
 p=SRC/name
 if not p.exists():urllib.request.urlretrieve(url,p)
 if md5 and hashlib.md5(p.read_bytes()).hexdigest()!=md5:raise ValueError('Source checksum mismatch: '+name)
source('flight-2007','Alerstam et al. radar-tracked bird flight','https://doi.org/10.1371/journal.pbio.0050197','Protocol S1 (2007), Figshare v1','CC BY 4.0')
flight=trait('cruising_flight_speed','Fastest cruising flight','km/h','Mean equivalent airspeed in continuous flapping migration flight, corrected to sea-level air density; radar tracks, not maximum speed or diving speed.','flight-2007','movement','Steady flight through the air. Not a hunting dive.',['bird'])
span=trait('measured_wingspan','Widest wingspan','m','Protocol S1 weighted mean maximum wingtip-to-wingtip span, measured with wings stretched; at least four measurements.','flight-2007','anatomy','Wingtip to wingtip, with wings stretched.',['bird'])
# Extract numeric cells by PDF coordinates to preserve empty columns and study markers.
import pdfplumber
with pdfplumber.open(SRC/'flight-speed-2007.pdf') as pdf:
 for pi,page in enumerate(pdf.pages[2:]):
  words=page.extract_words(x_tolerance=1,y_tolerance=2);lines={}
  for w in words:
   key=next((y for y in lines if abs(y-w['top'])<2),w['top']);lines.setdefault(key,[]).append(w)
  anchor='Cygnus olor' if pi==0 else 'Alauda arvensis'
  reference=next(ws for ws in lines.values() if ' '.join(w['text'] for w in ws).startswith(anchor+' ') and '•' not in [w['text'] for w in ws])
  nums=[w for w in reference if re.fullmatch(r'-?\d+(?:\.\d+)?',w['text'])]
  centers=[(w['x0']+w['x1'])/2 for w in nums]
  for ws in lines.values():
   text=' '.join(w['text'] for w in ws);m=re.match(r'([A-Z][a-z]+ [a-z]+)\s',text)
   if not m:continue
   a=animals.get(m.group(1).lower())
   if not a:continue
   cells={}
   for w in ws:
    if not re.fullmatch(r'-?\d+(?:\.\d+)?',w['text']):continue
    x=(w['x0']+w['x1'])/2;idx=min(range(len(centers)),key=lambda i:abs(centers[i]-x))
    if abs(centers[idx]-x)<9:cells[idx]=float(w['text'])
   secondary='•' in text
   ue=cells.get(0);sd=cells.get(1);n=cells.get(3,0)
   if ue and n>=10:
    prior=any(v['animalId']==a['id'] and v['traitId']==flight['id'] for v in selected)
    if not secondary or not prior:value(a,flight,ue*3.6,f"Protocol S1 {'Bruderer and Boldt' if secondary else 'Lund'} radar row: Ue={ue} m/s; {int(n)} tracks; SD={sd if sd is not None else 'not supplied'} m/s. Equivalent airspeed in flapping flight, not maximum or dive speed. No uncertainty interval for the species mean.",origin='wild')
   nb=cells.get(7,0);b=cells.get(8)
   if b and nb>=4:value(a,span,b,f'Protocol S1: {int(nb)} measured wingspans; weighted species mean. No uncertainty interval for the mean.')
# Sleep: retain strict adult, mixed-sex, 24-hour EEG records with >=3 subjects and lab score >=9.
source('sleep-bu-2007','Boston University Phylogeny of Sleep database','https://www.bu.edu/phylogeny/','CSV snapshot 2026-09-29; McNamara et al. 2008','Selected numerical facts with attribution; no blanket dataset reuse license stated','institutional-database')
sleep=trait('daily_sleep','Most time asleep','hours/day','Median of eligible adult mixed-sex EEG studies recorded over 24 hours, at least three animals and laboratory-condition score at least 9. Captive observations, not wild daily sleep.','sleep-bu-2007','sleep','Hours asleep in a day, measured in captive studies.')
rs=list(csv.DictReader((SRC/'sleep-bu-records.csv').open()));by={}
for r in rs:
 a=animals.get(r['SpeciesName_Reported'].lower().removesuffix(' l.'))
 try:n=float(r['N']);score=float(r['Total_lab_condition_score']);hours=float(r['Total_daily_sleep'])
 except ValueError:continue
 if a and r['EEG']=='Yes' and r['Twenty_four_hour'].startswith('3') and r['Summary_age_class']=='Adult' and r['Sex']=='Mix' and n>=3 and score>=9 and 0<hours<=24:by.setdefault(a['id'],[]).append((r,hours))
for aid,rows in by.items():
 a=next(x for x in d['animals'] if x['id']==aid);nums=[n for _,n in rows];notes='Adult, mixed-sex, captive 24-hour EEG records: '+'; '.join(f"BU record {r['search_id']}, {r['Reference']}, N={r['N']}, lab score={r['Total_lab_condition_score']}" for r,_ in rows)+'. Source disagreement envelope is not a confidence interval.'
 value(a,sleep,statistics.median(nums),notes,min(nums),max(nums),origin='captivity',sex='mixed')
# Home range: keep wild adults, no subspecies, individual annual 95% KDE estimates.
source('home-range-2025','HomeRange field-study database','https://doi.org/10.1111/geb.13625','Author repository 2025-04-11','CC0; Broekman et al.','curated-trait-database')
home=trait('annual_home_range','Largest home range','km²','Median individual annual 95% kernel-density home range for wild adults with no subspecies record; at least three individuals. Same estimator, isopleth and annual timescale. Full included individual range is a descriptive envelope, not uncertainty of the median.','home-range-2025','space','Area used over a year—not a defended territory.')
z=zipfile.ZipFile(SRC/'homerange-2025.zip');rows=list(csv.DictReader(io.StringIO(z.read('HomeRangeData_2025_04_11.csv').decode())));by={}
for r in rows:
 a=animals.get(r['Species'].lower())
 if not a or not all([r['Context']=='Wild',r['Life_Stage']=='Adult',r['HR_Level']=='Individual',r['HR_Span']=='Annual',r['HR_Method_Simple']=='KDE',r['Isopleth_Size']=='95',r['subspecies']=='NA']):continue
 try:n=float(r['Home_Range_km2'])
 except ValueError:continue
 if n>0:by.setdefault(a['id'],{})[(r['Study_ID'],r['Ind_ID'])]=(r,n)
for aid,records in by.items():
 rows=list(records.values())
 if len(rows)<3:continue
 a=next(x for x in d['animals'] if x['id']==aid);nums=[n for _,n in rows]
 value(a,home,statistics.median(nums),f"{len(nums)} annual individual records; study IDs {', '.join(sorted({r['Study_ID'] for r,_ in rows}))}. Wild adults, annual KDE 95%; full individual range, not a confidence interval. Local populations and tracking coverage differ; no universal species territory claim.",min(nums),max(nums),origin='wild')
# Diving: only field-explicit studies of birds/mammals; exclude captive/laboratory/hibernation contexts.
source('diving-2020','Verberk et al. observed dive-duration compilation','https://doi.org/10.5061/dryad.tqjq2bvv9','Diving_dataset.csv; archived 2023-08-18','CC0')
dive=trait('field_max_dive','Longest recorded dive','minutes','Largest reported maximum dive duration among field-explicit foraging or wild-tracking studies in Verberk et al.; study-dependent record, not a typical dive or physiological limit.','diving-2020','movement','A documented underwater dive. Records, not typical dives.')
by={}
for r in csv.DictReader((SRC/'diving-2020.csv').open(encoding='latin1')):
 a=animals.get(r['Species'].lower());context=(r['Remarks']+' '+r['Literature.source']).lower()
 if not a or r['Endo.vs..Ecto']!='Endotherm' or not any(s in context for s in ['foraging','free-ranging','at sea','in the wild','satellite']):continue
 if any(s in context for s in ['captiv','laboratory','aquarium','zoo_bio','hibernat','forced']):continue
 try:n=float(r['Maximum.dive.duration..min.'])
 except ValueError:continue
 if n>0:by.setdefault(a['id'],[]).append((r,n))
for aid,rows in by.items():
 a=next(x for x in d['animals'] if x['id']==aid);r,n=max(rows,key=lambda x:x[1]);value(a,dive,n,'Maximum among '+str(len(rows))+' eligible field-explicit records. Primary reference: '+r['Literature.source']+'. Study note: '+r['Remarks']+'. No uncertainty interval; record depends on sampling effort.',origin='wild',stage='species-level')
# EURING published minimum known ages; never substitute for true lifespan.
source('euring-2023','EURING European ringing longevity records','https://euring.org/files/documents/EURING_longevity_list_20230901.pdf','2023-09-01 list; Fransson et al. 2023','Selected numerical records with attribution; no blanket reuse license stated','institutional-database')
euring=trait('ringing_longevity','Oldest documented wild bird','years','Highest published minimum known age in the EURING 2023 European ringing list. Adults of unknown birth date are lower-bound ages; birds still alive may outlive the record. This compares published records, not typical lifespan or species survival.','euring-2023','longevity','Published wild-bird age records from European ringing schemes.',['bird'])
p=SRC/'euring-longevity-2023.pdf'
if not p.exists():urllib.request.urlretrieve('https://www.euring.org/files/documents/EURING_longevity_list_20230901.pdf',p)
if hashlib.md5(p.read_bytes()).hexdigest()!='c82b37efe23fe95b5e2945f894c46496':raise ValueError('EURING source checksum mismatch')
subprocess.run(['pdftotext','-layout',str(p),str(SRC/'euring-longevity-2023.txt')],check=True)
ls=(SRC/'euring-longevity-2023.txt').read_text().splitlines()
for i,line in enumerate(ls):
 for scientific,a in animals.items():
  if a['taxonomicGroup']!='bird' or scientific not in line.lower():continue
  # Scientific-name line holds the second record. Its preceding common-name row holds the oldest.
  before=next((ls[j] for j in range(i-1,max(-1,i-4),-1) if re.search(r'(\d+)y\s+(\d+)m',ls[j])),None)
  if before is None:continue
  match=re.search(r'(\d+)y\s+(\d+)m',before);years=int(match.group(1));months=int(match.group(2))
  value(a,euring,years+months/12,f'EURING September 2023 record: {years} years {months} months. Published minimum known age; rounding to months and unknown birth dates are not uncertainty intervals. Ringing effort differs between species. Records may be censored by a bird still being alive.',origin='wild',stage='species-level')
# Add canonical AnAge values for newly introduced species (no origin blending).
z=zipfile.ZipFile(SRC/'anage-build-15.zip');ar={f"{r['Genus']} {r['Species']}":r for r in csv.DictReader(io.TextIOWrapper(z.open('anage_data.txt')),delimiter='\t')}
keys={'adult_body_mass':'Adult weight (g)','maximum_documented_lifespan':'Maximum longevity (yrs)','wild_recorded_lifespan':'Maximum longevity (yrs)','litter_size':'Litter/Clutch size','gestation':'Gestation/Incubation (days)','clutch_size':'Litter/Clutch size','incubation':'Gestation/Incubation (days)'}
for scientific in NEW:
 r=ar.get(scientific);a=animals[scientific.lower()]
 if not r:continue
 for tid,column in keys.items():
  if a['taxonomicGroup']=='bird' and tid in ['litter_size','gestation'] or a['taxonomicGroup']!='bird' and tid in ['clutch_size','incubation']:continue
  if tid=='maximum_documented_lifespan' and r['Specimen origin']!='captivity' or tid=='wild_recorded_lifespan' and r['Specimen origin']!='wild':continue
  try:n=float(r[column])
  except ValueError:continue
  if n<=0:continue
  t=next(x for x in d['traits'] if x['id']==tid)
  if t['eligibilityGroups'] and a['taxonomicGroup'] not in t['eligibilityGroups']:t['eligibilityGroups'].append(a['taxonomicGroup'])
  value(a,t,n,f"AnAge HAGRID {r['HAGRID']}; references {r['References']}; specimen origin {r['Specimen origin']}. Longevity quality/sample flags do not establish quality of other traits.",origin=r['Specimen origin'] if 'lifespan' in tid else None,stage='adult' if tid=='adult_body_mass' else 'species-level')
# Direct AVONET means for new birds: no inferred values, >=4 individuals.
p=SRC/'avonet-v7.xlsx'
if not p.exists():urllib.request.urlretrieve('https://ndownloader.figshare.com/files/34480856',p)
import openpyxl
book=openpyxl.load_workbook(p,read_only=True,data_only=True);it=book['AVONET1_BirdLife'].values;head=next(it);ix={k:i for i,k in enumerate(head)}
cols={'bird_mass':'Mass','bird_beak_length':'Beak.Length_Culmen','bird_beak_width':'Beak.Width','bird_beak_depth':'Beak.Depth','bird_tarsus_length':'Tarsus.Length','bird_wing_length':'Wing.Length','bird_kipps_distance':'Kipps.Distance','bird_secondary_length':'Secondary1','bird_hand_wing_index':'Hand-Wing.Index','bird_tail_length':'Tail.Length','bird_range_area':'Range.Size'}
for r in it:
 scientific=r[ix['Species1']]
 if scientific not in NEW or NEW[scientific][1]!='bird' or r[ix['Inference']]!='NO' or r[ix['Total.individuals']]<4:continue
 a=animals[scientific.lower()]
 for tid,col in cols.items():
  n=r[ix[col]]
  if isinstance(n,(int,float)) and n>0:
   t=next(x for x in d['traits'] if x['id']==tid);value(a,t,n,f'AVONET direct species mean; {r[ix["Total.individuals"]]} measured individuals, inference NO.',sex='mixed')
# Keep direction variants current and give traits approachable labels without altering definitions.
labels={'adult_body_mass':('Heaviest adult','size','Typical adult weight.'),'bird_mass':('Heaviest adult','size','Average adult weight.'),'amphibian_max_mass':('Heaviest recorded adult','size','Largest adult mass reported in the source.'),'maximum_documented_lifespan':('Longest recorded life in captivity','longevity','Documented records in captivity.'),'wild_recorded_lifespan':('Longest recorded life in the wild','longevity','Documented records in the wild.'),'bird_range_area':('Widest breeding range','range','How much of the map its breeding range covers.'),'bird_beak_length':('Longest beak','anatomy','From the beak tip to its base.'),'bird_tail_length':('Longest tail feathers','anatomy','The longest tail feather, measured from the skin.'),'raw_clutch_size':('Most eggs per clutch','reproduction','Eggs laid in one clutch.'),'raw_incubation':('Longest wait to hatch','reproduction','Days from laying to hatching.'),'raw_gestation':('Longest pregnancy','reproduction','Days from conception to birth.'),'raw_litter_size':('Most young per birth','reproduction','Young born in a single birth.'),'clutch_size':('Most eggs per clutch','reproduction','Eggs laid in one clutch.'),'litter_size':('Most young per birth','reproduction','Young born in a single birth.'),'incubation':('Longest wait to hatch','reproduction','Days from laying to hatching.'),'gestation':('Longest pregnancy','reproduction','Days from conception to birth.'),'frog_max_svl':('Longest frog body','size','Snout to vent. Legs are excluded.')}
for t in d['traits']:
 tid=t['id'];family='reproduction'
 if 'lifespan' in tid:family='longevity'
 elif tid in ['adult_body_mass','smallest_adult_mass','bird_mass','amphibian_max_mass','raw_adult_mass','frog_max_svl']:family='size'
 elif tid.startswith('bird_'):family='range' if tid=='bird_range_area' else 'anatomy'
 t.setdefault('gameplayFamily',family)
 if tid in labels:t['displayName'],t['gameplayFamily'],t['playerHint']=labels[tid]
# New bird lower-mass direction uses exactly the same observations; no invented measurement.
for t in d['traits']:
 if t['id']=='smallest_adult_mass':t['displayName']='Lightest adult';t['playerHint']='Typical adult weight, with lighter animals ranking first.'
 if t['id']=='smallest_adult_mass':
  for v in list(d['values']):
   if v['traitId']=='adult_body_mass':
    x=dict(v,traitId=t['id']);d['values']=[r for r in d['values'] if (r['animalId'],r['traitId'])!=(x['animalId'],x['traitId'])]+[x]
base=next(t for t in d['traits'] if t['id']=='bird_mass');light=dict(base,id='lightest_bird',displayName='Lightest adult',direction='lower_wins',playerHint='Average adult weight, with lighter animals ranking first.')
d['traits']=[t for t in d['traits'] if t['id']!='lightest_bird']+[light]
d['values']=[v for v in d['values'] if v['traitId']!='lightest_bird']+[dict(v,traitId='lightest_bird') for v in d['values'] if v['traitId']=='bird_mass']
(OUT/'pilot.json').write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
(OUT/'interesting-trait-observations.json').write_text(json.dumps(list({(r['animalId'],r['traitId']):r for r in selected}.values()),indent=2,ensure_ascii=False)+'\n')
print('Added coverage:',len(selected),'observations;',len(d['animals']),'animals;',len(d['traits']),'traits')
print('New trait coverage:',{t['id']:sum(v['traitId']==t['id'] for v in d['values']) for t in [flight,span,sleep,home,dive]})
