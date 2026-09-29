#!/usr/bin/env python3
"""Generate diverse numerical candidates. Daily approval is a separate reviewed manifest."""
import collections,hashlib,itertools,json,random
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/animalstats'
DATA=json.loads((OUT/'pilot.json').read_text());ANIMALS={a['id']:a for a in DATA['animals']};TRAITS={t['id']:t for t in DATA['traits']}
VALUES={(v['animalId'],v['traitId']):v for v in DATA['values'] if v['confidence']=='approved' and v['observationType']!='imputed'}
ACTIVE=sorted(p['animalId'] for p in DATA['photos'] if p['approved'] and ANIMALS[p['animalId']]['active'])
MAMMALS={'carnivore','bear','large-mammal','primate','marsupial','rodent','marine-mammal'}
REPTILES={'crocodilian','snake','lizard','reptile','turtle'};AMPHIBIANS={'frog','salamander'};FISH={'shark','ray','fish'}
SIMILAR=[
 {'female_maturity','male_maturity','amphibian_min_maturity','earliest_female_maturity','raw_female_maturity','raw_early_female_maturity'},
 {'litters_per_year','interbirth_interval','clutches_per_year','amphibian_max_events','raw_clutch_frequency','raw_litter_frequency'},
 {'bird_wing_length','bird_secondary_length','bird_kipps_distance','bird_hand_wing_index'},
 {'adult_body_mass','bird_mass','amphibian_max_mass','smallest_adult_mass','raw_adult_mass'},
 {'litter_size','clutch_size','egg_clutch_size','amphibian_max_clutch','shark_litter_size','raw_clutch_size','raw_litter_size','fewest_shark_pups'},
 {'maximum_documented_lifespan','wild_recorded_lifespan','shortest_wild_lifespan'},
 {'gestation','shortest_gestation','raw_gestation','raw_short_gestation'},
 {'weaning_age','earliest_weaning','raw_weaning_age'},
 {'birth_weight','lightest_newborn','hatching_mass','raw_hatching_mass','raw_birth_mass'},
 {'weaning_mass','raw_weaning_mass'}, {'incubation','raw_incubation'},
 {'raw_egg_mass','raw_egg_length','raw_egg_width'},
]
MODES={'easy':(4,4),'normal':(6,4),'expert':(8,6)}
def kind(ids):
 groups={ANIMALS[i]['taxonomicGroup'] for i in ids}
 if len(groups)==1:return 'themed'
 if any(groups<=family for family in [REPTILES,AMPHIBIANS,FISH,{'carnivore','bear'},{'large-mammal','rodent'}]):return 'clustered'
 return 'cross-animal'
def title(ids):
 groups={ANIMALS[i]['taxonomicGroup'] for i in ids}
 names={'bear':'Bears of the world','bird':'Feathers and flight','shark':'Sharks below the surface','frog':'Frogs and toads','turtle':'Turtles and tortoises','snake':'Snakes','salamander':'Salamanders and newts','primate':'Our primate cousins','crocodilian':'Crocodiles and their cousins'}
 if len(groups)==1:return names.get(next(iter(groups)),next(iter(groups)).replace('-',' ').title())
 if groups<=REPTILES:return 'Scales, shells and cold blood'
 if groups<=AMPHIBIANS:return 'At the water’s edge'
 if groups<=FISH:return 'Life beneath the waves'
 if groups<=MAMMALS:return 'Fur, paws and unexpected company'
 return 'An unlikely gathering'
