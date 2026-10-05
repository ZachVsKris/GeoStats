import math
#!/usr/bin/env python3
"""Curate paired metrics and generate intuitive-majority, distinct-winner boards."""
import functools,zipfile,io,csv,statistics,collections,copy,hashlib,itertools,json,random,re,concurrent.futures,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/animalstats'
d=json.loads((OUT/'pilot.json').read_text())
# Directly weighed brain records only: reject volume conversions and unspecified methods.
brain_basis='Median of published directly weighed brain-mass cohorts in AnimalTraits v1.0.7. Cohort sex and life stage vary or are unreported; full reported cohort range checked. Not intelligence or a universal adult species mean.'
if 'animaltraits-2022' not in {x['id'] for x in d['sources']}:
 d['sources'].append(dict(id='animaltraits-2022',name='AnimalTraits directly weighed brain cohorts',sourceClass='curated-trait-database',url='https://doi.org/10.1038/s41597-022-01364-9',versionYear='Zenodo v1.0.7 (2022)',retrievedAt='2026-09-30',license='CC BY 4.0'))
d['traits']=[t for t in d['traits'] if t['id']!='weighed_brain_mass']+[dict(id='weighed_brain_mass',displayName='Largest measured brain',unit='g',definition=brain_basis,measurementBasis=brain_basis,canonicalSourceId='animaltraits-2022',eligibilityGroups=[],direction='higher_wins',separationMethod='positive_ratio_5_percent',gameplayFamily='brain',playerHint='Published brain weights. Brain size does not measure intelligence.')]
if (OUT/'source/animaltraits-v1.0.7-observations.csv').exists():
 by=collections.defaultdict(list);animals={a['scientificName'].lower():a for a in d['animals']}
 for r in csv.DictReader((OUT/'source/animaltraits-v1.0.7-observations.csv').open()):
  if r['species'].lower() in animals and r['brain size - method']=='brain weighed' and r['original brain size - units'] in {'g','kg'}:
   n=float(r['original brain size'])*(1000 if r['original brain size - units']=='kg' else 1)
   if n>0:by[animals[r['species'].lower()]['id']].append((r,n))
 d['values']=[v for v in d['values'] if v['traitId']!='weighed_brain_mass']
 for aid,rows in by.items():
  nums=[n for r,n in rows];v=dict(animalId=aid,traitId='weighed_brain_mass',valueNumeric=statistics.median(nums),unit='g',sex='reported cohorts',lifeStage='source stages not standardized',measurementBasis=brain_basis,sourceId='animaltraits-2022',observationType='compiled',confidence='approved',uncertaintyStatus='reported' if min(nums)!=max(nums) else 'not-reported',uncertaintyKind='source-range' if min(nums)!=max(nums) else 'not-reported',notes='Directly weighed records only; no brain-volume conversion. Cohorts: '+'; '.join(f"{r['fullReference']} / sex {r['sex'] or 'unreported'}, N={r['sampleSizeValue'] or 'unreported'}, brain={n} g" for r,n in rows))
  if min(nums)!=max(nums):v.update(valueMin=min(nums),valueMax=max(nums))
  d['values'].append(v)
# Range is measured from published maps, not a model-adjusted mammal trait.
range_basis='Area of published 2003 species range maps in equal-area Mollweide projection, from PanTHERIA WR05 August 2008. Historical mapped extent, not current occupied habitat or an individual home range.'
if 'pantheria-range-maps' not in {x['id'] for x in d['sources']}:
 d['sources'].append(dict(id='pantheria-range-maps',name='PanTHERIA published mammal range maps',sourceClass='curated-trait-database',url='https://esapubs.org/archive/ecol/E090/184/metadata.htm',versionYear='WR05 August 2008; maps 2003',retrievedAt='2026-09-30',license='Archive metadata: no copyright restrictions'))
