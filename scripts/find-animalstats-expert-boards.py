"""Search complete trait intersections with a compatibility graph, not blind random draws."""
import runpy,itertools,collections,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
s=runpy.run_path(str(ROOT/'scripts/generate-animalstats-boards.py'));T=s['TRAITS'];V=s['VALUES'];A=s['ACTIVE'];PLAY=s['PLAYABLE'];found=[];seen=set()
for ts in itertools.combinations(sorted(PLAY),6):
 fam=[T[t]['gameplayFamily'] for t in ts]
 if len(set(fam))<5 or any(fam.count(f)>1 and f!='anatomy' for f in fam):continue
 ids=[i for i in A if s['ANIMALS'][i]['taxonomicGroup']!='bird' and all((i,t) in V for t in ts)]
 if len(ids)<8:continue
 # A compatibility edge means all six trait comparisons are meaningfully separated.
 edges={i:set() for i in ids}
 for a,b in itertools.combinations(ids,2):
  ok=True
  for t in ts:
   x,y=V[(a,t)],V[(b,t)]
   if x['sex']!=y['sex'] or x['lifeStage']!=y['lifeStage'] or max(x['valueNumeric'],y['valueNumeric'])/min(x['valueNumeric'],y['valueNumeric'])<1.05-1e-12 or (x.get('valueMin',x['valueNumeric'])<=y.get('valueMax',y['valueNumeric']) and y.get('valueMin',y['valueNumeric'])<=x.get('valueMax',x['valueNumeric'])):ok=False;break
  if ok:edges[a].add(b);edges[b].add(a)
 def visit(chosen,candidates):
  if len(found)>=6:return
  if len(chosen)==8:
   ed=s['editorial'](ts,chosen)
   if not ed:return
   winners=[max(chosen,key=lambda a:V[(a,t)]['valueNumeric']) if T[t]['direction']=='higher_wins' else min(chosen,key=lambda a:V[(a,t)]['valueNumeric']) for t in ts]
   if len(set(winners))!=len(ts):return
   sig=tuple(sorted(chosen))
   if sig in seen or any(len(set(chosen)&set(b['animalIds']))>6 for b in found):return
   seen.add(sig);bt=s['kind'](chosen);fp='expert|'+bt+'|'+','.join(chosen)+'|'+','.join(ts)

   b=dict(id=hashlib.sha256(fp.encode()).hexdigest()[:16],mode='expert',boardType=bt,title=s['title'](chosen),animalIds=chosen,traitIds=list(ts),editorial=ed);found.append(b);print('FOUND',b,flush=True);return
  if len(chosen)+len(candidates)<8:return
  while candidates:
   a=candidates[0];candidates=candidates[1:]
   visit(chosen+[a],[b for b in candidates if b in edges[a]])
 visit([],ids)
 if len(found)>=6:break
print('found',len(found),flush=True)
path=ROOT/'data/animalstats/candidates.json'
data=json.loads(path.read_text());data['boards']=[b for b in data['boards'] if b['mode']!='expert']+found
path.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