def valid_traits(ids,rejected):
 valid=[]
 for tid,t in TRAITS.items():
  rows=[VALUES.get((i,tid)) for i in ids]
  if any(v is None for v in rows):continue
  if t['eligibilityGroups'] and any(ANIMALS[i]['taxonomicGroup'] not in t['eligibilityGroups'] for i in ids):continue
  ranked=sorted(zip(ids,rows),key=lambda x:x[1]['valueNumeric'],reverse=t['direction']=='higher_wins')
  if any(max(a[1]['valueNumeric'],b[1]['valueNumeric'])/min(a[1]['valueNumeric'],b[1]['valueNumeric'])<1.05-1e-12 for a,b in zip(ranked,ranked[1:])):
   rejected['tie or gap under 5%']+=1;continue
  if any(a[1].get('valueMin',a[1]['valueNumeric'])<=b[1].get('valueMax',b[1]['valueNumeric']) and b[1].get('valueMin',b[1]['valueNumeric'])<=a[1].get('valueMax',a[1]['valueNumeric']) for a,b in zip(ranked,ranked[1:])):
   rejected['overlapping supplied bounds']+=1;continue
  valid.append((tid,ranked[0][0]))
 return valid
pools={group:[i for i in ACTIVE if ANIMALS[i]['taxonomicGroup']==group] for group in sorted({a['taxonomicGroup'] for a in ANIMALS.values()})}
pools.update(mammals=[i for i in ACTIVE if ANIMALS[i]['taxonomicGroup'] in MAMMALS],reptiles=[i for i in ACTIVE if ANIMALS[i]['taxonomicGroup'] in REPTILES],amphibians=[i for i in ACTIVE if ANIMALS[i]['taxonomicGroup'] in AMPHIBIANS],fishmix=[i for i in ACTIVE if ANIMALS[i]['taxonomicGroup'] in FISH],predators=[i for i in ACTIVE if ANIMALS[i]['taxonomicGroup'] in {'carnivore','bear'}],egg_layers=[i for i in ACTIVE if ANIMALS[i]['taxonomicGroup'] in {'bird','turtle','frog','salamander','lizard'}],all=ACTIVE)
def generate(mode):
 n,k=MODES[mode];rng=random.Random('animalstats-expanded-v2:'+mode);valid_pools={name:pool for name,pool in pools.items() if len(pool)>=n}
 candidates=[];seen=set();diagnostics=collections.Counter();pool_counts=collections.Counter();type_counts=collections.Counter()
 # Search each taxonomic pool independently, so plentiful bird traits cannot crowd out new groups.
 for name,pool in valid_pools.items():
  limit=220000 if mode=='expert' and name in ['mammals','predators','bear'] else 40000 if mode=='expert' else 20000
  for attempt in range(limit):
   if pool_counts[name]>=3:break
   ids=rng.sample(pool,n);valid=valid_traits(ids,diagnostics)
   if len(valid)<k or len({winner for _,winner in valid})<k:continue
   rng.shuffle(valid)
   for combo in itertools.combinations(valid,k):
    tids=[x[0] for x in combo]
    if len({x[1] for x in combo})!=k or any(len(set(tids)&c)>1 for c in SIMILAR):continue
    signature=(tuple(sorted(ids)),tuple(sorted(tids)))
    if signature in seen:continue
    seen.add(signature);board_type=kind(ids)
    fingerprint=f'{mode}|{board_type}|'+','.join(ids)+'|'+','.join(tids)
    board=dict(id=hashlib.sha256(fingerprint.encode()).hexdigest()[:16],mode=mode,boardType=board_type,title=title(ids),animalIds=ids,traitIds=tids)
    candidates.append(board);pool_counts[name]+=1;type_counts[board_type]+=1;break
 print(mode,len(candidates),dict(type_counts),dict(pool_counts),flush=True)
 return candidates,dict(diagnostics)
def main():
 boards=[];diagnostics={}
 for mode in MODES:
  candidates,rejections=generate(mode);boards.extend(candidates);diagnostics[mode]=rejections
 (OUT/'candidates.json').write_text(json.dumps(dict(boards=boards,rejectionReasons=diagnostics),indent=2,ensure_ascii=False)+'\n')
 if any(not any(b['mode']==mode for b in boards) for mode in MODES):raise SystemExit('A mode has no numerical candidates')
if __name__=='__main__':main()