d['traits']=[t for t in d['traits'] if t['id']!='mammal_range_area']+[dict(id='mammal_range_area',displayName='Largest mapped range',unit='km²',definition=range_basis,measurementBasis=range_basis,canonicalSourceId='pantheria-range-maps',eligibilityGroups=[],direction='higher_wins',separationMethod='positive_ratio_5_percent',gameplayFamily='range',playerHint='Historical species range maps—not an individual territory or a current population count.')]
if (OUT/'source/pantheria-2009.zip').exists():
 archive=zipfile.ZipFile(OUT/'source/pantheria-2009.zip'); rows=csv.DictReader(io.StringIO(archive.read('PanTHERIA_1-0_WR05_Aug2008.txt').decode()),delimiter='\t'); animals={a['scientificName'].lower():a for a in d['animals']}
 d['values']=[v for v in d['values'] if v['traitId']!='mammal_range_area']
 for row in rows:
  animal=animals.get(row['MSW05_Binomial'].lower()); number=float(row['26-1_GR_Area_km2'])
  if animal and number>0:
   d['values'].append(dict(animalId=animal['id'],traitId='mammal_range_area',valueNumeric=number,unit='km²',sex='species-level',lifeStage='species-level',measurementBasis=range_basis,sourceId='pantheria-range-maps',observationType='compiled',confidence='approved',uncertaintyStatus='not-reported',notes='Exact species match; published GIS map area. No modeled body-length, mass, or home-range values imported.'))
