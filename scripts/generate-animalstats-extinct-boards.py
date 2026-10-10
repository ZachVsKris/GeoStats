#!/usr/bin/env python3
import json,itertools,random,pathlib,hashlib
R=pathlib.Path(__file__).resolve().parents[1];d=json.loads((R/'data/animalstats/extinct.json').read_text());animals=[a for a in d['animals'] if a.get('extinctionStatus')=='extinct'];traits={t['id']:t for t in d['traits']};vals={(v['animalId'],v['traitId']):v for v in d['values']};metric=['fossil_age','description','occurrences','femur'];rng=random.Random(101026)
def separated(ids,trait):
 vs=sorted([vals[(a,trait)] for a in ids],key=lambda v:v['valueNumeric'])
 for a,b in zip(vs,vs[1:]):
  if traits[trait]['separationMethod']=='distinct_ordinal':
   if a['valueNumeric']==b['valueNumeric']:return False
  elif b['valueNumeric']/a['valueNumeric']<1.05-1e-12:return False
  if a.get('valueMax',a['valueNumeric'])>=b.get('valueMin',b['valueNumeric']):return False
 return True
out=[]
for mode,n in [('easy',4),('normal',6)]:
 mode_start=len(out)
 choices=list(itertools.combinations(animals,n)) if n==4 else (rng.sample(animals,n) for _ in range(500000))
 if n==4:rng.shuffle(choices)
 for aa in choices:
  if sum(a['familiarityTier']=='core' for a in aa)<(1 if n==4 else 2):continue
  ids=[a['id'] for a in aa]
  if not all(separated(ids,'extinct_'+m) for m in metric):continue
  for directions in itertools.product(['','__low'],repeat=4):
   tt=['extinct_'+m+di for m,di in zip(metric,directions)];w=[sorted(ids,key=lambda a:vals[(a,t)]['valueNumeric'],reverse=traits[t]['direction']=='higher_wins')[0] for t in tt]
   if len(set(w))!=4:continue
   key=','.join(sorted(ids))+'|'+','.join(tt);id='extinct-dinosaur-'+mode+'-'+hashlib.sha256(key.encode()).hexdigest()[:12]
   out.append(dict(id=id,title='Extinct Special · Dinosaurs',mode=mode,collection='extinct-special',boardType='themed',animalIds=ids,traitIds=tt,editorial=dict(policy='intuitive-majority-distinct-winners-v5',families=[traits[t]['gameplayFamily'] for t in tt],multiTraitContenders=2,intuitiveMinimum=3)))
  if len(out)-mode_start>=1200:break
(R/'data/animalstats/research/extinct-board-candidates.json').write_text(json.dumps(out,indent=2)+'\n');print('Candidate boards',len(out),{m:sum(b['mode']==m for b in out) for m in ['easy','normal']})