# Every admitted category gets its reverse from identical records, never from a second source.
METRICS={
'maximum_hibernation_bout':('Longest hibernation stretch','Shortest hibernation stretch','intuitive','hibernation-bout'),
'scientific_description_age':('Oldest scientific description','Newest scientific description','specialist','scientific-history'),
'iucn_extinction_risk':('Most threatened','Least threatened','intuitive','conservation'),
'measured_eye_length':('Largest eyes','Smallest eyes','intuitive','eyes'),
'behavioral_visual_acuity':('Sharpest measured vision','Least sharp measured vision','intuitive','vision'),
'recorded_chewing_rate':('Fastest recorded chewing','Slowest recorded chewing','intuitive','chewing'),
'diet_prey_mass_span':('Widest prey-size range','Narrowest prey-size range','intuitive','prey-size-span'),
'hatching_mass':('Heaviest hatchling','Lightest hatchling','intuitive','hatchling-mass'),
'raw_hatching_mass':('Heaviest hatchling','Lightest hatchling','intuitive','hatchling-mass'),
'adult_intestine_length':('Longest intestine','Shortest intestine','specialist','intestine'),
'male_maturity':('Latest male maturity','Earliest male maturity','specialist','maturity'),
'weaning_mass':('Heaviest at weaning','Lightest at weaning','intuitive','weaning'),
'mapped_north_pole_distance':('Farthest from North Pole','Closest to North Pole','intuitive','north-pole'),
'mapped_south_pole_distance':('Farthest from South Pole','Closest to South Pole','intuitive','south-pole'),
'mapped_latitude_span':('Widest north–south range','Narrowest north–south range','intuitive','latitude-span'),
'diet_food_group_count':('Most food groups','Fewest food groups','intuitive','diet-breadth'),
'resting_breathing_frequency':('Fastest breathing at rest','Slowest breathing at rest','intuitive','breathing'),
'milk_fat_concentration':('Fattiest milk','Least fat in milk','intuitive','milk-fat'),
'milk_sugar_concentration':('Most sugar in milk','Least sugar in milk','intuitive','milk-sugar'),
'milk_protein_concentration':('Most protein in milk','Least protein in milk','specialist','milk-protein'),
'habitat_elevation_ceiling':('Highest mountain habitat','Lowest mountain ceiling','specialist','elevation'),
'habitat_depth_ceiling':('Deepest water habitat','Shallowest water limit','specialist','depth'),
'mammal_tail_length_upper':('Longest mammal tail','Shortest mammal tail','intuitive','tail'),
'aquatic_length_upper':('Longest aquatic body','Shortest aquatic body','intuitive','length'),
'raw_egg_length':('Longest egg','Shortest egg','specialist','egg-size'),
'raw_egg_width':('Widest egg','Narrowest egg','specialist','egg-size'),
'raw_clutch_frequency':('Most egg clutches per year','Fewest egg clutches per year','intuitive','breeding'),
'litters_per_year':('Most litters per year','Fewest litters per year','intuitive','breeding'),
'interbirth_interval':('Longest gap between births','Shortest gap between births','specialist','breeding'),

'adult_tooth_count':('Most adult teeth','Fewest adult teeth','intuitive','teeth'),
'field_travel_speed':('Fastest measured land travel','Slowest measured land travel','intuitive','movement'),
'field_swim_speed':('Fastest measured swimming','Slowest measured swimming','intuitive','movement'),
'basal_energy':('Most resting energy use','Least resting energy use','specialist','metabolism'),
'mass_specific_basal_energy':('Most resting energy per gram','Least resting energy per gram','specialist','metabolism'),
'daily_rem_sleep':('Most REM sleep','Least REM sleep','specialist','sleep'),
'weighed_brain_mass':('Largest measured brain','Smallest measured brain','specialist','brain'),
'adult_body_mass':('Heaviest adult','Lightest adult','intuitive','mass'),
'bird_mass':('Heaviest adult','Lightest adult','intuitive','mass'),
'amphibian_max_mass':('Heaviest recorded adult','Lightest recorded adult','intuitive','mass'),
'frog_max_svl':('Longest frog body','Shortest frog body','intuitive','length'),
'maximum_documented_lifespan':('Longest documented lifespan','Shortest documented lifespan','intuitive','lifespan'),
'wild_recorded_lifespan':('Longest recorded wild life','Shortest recorded wild life','intuitive','lifespan'),
'ringing_longevity':('Longest recorded wild life','Shortest recorded wild life','intuitive','lifespan'),
'cruising_flight_speed':('Fastest cruising flight','Slowest cruising flight','intuitive','flight'),
'measured_wingspan':('Largest wingspan','Smallest wingspan','intuitive','wingspan'),
'bird_range_area':('Largest breeding range','Smallest breeding range','intuitive','range'),
'mammal_range_area':('Largest mapped range','Smallest mapped range','intuitive','range'),
'daily_sleep':('Most time asleep','Least time asleep','intuitive','sleep'),
'annual_home_range':('Largest home range','Smallest home range','intuitive','home-range'),
'field_max_dive':('Longest recorded dive','Shortest recorded dive','intuitive','dive-duration'),
'bird_beak_length':('Longest beak','Shortest beak','specialist','beak-length'),
'bird_tail_length':('Longest tail feathers','Shortest tail feathers','specialist','tail'),
'raw_egg_mass':('Heaviest egg','Lightest egg','specialist','reproduction'),
'birth_weight':('Heaviest newborn','Lightest newborn','intuitive','newborn-mass'),
'gestation':('Longest pregnancy','Shortest pregnancy','intuitive','pregnancy'),
'raw_gestation':('Longest pregnancy','Shortest pregnancy','intuitive','pregnancy'),
'clutch_size':('Most eggs per clutch','Fewest eggs per clutch','intuitive','offspring'),
'raw_clutch_size':('Most eggs per clutch','Fewest eggs per clutch','intuitive','offspring'),
'incubation':('Longest wait to hatch','Shortest wait to hatch','intuitive','incubation'),
'raw_incubation':('Longest wait to hatch','Shortest wait to hatch','intuitive','incubation'),
'weaning_age':('Longest time on milk','Shortest time on milk','specialist','weaning'),
'raw_weaning_age':('Longest time on milk','Shortest time on milk','specialist','weaning'),
'female_maturity':('Latest female maturity','Earliest female maturity','specialist','maturity'),
'raw_birth_mass':('Heaviest newborn','Lightest newborn','intuitive','newborn-mass'),
'litter_size':('Most young per birth','Fewest young per birth','intuitive','offspring'),
}
# Preserve the research archive in pilot.json; only curated pairs enter this prototype.
for t in d['traits']:t['prototypeCategory']=False
originals={t['id']:t for t in d['traits']};original_values=copy.deepcopy(d['values'])
for tid,(hi,lo,kind,key) in METRICS.items():
 if tid not in originals:continue
 t=originals[tid];t.update(displayName=hi,direction='higher_wins',prototypeCategory=True,categoryKind=kind,metricKey=key,counterTraitId=tid+'__low')
 rev=copy.deepcopy(t);rev.update(id=tid+'__low',displayName=lo,direction='lower_wins',counterTraitId=tid)
 d['traits']=[x for x in d['traits'] if x['id']!=rev['id']]+[rev]
 d['values']=[x for x in d['values'] if x['traitId']!=rev['id']]+[{**v,'traitId':rev['id']} for v in original_values if v['traitId']==tid]
# Natural one-sided diet endpoints use distinct measurements, not artificial opposites.
for tid,label,direction,key in [('diet_largest_prey','Largest prey in published diet','higher_wins','prey-size-maximum'),('diet_smallest_prey','Smallest prey in published diet','lower_wins','prey-size-minimum')]:
 if tid not in originals:continue
 t=originals[tid];t.pop('counterTraitId',None);t.update(displayName=label,direction=direction,prototypeCategory=True,categoryKind='intuitive',metricKey=key,oneSided=True)
# ADW realm labels are source labels, not invented continent assignments or numerical ranges.
cache=OUT/'research/regions.json'
regions=json.loads(cache.read_text()) if cache.exists() else {}
def fetch(a):
 url='https://animaldiversity.org/accounts/'+a['scientificName'].replace(' ','_')+'/'
 try:
  html=urllib.request.urlopen(url,timeout=15).read().decode();section=html.split('id="geographic_range"',1)[1].split('</section>',1)[0]
  block=section.split('Biogeographic Regions',1)[1]
  labels=list(dict.fromkeys(re.findall(r'<button[^>]*>\s*(nearctic|palearctic|oriental|ethiopian|neotropical|australian|antarctica|oceanic islands|atlantic ocean|pacific ocean|indian ocean|arctic ocean)\s*</button>',block,re.I)))
  return a['id'],dict(labels=labels,sourceUrl=url,retrievedAt='2026-10-04')
 except Exception:return a['id'],dict(labels=[],sourceUrl=url,retrievedAt='2026-10-04')
missing=[a for a in d['animals'] if a['id'] not in regions]
if missing:
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:regions.update(dict(ex.map(fetch,missing)))
 cache.write_text(json.dumps(regions,indent=2)+'\n')
for a in d['animals']:
 r=regions.get(a['id'],{});a['biogeographicRegions']=r.get('labels',[]);a['regionSourceUrl']=r.get('sourceUrl')
(OUT/'pilot.json').write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
print('Paired metrics:',len(METRICS),'region accounts:',sum(bool(r['labels']) for r in regions.values()),flush=True)
A={a['id']:a for a in d['animals']};T={t['id']:t for t in d['traits'] if t.get('prototypeCategory')};V={(v['animalId'],v['traitId']):v for v in d['values'] if v['confidence']=='approved' and v['observationType']!='imputed'}
illustrated=set(re.findall(r'^\s{2}([a-z]+_[a-z]+):', (ROOT/'lib/animalstatsCartoons.ts').read_text(),re.M))
# Shared compact bird profiles are assigned in the table below the main object.
illustrated.update(re.findall(r'\b([a-z]+_[a-z]+)\s*:', (ROOT/'lib/animalstatsCartoons.ts').read_text()))
active=sorted(p['animalId'] for p in d['photos'] if p['approved'] and A[p['animalId']]['active'] and p['animalId'] in illustrated)
pools={'birds':[i for i in active if A[i]['taxonomicGroup']=='bird'],'mammals':[i for i in active if A[i]['taxonomicGroup'] in {'carnivore','bear','large-mammal','primate','marsupial','rodent','marine-mammal','monotreme','insectivore','treeshrew','lagomorph','bat'}],'world':active}
pools['flight']=[i for i in active if (i,'cruising_flight_speed') in V]
pools['brains']=[i for i in active if (i,'weighed_brain_mass') in V]
pools['reptile-brains']=[i for i in pools['brains'] if A[i]['taxonomicGroup'] in {'crocodilian','turtle','snake'}]
for metric in ['scientific_description_age','iucn_extinction_risk','measured_eye_length','behavioral_visual_acuity','recorded_chewing_rate','diet_largest_prey','diet_smallest_prey','diet_prey_mass_span','hatching_mass','raw_hatching_mass']:
 pools[metric]=[i for i in active if (i,metric) in V]
pools['sleep']=[i for i in active if (i,'daily_sleep') in V]
pools['intestines']=[i for i in active if (i,'adult_intestine_length') in V]
pools['weaning-size']=[i for i in active if (i,'weaning_mass') in V]
pools['male-maturity']=[i for i in active if (i,'male_maturity') in V]
pools['breathing']=[i for i in active if (i,'resting_breathing_frequency') in V]
pools['milk']=[i for i in active if any((i,t) in V for t in ['milk_fat_concentration','milk_sugar_concentration','milk_protein_concentration'])]
pools['diet']=[i for i in active if (i,'diet_food_group_count') in V]
pools['range-geography']=[i for i in active if (i,'mapped_latitude_span') in V]
pools['broad-mammals']=[i for i in pools['mammals'] if (i,'mammal_range_area') in V and (i,'female_maturity') in V and (i,'maximum_documented_lifespan') in V]
for metric in ['annual_home_range','adult_tooth_count','field_travel_speed','field_swim_speed','daily_rem_sleep','basal_energy','mass_specific_basal_energy','field_max_dive','habitat_elevation_ceiling','habitat_depth_ceiling','adult_shoulder_height','mammal_tail_length_upper','aquatic_length_upper','raw_clutch_frequency','litters_per_year','raw_egg_length','raw_egg_width']:
 pools[metric]=[i for i in active if (i,metric) in V]
@functools.lru_cache(maxsize=20000)
def valid_cached(ids):
 out=[]
 for tid,t in T.items():
  rows=[V.get((i,tid)) for i in ids]
  if any(x is None for x in rows):continue
  if any(v.get("confidence") != "approved" or v.get("observationType") not in {"observed", "compiled"} or not math.isfinite(v["valueNumeric"]) or v["valueNumeric"] <= 0 or v.get("unit") != t["unit"] or v.get("measurementBasis") != t["measurementBasis"] or v.get("sourceId") != t["canonicalSourceId"] for v in rows):continue
  if len({v['sex'] for v in rows})!=1 or len({v['lifeStage'] for v in rows})!=1:continue
  if t['eligibilityGroups'] and any(A[i]['taxonomicGroup'] not in t['eligibilityGroups'] for i in ids):continue
  ranked=sorted(zip(ids,rows),key=lambda x:x[1]['valueNumeric'],reverse=t['direction']=='higher_wins')
  if t['separationMethod']=='distinct_ordinal':
   if any(a[1]['valueNumeric']==b[1]['valueNumeric'] for a,b in zip(ranked,ranked[1:])):continue
  elif any(max(a[1]['valueNumeric'],b[1]['valueNumeric'])/min(a[1]['valueNumeric'],b[1]['valueNumeric'])<1.05-1e-12 for a,b in zip(ranked,ranked[1:])):continue
  if any(a[1].get('valueMin',a[1]['valueNumeric'])<=b[1].get('valueMax',b[1]['valueNumeric']) and b[1].get('valueMin',b[1]['valueNumeric'])<=a[1].get('valueMax',a[1]['valueNumeric']) for a,b in zip(ranked,ranked[1:])):continue
  out.append((tid,ranked[0][0],[next(j+1 for j,(aid,_) in enumerate(ranked) if aid==i) for i in ids]))
 return out
def valid(ids):return valid_cached(tuple(sorted(ids)))
LIFECYCLE={'pregnancy','offspring','incubation','weaning','maturity','reproduction','breeding','egg-size'}
boards=[];seen=set();rng=random.Random('balanced-world-prototype-v1')
for mode,n,k in [('easy',4,4),('normal',6,4),('expert',8,6)]:
 for name,pool in pools.items():
  if len(pool)<n:continue
  count=0
  for attempt in range(150000 if mode=='expert' and name=='broad-mammals' else 20000 if name in {'brains','reptile-brains'} else 6000):
   if count>=14:break
   ids=rng.sample(pool,n);
   if name=="world" and len({A[i]["taxonomicGroup"] for i in ids})<2:continue
   options=valid(ids);basic=[x for x in options if T[x[0]]['categoryKind']=='intuitive'];niche=[x for x in options if T[x[0]]['categoryKind']=='specialist']
   minimum_basic=4 if k==6 else 3
   if len(basic)<minimum_basic:continue
   found=False
   combinations=[]
   for basic_count in range(k,minimum_basic-1,-1):
    choices=list(itertools.combinations(basic,basic_count));rng.shuffle(choices)
    details=list(itertools.combinations(niche,k-basic_count));rng.shuffle(details)
    combinations.extend((b,s) for b in choices for s in details)
   for b,s in combinations:
    combo=b+s;tids=[x[0] for x in combo]
    focus={'intestines':'intestine','weaning-size':'weaning','male-maturity':'maturity'}.get(name)
    if name in {'scientific_description_age','iucn_extinction_risk','measured_eye_length','behavioral_visual_acuity','recorded_chewing_rate','diet_largest_prey','diet_smallest_prey','diet_prey_mass_span','hatching_mass','raw_hatching_mass','annual_home_range','field_max_dive','field_travel_speed','raw_clutch_frequency','raw_egg_width'} and not any(t.removesuffix('__low')==name for t in tids):continue
    if focus and not any(T[t]['metricKey']==focus and (name!='male-maturity' or t.startswith('male_maturity')) for t in tids):continue
    if sum(T[t].get('gameplayFamily')=='prey-size' for t in tids)>1:continue
    if sum(T[t].get('gameplayFamily')=='milk-composition' for t in tids)>1:continue
    if sum(T[t].get('gameplayFamily') in {'range-geography','range'} for t in tids)>1:continue
    if sum(T[t]['metricKey'] in LIFECYCLE for t in tids)>(3 if k==6 else 1):continue
    if len({x[1] for x in combo})!=k or len({T[t]['metricKey'] for t in tids})!=k:continue
    if any(abs(1-6*sum((x-y)**2 for x,y in zip(a[2],b[2]))/(n*(n*n-1)))>=1 for a,b in itertools.combinations(combo,2)):continue
    if sum(sum(x[2][j]<=2 for x in combo)>=2 for j in range(n))<2:continue
    signature=(tuple(sorted(ids)),tuple(sorted(tids)))
    if signature in seen:continue
    seen.add(signature);rng.shuffle(tids);regions=sorted({r for i in ids for r in A[i].get('biogeographicRegions',[])})
    bid=hashlib.sha256((mode+'|'+','.join(ids)+'|'+','.join(tids)).encode()).hexdigest()[:16]
    families=[T[t].get('gameplayFamily','anatomy') for t in tids]
    boards.append(dict(id=bid,mode=mode,boardType='themed' if name in {'birds','flight'} else 'cross-animal',title='Wings of the world' if name in {'birds','flight'} else 'The water sports fair' if name in {'field_swim_speed','field_max_dive'} else 'The sleepyhead showdown' if name in {'sleep','daily_rem_sleep'} else 'The tooth fairy trials' if name=='adult_tooth_count' else 'The worldwide menagerie',animalIds=ids,traitIds=tids,editorial=dict(families=families,multiTraitContenders=sum(sum(x[2][j]<=2 for x in combo)>=2 for j in range(n)),policy='intuitive-majority-distinct-winners-v5',intuitiveMinimum=minimum_basic),biogeographicRegions=regions));count+=1;found=True;break
  print(mode,name,count,flush=True)
# Include every feasible opposite direction. Solve orientations jointly so winners stay distinct.
for original in list(boards):
 for bits in itertools.product([False,True],repeat=len(original['traitIds'])):
  tids=[T[t].get('counterTraitId',t) if bit else t for t,bit in zip(original['traitIds'],bits)]
  available={t:w for t,w,r in valid(original['animalIds'])}
  if any(t not in available for t in tids) or len({available[t] for t in tids})!=len(tids):continue
  ranks=[r for t,w,r in valid(original['animalIds']) if t in tids]
  if sum(sum(r[j]<=2 for r in ranks)>=2 for j in range(len(original['animalIds'])))<2:continue
  signature=(tuple(sorted(original['animalIds'])),tuple(sorted(tids)))
  if signature in seen:continue
  seen.add(signature);board=copy.deepcopy(original);board['traitIds']=tids
  board['id']=hashlib.sha256((board['mode']+'|'+','.join(board['animalIds'])+'|'+','.join(tids)).encode()).hexdigest()[:16]
  board['editorial']['families']=[T[t].get('gameplayFamily','anatomy') for t in tids]
  board['editorial']['multiTraitContenders']=sum(sum(r[j]<=2 for r in ranks)>=2 for j in range(len(original['animalIds'])))
  boards.append(board)
# Keep plentiful bird anatomy records from dominating the catalog.
nonbirds=[b for b in boards if not all(A[i]['taxonomicGroup']=='bird' for i in b['animalIds'])]
selected=list(nonbirds);covered={t for b in selected for t in b['traitIds']};lineups={tuple(sorted(b['animalIds'])) for b in selected}
for mode,limit in [('easy',16),('normal',16),('expert',12)]:
 remaining=[b for b in boards if b['mode']==mode and all(A[i]['taxonomicGroup']=='bird' for i in b['animalIds'])]
 for _ in range(min(limit,len(remaining))):
  chosen=max(remaining,key=lambda b:sum(T[t].get('counterTraitId') in covered and t not in covered for t in b['traitIds'])*100+sum(t not in covered for t in b['traitIds'])*10+sum(T[t]['metricKey'] in {'flight','wingspan','movement'} for t in b['traitIds'])*30+(tuple(sorted(b['animalIds'])) not in lineups)*4+sum(A[i]['familiarityTier']=='core' for i in b['animalIds']))
  selected.append(chosen);remaining.remove(chosen);covered.update(chosen['traitIds']);lineups.add(tuple(sorted(chosen['animalIds'])))
boards=selected
# Keep previously shared challenges when their exact measurements still pass.
retained_files=[OUT/'retained-boards.json',OUT/'retained-live-boards.json']
if any(p.exists() for p in retained_files):
 signatures={(b['mode'],tuple(sorted(b['animalIds'])),tuple(sorted(b['traitIds']))) for b in boards}
 positions={(b['mode'],tuple(sorted(b['animalIds'])),tuple(sorted(b['traitIds']))):i for i,b in enumerate(boards)}
 for b in [b for p in retained_files if p.exists() for b in json.loads(p.read_text())['boards']]:
  signature=(b['mode'],tuple(sorted(b['animalIds'])),tuple(sorted(b['traitIds'])))
  available={t:w for t,w,r in valid(b['animalIds'])}
  if any(t not in available for t in b['traitIds']):continue
  if len({T[t]['metricKey'] for t in b['traitIds']})!=len(b['traitIds']):continue
  if sum(T[t].get('gameplayFamily') in {'range-geography','range'} for t in b['traitIds'])>1:continue
  if sum(T[t]['metricKey'] in LIFECYCLE for t in b['traitIds'])>(3 if b['mode']=='expert' else 1):continue
  if len({available[t] for t in b['traitIds']})!=len(b['traitIds']):continue
  if signature in signatures:
   boards[positions[signature]]=b
   continue
  positions[signature]=len(boards)
  boards.append(b);signatures.add(signature)
# Opposites stay adjacent in the review catalog; each playable direction qualifies independently.
(OUT/'candidates.json').write_text(json.dumps(dict(boards=boards,rejectionReasons={'policy':'At least half intuitive, prefer more; unique metric and winner; no imputed values; 5% separation and supplied bounds.'}),indent=2)+'\n')
print('Total boards',len(boards))
